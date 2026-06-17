import Link from 'next/link';
import { Button } from '@/shared/ui/button';
import { signOut } from '@/app/actions/auth';

export function HomeAuth({ nickname }: { nickname: string | null }) {
  return nickname ? (
    <div className="space-y-4 text-center">
      <p className="text-lg">환영합니다 {nickname}님</p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          로그아웃
        </Button>
      </form>
    </div>
  ) : (
    <Button asChild>
      <Link href="/login">로그인</Link>
    </Button>
  );
}
