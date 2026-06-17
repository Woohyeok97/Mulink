import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

const signInWithOAuth = vi.fn();
vi.mock('@/shared/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth } }),
}));

describe('LoginPage', () => {
  it('카카오 시작하기 버튼을 렌더한다', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: '카카오로 시작하기' })).toBeInTheDocument();
  });

  it('버튼 클릭 시 kakao provider로 OAuth를 호출한다', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: '카카오로 시작하기' }));
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'kakao' }),
    );
  });
});
