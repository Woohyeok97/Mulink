import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import {
  SessionTicketService,
  type SessionTokens,
} from './session-ticket.service';

// web이 ticket을 진짜 세션 토큰으로 교환하는 입구. (로그인 직후 1회 호출, 가드 미적용)
@Controller('auth/session')
export class SessionController {
  constructor(private readonly tickets: SessionTicketService) {}

  // ticket을 소비해 토큰을 돌려준다. 만료/위조/재사용이면 거부.
  @Post('exchange')
  exchange(@Body() body: { ticket: string }): SessionTokens {
    const tokens = this.tickets.consume(body.ticket);
    if (!tokens) throw new UnauthorizedException('유효하지 않은 ticket');
    return tokens;
  }
}
