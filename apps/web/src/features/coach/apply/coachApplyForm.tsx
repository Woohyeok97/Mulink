'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mic2, MapPin, UserPlus } from 'lucide-react';

import { Input } from '@/shared/ui/input/input';
import { Button } from '@/shared/ui/button/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select/select';
import {
  coachApplySchema,
  REGIONS,
  type CoachApplyFormValues,
} from './coachApplySchema';
import { registerCoachAction } from './coach.action';

export function CoachApplyForm() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CoachApplyFormValues>({
    resolver: zodResolver(coachApplySchema),
  });

  async function onSubmit(values: CoachApplyFormValues) {
    setServerError(null);
    const result = await registerCoachAction(values);
    if (result?.error) {
      setServerError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full">
      {serverError && (
        <div
          role="alert"
          className="mb-5 rounded-md bg-(--danger-100) px-4 py-3 text-sm text-(--danger-700)"
        >
          {serverError}
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-semibold text-(--neutral-700)">
            <Mic2 className="size-3.5 text-(--green-600)" />
            활동명
          </label>
          <Input
            placeholder="활동명을 입력해 주세요"
            aria-invalid={errors.activityName ? 'true' : undefined}
            {...register('activityName')}
          />
          {errors.activityName && (
            <p className="text-xs text-destructive">{errors.activityName.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-sm font-semibold text-(--neutral-700)">
            <MapPin className="size-3.5 text-(--green-600)" />
            활동 지역
          </label>
          <Controller
            name="region"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger
                  className="w-full"
                  aria-invalid={errors.region ? 'true' : undefined}
                >
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
            )}
          />
          {errors.region && (
            <p className="text-xs text-destructive">{errors.region.message}</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Button
          type="submit"
          variant="emphasis"
          size="lg"
          loading={isSubmitting}
          leftIcon={<UserPlus className="size-[18px]" />}
          className="w-full"
        >
          코치 가입하기
        </Button>
      </div>
    </form>
  );
}
