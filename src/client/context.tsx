'use client';

// Where the routes are mounted and where the What's New page is, for every
// call and link the components make. The defaults match the server's;
// WhatsNewProvider (or each component's basePath and pageUrl props) moves
// them.
import { createContext, use, type ReactNode } from 'react';

export const DEFAULT_BASE_PATH = '/api/whats-new';
export const DEFAULT_PAGE_URL = '/whats-new';

type Paths = Readonly<{ basePath: string; pageUrl: string }>;

const PathsContext = createContext<Paths>({ basePath: DEFAULT_BASE_PATH, pageUrl: DEFAULT_PAGE_URL });

/** Put it once around the signed-in layout when the app mounts the routes or the page somewhere else. */
export function WhatsNewProvider({ basePath, pageUrl, children }: { basePath?: string; pageUrl?: string; children: ReactNode }) {
  const outer = use(PathsContext);
  const value = {
    // No slash at the end, so the calls can add theirs.
    basePath: basePath === undefined ? outer.basePath : basePath.replace(/\/+$/, '') || DEFAULT_BASE_PATH,
    pageUrl: pageUrl ?? outer.pageUrl,
  };
  return <PathsContext value={value}>{children}</PathsContext>;
}

export function usePaths(): Paths {
  return use(PathsContext);
}
