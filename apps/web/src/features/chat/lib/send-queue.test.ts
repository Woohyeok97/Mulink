import { describe, it, expect } from 'vitest';
import { addPending, ackPending, type PendingMessage } from './send-queue';

const item = (id: string): PendingMessage => ({
  clientMsgId: id,
  roomId: 'r',
  content: `c-${id}`,
});

describe('send-queue', () => {
  // 전송 시 큐에 추가
  it('addPending은 항목을 큐 끝에 추가한다', () => {
    const q = addPending([], item('a'));
    expect(q.map((m) => m.clientMsgId)).toEqual(['a']);
  });

  // ack 받으면 해당 clientMsgId 제거
  it('ackPending은 해당 clientMsgId를 제거한다', () => {
    const q = addPending(addPending([], item('a')), item('b'));
    const after = ackPending(q, 'a');
    expect(after.map((m) => m.clientMsgId)).toEqual(['b']);
  });

  // 없는 id ack는 큐 그대로
  it('없는 id ack는 큐를 바꾸지 않는다', () => {
    const q = addPending([], item('a'));
    expect(ackPending(q, 'zzz')).toEqual(q);
  });

  // 같은 clientMsgId 중복 추가 방지(재전송 dedup)
  it('같은 clientMsgId는 중복 추가하지 않는다', () => {
    const q = addPending(addPending([], item('a')), item('a'));
    expect(q).toHaveLength(1);
  });
});
