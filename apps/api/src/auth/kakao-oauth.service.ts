import { Injectable, InternalServerErrorException } from '@nestjs/common';

// 카카오에서 받은 유저 식별 정보. (auth.users 메타에 실어 기존 추출 로직과 연결)
export interface KakaoProfile {
  kakaoId: string;
  nickname: string;
}

// 카카오 OAuth 서버와의 통신만 담당한다.
// scope를 직접 지정해 account_email을 빼는 것이 이 전환의 핵심.
@Injectable()
export class KakaoOauthService {
  private readonly restApiKey = process.env.KAKAO_REST_API_KEY!;
  private readonly clientSecret = process.env.KAKAO_CLIENT_SECRET!;
  private readonly redirectUri = process.env.KAKAO_REDIRECT_URI!;

  // 1단계: 사용자를 보낼 카카오 동의 화면 URL. state로 CSRF 방어.
  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.restApiKey,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'profile_nickname profile_image', // account_email 없음
      state,
    });
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  // 2단계: 카카오가 준 code를 카카오 access_token으로 교환.
  async exchangeCodeForToken(code: string): Promise<string> {
    const res = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.restApiKey,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code,
      }),
    });
    if (!res.ok) throw new InternalServerErrorException('카카오 토큰 교환 실패');
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  // 3단계: access_token으로 카카오 유저 정보 조회 → kakaoId/nickname.
  async fetchUserInfo(kakaoAccessToken: string): Promise<KakaoProfile> {
    const res = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });
    if (!res.ok) throw new InternalServerErrorException('카카오 유저 정보 조회 실패');
    const data = (await res.json()) as {
      id: number;
      kakao_account?: { profile?: { nickname?: string } };
    };
    return {
      kakaoId: String(data.id),
      nickname: data.kakao_account?.profile?.nickname ?? '카카오사용자',
    };
  }
}
