import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LessonService } from './lesson.service';

describe('LessonService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    lessonRequest: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new LessonService(prisma as any);

  const validDto = {
    region: 'SEOUL' as const,
    goal: '음정 교정',
    genre: 'POP' as const,
  };

  beforeEach(() => jest.clearAllMocks());

  it('정상 신청 시 LessonRequest를 생성하고 반환한다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', role: 'STUDENT' });
    prisma.lessonRequest.findFirst.mockResolvedValue(null);
    prisma.lessonRequest.create.mockResolvedValue({
      id: 'req-1',
      studentId: 'uuid-1',
      region: 'SEOUL',
      goal: '음정 교정',
      genre: 'POP',
      createdAt: new Date(),
    });

    const result = await service.createLessonRequest('uuid-1', validDto);

    expect(prisma.lessonRequest.create).toHaveBeenCalledWith({
      data: {
        studentId: 'uuid-1',
        region: 'SEOUL',
        goal: '음정 교정',
        genre: 'POP',
      },
    });
    expect(result.id).toBe('req-1');
  });

  it('목표가 빈 문자열이면 BadRequestException을 던진다', async () => {
    await expect(
      service.createLessonRequest('uuid-1', { ...validDto, goal: '  ' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.lessonRequest.create).not.toHaveBeenCalled();
  });

  it('User가 없으면 NotFoundException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.createLessonRequest('uuid-1', validDto),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.lessonRequest.create).not.toHaveBeenCalled();
  });

  it('이미 신청 내역이 있으면 ConflictException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', role: 'STUDENT' });
    prisma.lessonRequest.findFirst.mockResolvedValue({ id: 'existing-req' });

    await expect(
      service.createLessonRequest('uuid-1', validDto),
    ).rejects.toThrow(ConflictException);
    expect(prisma.lessonRequest.create).not.toHaveBeenCalled();
  });

  describe('cancelLessonRequest', () => {
    it('정상 취소 시 lessonRequest를 삭제하고 반환한다', async () => {
      prisma.lessonRequest.findUnique.mockResolvedValue({ id: 'req-1', studentId: 'uuid-1' });
      prisma.lessonRequest.delete.mockResolvedValue({ id: 'req-1', studentId: 'uuid-1' });

      const result = await service.cancelLessonRequest('uuid-1', 'req-1');

      expect(prisma.lessonRequest.delete).toHaveBeenCalledWith({ where: { id: 'req-1' } });
      expect(result.id).toBe('req-1');
    });

    it('존재하지 않는 id면 NotFoundException을 던진다', async () => {
      prisma.lessonRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelLessonRequest('uuid-1', 'not-exist'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.lessonRequest.delete).not.toHaveBeenCalled();
    });

    it('다른 사람의 신청이면 ForbiddenException을 던진다', async () => {
      prisma.lessonRequest.findUnique.mockResolvedValue({ id: 'req-1', studentId: 'uuid-other' });

      await expect(
        service.cancelLessonRequest('uuid-1', 'req-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.lessonRequest.delete).not.toHaveBeenCalled();
    });
  });
});
