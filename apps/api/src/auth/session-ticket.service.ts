import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

// web으로 넘길 세션 토큰 한 쌍.
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

// 토큰을 URL에 노출하지 않으려고, 진짜 토큰은 서버 메모리에 잠깐 두고
// web에는 1회용 ticket만 넘긴다. (호텔 프런트가 열쇠 대신 교환권을 주는 방식)
@Injectable()
export class SessionTicketService {
  private readonly store = new Map<
    string,
    { tokens: SessionTokens; expiresAt: number }
  >();

  // 토큰을 서버측 메모리에 저장하고 ticket을 돌려준다. 기본 30초 후 만료.
  issue(tokens: SessionTokens, ttlSeconds = 30): string {
    this.purgeExpired(); // 소비되지 않고 만료된 ticket이 쌓이지 않도록 발급 때마다 청소 (메모리 누수 방지)
    const ticket = randomUUID();
    this.store.set(ticket, {
      tokens,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return ticket;
  }

  // ticket으로 토큰을 서버 메모리에서 꺼냄 -> 꺼내면 즉시 삭제, 없거나 만료면 null
  consume(ticket: string): SessionTokens | null {
    const entry = this.store.get(ticket);
    if (!entry) return null;
    this.store.delete(ticket);
    if (Date.now() >= entry.expiresAt) return null;
    return entry.tokens;
  }

  // 만료된 ticket을 맵에서 제거한다. (소비되지 않은 ticket의 메모리 누수 방지)
  private purgeExpired(): void {
    const now = Date.now();
    for (const [ticket, entry] of this.store) {
      if (now >= entry.expiresAt) this.store.delete(ticket);
    }
  }
}
