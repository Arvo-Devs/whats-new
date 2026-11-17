// What's New posts in the database: what readers get, the pop-up's rules,
// how far each person has seen, and the reads and writes of the Admin page.
// A post is one HTML page (usually made with the page's prompt), a title, a
// one-line summary and an optional picture for the roundup email.
//
// The pop-up's rules (the README has them in full):
// - It shows live posts for the person that are newer than their mark, newer
//   than their account, and from the last POPUP_WINDOW_DAYS days.
// - The mark is a time: every post published at or before it was shown or put
//   away. The server sets it from the post the pop-up showed, so a tab left
//   open for a week never moves it back, and a post published while the
//   pop-up was open still shows next time.
// - A post that went live keeps its first time if it goes back to draft and
//   live again, so nobody who put it away sees it pop up twice.
import { randomUUID } from 'node:crypto';
import type { ConfigCore, WhatsNewSql, WhatsNewUser } from '../config';
import type { ManagedPost, PostInput, PostStatus, PostView } from '../shared/api';
import { descriptionOf, looksLikeHtml, titleOf } from '../shared/html';
import { FEED_PAGE, LIMITS, POPUP_ALSO, POPUP_WINDOW_DAYS } from '../shared/limits';

export type PostRow = {
  id: string;
  title: string;
  summary: string;
  html: string;
  cover_image_id: string | null;
  audience: string[];
  status: 'draft' | 'published';
  published_at: Date | null;
  in_email: boolean;
  updated_at: Date;
};

/** The address a picture is served at: on the site (for the pages), or in full (for emails and for pasting into HTML). */
export function imagePath(config: Pick<ConfigCore, 'basePath' | 'siteUrl'>, id: string | null, full = false): string | null {
  if (!id) return null;
  const path = `${config.basePath}/images/${id}`;
  return full && config.siteUrl ? `${config.siteUrl}${path}` : path;
}

/** A post for readers. Without `withHtml` the page is left out, for lists that show only titles. */
export function postView(config: Pick<ConfigCore, 'basePath' | 'siteUrl'>, row: PostRow, options: Readonly<{ fullImages?: boolean; withHtml?: boolean }> = {}): PostView {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    html: options.withHtml ? row.html : '',
    coverUrl: imagePath(config, row.cover_image_id, options.fullImages),
    publishedAt: (row.published_at ?? row.updated_at).toISOString(),
  };
}

function audiencesOf(user: WhatsNewUser): string[] {
  return Array.isArray(user.audiences) ? user.audiences.filter((key): key is string => typeof key === 'string') : [];
}

function createdAtOf(user: WhatsNewUser): Date | null {
  if (!user.createdAt) return null;
  const at = new Date(user.createdAt);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** The pop-up's posts for one person, newest first: the newest with its page, POPUP_ALSO more by title, and how many there are in all. */
export async function unseenFor(sql: WhatsNewSql, config: ConfigCore, user: WhatsNewUser): Promise<{ posts: PostView[]; total: number }> {
  const audiences = audiencesOf(user);
  const joined = createdAtOf(user);
  const rows = await sql<(PostRow & { total: number })[]>`
    select p.*, count(*) over ()::int as total
    from whats_new_posts p
    left join whats_new_readers r on r.user_id = ${user.id}
    where p.status = 'published'
      and p.published_at <= now()
      and p.published_at > now() - make_interval(days => ${POPUP_WINDOW_DAYS})
      and (r.seen_through is null or p.published_at > r.seen_through)
      and (${joined}::timestamptz is null or p.published_at > ${joined}::timestamptz)
      and (cardinality(p.audience) = 0 or p.audience && ${audiences}::text[])
    order by p.published_at desc, p.id
    limit ${1 + POPUP_ALSO}
  `;
  return { posts: rows.map((row, i) => postView(config, row, { withHtml: i === 0 })), total: rows[0]?.total ?? 0 };
}

/** One page of What's New for one person, newest first, before `before` when given. */
export async function feedFor(
  sql: WhatsNewSql,
  config: ConfigCore,
  user: WhatsNewUser,
  before: Date | null,
): Promise<{ posts: PostView[]; hasMore: boolean; seenThrough: string | null }> {
  const audiences = audiencesOf(user);
  const rows = await sql<PostRow[]>`
    select p.* from whats_new_posts p
    where p.status = 'published'
      and p.published_at <= now()
      and (${before}::timestamptz is null or p.published_at < ${before}::timestamptz)
      and (cardinality(p.audience) = 0 or p.audience && ${audiences}::text[])
    order by p.published_at desc, p.id
    limit ${FEED_PAGE + 1}
  `;
  const reader = await sql<{ seen_through: Date }[]>`select seen_through from whats_new_readers where user_id = ${user.id}`;
  return {
    posts: rows.slice(0, FEED_PAGE).map((row) => postView(config, row, { withHtml: true })),
    hasMore: rows.length > FEED_PAGE,
    seenThrough: reader[0]?.seen_through.toISOString() ?? null,
  };
}

/**
 * Moves the person's mark up to the post they were shown (never back). A
 * post that is not live, or not theirs to see, moves nothing. True when the
 * post was one they may see.
 */
export async function markSeen(sql: WhatsNewSql, user: WhatsNewUser, postId: string): Promise<boolean> {
  const audiences = audiencesOf(user);
  const rows = await sql<{ user_id: string }[]>`
    insert into whats_new_readers (user_id, seen_through)
    select ${user.id}, p.published_at from whats_new_posts p
    where p.id = ${postId}
      and p.status = 'published'
      and p.published_at <= now()
      and (cardinality(p.audience) = 0 or p.audience && ${audiences}::text[])
    on conflict (user_id) do update
      set seen_through = greatest(whats_new_readers.seen_through, excluded.seen_through), updated_at = now()
    returning user_id
  `;
  return rows.length > 0;
}

function statusOf(row: PostRow, now: Date): PostStatus {
  if (row.status === 'draft' || !row.published_at) return 'draft';
  return row.published_at.getTime() > now.getTime() ? 'scheduled' : 'live';
}

/** Every post, for the Admin page: drafts and scheduled first, then live, newest first. */
export async function allPosts(sql: WhatsNewSql, config: ConfigCore): Promise<ManagedPost[]> {
  const rows = await sql<PostRow[]>`
    select p.* from whats_new_posts p
    order by (p.status = 'draft') desc, p.published_at desc nulls first, p.updated_at desc
    limit 500
  `;
  const now = new Date();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    html: row.html,
    coverImageId: row.cover_image_id,
    coverUrl: imagePath(config, row.cover_image_id),
    audience: row.audience,
    status: statusOf(row, now),
    publishedAt: row.published_at?.toISOString() ?? null,
    inEmail: row.in_email,
    updatedAt: row.updated_at.toISOString(),
  }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : '';
}

/** A field the editor sent that cannot be saved: what to tell the person, and which field. */
export type FieldError = Readonly<{ error: string; field: string }>;

export function isFieldError(value: unknown): value is FieldError {
  return !!value && typeof value === 'object' && !Array.isArray(value) && typeof (value as { error?: unknown }).error === 'string';
}

/** The app's groups a post or email is for: only keys the app named. */
export function readAudience(body: Record<string, unknown>, config: Pick<ConfigCore, 'audiences'>): string[] | FieldError {
  const raw = body.audience;
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return { error: 'Pick who it is for from the list.', field: 'audience' };
  const keys = [...new Set(raw.filter((key): key is string => typeof key === 'string'))];
  if (keys.length !== raw.length || keys.some((key) => !config.audiences.some((a) => a.key === key))) {
    return { error: 'Pick who it is for from the list.', field: 'audience' };
  }
  return keys;
}

/** A picture id the editor sent: none, or one in the uuid form uploads get. */
export function readImageId(value: unknown, field: string): string | null | FieldError {
  if (value === null || value === undefined || value === '') return null;
  return isUuid(value) ? value : { error: 'That picture is not one this page uploaded. Add it again.', field };
}

/** Pasted HTML, checked: there, HTML, and not too big. */
export function readHtml(value: unknown, field = 'html'): string | FieldError {
  const html = typeof value === 'string' ? value.trim() : '';
  if (!html) return { error: 'Paste the HTML, or drop the .html file here.', field };
  if (!looksLikeHtml(html)) return { error: "That isn't HTML. Paste the whole file the prompt made.", field };
  if (html.length > LIMITS.html) return { error: 'That HTML is over 1 MB. Put pictures in by link from Pictures instead of inside the file.', field };
  return html;
}

/** A post from the editor, checked. The title and summary come from the page's own <title> and description when they are left empty. */
export function readPostInput(body: Record<string, unknown>, config: Pick<ConfigCore, 'audiences'>): PostInput | FieldError {
  const html = readHtml(body.html);
  if (isFieldError(html)) return html;
  const title = (text(body.title) || titleOf(html)).replace(/\s+/g, ' ');
  if (!title) return { error: "Give the post a title, or put one in the page's <title>.", field: 'title' };
  if (title.length > LIMITS.postTitle) return { error: `Keep the title to ${LIMITS.postTitle} characters.`, field: 'title' };
  const summary = (text(body.summary) || descriptionOf(html)).replace(/\s+/g, ' ');
  if (summary.length > LIMITS.postSummary) return { error: `Keep the one line to ${LIMITS.postSummary} characters.`, field: 'summary' };
  const coverImageId = readImageId(body.coverImageId, 'coverImageId');
  if (isFieldError(coverImageId)) return coverImageId;
  const audience = readAudience(body, config);
  if (isFieldError(audience)) return audience;
  const publish = body.publish;
  if (publish !== 'draft' && publish !== 'now' && publish !== 'later') return { error: 'Choose to save a draft, publish now or publish later.', field: 'publish' };
  let publishAt: string | null = null;
  if (publish === 'later') {
    const at = typeof body.publishAt === 'string' ? new Date(body.publishAt) : null;
    if (!at || Number.isNaN(at.getTime())) return { error: 'Pick when it goes live.', field: 'publishAt' };
    if (at.getTime() < Date.now() + 60_000) return { error: 'Pick a time in the future, or publish it now.', field: 'publishAt' };
    if (at.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) return { error: 'Pick a time within the next year.', field: 'publishAt' };
    publishAt = at.toISOString();
  }
  return { title, summary, html, coverImageId, audience, inEmail: body.inEmail !== false, publish, publishAt };
}

/** Makes a post. Answers its id. */
export async function createPost(sql: WhatsNewSql, input: PostInput, by: string): Promise<string> {
  const id = randomUUID();
  const status = input.publish === 'draft' ? 'draft' : 'published';
  const publishedAt = input.publish === 'later' ? (input.publishAt ?? null) : input.publish === 'now' ? new Date().toISOString() : null;
  await sql`
    insert into whats_new_posts (id, title, summary, html, cover_image_id, audience, status, published_at, in_email, created_by, updated_by)
    values (${id}, ${input.title}, ${input.summary}, ${input.html}, ${input.coverImageId}, ${input.audience as string[]}::text[],
            ${status}, ${publishedAt}, ${input.inEmail}, ${by}, ${by})
  `;
  return id;
}

/**
 * Changes a post. A post that already went live keeps the time it first went
 * live, whatever `publish` says: back to draft hides it, and publishing it
 * again (now or later) puts it back where it was. False when there is no such
 * post.
 */
export async function updatePost(sql: WhatsNewSql, id: string, input: PostInput, by: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    const rows = await tx<PostRow[]>`select * from whats_new_posts where id = ${id} for update`;
    const row = rows[0];
    if (!row) return false;
    const wentLive = row.published_at !== null && row.published_at.getTime() <= Date.now();
    let status: 'draft' | 'published' = input.publish === 'draft' ? 'draft' : 'published';
    let publishedAt: string | null;
    if (wentLive) publishedAt = row.published_at!.toISOString();
    else if (input.publish === 'later') publishedAt = input.publishAt ?? null;
    else if (input.publish === 'now') publishedAt = new Date().toISOString();
    else publishedAt = null;
    if (status === 'published' && !publishedAt) status = 'draft';
    await tx`
      update whats_new_posts set
        title = ${input.title}, summary = ${input.summary}, html = ${input.html}, cover_image_id = ${input.coverImageId},
        audience = ${input.audience as string[]}::text[], status = ${status}, published_at = ${publishedAt}, in_email = ${input.inEmail},
        updated_by = ${by}, updated_at = now()
      where id = ${id}
    `;
    return true;
  });
}

export async function deletePost(sql: WhatsNewSql, id: string): Promise<boolean> {
  const rows = await sql`delete from whats_new_posts where id = ${id} returning id`;
  return rows.length > 0;
}
