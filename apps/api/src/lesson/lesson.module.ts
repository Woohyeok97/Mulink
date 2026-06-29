import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';

@Module({
  imports: [AuthModule],
  controllers: [LessonController],
  providers: [LessonService],
})
export class LessonModule {}
