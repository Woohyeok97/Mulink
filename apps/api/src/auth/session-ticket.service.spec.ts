import { SessionTicketService } from './session-ticket.service';

describe('SessionTicketService', () => {
  it('issue 후 consume하면 토큰을 돌려준다', () => {
    const service = new SessionTicketService();
    const tokens = { accessToken: 'a', refreshToken: 'r' };
    const ticket = service.issue(tokens);
    expect(service.consume(ticket)).toEqual(tokens);
  });

  it('consume은 1회용이라 두 번째는 null', () => {
    const service = new SessionTicketService();
    const ticket = service.issue({ accessToken: 'a', refreshToken: 'r' });
    service.consume(ticket);
    expect(service.consume(ticket)).toBeNull();
  });

  it('없는 ticket은 null', () => {
    const service = new SessionTicketService();
    expect(service.consume('nope')).toBeNull();
  });

  it('만료된 ticket은 null', () => {
    const service = new SessionTicketService();
    const ticket = service.issue({ accessToken: 'a', refreshToken: 'r' }, 0);
    // ttl 0초 → 발급 즉시 만료
    expect(service.consume(ticket)).toBeNull();
  });

  it('새 issue 시 소비되지 않은 만료 ticket을 청소한다', () => {
    const service = new SessionTicketService();
    // 소비하지 않고 만료시킨 ticket
    service.issue({ accessToken: 'a', refreshToken: 'r' }, 0);
    // 새 발급이 일어나면 위 만료 ticket이 제거되어야 한다 (메모리 누수 방지)
    service.issue({ accessToken: 'b', refreshToken: 'r2' });
    const store = (service as unknown as { store: Map<string, unknown> }).store;
    expect(store.size).toBe(1);
  });
});
