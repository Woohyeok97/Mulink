import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CoachProfileModule } from './coach-profile/coach-profile.module';
import { LessonRequestModule } from './lesson-request/lesson-request.module';
import { LessonProposalModule } from './lesson-proposal/lesson-proposal.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UserModule,
    CoachProfileModule,
    LessonRequestModule,
    LessonProposalModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
