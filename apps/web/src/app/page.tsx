import { createClient } from '@/shared/lib/supabase/server';
import { HomeAuth } from '@/shared/ui/home-auth';

async function getNickname(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { nickname?: string };
  return user.nickname ?? null;
}

export default async function Home() {
  const nickname = await getNickname();
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <HomeAuth nickname={nickname} />
    </main>
  );
}
