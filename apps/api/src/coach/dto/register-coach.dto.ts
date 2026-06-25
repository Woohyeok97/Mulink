import type { Region } from '../../../generated/prisma/enums';

// POST /coaches 요청 body. 활동명·지역만 받는다 (카카오ID/닉네임은 이미 User에 있음).
export interface RegisterCoachDto {
  activityName: string;
  region: Region;
}
