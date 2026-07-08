import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Region } from '../../generated/prisma/enums';
import type { RegisterCoachDto } from './dto/register-coach.dto';

@Injectable()
export class CoachProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async registerCoach(userId: string, dto: RegisterCoachDto) {
    // 1단계: 트랜잭션 전에 dto 검증 (수동)
    if (!dto.activityName?.trim()) {
      throw new BadRequestException('활동명을 입력해주세요.');
    }
    if (!Object.values(Region).includes(dto.region)) {
      throw new BadRequestException('지역은 서울/경기/인천 중 선택해주세요.');
    }

    // 2단계: 트랜잭션 전에 유저 자격 확인 —> 트랜잭션 밖에서 조회, 거부
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }
    if (user.role === 'COACH') {
      throw new ConflictException('이미 코치로 등록된 계정입니다.');
    }
    if (user.role === 'ADMIN') {
      throw new ConflictException('관리자 계정은 코치로 등록할 수 없습니다.');
    }

    // 3단계: 유저의 role을 STUDENT-> COACH로 승격하고 CoachProfile 생성, 기존 레슨 신청 삭제를 트랜잭션으로 묶음
    return this.prisma.$transaction(async (prismaTransaction) => {
      await prismaTransaction.user.update({
        where: { id: userId },
        data: { role: 'COACH' },
      });
      // 코치는 학생 기능을 쓸 수 없으므로 기존 레슨 신청(및 cascade로 딸린 제안)을 삭제
      await prismaTransaction.lessonRequest.deleteMany({
        where: { studentId: userId },
      });
      return prismaTransaction.coachProfile.create({
        data: {
          userId,
          activityName: dto.activityName.trim(),
          region: dto.region,
        },
      });
    });
  }
}
