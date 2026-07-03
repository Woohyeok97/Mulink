import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LessonProposalController } from './lesson-proposal.controller';
import { LessonProposalService } from './lesson-proposal.service';

@Module({
  imports: [AuthModule],
  controllers: [LessonProposalController],
  providers: [LessonProposalService],
})
export class LessonProposalModule {}
