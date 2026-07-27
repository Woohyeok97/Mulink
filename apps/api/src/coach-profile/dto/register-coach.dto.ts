import type { Region } from '../../../generated/prisma/enums';

// POST /coach-profiles 요청 body. 활동명·지역·(선택)프로필 이미지 URL을 받는다 (카카오ID/닉네임은 이미 User에 있음).
export interface RegisterCoachDto {
  activityName: string;
  region: Region;
  imageUrl?: string; // presigned URL로 S3 업로드를 마친 뒤의 공개 URL (미등록 시 생략)
}
