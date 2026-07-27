import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateChatRoomDto } from './dto/create-chat-room.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // 채팅방 생성/취득 (학생만). 제안(학생-코치 쌍)당 방 1개 — 이미 있으면 기존 방 반환(멱등)
  async createOrGetRoom(userId: string, dto: CreateChatRoomDto) {
    // 1단계: 대상 제안 + 그 신청의 학생 조회 (방 개설 권한은 학생에게만)
    const proposal = await this.prisma.lessonProposal.findUnique({
      where: { id: dto.proposalId },
      include: { request: { select: { studentId: true } } },
    });
    if (!proposal) {
      throw new NotFoundException('레슨 제안을 찾을 수 없습니다.');
    }
    // 채팅 개시는 학생만 — 제안이 달린 신청의 주인이어야 함
    if (proposal.request.studentId !== userId) {
      throw new ForbiddenException(
        '본인 신청의 제안에서만 채팅을 시작할 수 있습니다.',
      );
    }

    // 2단계: 이미 방이 있으면 그대로 반환 (멱등)
    const existing = await this.prisma.chatRoom.findUnique({
      where: { proposalId: dto.proposalId },
    });
    if (existing) return existing;

    // 3단계: 새 방 생성 (학생 = 신청 주인, 코치 = 제안 발신자)
    return this.prisma.chatRoom.create({
      data: {
        proposalId: dto.proposalId,
        studentId: proposal.request.studentId,
        coachId: proposal.coachId,
      },
    });
  }

  // 내가 이 방의 당사자인지 검증하고 방을 반환 (아니면 예외) — 히스토리·소켓 접근 공용
  async getRoomForParticipant(userId: string, roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    }
    if (room.studentId !== userId && room.coachId !== userId) {
      throw new ForbiddenException('참여 중인 채팅방이 아닙니다.');
    }
    return room;
  }

  // 방 초기 내역 — 전체를 id 오름차순으로 (MVP: 페이지네이션 없음)
  async getMessages(userId: string, roomId: string) {
    await this.getRoomForParticipant(userId, roomId);
    return this.prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { id: 'asc' },
    });
  }

  // 재동기화 — 이 id 초과 메시지만 (끊긴 사이 쌓인 것). id가 단조증가라 WHERE id > ?
  async getMessagesAfter(userId: string, roomId: string, afterId: number) {
    await this.getRoomForParticipant(userId, roomId);
    return this.prisma.chatMessage.findMany({
      where: { roomId, id: { gt: afterId } },
      orderBy: { id: 'asc' },
    });
  }

  // 메시지 저장 (소켓 chat:send에서 호출) — 저장이 브로드캐스트보다 먼저 와야 유실 방지.
  // sendMessageKey로 upsert해 재전송(끊김 중 보낸 것의 재연결 시 재전송) 중복 저장을 막는다(멱등).
  // 같은 (roomId, sendMessageKey)면 기존 메시지를 그대로 반환 → 새 id로 또 저장되지 않음.
  // (DB 컬럼명은 아직 clientMsgId — 마이그레이션은 나중에)
  async saveMessage(
    userId: string,
    roomId: string,
    content: string,
    sendMessageKey: string,
  ) {
    await this.getRoomForParticipant(userId, roomId);
    return this.prisma.chatMessage.upsert({
      where: { roomId_clientMsgId: { roomId, clientMsgId: sendMessageKey } },
      create: {
        roomId,
        senderId: userId,
        content,
        clientMsgId: sendMessageKey,
      },
      update: {}, // 이미 있으면 그대로 — 재전송이 와도 내용·id 불변
    });
  }

  // 읽음 커서 갱신 — 뷰어 역할(student/coach)에 맞는 컬럼을 올린다
  async markRead(userId: string, roomId: string, lastReadMessageId: number) {
    const room = await this.getRoomForParticipant(userId, roomId);
    const field =
      room.studentId === userId
        ? 'studentLastReadMessageId'
        : 'coachLastReadMessageId';
    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { [field]: lastReadMessageId },
    });
    return { roomId, lastReadMessageId, readerId: userId };
  }

  // 내 채팅방 목록 — 각 방에 상대 표시정보·마지막 메시지·안읽음 수 (화면 지향)
  async getMyRooms(userId: string) {
    const rooms = await this.prisma.chatRoom.findMany({
      where: { OR: [{ studentId: userId }, { coachId: userId }] },
      include: {
        coach: {
          select: {
            nickname: true,
            coachProfile: { select: { activityName: true, imageUrl: true } },
          },
        },
        student: { select: { nickname: true } },
        messages: { orderBy: { id: 'desc' }, take: 1 }, // 마지막 메시지 1건
      },
    });

    // 방마다 안읽음 수를 병렬 집계 후 응답 형태로 평탄화
    const withMeta = await Promise.all(
      rooms.map(async (room) => {
        const iAmStudent = room.studentId === userId;
        const myLastRead = iAmStudent
          ? room.studentLastReadMessageId
          : room.coachLastReadMessageId;
        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            roomId: room.id,
            id: { gt: myLastRead ?? 0 },
            senderId: { not: userId },
          },
        });
        const last = room.messages[0] ?? null;
        return {
          id: room.id,
          partner: iAmStudent
            ? {
                name:
                  room.coach.coachProfile?.activityName ?? room.coach.nickname,
                imageUrl: room.coach.coachProfile?.imageUrl ?? null,
              }
            : { name: room.student.nickname, imageUrl: null },
          lastMessage: last
            ? { content: last.content, createdAt: last.createdAt }
            : null,
          unreadCount,
          createdAt: room.createdAt,
        };
      }),
    );

    // 최근 대화순 — 마지막 메시지 시각 우선, 없으면 방 생성 시각
    return withMeta.sort((a, b) => {
      const at = a.lastMessage?.createdAt ?? a.createdAt;
      const bt = b.lastMessage?.createdAt ?? b.createdAt;
      return new Date(bt).getTime() - new Date(at).getTime();
    });
  }
}
