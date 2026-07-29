// 체험 중 작성한 신청서를 페이지 간에 넘기는 임시 저장소.
// DB에 쓰지 않는 게 체험의 전제라 sessionStorage만 쓴다(탭 닫으면 자동 소멸).
import type { LessonRequestFormType } from '@/features/lesson-request/lesson-request.schema';

const STORAGE_KEY = 'demo-lesson-request';

// 신청서 저장
export function saveDemoRequest(values: LessonRequestFormType): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

// 저장된 원본 문자열. 렌더마다 같은 값이 나와야 하는 곳(useSyncExternalStore)에서 쓴다.
export function readDemoRequestRaw(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

// 원본 문자열 → 신청서 값. 없거나 깨졌으면 null
export function parseDemoRequest(raw: string | null): LessonRequestFormType | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as LessonRequestFormType;
  } catch {
    return null;
  }
}
