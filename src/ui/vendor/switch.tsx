'use client';

// Vendored from betterfanslink components/ui/switch.tsx (main cf653df): Switch and Checkbox, on the package's color names.
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <BaseSwitch.Root
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v)}
      disabled={disabled}
      aria-label={label}
      nativeButton
      render={<button type="button" />}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-input bg-background p-0.5 transition-colors duration-150',
        "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']",
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'data-[checked]:border-transparent data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className,
      )}
    >
      <BaseSwitch.Thumb className="block size-[18px] rounded-full bg-white shadow-[0_1px_2px_#00000040] transition-transform duration-150 data-[checked]:translate-x-4" />
    </BaseSwitch.Root>
  );
}

/** A checkbox with its label (and an optional line under it); a click anywhere on the row toggles it. */
export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  children,
  description,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 text-sm', disabled && 'cursor-not-allowed opacity-60', className)}>
      <BaseCheckbox.Root
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v)}
        disabled={disabled}
        className={cn(
          'mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-input bg-background',
          'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'data-[checked]:border-transparent data-[checked]:bg-primary',
        )}
      >
        <BaseCheckbox.Indicator className="text-primary-foreground data-[unchecked]:hidden">
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      <span className="flex min-w-0 flex-col">
        <span className="text-foreground">{children}</span>
        {description ? <span className="text-xs leading-relaxed text-muted-foreground/80">{description}</span> : null}
      </span>
    </label>
  );
}
