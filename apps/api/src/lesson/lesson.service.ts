import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLessonRequestDto } from './dto/create-lesson-request.dto';

@Injectable()
export class LessonService {
  constructor(private readonly prisma: PrismaService) {}

  // 레슨 신청
  async createLessonRequest(userId: string, dto: CreateLessonRequestDto) {
    if (!dto.goal?.trim()) {
      throw new BadRequestException('레슨 목표를 입력해주세요.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    const existing = await this.prisma.lessonRequest.findFirst({
      where: { studentId: userId },
    });
    if (existing) {
      throw new ConflictException('이미 레슨 신청 내역이 있습니다.');
    }

    return this.prisma.lessonRequest.create({
      data: {
        studentId: userId,
        region: dto.region,
        goal: dto.goal.trim(),
        genre: dto.genre,
      },
    });
  }

  // 내 레슨 신청 조회
  async getMyLessonRequest(userId: string) {
    return this.prisma.lessonRequest.findFirst({
      where: { studentId: userId },
    });
  }

  // 레슨 신청 취소
  async removeLessonRequest(userId: string, lessonRequestId: string) {
    const lessonRequest = await this.prisma.lessonRequest.findUnique({
      where: { id: lessonRequestId },
    });
    if (!lessonRequest) {
      throw new NotFoundException('레슨 신청을 찾을 수 없습니다.');
    }
    if (lessonRequest.studentId !== userId) {
      throw new ForbiddenException('본인의 레슨 신청만 취소할 수 있습니다.');
    }
    return this.prisma.lessonRequest.delete({ where: { id: lessonRequestId } });
  }

  // 레슨 제안 리스트 조회 (임시 Mock)
  getMyLessonOffers(): {
    id: string;
    coach: { id: string; activityName: string; region: string; career: number };
    message: string;
    createdAt: string;
  }[] {
    return [
      {
        id: 'mock-offer-1',
        coach: {
          id: 'mock-coach-uuid-1',
          activityName: '보이스랩 김선생',
          region: 'SEOUL',
          career: 8,
        },
        message:
          '안녕하세요! 음정 교정에 특화된 레슨을 제공하고 있어요. 함께 성장해봐요.',
        createdAt: '2025-06-20T10:00:00.000Z',
      },
      {
        id: 'mock-offer-2',
        coach: {
          id: 'mock-coach-uuid-2',
          activityName: '보컬 박코치',
          region: 'GYEONGGI',
          career: 5,
        },
        message: '팝과 발라드 전문 코치입니다. 실력 향상을 보장해드려요!',
        createdAt: '2025-06-21T14:30:00.000Z',
      },
      {
        id: 'mock-offer-3',
        coach: {
          id: 'mock-coach-uuid-3',
          activityName: '성악가 이선생',
          region: 'SEOUL',
          career: 12,
        },
        message: '클래식부터 팝까지 폭넓게 가르칩니다. 기초부터 탄탄하게!',
        createdAt: '2025-06-22T09:00:00.000Z',
      },
    ];
  }
}
