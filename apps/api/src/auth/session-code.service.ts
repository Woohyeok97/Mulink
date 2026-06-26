import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

// 세션 토큰
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

// 토큰을 URL에 노출시키지 않고, 진짜 토큰은 서버 메모리에 잠깐 두고 web에는 1회용 sessionCode만 넘김 (호텔 프런트가 열쇠 대신 교환권을 주는 방식)
@Injectable()
export class SessionCodeService {
  private readonly store = new Map<
    string,
    { tokens: SessionTokens; expiresAt: number }
  >();

  // 토큰을 서버측 메모리에 저장하고 sessionCode을 돌려준다 -> 기본 30초 후 만료
  createSessionCode(tokens: SessionTokens, ttlSeconds = 30): string {
    this.purgeExpired(); // 소비되지 않고 만료된 sessionCode이 쌓이지 않도록 발급 때마다 청소 (메모리 누수 방지)
    const code = randomUUID();
    this.store.set(code, {
      tokens,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return code;
  }

  // sessionCode으로 세션 토큰을 서버 메모리에서 꺼내 반환 -> 꺼내면 즉시 삭제, 없거나 만료면 null
  consumeSessionCode(code: string): SessionTokens | null {
    const entry = this.store.get(code);
    if (!entry) return null;
    this.store.delete(code);
    if (Date.now() >= entry.expiresAt) return null;
    return entry.tokens;
  }

  // 만료된 sessionCode을 맵에서 제거한다. (소비되지 않은 sessionCode의 메모리 누수 방지)
  private purgeExpired(): void {
    const now = Date.now();
    for (const [code, entry] of this.store) {
      if (now >= entry.expiresAt) this.store.delete(code);
    }
  }
}
