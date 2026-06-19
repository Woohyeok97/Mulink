import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import type { SessionTokens } from './session-ticket.service';
import type { KakaoProfile } from './kakao-oauth.service';

// service_role 키로 동작하는 관리자 클라이언트.
// ⚠️ 이 키는 DB 전체 권한이라 서버에서만 쓴다. (검증용 SupabaseService와 분리)
@Injectable()
export class SupabaseAdminService {
  private client: ReturnType<typeof createClient>;

  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL ?? 'http://localhost',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder',
      {
        auth: { persistSession: false, autoRefreshToken: false },
        // Node 20은 네이티브 WebSocket이 없어 ws를 transport로 주입한다.
        realtime: { transport: ws as any },
      },
    );
  }

  // 카카오 프로필로 Supabase 세션(access/refresh)을 발급한다.
  // 1) 합성 이메일로 magiclink 생성 (유저 없으면 자동 생성·있으면 재사용 = 멱등)
  // 2) 거기서 나온 hashed_token을 verifyOtp(token_hash)로 검증해 세션 획득
  async issueSession(profile: KakaoProfile): Promise<SessionTokens> {
    const email = `${profile.kakaoId}@kakao.local`;

    const { data: linkData, error: linkError } = await this.client.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        // user_metadata에 실어두면 verifyOtp가 만든 User에 반영되어
        // 기존 extractKakaoProfile(provider_id/name)이 그대로 읽는다.
        data: { provider: 'kakao', provider_id: profile.kakaoId, name: profile.nickname },
      },
    });
    if (linkError || !linkData) {
      throw new InternalServerErrorException('Supabase 매직링크 생성 실패');
    }

    // ⚠️ 응답 필드는 hashed_token, verifyOtp 파라미터는 token_hash (이름 다름)
    const { data: otpData, error: otpError } = await this.client.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });
    if (otpError || !otpData.session) {
      throw new InternalServerErrorException('Supabase 세션 발급 실패');
    }

    return {
      accessToken: otpData.session.access_token,
      refreshToken: otpData.session.refresh_token,
    };
  }
}
