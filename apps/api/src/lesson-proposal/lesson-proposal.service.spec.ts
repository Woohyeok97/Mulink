import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { LessonProposalService } from './lesson-proposal.service';

describe('LessonProposalService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    lessonRequest: { findUnique: jest.fn() },
    lessonProposal: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new LessonProposalService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('빈 message면 BadRequestException을 던진다', async () => {
    await expect(
      service.createLessonProposal('coach-1', 'req-1', { message: '  ' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.lessonProposal.create).not.toHaveBeenCalled();
  });

  it('학생이 제안하면 ForbiddenException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'stu-1', role: 'STUDENT' });
    await expect(
      service.createLessonProposal('stu-1', 'req-1', { message: '안녕' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.lessonProposal.create).not.toHaveBeenCalled();
  });

  it('삭제된(없는) 신청에 제안하면 NotFoundException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'coach-1', role: 'COACH' });
    prisma.lessonRequest.findUnique.mockResolvedValue(null);
    await expect(
      service.createLessonProposal('coach-1', 'gone', { message: '안녕' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.lessonProposal.create).not.toHaveBeenCalled();
  });

  it('이미 제안한 신청(P2002)이면 ConflictException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'coach-1', role: 'COACH' });
    prisma.lessonRequest.findUnique.mockResolvedValue({ id: 'req-1' });
    prisma.lessonProposal.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    await expect(
      service.createLessonProposal('coach-1', 'req-1', { message: '안녕' }),
    ).rejects.toThrow(ConflictException);
  });

  it('정상 제안 시 message를 trim해 생성한다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'coach-1', role: 'COACH' });
    prisma.lessonRequest.findUnique.mockResolvedValue({ id: 'req-1' });
    prisma.lessonProposal.create.mockResolvedValue({ id: 'p-1' });

    const result = await service.createLessonProposal('coach-1', 'req-1', {
      message: '  안녕  ',
    });

    expect(prisma.lessonProposal.create).toHaveBeenCalledWith({
      data: { requestId: 'req-1', coachId: 'coach-1', message: '안녕' },
    });
    expect(result.id).toBe('p-1');
  });

  describe('removeLessonProposal', () => {
    it('정상 취소 시 제안을 삭제하고 반환한다', async () => {
      prisma.lessonProposal.findUnique.mockResolvedValue({
        id: 'p-1',
        coachId: 'coach-1',
      });
      prisma.lessonProposal.delete.mockResolvedValue({
        id: 'p-1',
        coachId: 'coach-1',
      });

      const result = await service.removeLessonProposal('coach-1', 'p-1');

      expect(prisma.lessonProposal.delete).toHaveBeenCalledWith({
        where: { id: 'p-1' },
      });
      expect(result.id).toBe('p-1');
    });

    it('존재하지 않는 제안이면 NotFoundException을 던진다', async () => {
      prisma.lessonProposal.findUnique.mockResolvedValue(null);

      await expect(
        service.removeLessonProposal('coach-1', 'gone'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.lessonProposal.delete).not.toHaveBeenCalled();
    });

    it('다른 코치의 제안이면 ForbiddenException을 던진다', async () => {
      prisma.lessonProposal.findUnique.mockResolvedValue({
        id: 'p-1',
        coachId: 'coach-other',
      });

      await expect(
        service.removeLessonProposal('coach-1', 'p-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.lessonProposal.delete).not.toHaveBeenCalled();
    });
  });
});
