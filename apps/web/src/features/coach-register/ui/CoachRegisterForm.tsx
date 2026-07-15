'use client';

import { useRef, useState } from 'react';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// components
import { Camera, MapPin, Mic2, Plus, UserPlus, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar/avatar';
import { Input } from '@/shared/ui/input/input';
import { Button } from '@/shared/ui/button/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select/select';
// schemas
import { CoachRegisterSchema, REGIONS, type CoachRegisterFormType } from '../coach-register.schema';
// actions
import { coachRegisterAction, getUploadUrlAction } from '../coach-register.action';

export function CoachRegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  // 선택한 이미지 파일 — 실제 S3 업로드는 가입 제출 시에 한다 (선택만 하고 이탈 시 고아 객체 방지)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, control, handleSubmit, formState } = useForm<CoachRegisterFormType>({
    resolver: zodResolver(CoachRegisterSchema),
    defaultValues: {
      activityName: '',
      region: undefined,
      imageUrl: undefined
    }
  });

  // 폼 상태
  const { errors, isSubmitting } = formState;

  // 지역 선택 controller
  const { field: regionField } = useController({ name: 'region', control });

  // 파일 선택창 열기 핸들러
  const handlePickImage = () => fileInputRef.current?.click();

  // 파일 선택 핸들러 — 로컬 미리보기만 만들고 업로드는 하지 않는다
  const handleSelectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setServerError(null);
    setSelectedFile(file);
    // 이전 미리보기 blob URL 해제 후 새로 생성
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  // 이미지 제거 핸들러
  const handleRemoveImage = (event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedFile(null);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 코치 신청 핸들러 — 이미지가 있으면 이 시점에 S3 업로드 후 URL을 담아 가입 요청
  const onSubmit = handleSubmit(async data => {
    setServerError(null);

    let imageUrl: string | undefined;
    if (selectedFile) {
      // 1단계: presigned URL 발급
      const urlResult = await getUploadUrlAction(selectedFile.type);
      if ('error' in urlResult) {
        setServerError(urlResult.error);
        return;
      }
      // 2단계: 발급받은 URL로 S3에 원본 직접 업로드
      try {
        const uploadResponse = await fetch(urlResult.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': selectedFile.type },
          body: selectedFile
        });
        if (!uploadResponse.ok) throw new Error('upload failed');
        imageUrl = urlResult.publicUrl;
      } catch {
        setServerError('이미지 업로드에 실패했어요. 다시 시도해 주세요.');
        return;
      }
    }

    // 3단계: (업로드했다면 URL 포함해) 코치 가입
    const result = await coachRegisterAction({ ...data, imageUrl });
    if (result?.error) {
      setServerError(result.error);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      {serverError ? (
        <div role="alert" className="mb-5 rounded-md bg-(--danger-100) px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      ) : null}

      {/* 프로필 이미지 업로드 (선택) */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handlePickImage}
          aria-label="프로필 이미지 등록"
          className="group/upload relative rounded-full outline-none">
          <Avatar size="lg" className="size-23 border border-dashed border-(--neutral-300) bg-(--neutral-50) transition-colors group-hover/upload:border-(--green-500)">
            <AvatarImage src={previewUrl ?? undefined} alt="프로필 미리보기" />
            <AvatarFallback className="bg-transparent text-(--neutral-400)">
              <Camera className="size-6" />
            </AvatarFallback>
          </Avatar>
          {previewUrl ? (
            <span
              role="button"
              aria-label="이미지 제거"
              onClick={handleRemoveImage}
              className="absolute -top-0.5 -right-0.5 flex size-5.5 items-center justify-center rounded-full border-2 border-white bg-(--neutral-700) text-white">
              <X className="size-3" />
            </span>
          ) : (
            <span className="absolute -right-0.5 bottom-0.5 flex size-7 items-center justify-center rounded-full border-2 border-white bg-(--green-600) text-white shadow-(--shadow-sm)">
              <Plus className="size-3.5" />
            </span>
          )}
        </button>
        <p className="text-xs text-(--neutral-400)">
          {previewUrl ? '학생에게 이렇게 보여져요' : '프로필 이미지 (선택)'}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleSelectImage}
        />
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="activityName" className="flex items-center gap-1 text-sm font-semibold text-(--neutral-700)">
            <Mic2 className="size-3.5 text-(--green-600)" />
            활동명
          </label>
          <Input
            id="activityName"
            placeholder="활동명을 입력해 주세요"
            aria-invalid={errors.activityName ? 'true' : undefined}
            {...register('activityName')}
          />
          {errors.activityName && (
            <p role="alert" className="text-xs text-destructive">
              {errors.activityName.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="region" className="flex items-center gap-1 text-sm font-semibold text-(--neutral-700)">
            <MapPin className="size-3.5 text-(--green-600)" />
            활동 지역
          </label>
          <Select value={regionField.value ?? undefined} onValueChange={regionField.onChange}>
            <SelectTrigger id="region" className="w-full" aria-invalid={errors.region ? 'true' : undefined}>
              <SelectValue placeholder="지역을 선택해 주세요" />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.region && (
            <p role="alert" className="text-xs text-destructive">
              {errors.region.message}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Button
          type="submit"
          variant="emphasis"
          size="lg"
          loading={isSubmitting}
          leftIcon={<UserPlus className="size-4.5" />}
          className="w-full">
          코치 가입하기
        </Button>
      </div>
    </form>
  );
}
