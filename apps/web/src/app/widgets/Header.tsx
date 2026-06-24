import Link from 'next/link';
import { Mic } from 'lucide-react';
import { Button } from '@/shared/ui/button/button';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/shared/ui/dropdown/dropdown';

export function Header() {
  const user = true;

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-(--neutral-100)"
      style={{
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: 'var(--shadow-xs)'
      }}
      role="banner">
      <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-5 sm:h-16 sm:px-8">
        {/* 로고 */}
        <Link
          href="/"
          aria-label="MU:LINK 홈으로"
          className="group flex items-center gap-2.25 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-(--green-400) select-none no-underline">
          <span className="flex size-8.5 shrink-0 items-center justify-center rounded-md bg-(--green-100) transition-colors group-hover:bg-(--green-200)">
            <Mic size={18} color="var(--green-700)" strokeWidth={2} aria-hidden />
          </span>
          <span className="text-base font-extrabold leading-none tracking-tight text-(--green-800) sm:text-lg">
            MU:LINK
          </span>
        </Link>

        {/* 우측 영역 */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center rounded-full p-1 transition-colors hover:bg-(--green-50) outline-none focus-visible:ring-2 focus-visible:ring-(--green-400)"
                  aria-label="내 계정 메뉴 열기">
                  <Avatar size="sm">
                    <AvatarFallback>사용자</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8}>
                <DropdownMenuItem variant="destructive">로그아웃</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" size="sm">
              <Link href="/login">로그인 / 회원가입</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
