import { createClient } from '@/shared/lib/supabase/server';
import { HomeAuth } from '@/shared/ui/home-auth';

async function getNickname(): Promise<string | null> {
  const supabase = await createClient();
  // getSession은 쿠키의 access_token을 NestJS로 전달하는 용도만. 신원은 NestJS가 getUser로 재검증한다.
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) return null;

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store'
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { nickname?: string };
  return user.nickname ?? null;
}

export default async function Home() {
  const nickname = await getNickname();
  console.log(nickname);
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <HomeAuth nickname={nickname} />
    </main>
  );
}
