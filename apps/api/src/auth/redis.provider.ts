import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

// 주입 토큰: @Inject(REDIS)로 이 연결을 꺼내 쓴다
export const REDIS = 'REDIS_CLIENT';

// Redis 연결을 앱 전체가 공유하는 단일 인스턴스로 등록.
// REDIS_URL(예: redis://redis:6379)로 연결하고, ioredis가 재연결을 알아서 처리한다.
export const RedisProvider: Provider = {
  provide: REDIS,
  useFactory: () => {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    return new Redis(url);
  },
};
