// ISO 문자열을 'YYYY.MM.DD HH:mm' 형식으로 변환 (제안 발송 시각 표기용)
export function toAbsoluteTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
