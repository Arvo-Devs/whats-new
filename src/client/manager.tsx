'use client';

// Admin › What's New: every post, drafts and scheduled ones first, with what
// each is doing (live, scheduled, draft), who it is for and whether it went
// out in an email. New post opens the editor; a row opens it for that post.
import { Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { Audience, ManagedPost } from '../shared/api';
import { Button, buttonVariants, cn, EmptyState, ErrorState, Segmented, Skeleton, Table, TBody, Td, Th, THead, Tr } from '../ui/ui-deps';
import { useManagePosts } from './api';
import { WhatsNewProvider } from './context';
import { postDate } from './post-card';
import { PostEditor } from './post-editor';

export type WhatsNewManagerProps = Readonly<{ basePath?: string }>;

export function WhatsNewManager({ basePath }: WhatsNewManagerProps) {
  return (
    <WhatsNewProvider basePath={basePath}>
      <Manager />
    </WhatsNewProvider>
  );
}

type Filter = 'all' | 'live' | 'scheduled' | 'draft';

function timeOf(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusChip({ post }: { post: ManagedPost }) {
  const styles = {
    live: 'border-success-border bg-success-soft text-success-strong',
    scheduled: 'border-warning-border bg-warning-soft text-warning-strong',
    draft: 'border-border bg-muted text-muted-foreground',
  } as const;
  const words = post.status === 'live' ? 'Live' : post.status === 'scheduled' ? 'Scheduled' : 'Draft';
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', styles[post.status])}>{words}</span>;
}

function when(post: ManagedPost): string {
  if (post.status === 'live' && post.publishedAt) return `Since ${postDate(post.publishedAt)}`;
  if (post.status === 'scheduled' && post.publishedAt) return timeOf(post.publishedAt);
  return post.publishedAt ? `Was live ${postDate(post.publishedAt)}` : 'Not live yet';
}

function emailWords(post: ManagedPost): string {
  if (!post.inEmail) return 'Left out';
  return post.status === 'live' ? 'In the roundup' : 'Once it is live';
}

function audienceWords(keys: readonly string[], audiences: readonly Audience[]): string {
  if (!keys.length) return 'Everyone';
  return keys.map((key) => audiences.find((a) => a.key === key)?.label ?? key).join(', ');
}

export function ManagerSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading posts">
      <Skeleton className="h-9 w-72" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function Manager() {
  const posts = useManagePosts();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<ManagedPost | 'new' | null>(null);

  if (posts.isPending) return <ManagerSkeleton />;
  if (posts.isError) return <ErrorState error={posts.error} onRetry={() => void posts.refetch()} retrying={posts.isRefetching} />;
  const { audiences, roundupEmails: emails, pageUrl, facts } = posts.data;
  const all = posts.data.posts;
  const shown = filter === 'all' ? all : all.filter((post) => post.status === filter);
  const count = (status: Filter) => all.filter((post) => post.status === status).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Show"
          value={filter}
          onValueChange={setFilter}
          items={[
            { value: 'all', label: `All ${all.length}` },
            { value: 'live', label: `Live ${count('live')}` },
            { value: 'scheduled', label: `Scheduled ${count('scheduled')}` },
            { value: 'draft', label: `Drafts ${count('draft')}` },
          ]}
        />
        <div className="flex items-center gap-2">
          <Link href={pageUrl} className={buttonVariants({ variant: 'ghost' })}>
            Open What&apos;s New
          </Link>
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            New post
          </Button>
        </div>
      </div>

      {!all.length ? (
        <EmptyState
          icon={Sparkles}
          title="No posts yet"
          action={
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              New post
            </Button>
          }
        >
          A post tells people about something new they can use. Make it with the prompt in New post, paste it in, and it pops up once for each of them and stays on What&apos;s New.
        </EmptyState>
      ) : !shown.length ? (
        <EmptyState compact title={`No ${filter === 'draft' ? 'drafts' : `${filter} posts`}`}>
          Pick All to see every post.
        </EmptyState>
      ) : (
        <Table label="Posts">
          <THead>
            <Th>Post</Th>
            <Th>Status</Th>
            <Th>When</Th>
            {audiences.length ? <Th>Who it&apos;s for</Th> : null}
            {emails ? <Th>Email</Th> : null}
          </THead>
          <TBody>
            {shown.map((post) => (
              <Tr key={post.id} interactive>
                <Td>
                  <button type="button" onClick={() => setEditing(post)} className="flex min-w-0 cursor-pointer items-center gap-3 text-left outline-none focus-visible:underline">
                    {post.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.coverUrl} alt="" className="h-9 w-16 shrink-0 rounded-md border border-border object-cover" />
                    ) : (
                      <span className="grid h-9 w-16 shrink-0 place-items-center rounded-md border border-border bg-muted text-muted-foreground">
                        <Sparkles className="size-4" aria-hidden />
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium [overflow-wrap:anywhere] text-foreground">{post.title}</span>
                      {post.summary ? <span className="line-clamp-1 text-xs text-muted-foreground">{post.summary}</span> : null}
                    </span>
                  </button>
                </Td>
                <Td>
                  <StatusChip post={post} />
                </Td>
                <Td className="text-[13px] whitespace-nowrap text-muted-foreground">{when(post)}</Td>
                {audiences.length ? <Td className="text-[13px] text-muted-foreground">{audienceWords(post.audience, audiences)}</Td> : null}
                {emails ? <Td className="text-[13px] whitespace-nowrap text-muted-foreground">{emailWords(post)}</Td> : null}
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      {editing ? (
        <PostEditor key={editing === 'new' ? 'new' : editing.id} post={editing === 'new' ? null : editing} audiences={audiences} emails={emails} facts={facts} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
