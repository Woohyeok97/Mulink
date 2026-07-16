import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: {
    lessonProposal: { findUnique: jest.Mock };
    chatRoom: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    chatMessage: { create: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      lessonProposal: { findUnique: jest.fn() },
      chatRoom: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      chatMessage: { create: jest.fn(), findMany: jest.fn() },
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

  // 재동기화는 주어진 id 초과 메시지만 id 오름차순으로 조회한다
  it('getMessagesAfter는 id > after 조건으로 조회한다', async () => {
    prisma.chatRoom.findUnique.mockResolvedValue({
      id: 'room1',
      studentId: 'me',
      coachId: 'coach1',
    });
    prisma.chatMessage.findMany.mockResolvedValue([{ id: 11 }, { id: 12 }]);
    const rows = await service.getMessagesAfter('me', 'room1', 10);
    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
      where: { roomId: 'room1', id: { gt: 10 } },
      orderBy: { id: 'asc' },
    });
    expect(rows).toHaveLength(2);
  });

  // 메시지 저장은 방 참여자만 가능하고 senderId를 호출자로 고정한다
  it('saveMessage는 참여자만 저장하고 senderId를 호출자로 고정한다', async () => {
    prisma.chatRoom.findUnique.mockResolvedValue({
      id: 'room1',
      studentId: 'me',
      coachId: 'coach1',
    });
    prisma.chatMessage.create.mockResolvedValue({
      id: 1,
      roomId: 'room1',
      senderId: 'me',
      content: '안녕',
      createdAt: new Date(),
    });
    const msg = await service.saveMessage('me', 'room1', '안녕');
    expect(prisma.chatMessage.create).toHaveBeenCalledWith({
      data: { roomId: 'room1', senderId: 'me', content: '안녕' },
    });
    expect(msg.senderId).toBe('me');
  });
});
