'use server';

import { authedFetch } from '@/shared/lib/authed-fetch';

// 제안에서 채팅방 생성/취득 (멱등). 성공 시 roomId 반환.
export async function createChatRoomAction(proposalId: string): Promise<{ roomId: string } | { error: string }> {
  const response = await authedFetch('/chat-rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposalId }),
  });

  if (!response) {
    return { error: '로그인이 필요합니다.' };
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { error: body.message ?? '채팅방을 열 수 없습니다.' };
  }

  const room = (await response.json()) as { id: string };
  return { roomId: room.id };
}
