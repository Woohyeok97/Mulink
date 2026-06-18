import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
// Prisma 7은 클라이언트를 node_modules가 아니라 prisma/schema.prisma의
// generator output 경로(apps/api/generated/prisma)에 생성한다.
import { PrismaClient } from '../../generated/prisma/client';

/**
 * PrismaClient를 NestJS 서비스로 감싼 것.
 *
 * - PrismaClient를 상속하므로 this.user.findMany() 처럼 Prisma 기능을 그대로 쓸 수 있다.
 * - @Injectable() 덕분에 NestJS가 이 인스턴스를 싱글톤으로 관리한다.
 *   즉, 앱 전체가 하나의 DB 커넥션을 공유한다.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma 7은 Driver Adapter로 연결한다(schema의 datasource url을 런타임에 읽지 않음).
    // pg 어댑터에 연결 문자열을 넘긴다. 앱은 풀러(DATABASE_URL)를 쓰고, 마이그레이션은 DIRECT_URL을 쓴다.
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  }

  // 모듈이 초기화될 때(앱 시작 시) DB에 연결한다.
  async onModuleInit() {
    await this.$connect();
  }

  // 모듈이 종료될 때(앱 종료 시) DB 연결을 정리한다.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
