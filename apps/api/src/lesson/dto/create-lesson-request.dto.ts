import type { Region, Genre } from '../../../generated/prisma/enums';

export interface CreateLessonRequestDto {
  region: Region;
  goal: string;
  genre: Genre;
  voiceAudioUrl: string;
}
