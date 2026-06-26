'use client';

import { useState } from 'react';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// components
import { Mic2, MapPin, UserPlus } from 'lucide-react';
import { Input } from '@/shared/ui/input/input';
import { Button } from '@/shared/ui/button/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select/select';
// schemas
import { CoachRegisterSchema, REGIONS, type CoachRegisterFormType } from '../coach-register.schema';
// actions
import { coachRegisterAction } from '../coach-register.action';

export function CoachRegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, control, handleSubmit, formState } = useForm<CoachRegisterFormType>({
    resolver: zodResolver(CoachRegisterSchema),
    defaultValues: {
      activityName: '',
      region: undefined
    }
  });

  // 폼 상태
  const { errors, isSubmitting } = formState;

  // 지역 선택 controller
  const { field: regionField } = useController({ name: 'region', control });

  // 코치 신청 핸들러
  const onSubmit = handleSubmit(async data => {
    setServerError(null);
    const result = await coachRegisterAction(data);
    if (result?.error) {
      setServerError(result.error);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      {serverError && (
        <div role="alert" className="mb-5 rounded-md bg-(--danger-100) px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

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
