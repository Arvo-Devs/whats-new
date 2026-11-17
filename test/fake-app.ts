// A pretend app for the tests: its sign-in reads a `session=<who>` cookie,
// anyone on MASS_ACCESS may write posts, and it has two groups of people
// (agencies and creators).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type postgres from 'postgres';
import type { WhatsNewConfig, WhatsNewUser } from '../src/config';

export type Person = WhatsNewUser & { id: string };

export const SITE = 'https://app.example.com';

export const PEOPLE: Record<string, Person> = {
  admin: { id: 'usr_admin', createdAt: '2025-01-01T00:00:00Z' },
  agency: { id: 'usr_agency', createdAt: '2025-06-01T00:00:00Z', audiences: ['agency'] },
  creator: { id: 'usr_creator', createdAt: '2025-06-01T00:00:00Z', audiences: ['creator'] },
  fresh: { id: 'usr_fresh', createdAt: new Date(Date.now() + 365 * 86_400_000).toISOString(), audiences: ['agency'] },
  staff: { id: 'usr_staff', createdAt: '2025-01-01T00:00:00Z', viewedAs: true },
};

export const MASS_ACCESS = new Set(['usr_admin']);

export const cookieFor = (who: string) => `theme=dark; session=${who}`;

export function request(path: string, init: { method?: string; cookie?: string; body?: unknown; origin?: string | null; raw?: BodyInit; type?: string } = {}): Request {
  const headers = new Headers();
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.origin !== null) headers.set('origin', init.origin ?? SITE);
  let body: BodyInit | undefined;
  if (init.raw !== undefined) {
    body = init.raw;
    if (init.type) headers.set('content-type', init.type);
  } else if (init.body !== undefined) {
    body = JSON.stringify(init.body);
    headers.set('content-type', 'application/json');
  }
  return new Request(`${SITE}${path}`, { method: init.method ?? (body === undefined ? 'GET' : 'POST'), headers, body });
}

function who(request: Request): string | null {
  const match = /(?:^|;\s*)session=([a-z]+)/.exec(request.headers.get('cookie') ?? '');
  return match?.[1] ?? null;
}

export function fakeConfig(options: { db: () => postgres.Sql | null; roundupEmails?: boolean; log?: (line: string) => void }): WhatsNewConfig<Person> {
  return {
    db: options.db,
    signedInUser: async (request) => {
      const name = who(request);
      return name && PEOPLE[name] ? PEOPLE[name] : null;
    },
    canManage: (user) => MASS_ACCESS.has(user.id),
    siteUrl: SITE,
    appName: 'Example App',
    pageUrl: '/dashboard/whats-new',
    audiences: [
      { key: 'agency', label: 'Agencies' },
      { key: 'creator', label: 'Creators' },
    ],
    roundupEmails: options.roundupEmails ?? true,
    log: options.log ?? (() => undefined),
  };
}

const MIGRATIONS = join(import.meta.dir, '..', 'migrations');

export async function migrate(sql: postgres.Sql) {
  const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) await sql.unsafe(readFileSync(join(MIGRATIONS, file), 'utf8'));
}

/** A one-pixel PNG. */
export const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);
