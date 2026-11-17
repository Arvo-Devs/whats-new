'use client';

// A multi-line box on the same look as ./input (BetterFans Link's Input), for the text of a post or an email.
import type { ComponentProps } from 'react';
import { cn } from './cn';
import { useFieldControl } from './field';
import { inputClass } from './input';

export function Textarea({ className, id, ...props }: ComponentProps<'textarea'>) {
  const field = useFieldControl(id);
  return <textarea {...field} className={cn(inputClass, 'h-auto min-h-24 resize-y py-2 leading-relaxed', className)} {...props} />;
}
