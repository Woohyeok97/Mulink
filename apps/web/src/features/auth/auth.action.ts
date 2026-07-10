'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/server';

// 로그아웃 서버 액션
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
