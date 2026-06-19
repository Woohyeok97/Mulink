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
});
