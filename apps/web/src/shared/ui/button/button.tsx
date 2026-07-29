import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { Loader2 } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center cursor-pointer justify-center rounded-lg border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-[var(--shadow-sm)] hover:bg-[var(--green-700)]',
        emphasis:
          'bg-[var(--emphasis)] text-[var(--emphasis-foreground)] shadow-[var(--shadow-brand)] hover:bg-[var(--green-900)]',
        outline:
          'border-border bg-background hover:bg-[var(--green-50)] hover:border-[var(--green-400)] hover:text-[var(--green-700)]',
        secondary: 'bg-secondary text-secondary-foreground border-[var(--sand-300)] hover:bg-[var(--sand-200)]',
        ghost: 'hover:bg-[var(--green-50)] hover:text-[var(--green-700)]',
        destructive:
          'bg-destructive text-destructive-foreground shadow-[var(--shadow-sm)] hover:bg-[var(--danger-700)]',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-11 gap-2 px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4',
        sm: 'h-9 gap-1.5 px-4 text-sm rounded-[var(--radius-sm)] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        lg: 'h-[52px] gap-2 px-8 text-base has-data-[icon=inline-end]:pr-6 has-data-[icon=inline-start]:pl-6',
        icon: 'size-11',
        'icon-sm': 'size-9 rounded-[var(--radius-sm)]',
        'icon-lg': 'size-[52px]'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}>
      {loading ? (
        <Loader2 className="animate-spin" />
      ) : (
        leftIcon && <span className="inline-flex items-center">{leftIcon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
    </Comp>
  );
}

export { Button, buttonVariants };
