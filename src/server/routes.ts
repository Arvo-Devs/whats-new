/**
 * The routes, mounted under basePath (default /api/whats-new) by one
 * catch-all route file in the app.
 *
 * Anyone signed in:
 *   GET    feed?before=           one page of What's New
 *   GET    unseen                 the pop-up's posts
 *   POST   seen { through }       the pop-up was put away (or the page read) up to this post
 *
 * Admin › What's New (canManage):
 *   GET    manage/posts
 *   POST   manage/posts           a new post
 *   POST   manage/posts/<id>      a change
 *   DELETE manage/posts/<id>
 *   GET    manage/images          the pictures so far, with their links
 *   POST   manage/images          a picture, as the request body
 *
 * Anyone, no sign-in:
 *   GET    images/<id>            a picture (a post's picture goes out in the roundup email)
 *
 * Changes are only taken from the site's own pages (siteHosts). Every
 * answer is no-store except pictures.
 */
import type { ResolvedConfig, WhatsNewUser } from '../config';
import { absoluteUrl } from '../config';
import type { PromptFacts } from '../shared/api';
import { LIMITS } from '../shared/limits';
import { apiError, fromOwnPage, invalid, json, manager, noContent, notFound, readBytesUpTo, readJson, signedIn, unavailable } from './http';
import { imageResponse, listImages, saveImage, sniffImage } from './images';
import { allPosts, createPost, deletePost, feedFor, imagePath, isFieldError, isUuid, markSeen, readPostInput, unseenFor, updatePost } from './posts';

export type RouteHandler = (request: Request) => Promise<Response>;
export type WhatsNewRouteHandlers = Readonly<{ GET: RouteHandler; POST: RouteHandler; DELETE: RouteHandler }>;

/** A request that carries a post's HTML: the page itself, written as JSON (quotes and line breaks escaped), plus the other fields. */
const HTML_BODY_MAX = LIMITS.html * 2 + 64 * 1024;

export function createRouteHandlers<User extends WhatsNewUser>(config: ResolvedConfig<User>): WhatsNewRouteHandlers {
  const facts: PromptFacts = { appName: config.appName, siteUrl: config.siteUrl, pageUrl: absoluteUrl(config, config.pageUrl) };

  function fieldError(error: { error: string; field: string }): Response {
    return invalid(error.error, error.field);
  }

  // ---- anyone signed in ----

  async function feed(request: Request): Promise<Response> {
    const ctx = await signedIn(request, config);
    if (ctx instanceof Response) return ctx;
    const raw = new URL(request.url).searchParams.get('before');
    const before = raw ? new Date(raw) : null;
    if (before && Number.isNaN(before.getTime())) return invalid('That is not a time.', 'before');
    return json(await feedFor(ctx.sql, config, ctx.user, before));
  }

  async function unseen(request: Request): Promise<Response> {
    const ctx = await signedIn(request, config);
    if (ctx instanceof Response) return ctx;
    // Someone else is looking: the pop-up is the customer's, not theirs.
    if (ctx.user.viewedAs) return json({ posts: [], total: 0 });
    return json(await unseenFor(ctx.sql, config, ctx.user));
  }

  async function seen(request: Request): Promise<Response> {
    const ctx = await signedIn(request, config);
    if (ctx instanceof Response) return ctx;
    const body = await readJson(request, 1024);
    if (body instanceof Response) return body;
    if (!isUuid(body.through)) return invalid('Say which post was seen.', 'through');
    if (ctx.user.viewedAs) return noContent();
    await markSeen(ctx.sql, ctx.user, body.through);
    return noContent();
  }

  // ---- Admin › What's New ----

  async function managePosts(request: Request): Promise<Response> {
    const ctx = await manager(request, config);
    if (ctx instanceof Response) return ctx;
    return json({ posts: await allPosts(ctx.sql, config), audiences: config.audiences, roundupEmails: config.roundupEmails, pageUrl: config.pageUrl, facts });
  }

  async function newPost(request: Request): Promise<Response> {
    const ctx = await manager(request, config);
    if (ctx instanceof Response) return ctx;
    const body = await readJson(request, HTML_BODY_MAX);
    if (body instanceof Response) return body;
    const input = readPostInput(body, config);
    if (isFieldError(input)) return fieldError(input);
    return json({ id: await createPost(ctx.sql, input, ctx.user.id) }, 201);
  }

  async function changePost(request: Request, id: string): Promise<Response> {
    const ctx = await manager(request, config);
    if (ctx instanceof Response) return ctx;
    const body = await readJson(request, HTML_BODY_MAX);
    if (body instanceof Response) return body;
    const input = readPostInput(body, config);
    if (isFieldError(input)) return fieldError(input);
    if (!(await updatePost(ctx.sql, id, input, ctx.user.id))) return apiError('not_found', 'post_not_found', 'That post is gone. Someone may have deleted it.');
    return json({ id });
  }

  async function removePost(request: Request, id: string): Promise<Response> {
    const ctx = await manager(request, config);
    if (ctx instanceof Response) return ctx;
    await deletePost(ctx.sql, id);
    return noContent();
  }

  async function uploadImage(request: Request): Promise<Response> {
    const ctx = await manager(request, config);
    if (ctx instanceof Response) return ctx;
    const bytes = await readBytesUpTo(request, LIMITS.imageBytes);
    if (!bytes) return apiError('invalid_request', 'image_too_big', 'That picture is over 2 MB. Make it smaller and add it again.');
    if (!bytes.byteLength) return invalid('Add a picture.', 'image');
    const type = sniffImage(bytes);
    if (!type) return apiError('invalid_request', 'image_type', 'Use a PNG, JPG, GIF or WebP picture.');
    const id = await saveImage(ctx.sql, bytes, type, ctx.user.id);
    return json({ id, url: imagePath(config, id), fullUrl: imagePath(config, id, true) }, 201);
  }

  async function images(request: Request): Promise<Response> {
    const ctx = await manager(request, config);
    if (ctx instanceof Response) return ctx;
    const list = await listImages(ctx.sql);
    return json({ images: list.map((image) => ({ ...image, url: imagePath(config, image.id), fullUrl: imagePath(config, image.id, true) })) });
  }

  // ---- anyone ----

  async function image(id: string): Promise<Response> {
    try {
      const sql = await config.db();
      if (!sql) return notFound();
      return (await imageResponse(sql, id)) ?? notFound();
    } catch (error) {
      config.log("[What's New] a picture did not load", error);
      return unavailable();
    }
  }

  // ---- routing ----

  /** The route under basePath as its parts: [] is the base itself. Null outside basePath. */
  function partsOf(request: Request): string[] | null {
    const { pathname } = new URL(request.url);
    const base = config.basePath;
    if (base && pathname !== base && !pathname.startsWith(`${base}/`)) return null;
    return pathname
      .slice(base.length)
      .split('/')
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
  }

  async function route(method: 'GET' | 'POST' | 'DELETE', request: Request): Promise<Response> {
    const parts = partsOf(request);
    if (!parts) return notFound();
    const path = parts.join('/');
    const [a, b, c] = parts;

    if (method === 'GET') {
      if (path === 'feed') return feed(request);
      if (path === 'unseen') return unseen(request);
      if (path === 'manage/posts') return managePosts(request);
      if (path === 'manage/images') return images(request);
      if (a === 'images' && b && parts.length === 2) return image(b);
      return notFound();
    }

    // Every change comes from the site's own pages, never from another site the person happens to have open.
    if (!fromOwnPage(request.headers, config.siteHosts)) {
      return apiError('permission', 'missing_permission', 'This request came from a page we do not trust.');
    }

    if (method === 'POST') {
      if (path === 'seen') return seen(request);
      if (path === 'manage/posts') return newPost(request);
      if (path === 'manage/images') return uploadImage(request);
      if (a === 'manage' && b === 'posts' && isUuid(c) && parts.length === 3) return changePost(request, c);
      return notFound();
    }

    if (a === 'manage' && b === 'posts' && isUuid(c) && parts.length === 3) return removePost(request, c);
    return notFound();
  }

  function handler(method: 'GET' | 'POST' | 'DELETE'): RouteHandler {
    return async (request: Request) => {
      try {
        return await route(method, request);
      } catch (error) {
        // An app hook or the database threw where nothing else caught it: still a plain answer, never a crash.
        config.log("[What's New] a request was not answered", error);
        return unavailable();
      }
    };
  }

  return { GET: handler('GET'), POST: handler('POST'), DELETE: handler('DELETE') };
}
