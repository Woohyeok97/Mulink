import type { User } from '@supabase/supabase-js';

export interface KakaoProfile {
  kakaoId: string;
  nickname: string;
}

// ⚠️ user_metadata는 인가 판단에 쓰지 않는다. 닉네임 표시/최초 저장 용도만.
export function extractKakaoProfile(user: User): KakaoProfile {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const identity = user.identities?.find((i) => i.provider === 'kakao');
  const kakaoId =
    identity?.id ??
    (meta.provider_id as string) ??
    (meta.sub as string) ??
    user.id;
  const nickname =
    (meta.name as string) ??
    (meta.full_name as string) ??
    (meta.nickname as string) ??
    (meta.preferred_username as string) ??
    '카카오사용자';
  return { kakaoId: String(kakaoId), nickname: String(nickname) };
}
