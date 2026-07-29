import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { coachRegisterAction, getUploadUrlAction } from './coach-register.action';
import type { CoachRegisterFormType } from './coach-register.schema';
// lib
import { compressImage } from '@/shared/lib/image/compress-image';

type CoachRegisterResult = { error: string } | void;

type CoachRegisterVariables = CoachRegisterFormType & { selectedFile: File | null };

type CoachRegisterMutationOptions = UseMutationOptions<CoachRegisterResult, Error, CoachRegisterVariables>;

// 코치 가입 mutate — 이미지가 있으면 압축 후 presigned URL로 S3 업로드, 그 URL을 담아 가입 요청
export function useCoachRegisterMutation(options?: CoachRegisterMutationOptions) {
  return useMutation({
    mutationFn: async ({ selectedFile, ...data }: CoachRegisterVariables): Promise<CoachRegisterResult> => {
      let imageUrl: string | undefined;
      if (selectedFile) {
        try {
          // 1단계: 업로드 직전 브라우저에서 축소·WebP 변환 (원본이 네트워크·S3를 타지 않게)
          const uploadBlob = await compressImage(selectedFile);

          // 2단계: 축소본 타입으로 presigned URL 발급
          const urlResult = await getUploadUrlAction(uploadBlob.type);
          if ('error' in urlResult) {
            return { error: urlResult.error };
          }

          // 3단계: 발급받은 URL로 S3에 축소본 직접 업로드
          const uploadResponse = await fetch(urlResult.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': uploadBlob.type },
            body: uploadBlob,
          });
          if (!uploadResponse.ok) throw new Error('upload failed');
          imageUrl = urlResult.publicUrl;
        } catch {
          return { error: '이미지 업로드에 실패했어요. 다시 시도해 주세요.' };
        }
      }

      // 4단계: (업로드했다면 URL 포함해) 코치 가입
      return coachRegisterAction({ ...data, imageUrl });
    },
    ...options,
  });
}
