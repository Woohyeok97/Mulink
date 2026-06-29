import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LessonService } from './lesson.service';

describe('LessonService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    lessonRequest: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const service = new LessonService(prisma as any);

  const validDto = {
    region: 'SEOUL' as const,
    goal: '음정 교정',
    genre: 'POP' as const,
    voiceAudioUrl: 'https://example.com/audio.mp3',
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
      voiceAudioUrl: 'https://example.com/audio.mp3',
      createdAt: new Date(),
    });

    const result = await service.createLessonRequest('uuid-1', validDto);

    expect(prisma.lessonRequest.create).toHaveBeenCalledWith({
      data: {
        studentId: 'uuid-1',
        region: 'SEOUL',
        goal: '음정 교정',
        genre: 'POP',
        voiceAudioUrl: 'https://example.com/audio.mp3',
      },
    });
    expect(result.id).toBe('req-1');
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
});
