import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaService를 앱 전역에 제공하는 모듈.
 *
 * - @Global() 덕분에 다른 모듈에서 imports에 PrismaModule을 매번 넣지 않아도
 *   생성자에서 PrismaService를 바로 주입받을 수 있다.
 * - exports에 등록해야 다른 모듈이 PrismaService를 쓸 수 있다.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
