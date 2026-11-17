'use client';

// The What's New pop-up. Mount it once in the signed-in layout. When the
// person has posts they have not seen, it opens in the middle of the screen
// with the newest one's page in full and a few more by title, and two ways
// out: Got it, and See all (the What's New page). However it is closed,
// everything it showed counts as seen, so it never comes back for the same
// posts. It never makes anyone wait to close it.
//
// It stays shut on the What's New page itself, in a view-as session (the
// server answers nothing), while another pop-up is open (it waits for that
// one, up to a minute), and after it has shown once in this tab.
import { ChevronRight, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { buttonVariants, Dialog, DialogContent } from '../ui/ui-deps';
import { useMarkSeen, useUnseen } from './api';
import { usePaths, WhatsNewProvider } from './context';
import { PostPage } from './post-card';
import { SmartLink } from './smart-link';

const SHOWN_KEY = 'arvo-whats-new:shown';

/** True while another dialog is open: the pop-up never lands on top of one. */
function otherDialogOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"]:not([data-whats-new]), [role="alertdialog"]'));
}

export type WhatsNewPopupProps = Readonly<{
  basePath?: string;
  pageUrl?: string;
  /** Pages where it should never open (sign-up steps, say): true for those paths. */
  hiddenOn?: (pathname: string) => boolean;
}>;

export function WhatsNewPopup({ basePath, pageUrl, hiddenOn }: WhatsNewPopupProps) {
  return (
    <WhatsNewProvider basePath={basePath} pageUrl={pageUrl}>
      <Popup hiddenOn={hiddenOn} />
    </WhatsNewProvider>
  );
}

function Popup({ hiddenOn }: { hiddenOn?: (pathname: string) => boolean }) {
  const { pageUrl } = usePaths();
  const pathname = usePathname() ?? '';
  const onPage = pathname === pageUrl.replace(/[?#].*$/, '');
  const hidden = onPage || (hiddenOn ? hiddenOn(pathname) : false);
  const unseen = useUnseen(!hidden);
  const markSeen = useMarkSeen();
  const [open, setOpen] = useState(false);
  const shownFor = useRef<string | null>(null);
  const posts = unseen.data?.posts ?? [];
  const newest = posts[0] ?? null;

  useEffect(() => {
    if (hidden || !newest || open) return;
    let already: string | null = null;
    try {
      already = sessionStorage.getItem(SHOWN_KEY);
    } catch {
      // Storage refused (a private window): the server's mark still keeps it from coming back.
    }
    if (already === newest.id || shownFor.current === newest.id) return;
    let tries = 0;
    const attempt = () => {
      if (!otherDialogOpen()) {
        shownFor.current = newest.id;
        setOpen(true);
        return true;
      }
      tries += 1;
      return tries >= 30;
    };
    if (attempt()) return;
    const timer = setInterval(() => {
      if (attempt()) clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [hidden, newest, open]);

  function close() {
    setOpen(false);
    if (!newest) return;
    try {
      sessionStorage.setItem(SHOWN_KEY, newest.id);
    } catch {
      // See above.
    }
    markSeen.mutate(newest.id);
  }

  if (!newest) return null;
  const more = posts.slice(1);
  const total = unseen.data?.total ?? posts.length;
  const unlisted = Math.max(0, total - posts.length);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent
        size="xl"
        className="sm:max-w-4xl"
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            What&apos;s New
          </span>
        }
        footer={
          <>
            <SmartLink href={pageUrl} onClick={close} className={buttonVariants({ variant: 'ghost' })}>
              See all
            </SmartLink>
            <Dialog.Close render={<button type="button" className={buttonVariants({ variant: 'primary' })} />}>Got it</Dialog.Close>
          </>
        }
      >
        <div data-whats-new="">
          <PostPage post={newest} />
          {more.length ? (
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">You also missed</p>
              <ul className="mt-2 space-y-1.5">
                {more.map((post) => (
                  <li key={post.id} className="min-w-0">
                    <SmartLink
                      href={`${pageUrl}#post-${post.id}`}
                      onClick={close}
                      className="group inline-flex max-w-full items-start gap-1 text-sm font-medium [overflow-wrap:anywhere] text-primary hover:underline"
                    >
                      <span className="min-w-0">{post.title}</span>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </SmartLink>
                  </li>
                ))}
              </ul>
              {unlisted ? <p className="mt-2 text-xs text-muted-foreground">and {unlisted} more on What&apos;s New</p> : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog.Root>
  );
}
