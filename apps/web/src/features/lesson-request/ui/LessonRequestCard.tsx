import { CalendarDays, MapPin, Music, Target, Trash2 } from 'lucide-react';

import { GENRE_LABEL, REGION_LABEL, type LessonRequest } from '@/entities/lesson-request/lesson-request.type';
import { Button } from '@/shared/ui/button/button';

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

interface LessonRequestCardProps {
  request: LessonRequest;
  onDelete: () => void;
}

export function LessonRequestCard({ request, onDelete }: LessonRequestCardProps) {
  const rows = [
    { icon: CalendarDays, label: '신청일', value: formatDate(request.createdAt) },
    { icon: MapPin, label: '지역', value: REGION_LABEL[request.region] },
    { icon: Music, label: '장르', value: GENRE_LABEL[request.genre] },
    { icon: Target, label: '목표', value: request.goal }
  ];

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-(--neutral-200) bg-white p-6">
      <ul className="flex flex-col gap-3">
        {rows.map(row => (
          <li key={row.label} className="flex items-start gap-2">
            <row.icon className="mt-0.5 size-4 shrink-0 text-(--neutral-400)" />
            <span className="w-10 shrink-0 text-sm text-(--neutral-500)">{row.label}</span>
            <span className="text-sm font-medium text-(--neutral-800)">{row.value}</span>
          </li>
        ))}
      </ul>
      <div className="h-px bg-(--neutral-100)" />
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-center text-(--danger-500) hover:bg-(--danger-100) hover:text-(--danger-500)"
        leftIcon={<Trash2 />}
        onClick={onDelete}>
        신청 삭제
      </Button>
    </div>
  );
}
