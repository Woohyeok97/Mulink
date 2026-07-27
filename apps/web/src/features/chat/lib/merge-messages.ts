import type { ChatMessage } from '@/entities/chat/chat.type';

// 기존 메시지와 새로 받은 메시지를 id 기준 중복 제거하며 오름차순 병합.
// 소켓 실시간 수신·재연결 재동기화 양쪽에서 같은 규칙으로 합치기 위한 순수 함수.
export function mergeMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
