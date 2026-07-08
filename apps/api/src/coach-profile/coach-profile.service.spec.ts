import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CoachProfileService } from './coach-profile.service';

describe('CoachProfileService', () => {
  // 트랜잭션 콜백 안에서 쓰는 목 (update + create + 레슨 신청 삭제)
  const prismaTransaction = {
    user: { update: jest.fn() },
    coachProfile: { create: jest.fn() },
    lessonRequest: { deleteMany: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    // $transaction(콜백) 형태: 콜백에 prismaTransaction 목을 넘겨 실행
    $transaction: jest.fn((callback: any) => callback(prismaTransaction)),
  };
  const service = new CoachProfileService(prisma as any);

  const validDto = { activityName: '보컬코치홍', region: 'SEOUL' as const };

  beforeEach(() => jest.clearAllMocks());

  it('STUDENT가 등록하면 트랜잭션으로 role 승격 + CoachProfile을 생성한다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', role: 'STUDENT' });
    prismaTransaction.coachProfile.create.mockResolvedValue({
      id: 'coach-1',
      userId: 'uuid-1',
      activityName: '보컬코치홍',
      region: 'SEOUL',
    });

    const result = await service.registerCoach('uuid-1', validDto);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaTransaction.user.update).toHaveBeenCalledWith({
      where: { id: 'uuid-1' },
      data: { role: 'COACH' },
    });
    expect(prismaTransaction.coachProfile.create).toHaveBeenCalledWith({
      data: { userId: 'uuid-1', activityName: '보컬코치홍', region: 'SEOUL' },
    });
    expect(prismaTransaction.lessonRequest.deleteMany).toHaveBeenCalledWith({
      where: { studentId: 'uuid-1' },
    });
    expect(result).toEqual({
      id: 'coach-1',
      userId: 'uuid-1',
      activityName: '보컬코치홍',
      region: 'SEOUL',
    });
  });

  it('활동명이 빈 문자열이면 BadRequestException, 트랜잭션을 호출하지 않는다', async () => {
    await expect(
      service.registerCoach('uuid-1', { activityName: '  ', region: 'SEOUL' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('지역이 enum 값이 아니면 BadRequestException, 트랜잭션을 호출하지 않는다', async () => {
    await expect(
      service.registerCoach('uuid-1', {
        activityName: '홍',
        region: 'JEJU' as any,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('이미 COACH면 ConflictException, 트랜잭션을 호출하지 않는다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', role: 'COACH' });
    await expect(service.registerCoach('uuid-1', validDto)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ADMIN이면 ConflictException, 트랜잭션을 호출하지 않는다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'uuid-1', role: 'ADMIN' });
    await expect(service.registerCoach('uuid-1', validDto)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('User가 없으면 NotFoundException, 트랜잭션을 호출하지 않는다', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.registerCoach('uuid-1', validDto)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
