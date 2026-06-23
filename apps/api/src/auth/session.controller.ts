import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { SessionCodeService, type SessionTokens } from './session-code.service';

// web이 세션 코드를 -> 세션 토큰으로 교환하는 컨트롤러 (로그인 직후 1회 호출, 가드 미적용)
@Controller('auth/session')
export class SessionController {
  constructor(private readonly sessionCode: SessionCodeService) {}

  // 세션 코드를 소비해 세션 토큰을 돌려줌 (만료/위조/재사용이면 거부)
  @Post('exchange')
  exchangeSessionCode(@Body() body: { code: string }): SessionTokens {
    const sessionTokens = this.sessionCode.consumeSessionCode(body.code);
    if (!sessionTokens)
      throw new UnauthorizedException('유효하지 않은 sessionCode');
    return sessionTokens;
  }
}
