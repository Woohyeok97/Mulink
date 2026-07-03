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
export class LessonRequestService {
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
}
