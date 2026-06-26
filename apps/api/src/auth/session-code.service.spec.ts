import { SessionCodeService } from './session-code.service';

describe('SessionCodeService', () => {
  it('createSessionCode 후 consumeSessionCode하면 토큰을 돌려준다', () => {
    const service = new SessionCodeService();
    const tokens = { accessToken: 'a', refreshToken: 'r' };
    const code = service.createSessionCode(tokens);
    expect(service.consumeSessionCode(code)).toEqual(tokens);
  });

  it('consumeSessionCode는 1회용이라 두 번째는 null', () => {
    const service = new SessionCodeService();
    const code = service.createSessionCode({ accessToken: 'a', refreshToken: 'r' });
    service.consumeSessionCode(code);
    expect(service.consumeSessionCode(code)).toBeNull();
  });

  it('없는 sessionCode는 null', () => {
    const service = new SessionCodeService();
    expect(service.consumeSessionCode('nope')).toBeNull();
  });

  it('만료된 sessionCode는 null', () => {
    const service = new SessionCodeService();
    const code = service.createSessionCode({ accessToken: 'a', refreshToken: 'r' }, 0);
    // ttl 0초 → 발급 즉시 만료
    expect(service.consumeSessionCode(code)).toBeNull();
  });

  it('새 createSessionCode 시 소비되지 않은 만료 sessionCode를 청소한다', () => {
    const service = new SessionCodeService();
    // 소비하지 않고 만료시킨 sessionCode
    service.createSessionCode({ accessToken: 'a', refreshToken: 'r' }, 0);
    // 새 발급이 일어나면 위 만료 sessionCode가 제거되어야 한다 (메모리 누수 방지)
    service.createSessionCode({ accessToken: 'b', refreshToken: 'r2' });
    const store = (service as unknown as { store: Map<string, unknown> }).store;
    expect(store.size).toBe(1);
  });
});
