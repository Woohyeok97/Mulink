import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoachProfileController } from './coach-profile.controller';
import { CoachProfileService } from './coach-profile.service';

// 코치 프로필 관련 기능 묶음 -> SupabaseAuthGuard를 쓰기 위해 AuthModule을 import (PrismaService는 PrismaModule이 @Global이라 import 불필요)
@Module({
  imports: [AuthModule],
  controllers: [CoachProfileController],
  providers: [CoachProfileService],
})
export class CoachProfileModule {}
