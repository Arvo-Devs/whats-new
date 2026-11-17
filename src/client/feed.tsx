'use client';

// The What's New page's body: every post the person may see, newest first,
// in months, five at a time, each its own page in a sealed frame. Posts newer than what they had seen carry a New
// chip, and opening the page counts them as seen, so the pop-up won't show
// them again. A link to #post-<id> (from the pop-up or an email) scrolls to
// that post once it has loaded.
import { Sparkles } from 'lucide-react';
import { Fragment, useEffect, useRef } from 'react';
import { useFeed, useMarkSeen } from './api';
import { WhatsNewProvider } from './context';
import { PostPage } from './post-card';
import { POPUP_WINDOW_DAYS } from '../shared/limits';
import { Button, EmptyState, ErrorState, Skeleton, Spinner } from '../ui/ui-deps';

export type WhatsNewFeedProps = Readonly<{ basePath?: string; pageUrl?: string }>;

export function WhatsNewFeed({ basePath, pageUrl }: WhatsNewFeedProps) {
  return (
    <WhatsNewProvider basePath={basePath} pageUrl={pageUrl}>
      <Feed />
    </WhatsNewProvider>
  );
}

/** Newer than what they had seen; with nothing seen yet, from the last 30 days, so a first visit isn't all New. */
function isNew(publishedAt: string, seenThrough: string | null): boolean {
  if (seenThrough) return publishedAt > seenThrough;
  return Date.now() - new Date(publishedAt).getTime() < POPUP_WINDOW_DAYS * 86_400_000;
}

function monthOf(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function FeedSkeleton() {
  return (
    <div className="max-w-4xl space-y-10" aria-busy="true" aria-label="Loading What's New">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[16/9] w-full rounded-xl" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  );
}

function Feed() {
  const feed = useFeed();
  const markSeen = useMarkSeen();
  const marked = useRef(false);
  const scrolled = useRef(false);
  const pages = feed.data?.pages ?? [];
  const posts = pages.flatMap((page) => page.posts);
  // The mark as it was when the page opened, so the chips stay while the person reads.
  const seenThrough = pages[0]?.seenThrough ?? null;

  useEffect(() => {
    const newest = posts[0];
    if (!newest || marked.current) return;
    marked.current = true;
    if (!seenThrough || newest.publishedAt > seenThrough) markSeen.mutate(newest.id);
  }, [posts, seenThrough, markSeen]);

  useEffect(() => {
    if (scrolled.current || !posts.length) return;
    const hash = typeof window === 'undefined' ? '' : window.location.hash;
    if (!hash.startsWith('#post-')) return;
    const target = document.getElementById(hash.slice(1));
    if (target) {
      scrolled.current = true;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (feed.hasNextPage && !feed.isFetchingNextPage) {
      // An older post: keep loading until it is on the page.
      void feed.fetchNextPage();
    }
  }, [posts, feed]);

  if (feed.isPending) return <FeedSkeleton />;
  if (feed.isError) return <ErrorState error={feed.error} onRetry={() => void feed.refetch()} retrying={feed.isRefetching} />;
  if (!posts.length) {
    return (
      <EmptyState icon={Sparkles} title="Nothing new yet">
        New features and changes show up here as soon as they go live.
      </EmptyState>
    );
  }

  let month = '';
  return (
    <div className="max-w-4xl">
      {posts.map((post) => {
        const thisMonth = monthOf(post.publishedAt);
        const heading = thisMonth !== month ? thisMonth : null;
        month = thisMonth;
        return (
          <Fragment key={post.id}>
            {heading ? <h2 className="mt-10 mb-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase first:mt-0">{heading}</h2> : null}
            <PostPage post={post} isNew={isNew(post.publishedAt, seenThrough)} className="mb-6 rounded-2xl border border-border bg-card p-4 sm:p-5" />
          </Fragment>
        );
      })}
      {feed.hasNextPage ? (
        <div className="flex justify-center pt-2 pb-6">
          <Button onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
            {feed.isFetchingNextPage ? <Spinner /> : null}
            Show older
          </Button>
        </div>
      ) : null}
    </div>
  );
}
