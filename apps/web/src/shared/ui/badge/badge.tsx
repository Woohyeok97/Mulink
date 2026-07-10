import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/shared/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-[var(--green-700)] bg-primary text-primary-foreground [a&]:hover:bg-[var(--green-700)]',
        neutral: 'border-[var(--neutral-200)] bg-[var(--neutral-100)] text-[var(--neutral-700)]',
        brand: 'border-[var(--green-300)] bg-[var(--green-100)] text-[var(--green-800)]',
        success: 'border-[var(--success-500)] bg-[var(--success-100)] text-[var(--success-700)]',
        warning: 'border-[var(--warning-500)] bg-[var(--warning-100)] text-[var(--warning-700)]',
        danger: 'border-[var(--danger-500)] bg-[var(--danger-100)] text-[var(--danger-700)]',
        info: 'border-[var(--info-500)] bg-[var(--info-100)] text-[var(--info-700)]',
        outline: 'border-[var(--neutral-300)] bg-transparent text-[var(--neutral-600)]',
        destructive: 'border-[var(--danger-700)] bg-destructive text-white focus-visible:ring-destructive/20'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

function Badge({
  className,
  variant = 'default',
  asChild = false,
  dot = false,
  children,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    dot?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current opacity-80" />}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
