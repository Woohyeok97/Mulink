import { createClient } from '@/shared/lib/supabase/client';
import type { ChatMessage } from '@/entities/chat/chat.type';

// 재연결 직후 호출: 마지막으로 받은 id 초과 메시지만 조회(끊긴 사이 쌓인 것).
// 브라우저에서 실행되므로 browser supabase로 토큰을 얻는다. 실패 시 빈 배열.
export async function fetchMessagesAfter(
  roomId: string,
  afterId: number,
): Promise<ChatMessage[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return [];

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/chat-rooms/${roomId}/messages?after=${afterId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  return (await res.json()) as ChatMessage[];
}
