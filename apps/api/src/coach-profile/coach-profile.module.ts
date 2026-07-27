import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { S3Module } from '../s3/s3.module';
import { CoachProfileController } from './coach-profile.controller';
import { CoachProfileService } from './coach-profile.service';

// 코치 프로필 관련 기능 묶음 -> SupabaseAuthGuard를 쓰기 위해 AuthModule을, presigned URL 발급을 위해 S3Module을 import (PrismaService는 PrismaModule이 @Global이라 import 불필요)
@Module({
  imports: [AuthModule, S3Module],
  controllers: [CoachProfileController],
  providers: [CoachProfileService],
})
export class CoachProfileModule {}
