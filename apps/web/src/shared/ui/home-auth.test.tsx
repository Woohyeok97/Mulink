import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeAuth } from './home-auth';

vi.mock('@/app/actions/auth', () => ({ signOut: vi.fn() }));

describe('HomeAuth', () => {
  it('로그인 상태면 닉네임과 로그아웃 버튼을 보여준다', () => {
    render(<HomeAuth nickname="홍길동" />);
    expect(screen.getByText('환영합니다 홍길동님')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument();
  });

  it('비로그인 상태면 로그인 링크를 보여준다', () => {
    render(<HomeAuth nickname={null} />);
    expect(screen.getByRole('link', { name: '로그인' })).toBeInTheDocument();
  });
});
