import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { REDIS } from './redis.provider';

// 세션 토큰
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

// 토큰을 URL에 노출시키지 않고, 진짜 토큰은 서버 밖 Redis에 잠깐 두고 web에는 1회용 sessionCode만 넘김 (호텔 프런트가 열쇠 대신 교환권을 주는 방식)
// Redis에 두는 이유: 재배포로 프로세스가 교체돼도, 서버를 여러 대로 늘려도 교환권이 유실되지 않게 (프로세스 메모리 Map은 둘 다에서 유실됨)
@Injectable()
export class SessionCodeService implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  // 토큰을 Redis에 저장하고 sessionCode을 돌려준다 -> EX로 기본 30초 후 Redis가 자동 만료
  async createSessionCode(
    tokens: SessionTokens,
    ttlSeconds = 30,
  ): Promise<string> {
    const code = randomUUID();
    await this.redis.set(code, JSON.stringify(tokens), 'EX', ttlSeconds);
    return code;
  }

  // sessionCode으로 세션 토큰을 Redis에서 꺼내 반환 -> GETDEL로 꺼내기+삭제를 원자적으로 (동시 요청의 이중 소비 차단), 없거나 만료면 null
  async consumeSessionCode(code: string): Promise<SessionTokens | null> {
    const raw = await this.redis.getdel(code);
    if (!raw) return null;
    return JSON.parse(raw) as SessionTokens;
  }

  // 앱 종료 시 Redis 연결 정리
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}

// ─────────────────────────────────────────────────────────────
// [학습용 보존] Redis 이전 전, 프로세스 메모리 Map에 저장하던 옛 구현.
// 재배포·수평 확장 시 교환권이 유실되는 결함이 있어 위 Redis 방식으로 교체함.
// (평소라면 데드 코드는 지우지만, before/after 대조를 위해 요청에 따라 남겨둠)
//
// @Injectable()
// export class SessionCodeService {
//   private readonly store = new Map<
//     string,
//     { tokens: SessionTokens; expiresAt: number }
//   >();
//
//   // 토큰을 서버측 메모리에 저장하고 sessionCode을 돌려준다 -> 기본 30초 후 만료
//   createSessionCode(tokens: SessionTokens, ttlSeconds = 30): string {
//     this.purgeExpired(); // 소비되지 않고 만료된 sessionCode이 쌓이지 않도록 발급 때마다 청소 (메모리 누수 방지)
//     const code = randomUUID();
//     this.store.set(code, {
//       tokens,
//       expiresAt: Date.now() + ttlSeconds * 1000,
//     });
//     return code;
//   }
//
//   // sessionCode으로 세션 토큰을 서버 메모리에서 꺼내 반환 -> 꺼내면 즉시 삭제, 없거나 만료면 null
//   consumeSessionCode(code: string): SessionTokens | null {
//     const entry = this.store.get(code);
//     if (!entry) return null;
//     this.store.delete(code);
//     if (Date.now() >= entry.expiresAt) return null;
//     return entry.tokens;
//   }
//
//   // 만료된 sessionCode을 맵에서 제거한다. (소비되지 않은 sessionCode의 메모리 누수 방지)
//   private purgeExpired(): void {
//     const now = Date.now();
//     for (const [code, entry] of this.store) {
//       if (now >= entry.expiresAt) this.store.delete(code);
//     }
//   }
// }
// ─────────────────────────────────────────────────────────────
