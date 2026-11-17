// The contract between the package and the app that installs it. Everything
// that differs from app to app comes in through here: the database, who is
// signed in and who may write posts, the app's name and site for the prompt,
// and the app's groups of people.
//
// normalizeConfig reads it once, in createWhatsNew. It imports nothing that
// needs Node, so a page that imports a type from here stays a browser bundle.
import type postgres from 'postgres';
import type { Audience } from './shared/api';

/**
 * A postgres.js client for the app's database, with the package's tables
 * (migrations/). Give it one nothing wraps with drizzle: drizzle(sql) changes
 * how a shared client reads dates and JSON.
 */
export type WhatsNewSql = postgres.Sql;

/** The person signed in, as the app's auth knows them on this request. */
export type WhatsNewUser = Readonly<{
  id: string;
  /** True in a staff member's view-as session: someone else is looking, so the pop-up stays shut and nothing is marked seen. */
  viewedAs?: boolean;
  /** When the account was made: the pop-up never shows a brand-new account the posts from before it joined. */
  createdAt?: Date | string | null;
  /** The app's groups this person is in (keys from `audiences`). */
  audiences?: readonly string[] | null;
}>;

export type WhatsNewLog = (line: string, error?: unknown) => void;

export type WhatsNewConfig<User extends WhatsNewUser = WhatsNewUser> = Readonly<{
  /** The database, or null when it is not set up (the routes answer 503). A function, so nothing connects at build time. */
  db: () => Promise<WhatsNewSql | null> | WhatsNewSql | null;
  /** Who is signed in, asked on every call that needs it. */
  signedInUser: (request: Request) => Promise<User | null>;
  /** True for the people who may write posts on Admin › What's New: the app's Mass Access check, or the Team import's check for that page. */
  canManage: (user: User) => boolean | Promise<boolean>;
  /** The site's public address, like https://yourapp.com: pictures are served from it, and the prompt names it. */
  siteUrl: string;
  /** The hosts the site's own pages are on, for the check that a change came from them. Default: siteUrl's host. */
  siteHosts?: readonly string[];
  /** The app's name as customers know it, for the prompt. */
  appName: string;
  /** Where the app shows the What's New page. Default /whats-new. */
  pageUrl?: string;
  /** The app's groups of people, when a post may be for some of them only. Default: none, every post is for everyone. */
  audiences?: readonly Audience[];
  /**
   * True when the app also has @arvo/marketing-emails with its roundup: the
   * editor then offers "Put it in the next roundup email" and a picture for
   * the email. Default false.
   */
  roundupEmails?: boolean;
  /** Where routeHandlers are mounted. Default /api/whats-new. */
  basePath?: string;
  /** Where errors are written. Default console.error. */
  log?: WhatsNewLog;
}>;

export type ResolvedConfig<User extends WhatsNewUser = WhatsNewUser> = Readonly<{
  db: () => Promise<WhatsNewSql | null>;
  signedInUser: (request: Request) => Promise<User | null>;
  canManage: (user: User) => Promise<boolean>;
  siteUrl: string;
  siteHosts: readonly string[];
  appName: string;
  pageUrl: string;
  audiences: readonly Audience[];
  roundupEmails: boolean;
  basePath: string;
  log: WhatsNewLog;
}>;

/** The parts of the config that do not depend on the app's user type. */
export type ConfigCore = Omit<ResolvedConfig, 'signedInUser' | 'canManage'>;

const KEY = /^[a-z][a-z0-9_-]{0,39}$/;

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function siteOf(value: unknown): URL | null {
  try {
    const url = new URL(trimmed(value));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

/** Reads the config once. Never throws: what is wrong is logged. */
export function normalizeConfig<User extends WhatsNewUser>(input: WhatsNewConfig<User>): ResolvedConfig<User> {
  const log: WhatsNewLog = input.log ?? ((line, error) => (error === undefined ? console.error(line) : console.error(line, error)));
  const site = siteOf(input.siteUrl);
  if (!site) log(`[What's New] siteUrl must be a full https address, like https://yourapp.com: ${JSON.stringify(input.siteUrl)}`);
  const siteHosts = (input.siteHosts?.length ? input.siteHosts : site ? [site.hostname] : []).map((host) => host.trim().toLowerCase()).filter(Boolean);
  const audiences: Audience[] = [];
  for (const audience of input.audiences ?? []) {
    if (!audience || !KEY.test(audience.key) || !trimmed(audience.label) || audiences.some((a) => a.key === audience.key)) {
      log(`[What's New] an audience was left out: its key must be lower case letters, digits, - or _ (at most 40), with a label, once: ${JSON.stringify(audience)}`);
      continue;
    }
    audiences.push({ key: audience.key, label: trimmed(audience.label) });
  }
  const pageUrl = trimmed(input.pageUrl) || '/whats-new';
  return {
    db: async () => (await input.db()) ?? null,
    signedInUser: input.signedInUser,
    canManage: async (user) => Boolean(await input.canManage(user)),
    siteUrl: site ? site.origin : '',
    siteHosts,
    appName: trimmed(input.appName) || 'Our app',
    pageUrl: pageUrl.startsWith('/') || siteOf(pageUrl) ? pageUrl : `/${pageUrl}`,
    audiences,
    roundupEmails: input.roundupEmails === true,
    basePath: (trimmed(input.basePath) || '/api/whats-new').replace(/\/+$/, ''),
    log,
  };
}

/** A path on the site as a full address. */
export function absoluteUrl(config: Pick<ResolvedConfig, 'siteUrl'>, path: string): string {
  try {
    return new URL(path, config.siteUrl || 'https://example.invalid').href;
  } catch {
    return path;
  }
}
