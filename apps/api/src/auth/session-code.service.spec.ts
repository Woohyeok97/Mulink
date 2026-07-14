import Redis from 'ioredis';
import { SessionCodeService } from './session-code.service';

// 진짜 로컬 Redis에 붙여 검증한다 (docker compose의 redis 컨테이너 필요, CI는 services.redis 사용)
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

describe('SessionCodeService', () => {
  let redis: Redis;
  let service: SessionCodeService;

  beforeAll(() => {
    redis = new Redis(REDIS_URL);
  });

  // 각 테스트 전에 저장소를 비워 테스트 간 코드가 섞이지 않게 한다
  beforeEach(async () => {
    await redis.flushall();
    service = new SessionCodeService(redis);
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('createSessionCode 후 consumeSessionCode하면 토큰을 돌려준다', async () => {
    const tokens = { accessToken: 'a', refreshToken: 'r' };
    const code = await service.createSessionCode(tokens);
    expect(await service.consumeSessionCode(code)).toEqual(tokens);
  });

  it('consumeSessionCode는 1회용이라 두 번째는 null', async () => {
    const code = await service.createSessionCode({
      accessToken: 'a',
      refreshToken: 'r',
    });
    await service.consumeSessionCode(code);
    expect(await service.consumeSessionCode(code)).toBeNull();
  });

  it('없는 sessionCode는 null', async () => {
    expect(await service.consumeSessionCode('nope')).toBeNull();
  });

  it('만료된 sessionCode는 null (TTL 경과)', async () => {
    const code = await service.createSessionCode({
      accessToken: 'a',
      refreshToken: 'r',
    });
    // TTL을 짧게 덮어써 만료를 강제 (운영 인터페이스는 초 단위라 테스트에서 직접 px로 조정)
    await redis.pexpire(code, 30);
    await new Promise((r) => setTimeout(r, 60));
    expect(await service.consumeSessionCode(code)).toBeNull();
  });

  // GETDEL의 존재 이유: 같은 코드로 동시에 소비해도 딱 하나만 토큰을 받는다 (이중 소비 차단)
  it('동시 소비 시 하나만 성공한다 (원자성)', async () => {
    const code = await service.createSessionCode({
      accessToken: 'a',
      refreshToken: 'r',
    });
    const [first, second] = await Promise.all([
      service.consumeSessionCode(code),
      service.consumeSessionCode(code),
    ]);
    const successes = [first, second].filter((v) => v !== null);
    expect(successes).toHaveLength(1);
  });
});
