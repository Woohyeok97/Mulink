import 'server-only';
import { cache } from 'react';
import { authedFetch } from '@/shared/lib/authed-fetch';
import type { ChatMessage, ChatRoomSummary } from './chat.type';

// 내 채팅방 목록 (SSR 초기 렌더). 비로그인/오류면 빈 배열.
export const getMyChatRooms = cache(async (): Promise<ChatRoomSummary[]> => {
  const response = await authedFetch('/chat-rooms', { cache: 'no-store' });
  if (!response?.ok) return [];
  return (await response.json()) as ChatRoomSummary[];
});

// 방 초기 내역 (SSR). 접근 불가/오류면 빈 배열.
export const getRoomMessages = cache(
  async (roomId: string): Promise<ChatMessage[]> => {
    const response = await authedFetch(`/chat-rooms/${roomId}/messages`, {
      cache: 'no-store',
    });
    if (!response?.ok) return [];
    return (await response.json()) as ChatMessage[];
  },
);

// 헤더 뱃지용 총 안읽음 수 (새로고침 시 갱신). 목록의 unreadCount 합.
export const getUnreadTotal = cache(async (): Promise<number> => {
  const rooms = await getMyChatRooms();
  return rooms.reduce((sum, room) => sum + room.unreadCount, 0);
});
