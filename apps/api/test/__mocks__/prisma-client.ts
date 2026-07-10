// Jest mock for the generated Prisma client (which uses ESM import.meta, incompatible with ts-jest CJS mode).
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

export class PrismaClient {
  $connect = jest.fn();
  $disconnect = jest.fn();
}

// Prisma 네임스페이스는 runtime의 실제 에러 클래스를 재노출한다.
// (서비스 코드의 `err instanceof Prisma.PrismaClientKnownRequestError`가 테스트에서도 실물과 일치하도록)
export const Prisma = { PrismaClientKnownRequestError };
