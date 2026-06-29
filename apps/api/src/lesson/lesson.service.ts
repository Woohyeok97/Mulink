import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLessonRequestDto } from './dto/create-lesson-request.dto';

@Injectable()
export class LessonService {
  constructor(private readonly prisma: PrismaService) {}

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
}
