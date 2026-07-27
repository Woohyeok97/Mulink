import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLessonRequestDto } from './dto/create-lesson-request.dto';

@Injectable()
export class LessonRequestService {
  constructor(private readonly prisma: PrismaService) {}

  // 레슨 신청
  async createLessonRequest(userId: string, dto: CreateLessonRequestDto) {
    if (!dto.goal?.trim()) {
      throw new BadRequestException('레슨 목표를 입력해주세요.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    const existing = await this.prisma.lessonRequest.findFirst({
      where: { studentId: userId },
    });
    if (existing) {
      throw new ConflictException('이미 레슨 신청 내역이 있습니다.');
    }

    return this.prisma.lessonRequest.create({
      data: {
        studentId: userId,
        region: dto.region,
        goal: dto.goal.trim(),
        genre: dto.genre,
      },
    });
  }

  // 내 레슨 신청 조회 (받은 제안 + 각 제안 코치 프로필까지 한 번에)
  async getMyLessonRequest(userId: string) {
    // 1단계: 내 신청 + 제안(최신순) + 각 제안 코치의 프로필을 한 방에 조회
    const request = await this.prisma.lessonRequest.findFirst({
      where: { studentId: userId },
      include: {
        proposals: {
          orderBy: { createdAt: 'desc' }, // 최신순 (기획)
          select: {
            id: true,
            message: true,
            createdAt: true,
            chatRoom: { select: { id: true } }, // 이 제안으로 열린 방(있으면)
            coach: {
              select: {
                coachProfile: {
                  select: { activityName: true, imageUrl: true, region: true },
                },
              },
            },
          },
        },
      },
    });
    if (!request) return null;

    // 2단계: coach.coachProfile 한 겹을 벗겨 응답을 평탄화 (내부 테이블 구조 은닉)
    return {
      ...request,
      proposals: request.proposals.map((proposal) => ({
        id: proposal.id,
        message: proposal.message,
        createdAt: proposal.createdAt,
        coachProfile: proposal.coach.coachProfile, // { activityName, region }
        roomId: proposal.chatRoom?.id ?? null, // 방 있으면 그 id, 없으면 null
      })),
    };
  }

  // 모집중 레슨 신청 목록 조회 (코치) — 각 신청에 내가 보낸 제안(myProposal)을 붙여 표시
  async getOpenLessonRequests(userId: string) {
    // 1단계: 코치 자격 확인 — 학생은 이 화면을 쓰지 않음
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'COACH') {
      throw new ForbiddenException('코치만 접근할 수 있습니다.');
    }

    // 2단계: 모집중 신청 전체 조회 (최신순) — 학생 닉네임만 함께 조회
    const requests = await this.prisma.lessonRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { student: { select: { nickname: true } } },
    });

    // 3단계: 이 코치가 이미 보낸 제안을 신청별로 매핑 (펼침 상세·취소에 쓸 id/message/createdAt 포함)
    const myProposals = await this.prisma.lessonProposal.findMany({
      where: { coachId: userId },
      select: { id: true, requestId: true, message: true, createdAt: true },
    });

    const myProposalByRequestId = new Map(
      myProposals.map(({ requestId, ...proposal }) => [requestId, proposal]),
    );

    // 4단계: 각 신청에 myProposal·studentNickname을 붙이고 내부 관계는 감춘다
    return requests.map(({ student, ...request }) => ({
      ...request,
      studentNickname: student.nickname,
      myProposal: myProposalByRequestId.get(request.id) ?? null,
    }));
  }

  // 레슨 신청 취소
  async removeLessonRequest(userId: string, lessonRequestId: string) {
    const lessonRequest = await this.prisma.lessonRequest.findUnique({
      where: { id: lessonRequestId },
    });
    if (!lessonRequest) {
      throw new NotFoundException('레슨 신청을 찾을 수 없습니다.');
    }
    if (lessonRequest.studentId !== userId) {
      throw new ForbiddenException('본인의 레슨 신청만 취소할 수 있습니다.');
    }
    return this.prisma.lessonRequest.delete({ where: { id: lessonRequestId } });
  }
}
