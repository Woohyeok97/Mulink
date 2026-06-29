import { CalendarDays, MapPin, Music, Target } from 'lucide-react';

import { GENRE_LABEL, REGION_LABEL, type LessonRequest } from '@/entities/lesson-request/lesson-request.type';

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

type ApplicationSummaryProps = {
  request: LessonRequest;
};

export function ApplicationSummary({ request }: ApplicationSummaryProps) {
  const rows = [
    { icon: CalendarDays, label: '신청일', value: formatDate(request.createdAt) },
    { icon: MapPin, label: '지역', value: REGION_LABEL[request.region] },
    { icon: Music, label: '장르', value: GENRE_LABEL[request.genre] },
    { icon: Target, label: '목표', value: request.goal },
  ];

  return (
    <div className="rounded-2xl border border-[var(--neutral-200)] bg-white p-5 shadow-[var(--shadow-sm)]">
      <h2 className="mb-4 text-sm font-semibold text-[var(--neutral-500)]">내 레슨 신청</h2>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.label} className="flex items-start gap-3">
            <row.icon className="mt-0.5 size-4 shrink-0 text-[var(--green-600)]" />
            <span className="w-10 shrink-0 text-sm text-[var(--neutral-500)]">{row.label}</span>
            <span className="text-sm font-medium text-[var(--neutral-800)]">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
