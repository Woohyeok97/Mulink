import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LessonRequestService } from './lesson-request.service';

describe('LessonRequestService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    lessonRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    lessonProposal: { findMany: jest.fn() },
  };
  const service = new LessonRequestService(prisma as any);

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

  describe('getMyLessonRequest', () => {
    it('제안을 최신순으로 include하고 coachProfile로 평탄화해 반환한다', async () => {
      const proposalCreatedAt = new Date('2026-07-03T00:00:00.000Z');
      prisma.lessonRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        studentId: 'uuid-1',
        region: 'SEOUL',
        goal: 'g',
        genre: 'POP',
        createdAt: new Date(),
        proposals: [
          {
            id: 'p-1',
            message: '안녕',
            createdAt: proposalCreatedAt,
            coach: {
              coachProfile: { activityName: '김보컬', region: 'SEOUL' },
            },
          },
        ],
      });

      const result = await service.getMyLessonRequest('uuid-1');

      // include로 proposals(최신순) + coach.coachProfile 요청 확인
      expect(prisma.lessonRequest.findFirst).toHaveBeenCalledWith({
        where: { studentId: 'uuid-1' },
        include: {
          proposals: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              message: true,
              createdAt: true,
              coach: {
                select: {
                  coachProfile: {
                    select: { activityName: true, region: true },
                  },
                },
              },
            },
          },
        },
      });
      // coach.coachProfile 한 겹을 벗겨 coachProfile 키로 평탄화
      expect(result!.proposals[0]).toEqual({
        id: 'p-1',
        message: '안녕',
        createdAt: proposalCreatedAt,
        coachProfile: { activityName: '김보컬', region: 'SEOUL' },
      });
    });

    it('신청이 없으면 null을 반환한다', async () => {
      prisma.lessonRequest.findFirst.mockResolvedValue(null);
      expect(await service.getMyLessonRequest('uuid-1')).toBeNull();
    });
  });

  describe('getOpenLessonRequests', () => {
    it('학생이 호출하면 ForbiddenException을 던진다', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        role: 'STUDENT',
      });
      await expect(service.getOpenLessonRequests('uuid-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('코치가 호출하면 각 신청에 isProposed와 studentNickname을 붙여 반환한다', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'coach-1',
        role: 'COACH',
      });
      prisma.lessonRequest.findMany.mockResolvedValue([
        {
          id: 'req-1',
          region: 'SEOUL',
          goal: 'g1',
          genre: 'POP',
          createdAt: new Date(),
          student: { nickname: '김민지' },
        },
        {
          id: 'req-2',
          region: 'BUSAN',
          goal: 'g2',
          genre: 'ROCK',
          createdAt: new Date(),
          student: { nickname: '이준호' },
        },
      ]);
      // 코치가 이미 req-1에 제안함
      prisma.lessonProposal.findMany.mockResolvedValue([
        { requestId: 'req-1' },
      ]);

      const result = await service.getOpenLessonRequests('coach-1');

      // student 관계를 닉네임만 include하는지 확인
      expect(prisma.lessonRequest.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: { student: { select: { nickname: true } } },
      });
      // 평탄화 결과
      expect(result[0].studentNickname).toBe('김민지');
      expect(result[0].isProposed).toBe(true);
      expect(result[1].studentNickname).toBe('이준호');
      expect(result[1].isProposed).toBe(false);
      // 내부 관계 키는 노출하지 않음
      expect((result[0] as Record<string, unknown>).student).toBeUndefined();
    });
  });

  describe('removeLessonRequest', () => {
    it('정상 취소 시 lessonRequest를 삭제하고 반환한다', async () => {
      prisma.lessonRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        studentId: 'uuid-1',
      });
      prisma.lessonRequest.delete.mockResolvedValue({
        id: 'req-1',
        studentId: 'uuid-1',
      });

      const result = await service.removeLessonRequest('uuid-1', 'req-1');

      expect(prisma.lessonRequest.delete).toHaveBeenCalledWith({
        where: { id: 'req-1' },
      });
      expect(result.id).toBe('req-1');
    });

    it('존재하지 않는 id면 NotFoundException을 던진다', async () => {
      prisma.lessonRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.removeLessonRequest('uuid-1', 'not-exist'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.lessonRequest.delete).not.toHaveBeenCalled();
    });

    it('다른 사람의 신청이면 ForbiddenException을 던진다', async () => {
      prisma.lessonRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        studentId: 'uuid-other',
      });

      await expect(
        service.removeLessonRequest('uuid-1', 'req-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.lessonRequest.delete).not.toHaveBeenCalled();
    });
  });
});
