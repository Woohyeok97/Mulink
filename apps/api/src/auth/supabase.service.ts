import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  // 토큰을 Supabase 서버에 위임 검증하고 유저를 돌려준다.
  getUser(accessToken: string) {
    return this.client.auth.getUser(accessToken);
  }
}
