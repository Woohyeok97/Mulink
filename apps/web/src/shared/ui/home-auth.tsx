import Link from 'next/link';
import { Button } from '@/shared/ui/button/button';
import { signOut } from '@/app/actions/auth';
import { Input } from './input/input';

export function HomeAuth({ nickname }: { nickname: string | null }) {
  return nickname ? (
    <div className="space-y-4 text-center">
      <p className="text-lg">환영합니다 {nickname}님</p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          로그아웃
        </Button>
        <Input placeholder="입력해" />
      </form>
    </div>
  ) : (
    <Button asChild>
      <Link href="/login">로그인</Link>
    </Button>
  );
}
