import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SupabaseService } from './supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [SupabaseService, SupabaseAuthGuard],
})
export class AuthModule {}
