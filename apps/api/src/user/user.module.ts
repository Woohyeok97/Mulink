import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthModule } from '../auth/auth.module';

// user 리소스(POST /users, GET /users/me)를 담당하는 Module
@Module({
  imports: [AuthModule], // SupabaseAuthGuard 사용
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
