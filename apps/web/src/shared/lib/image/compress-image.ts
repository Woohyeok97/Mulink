// 업로드 직전 브라우저에서 이미지를 축소·WebP 변환한다.
// 원본이 S3에 저장·반출되지 않게 해 스토리지·egress·업로드 대역폭을 함께 줄인다.

const MAX_EDGE = 800; // 긴 변 상한(px) — 목록 아바타 + 프로필 상세 확대 모두 커버
const QUALITY = 0.8; // WebP 품질

// 긴 변을 max 이하로 맞춘 목표 크기(비율 유지). 이미 작으면 원본 그대로.
export function calcTargetSize(width: number, height: number, max: number = MAX_EDGE) {
  const longEdge = Math.max(width, height);
  if (longEdge <= max) return { width, height };
  const ratio = max / longEdge;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio)
  };
}

// HEIC 여부 — 브라우저 Canvas가 못 읽어 별도 디코드가 필요한 포맷
function isHeic(file: File) {
  return file.type === 'image/heic' || file.type === 'image/heif' || /\.hei[cf]$/i.test(file.name);
}

// 원본 File을 축소된 WebP(폴백 JPEG) Blob으로 변환
export async function compressImage(file: File): Promise<Blob> {
  // 1단계: HEIC면 heic2any를 동적 로드해 JPEG로 먼저 변환 (평소 번들에 안 넣기 위해 조건부 import)
  let source: Blob = file;
  if (isHeic(file)) {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: file, toType: 'image/jpeg' });
    source = Array.isArray(converted) ? converted[0] : converted;
  }

  // 2단계: EXIF 회전을 반영해 비트맵으로 디코드 (폰 사진 눕힘 방지)
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });

  // 3단계: 긴 변 상한으로 비율 유지 축소
  const { width, height } = calcTargetSize(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas context를 만들 수 없습니다.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // 4단계: WebP로 인코딩, 미지원 브라우저는 JPEG 폴백
  const blob = await canvasToBlob(canvas, 'image/webp');
  if (blob && blob.type === 'image/webp') return blob;
  const jpeg = await canvasToBlob(canvas, 'image/jpeg');
  if (!jpeg) throw new Error('이미지 변환에 실패했습니다.');
  return jpeg;
}

// canvas.toBlob을 Promise로 감싼다
function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, QUALITY));
}
