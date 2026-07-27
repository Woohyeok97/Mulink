import Link from 'next/link';
import { Mic } from 'lucide-react';
import { buttonVariants } from '@/shared/ui/button/button';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/shared/ui/dropdown/dropdown';
import { getCurrentUser } from '@/entities/user/user.api';
import { getUnreadTotal } from '@/entities/chat/chat.api';
import { Badge } from '@/shared/ui/badge/badge';
import { logoutAction } from '@/features/auth/auth.action';

export async function Header() {
  const user = await getCurrentUser();
  const unread = user ? await getUnreadTotal() : 0;

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
                  className="relative flex items-center rounded-full p-1 transition-colors hover:bg-(--green-50) outline-none focus-visible:ring-2 focus-visible:ring-(--green-400)"
                  aria-label="내 계정 메뉴 열기">
                  <Avatar size="sm">
                    <AvatarFallback>{user.nickname.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {/* 안읽음 있을 때 아바타 우상단 점 (새로고침 시 갱신) */}
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-(--green-600)" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-56 **:data-[slot=dropdown-menu-item]:px-2.5 **:data-[slot=dropdown-menu-item]:py-2 **:data-[slot=dropdown-menu-label]:px-2.5 **:data-[slot=dropdown-menu-label]:py-2.5">
                <DropdownMenuLabel className="py-1.5 text-base font-semibold text-foreground">
                  {user.nickname}
                  {user.role === 'STUDENT' ? ' 고객님' : ' 코치님'}
                </DropdownMenuLabel>
                {user.role === 'STUDENT' ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/student/lesson-request/new">레슨 신청하기</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/student/lesson-request">나의 레슨 신청 현황</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/coach-register">코치 가입</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/coach/lesson-requests">레슨 제안하기</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/chat">
                    채팅
                    {unread > 0 && (
                      <Badge variant="brand" className="ml-auto">
                        {unread}
                      </Badge>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <DropdownMenuItem variant="destructive" asChild>
                    <button type="submit" className="w-full">
                      로그아웃
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              로그인 / 회원가입
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
