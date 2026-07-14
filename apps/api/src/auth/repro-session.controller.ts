// ⚠️ 재현 전용 컨트롤러 (BE-1 세션코드 유실 장애 재현용, 제거 대상).
// Supabase·카카오를 건너뛰고 "세션코드 발급 → 교환"만 격리해 측정한다.
// 목적: Map 저장소가 서버 간 공유되지 않아 발급 서버 ≠ 교환 서버일 때 실패함을 수치로 증명.
import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { SessionCodeService } from './session-code.service';

// 이 컨테이너가 누구인지 알려주는 표식 (compose에서 api1/api2에 다른 값 주입)
// 발급 응답과 교환 응답의 instance가 다르면 "요청이 두 서버로 갈라졌다"는 증거가 된다.
const INSTANCE_ID = process.env.INSTANCE_ID ?? 'unknown';

// 개발 환경이 아니면 이 컨트롤러의 모든 엔드포인트를 막는다 (⚠️ 프로덕션 보안)
function assertDevEnv() {
  if (process.env.NODE_ENV !== 'development') {
    throw new NotFoundException();
  }
}

@Controller('auth/repro')
export class ReproSessionController {
  constructor(private readonly sessionCode: SessionCodeService) {}

  // 세션코드 발급: 외부 호출 없이 더미 토큰을 감싼 1회용 코드를 돌려준다
  @Get('issue')
  async issue() {
    assertDevEnv();
    const code = await this.sessionCode.createSessionCode({
      accessToken: 'repro-access',
      refreshToken: 'repro-refresh',
    });
    return { code, instance: INSTANCE_ID };
  }

  // 세션코드 교환: 코드를 소비해 성공 여부를 돌려준다
  @Get('exchange')
  async exchange(@Query('code') code: string) {
    assertDevEnv();
    const tokens = await this.sessionCode.consumeSessionCode(code);
    // Map에 코드가 없으면(=다른 서버가 발급했거나 재배포로 유실) 소비 실패
    return { ok: tokens !== null, instance: INSTANCE_ID };
  }
}
