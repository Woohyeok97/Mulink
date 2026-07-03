import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { CreateLessonProposalDto } from './dto/create-lesson-proposal.dto';

@Injectable()
export class LessonProposalService {
  constructor(private readonly prisma: PrismaService) {}

  // 레슨 제안 생성 (1신청 1제안)
  async createProposal(
    userId: string,
    requestId: string,
    dto: CreateLessonProposalDto,
  ) {
    // 1단계: 한마디 검증 — 공백만이면 거부
    const message = dto.message?.trim();
    if (!message) {
      throw new BadRequestException('제안 한마디를 입력해주세요.');
    }

    // 2단계: 코치 자격 확인 — 학생은 제안할 수 없음
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'COACH') {
      throw new ForbiddenException('코치만 제안할 수 있습니다.');
    }

    // 3단계: 대상 신청 존재 확인 — 그새 삭제됐으면 막는다 (기획 엣지케이스)
    const request = await this.prisma.lessonRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('레슨 신청을 찾을 수 없습니다.');
    }

    // 4단계: 제안 생성. 중복(@@unique 위반)은 DB가 막고 P2002로 던진다 (동시요청 방어)
    try {
      return await this.prisma.lessonProposal.create({
        data: { requestId, coachId: userId, message },
      });
    } catch (err) {
      // 이미 이 신청에 제안한 코치
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('이미 제안한 레슨 신청입니다.');
      }
      throw err;
    }
  }
}
