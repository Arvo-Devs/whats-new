'use client';

// Vendored from betterfanslink components/ui/dialog.tsx (main d4138f9): Dialog, DialogContent and ConfirmDialog, on the package's color names.
// Changed in @arvo/team, kept here: every dialog opens in the CENTER of the screen at every width (Framework Part 3: pop-ups open in the center;
// BetterFans Link's became a bottom sheet under 640 px). On a phone it sits 16 px from each edge, its middle scrolls, and its buttons
// stay pinned at the bottom, stacked full width with the main one first. DialogContent takes `footerStart` for the button that sits at
// the left on a wide screen (Delete post, Remove) and comes last when the buttons stack; ConfirmDialog takes `pendingLabel`
// ("Removing…") for its button while it works.
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button, Spinner } from './button';
import { cn } from './cn';

export const Dialog = BaseDialog;

const backdropClass =
  'fixed inset-0 z-50 bg-[#06060e]/60 backdrop-blur-[2px] transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0';

/**
 * A dialog in the center of the screen, at every width. Put a Dialog.Root
 * around it and a Dialog.Trigger next to it, or control `open`. `footer` is
 * the buttons on the right (Cancel, then the main one last); `footerStart`
 * is a button on the left.
 */
export function DialogContent({
  title,
  description,
  children,
  footer,
  footerStart,
  className,
  size = 'md',
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  footerStart?: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  return (
    <BaseDialog.Portal>
      <DialogBody title={title} description={description} footer={footer} footerStart={footerStart} className={className} size={size}>
        {children}
      </DialogBody>
    </BaseDialog.Portal>
  );
}

/**
 * The element that had focus when the dialog opened. Most dialogs here are
 * opened by a plain button or a menu item rather than a Dialog.Trigger, and
 * without this Base UI drops focus on the body when they close, so a keyboard
 * user starts over from the top of the page.
 */
function useReturnFocus() {
  const [opener] = useState(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)));
  return () => (opener && opener !== document.body && opener.isConnected ? opener : true);
}

function DialogBody({
  title,
  description,
  children,
  footer,
  footerStart,
  className,
  size,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  footerStart?: ReactNode;
  className?: string;
  size: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const finalFocus = useReturnFocus();
  return (
    <>
      <BaseDialog.Backdrop className={backdropClass} />
      {/* 16 px from each edge on a phone, 24 px on a wider screen; the popup is never taller than what is left. */}
      <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <BaseDialog.Popup
          finalFocus={finalFocus}
          className={cn(
            'flex max-h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-input bg-card text-foreground shadow-lg outline-none',
            'transition-[transform,opacity] duration-200 ease-out',
            'data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0',
            size === 'sm' && 'max-w-md',
            size === 'md' && 'max-w-lg',
            size === 'lg' && 'max-w-2xl',
            // The editors: the form and its preview side by side on a wide screen.
            size === 'xl' && 'max-w-5xl',
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-5">
            <div className="min-w-0">
              <BaseDialog.Title className="text-base font-semibold tracking-tight [overflow-wrap:anywhere] text-foreground">{title}</BaseDialog.Title>
              {description ? (
                <BaseDialog.Description className="mt-1 text-sm leading-relaxed [overflow-wrap:anywhere] text-muted-foreground">{description}</BaseDialog.Description>
              ) : null}
            </div>
            <BaseDialog.Close
              aria-label="Close"
              className="-mt-1 -mr-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground/80 outline-none hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-4" aria-hidden />
            </BaseDialog.Close>
          </div>
          {/* The middle scrolls; the title and the buttons stay put. */}
          {children ? <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-5">{children}</div> : <div className="pb-5" />}
          {footer || footerStart ? (
            // Stacked on a phone, full width and taller to tap, the main button (last in `footer`) on top and `footerStart` at the bottom;
            // in a row from 640 px, `footerStart` at the left and the rest at the right.
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-background/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end max-sm:[&_button]:h-10">
              {footerStart ? <div className="flex flex-col gap-2 sm:mr-auto sm:flex-row">{footerStart}</div> : null}
              {footer}
            </div>
          ) : null}
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </>
  );
}

/**
 * Confirmation for a consequential action. `consequence` is the one sentence
 * the person needs before they click.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  consequence,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Cancel',
  pending,
  disabled,
  danger,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  consequence: ReactNode;
  confirmLabel: string;
  /** What the button says while it works, such as "Removing…". */
  pendingLabel?: string;
  /** The dismiss button, when "Cancel" would read badly next to the action, such as "Keep link". */
  cancelLabel?: string;
  pending?: boolean;
  /** Blocks confirming without a spinner, for example until a name is typed. */
  disabled?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title={title}
        description={consequence}
        footer={
          <>
            <BaseDialog.Close render={<Button variant="ghost" />}>{cancelLabel}</BaseDialog.Close>
            <Button variant={danger ? 'danger' : 'primary'} disabled={pending || disabled} onClick={onConfirm}>
              {pending ? <Spinner /> : null}
              {pending && pendingLabel ? pendingLabel : confirmLabel}
            </Button>
          </>
        }
      >
        {children}
      </DialogContent>
    </BaseDialog.Root>
  );
}
