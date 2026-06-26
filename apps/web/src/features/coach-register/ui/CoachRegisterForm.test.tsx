import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CoachRegisterForm } from './CoachRegisterForm';
import * as coachAction from '../coach-register.action';

vi.mock('../coach-register.action', () => ({
  coachRegisterAction: vi.fn()
}));

// Radix Select는 jsdom에서 pointer/scroll API가 없어 직접 상호작용이 안 됨.
// native <select>로 렌더링하는 단순 mock으로 대체.
import React from 'react';

// vi.mock은 파일 상단으로 호이스팅되므로 factory 밖 변수를 참조할 수 없음.
// vi.hoisted()로 context를 먼저 생성해 factory 안에서 참조 가능하게 함.
const { SelectMockContext } = vi.hoisted(() => {
  const React = require('react') as typeof import('react');
  type SelectContextValue = { onValueChange: (v: string) => void; value: string };
  const SelectMockContext = React.createContext<SelectContextValue>({
    onValueChange: () => {},
    value: ''
  });
  return { SelectMockContext };
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

const mockCoachRegisterAction = vi.mocked(coachAction.coachRegisterAction);

describe('CoachRegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('폼이 렌더링되면 활동명 input, 지역 select, 제출 버튼이 보임', () => {
    render(<CoachRegisterForm />);

    expect(screen.getByPlaceholderText('활동명을 입력해 주세요')).toBeInTheDocument();
    expect(screen.getByLabelText('지역을 선택해 주세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /코치 가입하기/ })).toBeInTheDocument();
  });

  it('빈 상태로 제출하면 "활동명을 입력해 주세요." 에러 메시지 표시', async () => {
    const user = userEvent.setup();
    render(<CoachRegisterForm />);

    await user.click(screen.getByRole('button', { name: /코치 가입하기/ }));

    expect(await screen.findByText('활동명을 입력해 주세요.')).toBeInTheDocument();
    expect(await screen.findByText('지역을 선택해 주세요.')).toBeInTheDocument();
  });

  it('coachRegisterAction이 에러를 반환하면 role="alert" 영역에 에러 표시', async () => {
    const user = userEvent.setup();
    mockCoachRegisterAction.mockResolvedValueOnce({ error: '이미 코치로 등록된 계정입니다.' });

    render(<CoachRegisterForm />);

    await user.type(screen.getByPlaceholderText('활동명을 입력해 주세요'), '테스트 코치');
    await user.selectOptions(screen.getByLabelText('지역을 선택해 주세요'), 'SEOUL');

    await user.click(screen.getByRole('button', { name: /코치 가입하기/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('이미 코치로 등록된 계정입니다.');
  });

  it('제출 중(isSubmitting)에는 버튼이 disabled 상태', async () => {
    const user = userEvent.setup();
    mockCoachRegisterAction.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(undefined), 500)));

    render(<CoachRegisterForm />);

    await user.type(screen.getByPlaceholderText('활동명을 입력해 주세요'), '테스트 코치');
    await user.selectOptions(screen.getByLabelText('지역을 선택해 주세요'), 'SEOUL');

    const submitButton = screen.getByRole('button', { name: /코치 가입하기/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });
});
