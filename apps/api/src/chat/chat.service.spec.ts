import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: {
    lessonProposal: { findUnique: jest.Mock };
    chatRoom: { findUnique: jest.Mock; create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      lessonProposal: { findUnique: jest.fn() },
      chatRoom: { findUnique: jest.fn(), create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ChatService);
  });

  // 학생이 자기 제안이 아닌 방을 열려 하면 막는다
  it('제안의 학생이 아니면 방 생성을 거부한다', async () => {
    prisma.lessonProposal.findUnique.mockResolvedValue({
      id: 'p1',
      coachId: 'coach1',
      request: { studentId: 'other-student' },
    });
    await expect(
      service.createOrGetRoom('me-student', { proposalId: 'p1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // 이미 방이 있으면 새로 만들지 않고 기존 방을 반환한다(멱등)
  it('이미 방이 있으면 기존 방을 반환한다', async () => {
    prisma.lessonProposal.findUnique.mockResolvedValue({
      id: 'p1',
      coachId: 'coach1',
      request: { studentId: 'me-student' },
    });
    prisma.chatRoom.findUnique.mockResolvedValue({ id: 'room1', proposalId: 'p1' });
    const room = await service.createOrGetRoom('me-student', { proposalId: 'p1' });
    expect(room.id).toBe('room1');
    expect(prisma.chatRoom.create).not.toHaveBeenCalled();
  });
});
