/**
 * What's New against a real Postgres, through createWhatsNew and a pretend
 * app (fake-app.ts): who sees which posts, the pop-up's rules, the mark that
 * only moves forward, drafts and scheduled posts, groups, pictures, and who
 * may reach each route. Runs only with WHATS_NEW_TEST_PG_URL (a Postgres the
 * test may create databases on): each run makes its own database from
 * migrations/*.sql and drops it at the end.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import postgres from 'postgres';
import { createWhatsNew, type WhatsNew } from '../src/index';
import type { FeedAnswer, ManagePostsAnswer, UnseenAnswer } from '../src/shared/api';
import { cookieFor, fakeConfig, migrate, PNG, request } from './fake-app';

const ROOT_URL = process.env.WHATS_NEW_TEST_PG_URL ?? '';

describe.skipIf(!ROOT_URL)("What's New (pg)", () => {
  const database = `whats_new_test_${process.pid}_${Date.now()}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let app: WhatsNew;

  const get = async <T>(path: string, who: string | null) => {
    const response = await app.routeHandlers.GET(request(path, { cookie: who ? cookieFor(who) : undefined }));
    return { status: response.status, body: (await response.json()) as T };
  };
  const post = (path: string, who: string, body: unknown, origin?: string | null) =>
    app.routeHandlers.POST(request(path, { cookie: cookieFor(who), body, origin }));
  const page = (words: string) => `<!DOCTYPE html><html><head><title>${words}</title></head><body><h1>${words}</h1></body></html>`;
  const newPost = async (fields: Record<string, unknown>) => {
    const response = await post('/api/whats-new/manage/posts', 'admin', { html: page(String(fields.title ?? 'A post')), publish: 'now', audience: [], ...fields });
    expect(response.status).toBe(201);
    return ((await response.json()) as { id: string }).id;
  };
  const unseen = (who: string) => get<UnseenAnswer>('/api/whats-new/unseen', who);
  const feed = (who: string, query = '') => get<FeedAnswer>(`/api/whats-new/feed${query}`, who);
  /** Moves a post's time, as if it went live then. */
  const liveAt = (id: string, at: Date) => sql`update whats_new_posts set published_at = ${at} where id = ${id}`;

  beforeAll(async () => {
    admin = postgres(ROOT_URL, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database ${database}`);
    const url = new URL(ROOT_URL);
    url.pathname = `/${database}`;
    sql = postgres(url.href, { max: 4, onnotice: () => {} });
    await migrate(sql);
    // Twice: an app that runs the file again changes nothing.
    await migrate(sql);
    app = createWhatsNew(fakeConfig({ db: () => sql }));
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists ${database} with (force)`);
    await admin?.end();
  });

  beforeEach(async () => {
    await sql`truncate whats_new_posts, whats_new_readers, whats_new_images`;
  });

  test('a live post pops up once, and the page still has it after', async () => {
    const id = await newPost({ title: 'Export any list' });
    const first = await unseen('agency');
    expect(first.status).toBe(200);
    expect(first.body.posts.map((p) => p.id)).toEqual([id]);
    expect(first.body.total).toBe(1);

    expect((await post('/api/whats-new/seen', 'agency', { through: id })).status).toBe(204);
    expect((await unseen('agency')).body.posts).toEqual([]);
    expect((await feed('agency')).body.posts.map((p) => p.id)).toEqual([id]);
    // Someone else's pop-up is untouched.
    expect((await unseen('creator')).body.posts.map((p) => p.id)).toEqual([id]);
  });

  test('newest first, one in full and three more, with how many in all', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const id = await newPost({ title: `Post ${i}` });
      await liveAt(id, new Date(Date.now() - (10 - i) * 60_000));
      ids.push(id);
    }
    const out = await unseen('agency');
    expect(out.body.posts.map((p) => p.title)).toEqual(['Post 5', 'Post 4', 'Post 3', 'Post 2']);
    expect(out.body.total).toBe(6);
    // Putting the pop-up away through the newest clears all six.
    await post('/api/whats-new/seen', 'agency', { through: ids[5] });
    expect((await unseen('agency')).body.total).toBe(0);
  });

  test('the mark never moves back, and a post published while the pop-up was open still shows', async () => {
    const older = await newPost({ title: 'Older' });
    await liveAt(older, new Date(Date.now() - 5 * 60_000));
    const newer = await newPost({ title: 'Newer' });
    await liveAt(newer, new Date(Date.now() - 60_000));
    await post('/api/whats-new/seen', 'agency', { through: newer });
    // An old tab puts away the older post afterwards: nothing comes back.
    await post('/api/whats-new/seen', 'agency', { through: older });
    expect((await unseen('agency')).body.posts).toEqual([]);

    // The pop-up showed `newer`; a post went live after it opened.
    const late = await newPost({ title: 'Late' });
    await post('/api/whats-new/seen', 'agency', { through: newer });
    expect((await unseen('agency')).body.posts.map((p) => p.id)).toEqual([late]);
  });

  test('a new account never gets the posts from before it joined, nor anything over 30 days old', async () => {
    const id = await newPost({ title: 'Before you joined' });
    expect((await unseen('fresh')).body.posts).toEqual([]);
    expect((await feed('fresh')).body.posts.map((p) => p.id)).toEqual([id]);

    const old = await newPost({ title: 'Long ago' });
    await liveAt(old, new Date(Date.now() - 31 * 86_400_000));
    expect((await unseen('agency')).body.posts.map((p) => p.title)).toEqual(['Before you joined']);
  });

  test('a post for one group reaches only that group, on the page and in the pop-up', async () => {
    const forAgencies = await newPost({ title: 'Agencies only', audience: ['agency'] });
    const forEveryone = await newPost({ title: 'Everyone' });
    expect((await unseen('agency')).body.posts.map((p) => p.id).sort()).toEqual([forAgencies, forEveryone].sort());
    expect((await unseen('creator')).body.posts.map((p) => p.id)).toEqual([forEveryone]);
    expect((await feed('creator')).body.posts.map((p) => p.id)).toEqual([forEveryone]);
    // Putting away a post they may not see moves nothing.
    await liveAt(forAgencies, new Date(Date.now() + 0));
    await post('/api/whats-new/seen', 'creator', { through: forAgencies });
    expect((await unseen('creator')).body.posts.map((p) => p.id)).toEqual([forEveryone]);
  });

  test('drafts and scheduled posts stay hidden until their time', async () => {
    const draft = await newPost({ title: 'Draft', publish: 'draft' });
    const later = await newPost({ title: 'Later', publish: 'later', publishAt: new Date(Date.now() + 3_600_000).toISOString() });
    expect((await feed('agency')).body.posts).toEqual([]);
    expect((await unseen('agency')).body.posts).toEqual([]);
    const managed = await get<ManagePostsAnswer>('/api/whats-new/manage/posts', 'admin');
    expect(Object.fromEntries(managed.body.posts.map((p) => [p.id, p.status]))).toEqual({ [draft]: 'draft', [later]: 'scheduled' });

    // Its time comes.
    await liveAt(later, new Date(Date.now() - 1000));
    expect((await unseen('agency')).body.posts.map((p) => p.id)).toEqual([later]);
  });

  test('back to draft and live again keeps its first time, so it never pops up twice', async () => {
    const id = await newPost({ title: 'Original' });
    await liveAt(id, new Date(Date.now() - 60_000));
    const firstTime = (await sql<{ published_at: Date }[]>`select published_at from whats_new_posts where id = ${id}`)[0]!.published_at;
    await post('/api/whats-new/seen', 'agency', { through: id });

    const change = (publish: string, extra: Record<string, unknown> = {}) =>
      post(`/api/whats-new/manage/posts/${id}`, 'admin', { title: 'Fixed typo', html: page('Fixed typo'), audience: [], publish, ...extra });
    expect((await change('draft')).status).toBe(200);
    expect((await feed('agency')).body.posts).toEqual([]);
    expect((await change('later', { publishAt: new Date(Date.now() + 86_400_000).toISOString() })).status).toBe(200);
    const row = (await sql<{ published_at: Date; status: string; title: string }[]>`select published_at, status, title from whats_new_posts where id = ${id}`)[0]!;
    expect(row.status).toBe('published');
    expect(row.published_at.toISOString()).toBe(firstTime.toISOString());
    expect(row.title).toBe('Fixed typo');
    expect((await unseen('agency')).body.posts).toEqual([]);
    expect((await feed('agency')).body.posts.map((p) => p.title)).toEqual(['Fixed typo']);
  });

  test('a view-as session never sees the pop-up or moves the mark', async () => {
    const id = await newPost({ title: 'Hello' });
    expect((await unseen('staff')).body.posts).toEqual([]);
    expect((await post('/api/whats-new/seen', 'staff', { through: id })).status).toBe(204);
    expect((await sql`select * from whats_new_readers`).length).toBe(0);
  });

  test('the page goes back in pages of five (each post is a whole page)', async () => {
    for (let i = 0; i < 12; i += 1) {
      const id = await newPost({ title: `P${i}` });
      await liveAt(id, new Date(Date.now() - (20 - i) * 60_000));
    }
    const first = await feed('agency');
    expect(first.body.posts.map((p) => p.title)).toEqual(['P11', 'P10', 'P9', 'P8', 'P7']);
    expect(first.body.hasMore).toBe(true);
    const second = await feed('agency', `?before=${encodeURIComponent(first.body.posts.at(-1)!.publishedAt)}`);
    const third = await feed('agency', `?before=${encodeURIComponent(second.body.posts.at(-1)!.publishedAt)}`);
    expect(third.body.posts.map((p) => p.title)).toEqual(['P1', 'P0']);
    expect(third.body.hasMore).toBe(false);
  });

  test('who may reach what', async () => {
    expect((await get('/api/whats-new/unseen', null)).status).toBe(401);
    expect((await get('/api/whats-new/manage/posts', 'agency')).status).toBe(404);
    expect((await post('/api/whats-new/manage/posts', 'agency', { title: 'x', publish: 'now' })).status).toBe(404);
    // A change from another site is refused before anything else.
    expect((await post('/api/whats-new/manage/posts', 'admin', { title: 'x', publish: 'now' }, 'https://evil.example')).status).toBe(403);
    expect((await post('/api/whats-new/seen', 'agency', { through: crypto.randomUUID() }, 'https://evil.example')).status).toBe(403);
    expect((await get('/api/whats-new/nothing-here', 'admin')).status).toBe(404);
    expect((await app.routeHandlers.GET(request('/somewhere-else'))).status).toBe(404);
  });

  test('the editor is told what is wrong, field by field', async () => {
    const send = async (body: Record<string, unknown>) => {
      const response = await post('/api/whats-new/manage/posts', 'admin', { title: 'Ok', html: page('Ok'), publish: 'now', ...body });
      return { status: response.status, param: ((await response.json()) as { error?: { param?: string } }).error?.param };
    };
    expect(await send({ html: '' })).toEqual({ status: 400, param: 'html' });
    expect(await send({ html: 'just some words' })).toEqual({ status: 400, param: 'html' });
    expect(await send({ html: `<p>${'x'.repeat(1_000_001)}</p>` })).toEqual({ status: 400, param: 'html' });
    // A big page with drawings, well under the limit, saves.
    expect((await send({ html: `<div style="background:linear-gradient(red,blue)">${'<span class="cell">made-up row</span>'.repeat(8000)}</div>` })).status).toBe(201);
    expect(await send({ title: '', html: '<p>No title anywhere</p>' })).toEqual({ status: 400, param: 'title' });
    expect(await send({ title: 'x'.repeat(121) })).toEqual({ status: 400, param: 'title' });
    expect(await send({ summary: 'x'.repeat(201) })).toEqual({ status: 400, param: 'summary' });
    expect(await send({ audience: ['admins'] })).toEqual({ status: 400, param: 'audience' });
    expect(await send({ publish: 'later', publishAt: new Date(Date.now() - 1000).toISOString() })).toEqual({ status: 400, param: 'publishAt' });
    expect(await send({ coverImageId: 'not-a-picture' })).toEqual({ status: 400, param: 'coverImageId' });
    expect(await send({ publish: 'soon' })).toEqual({ status: 400, param: 'publish' });
  });

  test("the title and the one line come from the page's own head when left empty", async () => {
    const html = '<!DOCTYPE html><html><head><title>Dark mode &amp; more</title><meta name="description" content="Easier on the eyes at night."></head><body>…</body></html>';
    const id = await newPost({ title: '', summary: '', html });
    const row = (await sql<{ title: string; summary: string; html: string }[]>`select title, summary, html from whats_new_posts where id = ${id}`)[0]!;
    expect(row).toEqual({ title: 'Dark mode & more', summary: 'Easier on the eyes at night.', html });
    // What's typed wins over the page.
    const typed = await newPost({ title: 'Typed title', summary: 'Typed line', html });
    expect((await sql<{ title: string; summary: string }[]>`select title, summary from whats_new_posts where id = ${typed}`)[0]).toEqual({ title: 'Typed title', summary: 'Typed line' });
  });

  test('readers get the whole page on What\'s New; the pop-up sends only the newest page, the rest by title', async () => {
    const older = await newPost({ title: 'Older' });
    await liveAt(older, new Date(Date.now() - 60_000));
    await newPost({ title: 'Newer' });
    const popup = (await unseen('agency')).body.posts;
    expect(popup.map((p) => [p.title, p.html.includes('<h1>')])).toEqual([
      ['Newer', true],
      ['Older', false],
    ]);
    expect((await feed('agency')).body.posts.every((p) => p.html.includes('<h1>'))).toBe(true);
  });

  test('pictures: only real images, served to anyone, and never as anything else', async () => {
    const upload = (raw: BodyInit, type = 'image/png') => app.routeHandlers.POST(request('/api/whats-new/manage/images', { cookie: cookieFor('admin'), raw, type }));
    const response = await upload(PNG);
    expect(response.status).toBe(201);
    const { id, url } = (await response.json()) as { id: string; url: string };
    expect(url).toBe(`/api/whats-new/images/${id}`);

    const served = await app.routeHandlers.GET(request(url));
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/png');
    expect(served.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);

    expect((await upload('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'image/svg+xml')).status).toBe(400);
    expect((await upload(new Uint8Array(2 * 1024 * 1024 + 1).fill(0x89))).status).toBe(400);
    expect((await app.routeHandlers.POST(request('/api/whats-new/manage/images', { cookie: cookieFor('agency'), raw: PNG, type: 'image/png' }))).status).toBe(404);
    expect((await app.routeHandlers.GET(request('/api/whats-new/images/00000000-0000-0000-0000-000000000000'))).status).toBe(404);
  });

  test('a picture: its full link to put in HTML, the Pictures list, and a post\'s picture for the email', async () => {
    const upload = await app.routeHandlers.POST(request('/api/whats-new/manage/images', { cookie: cookieFor('admin'), raw: PNG, type: 'image/png' }));
    const uploaded = (await upload.json()) as { id: string; url: string; fullUrl: string };
    expect(uploaded.fullUrl).toBe(`https://app.example.com/api/whats-new/images/${uploaded.id}`);
    const list = await get<{ images: { id: string; fullUrl: string; bytes: number; type: string }[] }>('/api/whats-new/manage/images', 'admin');
    expect(list.body.images.map((i) => [i.id, i.type, i.bytes])).toEqual([[uploaded.id, 'image/png', PNG.byteLength]]);
    expect((await get('/api/whats-new/manage/images', 'agency')).status).toBe(404);
    await newPost({ title: 'With a picture', coverImageId: uploaded.id });
    const [shown] = (await feed('agency')).body.posts;
    expect(shown?.coverUrl).toBe(`/api/whats-new/images/${uploaded.id}`);
  });

  test('forgetAccount leaves nothing about the account behind', async () => {
    const id = await newPost({ title: 'Hello' });
    await post('/api/whats-new/seen', 'agency', { through: id });
    expect(await app.forgetAccount('usr_agency')).toBe(true);
    expect((await sql`select 1 from whats_new_readers where user_id = 'usr_agency'`).length).toBe(0);
  });

  test('the editor offers the roundup only when the app has it', async () => {
    const answer = async (roundupEmails: boolean) => {
      const other = createWhatsNew(fakeConfig({ db: () => sql, roundupEmails }));
      const response = await other.routeHandlers.GET(request('/api/whats-new/manage/posts', { cookie: cookieFor('admin') }));
      return ((await response.json()) as ManagePostsAnswer).roundupEmails;
    };
    expect(await answer(true)).toBe(true);
    expect(await answer(false)).toBe(false);
  });

  test('without a database the routes say so instead of crashing', async () => {
    const lost = createWhatsNew(fakeConfig({ db: () => null }));
    const response = await lost.routeHandlers.GET(request('/api/whats-new/unseen', { cookie: cookieFor('agency') }));
    expect(response.status).toBe(503);
  });
});
