'use client';

// One post as people read it: its date, and its HTML page in a sealed frame.
// The pop-up, the What's New page and the editor's preview all draw it with
// this, so the preview is what people get.
import { cn } from '../ui/ui-deps';
import { HtmlFrame } from './html-frame';

/** "November 24, 2026" in the reader's own time. */
export function postDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function PostPicture({ url, className }: { url: string; className?: string }) {
  return (
    // A plain img: the picture comes from the package's own route, and next/image would need the app to allow it.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" className={cn('block w-full rounded-xl border border-border bg-muted object-cover', className)} />
  );
}

export function PostPage({
  post,
  isNew,
  className,
}: {
  post: Readonly<{ id?: string; title: string; html: string; publishedAt?: string | null }>;
  isNew?: boolean;
  className?: string;
}) {
  return (
    <article id={post.id ? `post-${post.id}` : undefined} aria-label={post.title} className={cn('min-w-0 scroll-mt-24', className)}>
      {post.publishedAt ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <time dateTime={post.publishedAt}>{postDate(post.publishedAt)}</time>
          {isNew ? <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">New</span> : null}
        </div>
      ) : null}
      <HtmlFrame html={post.html} title={post.title} />
    </article>
  );
}
