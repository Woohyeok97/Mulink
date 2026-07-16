// 미전송(미ack) 메시지 큐. clientMsgId를 키로 추가·제거하는 순수 함수 모음.
// 연결이 끊긴 채 보낸 메시지를 재연결 시 재전송하기 위해 보관한다.
export type PendingMessage = {
  clientMsgId: string;
  roomId: string;
  content: string;
};

// 큐 끝에 추가 (같은 clientMsgId가 이미 있으면 그대로 — 재전송 dedup)
export function addPending(
  queue: PendingMessage[],
  item: PendingMessage,
): PendingMessage[] {
  if (queue.some((m) => m.clientMsgId === item.clientMsgId)) return queue;
  return [...queue, item];
}

// ack 받은 clientMsgId 제거 (없으면 동일 배열 참조 유지)
export function ackPending(
  queue: PendingMessage[],
  clientMsgId: string,
): PendingMessage[] {
  if (!queue.some((m) => m.clientMsgId === clientMsgId)) return queue;
  return queue.filter((m) => m.clientMsgId !== clientMsgId);
}
