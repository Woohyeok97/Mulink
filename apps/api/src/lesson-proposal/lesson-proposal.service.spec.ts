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
    lessonProposal: { create: jest.fn() },
  };
  const service = new LessonProposalService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('빈 message면 BadRequestException을 던진다', async () => {
    await expect(
      service.createProposal('coach-1', 'req-1', { message: '  ' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.lessonProposal.create).not.toHaveBeenCalled();
  });

  it('학생이 제안하면 ForbiddenException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'stu-1', role: 'STUDENT' });
    await expect(
      service.createProposal('stu-1', 'req-1', { message: '안녕' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.lessonProposal.create).not.toHaveBeenCalled();
  });

  it('삭제된(없는) 신청에 제안하면 NotFoundException을 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'coach-1', role: 'COACH' });
    prisma.lessonRequest.findUnique.mockResolvedValue(null);
    await expect(
      service.createProposal('coach-1', 'gone', { message: '안녕' }),
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
      service.createProposal('coach-1', 'req-1', { message: '안녕' }),
    ).rejects.toThrow(ConflictException);
  });

  it('정상 제안 시 message를 trim해 생성한다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'coach-1', role: 'COACH' });
    prisma.lessonRequest.findUnique.mockResolvedValue({ id: 'req-1' });
    prisma.lessonProposal.create.mockResolvedValue({ id: 'p-1' });

    const result = await service.createProposal('coach-1', 'req-1', {
      message: '  안녕  ',
    });

    expect(prisma.lessonProposal.create).toHaveBeenCalledWith({
      data: { requestId: 'req-1', coachId: 'coach-1', message: '안녕' },
    });
    expect(result.id).toBe('p-1');
  });
});
