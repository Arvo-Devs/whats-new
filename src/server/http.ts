// Answers for the routes, in the error body @arvo/traffic, @arvo/team and
// BetterFans Link's dashboard use ({ error: { type, code, message, hint?,
// param? }, requestId }), so a page that shows those errors shows these the
// same way. Every answer is no-store unless it says otherwise.
import { randomUUID } from 'node:crypto';
import type { ResolvedConfig, WhatsNewSql, WhatsNewUser } from '../config';

type ErrorType = 'invalid_request' | 'authentication' | 'permission' | 'not_found' | 'rate_limited' | 'internal';

const STATUS: Record<ErrorType, number> = {
  invalid_request: 400,
  authentication: 401,
  permission: 403,
  not_found: 404,
  rate_limited: 429,
  internal: 503,
};

export const NO_STORE = { 'cache-control': 'no-store' } as const;

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function apiError(type: ErrorType, code: string, message: string, extra: { hint?: string; param?: string } = {}): Response {
  const requestId = `req_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  return Response.json({ error: { type, code, message, ...extra }, requestId }, { status: STATUS[type], headers: NO_STORE });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: NO_STORE });
}

/** The app's sign-in or the database could not be reached. */
export function unavailable(): Response {
  return apiError('internal', 'internal_error', "What's New is not answering right now.", { hint: 'Try again in a minute.' });
}

export function notFound(): Response {
  return apiError('not_found', 'route_not_found', 'This page does not exist.');
}

export function invalid(message: string, param?: string): Response {
  return apiError('invalid_request', 'invalid_parameter', message, param ? { param } : {});
}

/**
 * True when the request came from one of the site's own pages, or names no
 * origin and does not say it is cross-site. `siteHosts` are host names; the
 * port is not compared.
 */
export function fromOwnPage(headers: Headers, siteHosts: readonly string[]): boolean {
  const origin = headers.get('origin');
  if (!origin) return headers.get('sec-fetch-site') !== 'cross-site';
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  return siteHosts.includes(host);
}

/** Reads the body up to `max` bytes; null when it is longer. */
export async function readBytesUpTo(request: Request, max: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > max) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/** A JSON object body of at most `max` bytes, or the answer to send instead. */
export async function readJson(request: Request, max = 64 * 1024): Promise<Record<string, unknown> | Response> {
  const bytes = await readBytesUpTo(request, max);
  if (!bytes) return apiError('invalid_request', 'body_too_large', 'That is too long to save.');
  try {
    const parsed: unknown = JSON.parse(Buffer.from(bytes).toString('utf8') || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return apiError('invalid_request', 'invalid_json', 'The request body is not valid JSON.');
  }
}

export type Ctx<User extends WhatsNewUser> = Readonly<{ user: User; sql: WhatsNewSql }>;

async function databaseFor<User extends WhatsNewUser>(config: ResolvedConfig<User>, user: User): Promise<Ctx<User> | Response> {
  try {
    const sql = await config.db();
    if (!sql) {
      return apiError('internal', 'internal_error', "What's New has no database yet.", {
        hint: "Give createWhatsNew a database (db in the config) with the tables from the package's migrations folder.",
      });
    }
    return { user, sql };
  } catch (error) {
    config.log("[What's New] the database did not answer", error);
    return unavailable();
  }
}

/** Anyone signed in, and the database; or the answer to send instead. */
export async function signedIn<User extends WhatsNewUser>(request: Request, config: ResolvedConfig<User>): Promise<Ctx<User> | Response> {
  let user: User | null;
  try {
    user = await config.signedInUser(request);
  } catch (error) {
    config.log("[What's New] could not check the session", error);
    return unavailable();
  }
  if (!user) return apiError('authentication', 'not_signed_in', 'Sign in to see this.');
  return databaseFor(config, user);
}

/**
 * Someone who may manage one of the Admin pages, and the database; or the
 * answer to send instead. Anyone else gets not found, so the address says
 * nothing to them.
 */
export async function manager<User extends WhatsNewUser>(request: Request, config: ResolvedConfig<User>): Promise<Ctx<User> | Response> {
  let user: User | null;
  try {
    user = await config.signedInUser(request);
  } catch (error) {
    config.log("[What's New] could not check the session", error);
    return unavailable();
  }
  if (!user) return apiError('authentication', 'not_signed_in', 'Sign in to see this page.');
  let allowed: boolean;
  try {
    allowed = await config.canManage(user);
  } catch (error) {
    config.log("[What's New] could not check who may manage the page", error);
    return unavailable();
  }
  if (!allowed) return notFound();
  return databaseFor(config, user);
}
