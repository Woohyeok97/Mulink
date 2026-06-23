import { Injectable, NotFoundException } from '@nestjs/common';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { extractKakaoProfile } from './kakao-profile';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertUser(user: SupabaseUser) {
    const { kakaoId, nickname } = extractKakaoProfile(user);

    return this.prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, kakaoId, nickname },
      update: {},
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    return user;
  }
}
