// ⚠️ 개발 전용 로그인 패널 (제거 대상). 이 파일 삭제 + page.tsx의 <DevLoginPanel /> 한 줄 제거로 끝.
// docs/superpowers/plans/2026-07-03-dev-seed-and-dev-login.md
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/button/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select/select';

interface DevUser {
  id: string;
  nickname: string;
  role: 'STUDENT' | 'COACH' | 'ADMIN';
}

export function DevLoginPanel() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const [users, setUsers] = useState<DevUser[]>([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    fetch(`${apiUrl}/auth/dev/users`)
      .then(res => (res.ok ? res.json() : []))
      .then(setUsers);
  }, [apiUrl]);

  return (
    <div className="mt-6 w-full rounded-md border border-dashed border-(--neutral-300) p-4">
      <p className="mb-2 text-xs font-semibold text-(--neutral-500)">개발용 로그인 (dev only)</p>
      <div className="flex gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="min-w-0 flex-1">
            <SelectValue placeholder="계정 선택…" />
          </SelectTrigger>
          <SelectContent>
            {users.map(u => (
              <SelectItem key={u.id} value={u.id}>
                [{u.role === 'COACH' ? '코치' : '학생'}] {u.nickname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          disabled={!selected}
          onClick={() => {
            window.location.href = `${apiUrl}/auth/dev/login?userId=${selected}`;
          }}>
          로그인
        </Button>
      </div>
    </div>
  );
}
