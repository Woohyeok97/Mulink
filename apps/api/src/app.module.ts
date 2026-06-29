import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CoachModule } from './coach/coach.module';
import { LessonModule } from './lesson/lesson.module';

@Module({
  imports: [PrismaModule, AuthModule, CoachModule, LessonModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
