import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LessonRequestController } from './lesson-request.controller';
import { LessonRequestService } from './lesson-request.service';

@Module({
  imports: [AuthModule],
  controllers: [LessonRequestController],
  providers: [LessonRequestService],
})
export class LessonRequestModule {}
