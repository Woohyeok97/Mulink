import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LessonRequestForm } from './LessonRequestForm';
import * as lessonRequestAction from '../../lesson-request.action';

vi.mock('../../lesson-request.action', () => ({
  createLessonRequestAction: vi.fn()
}));

// Radix Select는 jsdom에서 pointer/scroll API가 없어 직접 상호작용이 안 됨.
// native <select>로 렌더링하는 단순 mock으로 대체.
type SelectContextValue = { onValueChange: (v: string) => void; value: string };
const SelectMockContext = React.createContext<SelectContextValue>({
  onValueChange: () => {},
  value: ''
});

vi.mock('@/shared/ui/select/select', () => {
  function Select({
    children,
    onValueChange,
    value
  }: {
    children: React.ReactNode;
    onValueChange: (v: string) => void;
    value: string;
  }) {
    return (
      <SelectMockContext.Provider value={{ onValueChange, value }}>
        <div data-testid="select-root">{children}</div>
      </SelectMockContext.Provider>
    );
  }

  function SelectTrigger() {
    return null;
  }

  function SelectValue() {
    return null;
  }

  function SelectContent({ children }: { children: React.ReactNode }) {
    const { onValueChange, value } = React.useContext(SelectMockContext);
    const options: Array<{ value: string; label: React.ReactNode }> = [];
    React.Children.forEach(children, child => {
      const c = child as React.ReactElement<{ value: string; children: React.ReactNode }>;
      if (c?.props?.value) {
        options.push({ value: c.props.value, label: c.props.children });
      }
    });
    return (
      <select aria-label="지역을 선택해 주세요" value={value} onChange={e => onValueChange(e.target.value)}>
        <option value="">지역을 선택해 주세요</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  function SelectItem({ children }: { value: string; children: React.ReactNode }) {
    return <>{children}</>;
  }

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

const mockCreateLessonRequestAction = vi.mocked(lessonRequestAction.createLessonRequestAction);

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LessonRequestForm />
    </QueryClientProvider>
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('지역을 선택해 주세요'), 'SEOUL');
  await user.click(screen.getByRole('button', { name: '팝' }));
  await user.type(screen.getByPlaceholderText(/예: 음치 탈출/), '음치 탈출');
}

describe('LessonRequestForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createLessonRequestAction이 에러를 반환하면 role="alert" 영역에 에러 표시', async () => {
    const user = userEvent.setup();
    mockCreateLessonRequestAction.mockResolvedValueOnce({ error: '이미 레슨 신청 내역이 있습니다.' });

    renderForm();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /코치 매칭 받기/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('이미 레슨 신청 내역이 있습니다.');
  });

  it('createLessonRequestAction이 성공(undefined)하면 신청 완료 화면(SuccessView)으로 전환', async () => {
    const user = userEvent.setup();
    mockCreateLessonRequestAction.mockResolvedValueOnce(undefined);

    renderForm();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /코치 매칭 받기/ }));

    expect(await screen.findByText('신청이 완료됐어요!')).toBeInTheDocument();
  });

  it('제출 중(isPending)에는 버튼이 disabled 상태', async () => {
    const user = userEvent.setup();
    mockCreateLessonRequestAction.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(undefined), 500)));

    renderForm();
    await fillValidForm(user);

    const submitButton = screen.getByRole('button', { name: /코치 매칭 받기/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });
});
