import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';

// 코치 관련 기능 묶음 -> SupabaseAuthGuard를 쓰기 위해 AuthModule을 import (PrismaService는 PrismaModule이 @Global이라 import 불필요)
@Module({
  imports: [AuthModule],
  controllers: [CoachController],
  providers: [CoachService],
})
export class CoachModule {}
