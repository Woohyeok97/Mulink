import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

// auth 관련된 모든 것을 하나로 묶는 Module
@Module({
  controllers: [AuthController], // 이 모듈이 사용할 컨트롤러(입구)
  providers: [AuthService, SupabaseService, SupabaseAuthGuard], // 이 모듈이 사용할 서비스(로직)
})
export class AuthModule {}
