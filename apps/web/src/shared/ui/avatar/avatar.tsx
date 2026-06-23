'use client';

import * as React from 'react';
import { Avatar as AvatarPrimitive } from 'radix-ui';

import { cn } from '@/shared/lib/utils';

const tierBorderColor: Record<string, string> = {
  bronze: 'var(--tier-bronze)',
  silver: 'var(--tier-silver)',
  gold: 'var(--tier-gold)',
  platinum: 'var(--tier-platinum)',
  diamond: 'var(--tier-diamond)'
};

function Avatar({
  className,
  size = 'default',
  tier,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: 'sm' | 'default' | 'lg';
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        'group/avatar relative flex shrink-0 overflow-hidden rounded-full select-none',
        'size-11 data-[size=sm]:size-9 data-[size=lg]:size-14',
        className
      )}
      style={tier ? { boxShadow: `0 0 0 2px ${tierBorderColor[tier]}` } : undefined}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-(--green-100) text-sm font-semibold text-(--green-800)',
        'group-data-[size=sm]/avatar:text-xs',
        'group-data-[size=lg]/avatar:text-base',
        className
      )}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        'absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background select-none',
        'group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden',
        'group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2',
        'group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2',
        className
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        'group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background',
        className
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        'relative flex size-11 shrink-0 items-center justify-center rounded-full bg-(--green-100) text-sm font-semibold text-(--green-800) ring-2 ring-background',
        'group-has-data-[size=sm]/avatar-group:size-9 group-has-data-[size=sm]/avatar-group:text-xs',
        'group-has-data-[size=lg]/avatar-group:size-14 group-has-data-[size=lg]/avatar-group:text-base',
        '[&>svg]:size-4',
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount };
