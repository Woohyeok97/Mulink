'use server';

import { createClient } from '@/shared/lib/supabase/server';

// 제안에서 채팅방 생성/취득 (멱등). 성공 시 roomId 반환.
export async function createChatRoomAction(
  proposalId: string,
): Promise<{ roomId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: '로그인이 필요합니다.' };

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat-rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ proposalId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { error: body.message ?? '채팅방을 열 수 없습니다.' };
  }
  const room = (await response.json()) as { id: string };
  return { roomId: room.id };
}
