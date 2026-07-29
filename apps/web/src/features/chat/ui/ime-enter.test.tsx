import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';

// 한글 조합 중 Enter가 전송으로 새지 않는지 확인한다.
// ChatRoomView가 쓰는 form submit 방식과, 이전의 keydown 방식을 같은 조건으로 비교한다.

// 수정 후 방식 — form submit
function FormVersion({ onSend }: { onSend: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (!value) return;
    onSend(value);
    if (inputRef.current) inputRef.current.value = '';
  };
  return (
    <form onSubmit={handleSubmit}>
      <input ref={inputRef} aria-label="메시지" />
      <button type="submit">전송</button>
    </form>
  );
}

// 수정 전 방식 — keydown으로 Enter 감지
function KeydownVersion({ onSend }: { onSend: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleSend = () => {
    const value = inputRef.current?.value.trim();
    if (!value) return;
    onSend(value);
    if (inputRef.current) inputRef.current.value = '';
  };
  return (
    <div>
      <input
        ref={inputRef}
        aria-label="메시지"
        onKeyDown={e => {
          if (e.key === 'Enter') handleSend();
        }}
      />
      <button onClick={handleSend}>전송</button>
    </div>
  );
}

// 한글 조합 중 Enter를 누른 상황을 재현한다.
// 실제 브라우저에서는 (1) 조합 확정용 Enter keydown이 먼저 오고,
// (2) IME가 확정된 글자를 input에 다시 채운 뒤, (3) 사용자의 Enter가 도착한다.
async function typeKoreanThenEnter(input: HTMLInputElement) {
  const user = userEvent.setup();
  await user.click(input);
  await user.type(input, '하이');

  // (1) 조합 확정 단계의 Enter — 조합 중이라 isComposing이 true다
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
  // (2) IME가 확정 글자를 다시 써넣는다(핸들러가 input을 비웠더라도)
  input.value = '하이';
  // (3) 사용자가 누른 Enter
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: false, bubbles: true }));
}

describe('한글 입력 중 Enter 전송', () => {
  it('keydown 방식은 조합 확정 Enter까지 전송해 중복이 생긴다(수정 전 동작)', async () => {
    const onSend = vi.fn();
    render(<KeydownVersion onSend={onSend} />);

    await typeKoreanThenEnter(screen.getByLabelText('메시지') as HTMLInputElement);

    // 조합 확정 Enter와 사용자 Enter가 각각 전송을 일으킨다
    expect(onSend).toHaveBeenCalledTimes(2);
  });

  it('form 방식은 조합 확정 Enter를 전송으로 취급하지 않는다', async () => {
    const onSend = vi.fn();
    render(<FormVersion onSend={onSend} />);

    await typeKoreanThenEnter(screen.getByLabelText('메시지') as HTMLInputElement);

    // keydown을 듣지 않으므로 조합 확정 Enter는 아무 일도 하지 않는다
    expect(onSend).not.toHaveBeenCalled();
  });

  it('form 방식은 조합이 끝난 뒤의 Enter로 한 번만 전송한다', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<FormVersion onSend={onSend} />);

    const input = screen.getByLabelText('메시지');
    await user.click(input);
    await user.type(input, '하이{Enter}');

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('하이');
  });
});
