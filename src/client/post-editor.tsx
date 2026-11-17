'use client';

// The post editor: paste the HTML the prompt made (or drop its file), and
// see it on the right exactly as people will. The title and
// the one line for emails fill themselves in from the page's own <title> and
// description. A post that went live once keeps its date, so the choices for
// it are "keep it live" or "hide it", never a new time.
import { useMemo, useState } from 'react';
import type { Audience, ManagedPost, PostInput, PromptFacts } from '../shared/api';
import { POST_TIPS } from '../shared/tips';
import { descriptionOf, titleOf } from '../shared/html';
import { LIMITS } from '../shared/limits';
import { postPrompt } from '../shared/prompts';
import { Button, Checkbox, cn, ConfirmDialog, Dialog, DialogContent, Field, InlineError, Input, Segmented, Spinner } from '../ui/ui-deps';
import { useDeletePost, useSavePost } from './api';
import { HtmlField } from './html-field';
import { ImageField } from './image-field';
import { PicturesButton } from './pictures';
import { PostPage, postDate } from './post-card';
import { PromptButton } from './prompt-dialog';

type When = 'now' | 'later' | 'draft';

/** "2026-11-25T09:00" for a datetime-local box, in the browser's own time. */
function localValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function tomorrowNine(): string {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(9, 0, 0, 0);
  return localValue(at);
}

export function Counter({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return <span className={over ? 'font-medium text-danger-strong' : undefined}>{value.length}/{max}</span>;
}

export function PostEditor({
  post,
  audiences,
  emails,
  facts,
  onClose,
}: {
  /** The post to change, or null for a new one. */
  post: ManagedPost | null;
  audiences: readonly Audience[];
  /** The app has marketing emails, so posts can go in the roundup. */
  emails: boolean;
  facts: PromptFacts;
  onClose: () => void;
}) {
  const wentLive = Boolean(post?.publishedAt && new Date(post.publishedAt).getTime() <= Date.now());
  const [html, setHtml] = useState(post?.html ?? '');
  const [title, setTitle] = useState(post?.title ?? '');
  const [summary, setSummary] = useState(post?.summary ?? '');
  const [cover, setCover] = useState<{ id: string; url: string } | null>(post?.coverImageId && post.coverUrl ? { id: post.coverImageId, url: post.coverUrl } : null);
  const [audience, setAudience] = useState<string[]>([...(post?.audience ?? [])]);
  const [inEmail, setInEmail] = useState(post?.inEmail ?? true);
  const [when, setWhen] = useState<When>(post ? (post.status === 'draft' ? 'draft' : post.status === 'scheduled' ? 'later' : 'now') : 'now');
  const [publishAt, setPublishAt] = useState(post?.status === 'scheduled' && post.publishedAt ? localValue(new Date(post.publishedAt)) : tomorrowNine());
  const [width, setWidth] = useState<'popup' | 'phone'>('popup');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useSavePost();
  const remove = useDeletePost();
  const prompt = useMemo(() => postPrompt(facts), [facts]);

  const dirty = !post ? Boolean(html.trim() || title || summary) : html !== post.html || title !== post.title || summary !== post.summary;
  const field = save.error?.param;
  const errorFor = (name: string) => (field === name ? save.error?.message : undefined);

  /** A new page fills in the title and the one line when they are still empty. */
  function changeHtml(next: string) {
    setHtml(next);
    if (!title.trim()) setTitle(titleOf(next).slice(0, LIMITS.postTitle));
    if (!summary.trim()) setSummary(descriptionOf(next).slice(0, LIMITS.postSummary));
  }

  function submit() {
    const input: PostInput = {
      title,
      summary,
      html,
      coverImageId: cover?.id ?? null,
      audience,
      inEmail,
      publish: when,
      publishAt: when === 'later' ? new Date(publishAt).toISOString() : null,
    };
    save.mutate({ id: post?.id ?? null, input }, { onSuccess: onClose });
  }

  const whenItems: { value: When; label: string }[] = wentLive
    ? [
        { value: 'now', label: post?.status === 'draft' ? 'Put it back live' : 'Keep it live' },
        { value: 'draft', label: post?.status === 'draft' ? 'Keep as draft' : 'Hide it (draft)' },
      ]
    : [
        { value: 'now', label: 'Publish now' },
        { value: 'later', label: 'Later' },
        { value: 'draft', label: 'Draft' },
      ];
  const saveLabel = when === 'draft' ? 'Save draft' : when === 'later' && !wentLive ? 'Schedule' : post?.status === 'live' ? 'Save' : 'Publish';
  const previewDate = when === 'later' && !wentLive ? new Date(publishAt).toISOString() : (post?.publishedAt ?? new Date().toISOString());

  return (
    <>
      <Dialog.Root open disablePointerDismissal={dirty} onOpenChange={(open) => (!open ? onClose() : undefined)}>
        <DialogContent
          size="xl"
          className="sm:max-w-[1180px]"
          title={post ? 'Edit post' : 'New post'}
          description="Make it with the prompt, paste it here, and check it on the right. It pops up once for everyone it's for, and stays on What's New."
          footerStart={
            post ? (
              <Button variant="ghost" className="text-danger-strong hover:text-danger-strong" onClick={() => setConfirmDelete(true)}>
                Delete post
              </Button>
            ) : null
          }
          footer={
            <>
              <Dialog.Close render={<Button variant="ghost" />}>Cancel</Dialog.Close>
              <Button variant="primary" onClick={submit} disabled={save.isPending}>
                {save.isPending ? <Spinner /> : null}
                {saveLabel}
              </Button>
            </>
          }
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <PromptButton
                  prompt={prompt}
                  title="The prompt for a What's New post"
                  steps="Run it in the product's repo with the best AI model at the time. Add what changed at the end, read the page it makes, and paste it here."
                />
                <PicturesButton />
              </div>
              <HtmlField value={html} onChange={changeHtml} error={errorFor('html')} />
              <Field label="Title" error={errorFor('title')} hint={<>From the page&apos;s own title if you leave it empty. <Counter value={title} max={LIMITS.postTitle} /></>}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Export any list to a spreadsheet" />
              </Field>
              <Field label="One line about it" optional error={errorFor('summary')} hint={<>The roundup email and the pop-up&apos;s list show it. <Counter value={summary} max={LIMITS.postSummary} /></>}>
                <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Every list now has an Export button." />
              </Field>
              {emails ? (
                <ImageField imageUrl={cover?.url ?? null} onChange={setCover} label="Picture for the email" hint="A picture of it working, for the roundup email. Drawings in the page don't show in email." />
              ) : null}
              {audiences.length ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-[13px] font-medium text-foreground">Who it&apos;s for</legend>
                  {audiences.map((a) => (
                    <Checkbox
                      key={a.key}
                      checked={audience.includes(a.key)}
                      onCheckedChange={(checked) => setAudience((now) => (checked ? [...now, a.key] : now.filter((k) => k !== a.key)))}
                    >
                      {a.label}
                    </Checkbox>
                  ))}
                  <p className="text-xs text-muted-foreground/80">{audience.length ? 'Only the groups ticked see it.' : 'None ticked: everyone sees it.'}</p>
                </fieldset>
              ) : null}
              {emails ? (
                <Checkbox
                  checked={inEmail}
                  onCheckedChange={setInEmail}
                  description="The next roundup email carries every live post with this ticked, once."
                >
                  Put it in the next roundup email
                </Checkbox>
              ) : null}
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-foreground">When it goes live</span>
                <Segmented label="When it goes live" value={when} onValueChange={setWhen} items={whenItems} className="w-fit" />
                {wentLive ? (
                  <p className="text-xs text-muted-foreground/80">It first went live on {postDate(post?.publishedAt)} and keeps that date, so nobody sees it pop up twice.</p>
                ) : when === 'later' ? (
                  <Field label="Goes live at" error={errorFor('publishAt')} hint="Your own time.">
                    <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className="w-fit" />
                  </Field>
                ) : null}
              </div>
              {save.error && (!field || field === 'publish' || field === 'audience' || field === 'coverImageId') ? <InlineError error={save.error} /> : null}
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Preview</p>
                <Segmented
                  label="Preview width"
                  value={width}
                  onValueChange={setWidth}
                  items={[
                    { value: 'popup', label: 'Pop-up' },
                    { value: 'phone', label: 'Phone' },
                  ]}
                />
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-3">
                {html.trim() ? (
                  <div className={cn('mx-auto rounded-xl bg-card p-3 shadow-sm transition-[max-width] duration-200', width === 'phone' ? 'max-w-[390px]' : 'max-w-full')}>
                    <PostPage post={{ title: title || 'Preview', html, publishedAt: previewDate }} />
                  </div>
                ) : (
                  <div className="px-6 py-16 text-center">
                    <p className="text-sm font-medium text-foreground">Paste the HTML and the post shows here, the way people will see it.</p>
                    <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-left">
                      {POST_TIPS.map((tip) => (
                        <li key={tip.title} className="text-xs leading-relaxed text-muted-foreground">
                          <span className="font-medium text-foreground">{tip.title}.</span> {tip.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog.Root>
      {post ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          danger
          title="Delete this post?"
          consequence={`"${post.title}" leaves What's New for everyone. This can't be undone.`}
          confirmLabel="Delete post"
          pendingLabel="Deleting…"
          pending={remove.isPending}
          onConfirm={() =>
            remove.mutate(post.id, {
              onSuccess: () => {
                setConfirmDelete(false);
                onClose();
              },
            })
          }
        >
          {remove.error ? <InlineError error={remove.error} /> : null}
        </ConfirmDialog>
      ) : null}
    </>
  );
}
