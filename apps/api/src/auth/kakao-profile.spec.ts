import { extractKakaoProfile } from './kakao-profile';

describe('extractKakaoProfile', () => {
  it('identities의 kakao id와 user_metadata.name을 뽑는다', () => {
    const user: any = {
      id: 'uuid-1',
      user_metadata: { name: '홍길동' },
      identities: [{ provider: 'kakao', id: '12345' }],
    };
    expect(extractKakaoProfile(user)).toEqual({ kakaoId: '12345', nickname: '홍길동' });
  });

  it('닉네임/provider id가 없으면 기본값(uid, 카카오사용자)을 쓴다', () => {
    const user: any = { id: 'uuid-1', user_metadata: {}, identities: [] };
    expect(extractKakaoProfile(user)).toEqual({ kakaoId: 'uuid-1', nickname: '카카오사용자' });
  });
});
