import * as React from 'react';

import { cn } from '@/shared/lib/utils';

function Input({
  className,
  type,
  leftIcon,
  rightIcon,
  ...props
}: React.ComponentProps<'input'> & {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}) {
  if (leftIcon || rightIcon) {
    return (
      <div
        className={cn(
          'flex h-11 w-full items-center gap-2 rounded-sm border border-input bg-(--neutral-50) px-3.5 transition-[border-color,box-shadow]',
          'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
          'has-[input:disabled]:bg-(--neutral-100) has-[input:disabled]:pointer-events-none has-[input:disabled]:opacity-50',
          'has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:ring-3 has-[input[aria-invalid=true]]:ring-destructive/20',
          className
        )}
      >
        {leftIcon && (
          <span className="inline-flex shrink-0 items-center text-(--neutral-400) [&_svg]:size-4.5">
            {leftIcon}
          </span>
        )}
        <input
          type={type}
          data-slot="input"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          {...props}
        />
        {rightIcon && (
          <span className="inline-flex shrink-0 items-center text-(--neutral-400) [&_svg]:size-4.5">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-sm border border-input bg-(--neutral-50) px-3.5 py-1 text-sm text-foreground transition-[border-color,box-shadow] outline-none',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-(--neutral-100) disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        className
      )}
      {...props}
    />
  );
}

export { Input };
