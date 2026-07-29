'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// components
import { Camera, MapPin, Mic2, Plus, UserPlus, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar/avatar';
import { Input } from '@/shared/ui/input/input';
import { Button } from '@/shared/ui/button/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select/select';
// schemas
import { CoachRegisterSchema, REGIONS, type CoachRegisterFormType } from '@/features/coach-register/coach-register.schema';
// demo
import { DEFAULT_COACH_VALUES } from '../_lib/demo-fixtures';

// 프로덕션 CoachRegisterForm의 데모판.
// 폼 UI는 같고, 제출이 S3 업로드·가입 요청 대신 신청 목록으로의 이동이 된다.
export function DemoCoachRegisterForm() {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, control, handleSubmit, formState } = useForm<CoachRegisterFormType>({
    resolver: zodResolver(CoachRegisterSchema),
    // 체험자가 바로 제출해볼 수 있도록 미리 채워둔다(수정 가능)
    defaultValues: DEFAULT_COACH_VALUES
  });

  // 폼 상태
  const { errors } = formState;

  // 지역 선택 controller
  const { field: regionField } = useController({ name: 'region', control });

  // 파일 선택창 열기 핸들러
  const handlePickImage = () => fileInputRef.current?.click();

  // 파일 선택 핸들러 — 데모에서는 미리보기만 만들고 업로드하지 않는다
  const handleSelectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 이전 미리보기 blob URL 해제 후 새로 생성
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  // 이미지 제거 핸들러
  const handleRemoveImage = (event: React.MouseEvent) => {
    event.stopPropagation();
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 코치 가입 핸들러 — 저장 없이 신청 목록으로 넘어간다
  const onSubmit = handleSubmit(() => router.push('/demo/coach/lesson-requests'));

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      {/* 프로필 이미지 업로드 (선택) */}
      <div className="mb-6 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handlePickImage}
          aria-label="프로필 이미지 등록"
          className="group/upload relative rounded-full outline-none">
          <Avatar
            size="lg"
            className="size-23 border border-dashed border-(--neutral-300) bg-(--neutral-50) transition-colors group-hover/upload:border-(--green-500)">
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
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleSelectImage} />
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
          leftIcon={<UserPlus className="size-4.5" />}
          className="w-full">
          코치 가입하기
        </Button>
      </div>
    </form>
  );
}
