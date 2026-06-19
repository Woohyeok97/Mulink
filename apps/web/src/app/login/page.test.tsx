import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import LoginPage from './page';

describe('LoginPage', () => {
  beforeEach(() => {
    // 버튼 클릭이 window.location.href에 NestJS 진입점을 넣는지 검증하기 위해
    // location.href를 추적 가능한 형태로 교체한다.
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });
  });

  it('카카오 시작하기 버튼을 렌더한다', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: '카카오로 시작하기' })).toBeInTheDocument();
  });

  it('버튼 클릭 시 NestJS 카카오 로그인 진입점으로 이동한다', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: '카카오로 시작하기' }));
    expect(window.location.href).toBe(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/kakao/login`,
    );
  });
});
