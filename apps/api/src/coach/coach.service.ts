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
export class CoachService {
  constructor(private readonly prisma: PrismaService) {}

  // 로그인된 STUDENT를 COACH로 승격하고 CoachProfile을 생성한다.
  async registerCoach(userId: string, dto: RegisterCoachDto) {
    // 1. 입력 검증 (수동) — 트랜잭션 전에 빠르게 거른다.
    if (!dto.activityName?.trim()) {
      throw new BadRequestException('활동명을 입력해주세요.');
    }
    if (!Object.values(Region).includes(dto.region)) {
      throw new BadRequestException('지역은 서울/경기/인천 중 선택해주세요.');
    }

    // 2. 자격 확인 — 트랜잭션 밖에서 조회·거부.
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    if (user.role === 'COACH') {
      throw new ConflictException('이미 코치로 등록된 계정입니다.');
    }
    if (user.role === 'ADMIN') {
      throw new ConflictException('코치로 등록할 수 없는 계정입니다.');
    }

    // 3. 쓰기 — role 승격 + 프로필 생성을 한 트랜잭션으로 묶는다.
    return this.prisma.$transaction(async (prismaTransaction) => {
      await prismaTransaction.user.update({
        where: { id: userId },
        data: { role: 'COACH' },
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
