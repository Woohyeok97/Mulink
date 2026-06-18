import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

@Injectable()
export class SupabaseService {
  private readonly client: ReturnType<typeof createClient>;

  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        // Node.js 20은 네이티브 WebSocket이 없어서 ws 패키지를 transport로 주입해야 한다.
        realtime: { transport: ws as any },
      },
    );
  }

  // 토큰을 Supabase 서버에 위임 검증하고 유저를 돌려준다.
  getUser(accessToken: string) {
    return this.client.auth.getUser(accessToken);
  }
}
