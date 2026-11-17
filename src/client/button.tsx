'use client';

// The What's New button for the app's header. It goes to the What's New page
// and shows a dot while the person has posts they have not seen. On a phone
// it is the icon alone, but it is always there, so phones can reach every
// post too.
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useUnseen } from './api';
import { usePaths, WhatsNewProvider } from './context';
import { buttonVariants, cn } from '../ui/ui-deps';

export type WhatsNewButtonProps = Readonly<{ basePath?: string; pageUrl?: string; className?: string }>;

export function WhatsNewButton({ basePath, pageUrl, className }: WhatsNewButtonProps) {
  return (
    <WhatsNewProvider basePath={basePath} pageUrl={pageUrl}>
      <HeaderButton className={className} />
    </WhatsNewProvider>
  );
}

function HeaderButton({ className }: { className?: string }) {
  const { pageUrl } = usePaths();
  const unseen = useUnseen();
  const count = unseen.data?.total ?? 0;
  return (
    <Link
      href={pageUrl}
      aria-label={count ? `What's New, ${count} new` : "What's New"}
      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'relative max-sm:size-9 max-sm:px-0', className)}
    >
      <Sparkles aria-hidden />
      <span className="max-sm:sr-only">What&apos;s New</span>
      {count ? <span aria-hidden className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background sm:top-1.5 sm:right-1.5" /> : null}
    </Link>
  );
}
