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
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('채팅방을 찾을 수 없습니다.');
    }
    if (room.studentId !== userId && room.coachId !== userId) {
      throw new ForbiddenException('참여 중인 채팅방이 아닙니다.');
    }
    return room;
  }
}
