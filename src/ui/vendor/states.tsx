'use client';

// Vendored from betterfanslink components/ui/states.tsx (main d4138f9): EmptyState, ErrorState and InlineError, on the package's color names, for WhatsNewError, without the billing, view-as and docs links.
// Changed for Team (design §9 and the copy deck's ERRORS, §10): no request id and no error code is ever shown on screen. Each failure
// that is shown goes to console.error once instead, with its status, code and request id, for whoever debugs it. The words are the copy
// deck's: the failures a route cannot word (no answer at all, signed out, the page gone, the server not answering) get the deck's
// own line, and every other refusal shows the route's message, which is already in the deck's words.
import { useEffect, type ComponentType, type ReactNode } from 'react';
import { AlertTriangle, Lock, LogIn, WifiOff } from 'lucide-react';
import { Button, Spinner } from './button';
import { cn } from './cn';
import { WhatsNewError } from './errors';

/** The copy deck's lines for the failures the page words itself. */
export const ERROR_WORDS = {
  offline: "You're offline. Check your connection.",
  loadFailed: "This didn't load. Try again in a minute.",
  saveFailed: "That wasn't saved. Try again in a minute.",
  signedOut: "You've been signed out. Sign in again to keep going.",
  lostPage: "You can't open this page anymore. Ask whoever runs it.",
} as const;

/**
 * What kind of failure it is: no answer at all, signed out, the page is
 * not theirs anymore, the server could not do it (try again), or a refusal
 * the route worded.
 */
export type ErrorKind = 'offline' | 'signed_out' | 'lost_page' | 'failed' | 'refused';

/** Codes whose message is meant for a developer (or is the server's generic "not answering"): the person sees the deck's line instead. */
const FAILED_CODES = new Set(['internal_error', 'network_error', 'invalid_json', 'body_too_large']);

export function errorKind(error: unknown): ErrorKind {
  if (!(error instanceof WhatsNewError)) return 'failed';
  if (error.status === 0) return 'offline';
  if (error.status === 401 || error.code === 'not_signed_in') return 'signed_out';
  if (error.code === 'route_not_found') return 'lost_page';
  if (FAILED_CODES.has(error.code) || !error.message) return 'failed';
  return 'refused';
}

/** The one line to show for a failure: a load ("This didn't load…") or a save ("That wasn't saved…"). */
export function errorWords(error: unknown, when: 'load' | 'save' = 'save'): string {
  switch (errorKind(error)) {
    case 'offline':
      return ERROR_WORDS.offline;
    case 'signed_out':
      return ERROR_WORDS.signedOut;
    case 'lost_page':
      return ERROR_WORDS.lostPage;
    case 'failed':
      return when === 'load' ? ERROR_WORDS.loadFailed : ERROR_WORDS.saveFailed;
    default:
      return (error as WhatsNewError).message;
  }
}

/** Writes a shown failure to the console once, with what the screen leaves out. */
function useLogged(error: unknown) {
  useEffect(() => {
    if (!error) return;
    if (error instanceof WhatsNewError) {
      const id = error.requestId ? ` (request ${error.requestId})` : '';
      const hint = error.hint ? ` ${error.hint}` : '';
      console.error(`[What's New] ${error.status === 0 ? 'no answer' : error.status} ${error.code}${id}: ${error.message}${hint}`);
    } else {
      console.error("[What's New]", error);
    }
  }, [error]);
}

/** "You're offline." and "Check your connection.": the first sentence leads, the rest follows under it. */
function splitLine(line: string): [string, string] {
  const at = line.search(/[.!?]\s/);
  return at < 0 ? [line, ''] : [line.slice(0, at + 1), line.slice(at + 2)];
}

/**
 * What a list shows when it has nothing. `title` says what is missing,
 * `children` says how to get the first one, `action` is the button for it.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
  compact,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 text-center', compact ? 'py-8' : 'py-14', className)}>
      {Icon ? (
        <div className="mb-4 grid size-10 place-items-center rounded-xl border border-input bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {children ? <div className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{children}</div> : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

const ICONS: Record<ErrorKind, ComponentType<{ className?: string }>> = {
  offline: WifiOff,
  signed_out: LogIn,
  lost_page: Lock,
  failed: AlertTriangle,
  refused: AlertTriangle,
};

/**
 * A failed load, in the deck's words, with Try again when trying again can
 * help (offline, or the server did not answer). `failed` replaces "This
 * didn't load…" where the load is something else's (a gated page).
 */
export function ErrorState({
  error,
  onRetry,
  retrying,
  className,
  compact,
  failed,
}: {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
  compact?: boolean;
  failed?: string;
}) {
  useLogged(error);
  const kind = errorKind(error);
  const [title, rest] = splitLine(kind === 'failed' && failed ? failed : errorWords(error, 'load'));
  const Icon = ICONS[kind];
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 text-center', compact ? 'py-8' : 'py-14', className)}>
      <div className="mb-4 grid size-10 place-items-center rounded-xl border border-danger-border bg-danger-soft text-danger-strong">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {rest ? <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{rest}</p> : null}
      {onRetry && (kind === 'offline' || kind === 'failed') ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={onRetry} disabled={retrying}>
            {retrying ? <Spinner /> : null}
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The inline version for forms and dialogs: one line, and a button when the
 * deck gives the line one (Start over, Close, Copy sign-up link). `words`
 * replaces the line where the page knows better (a name the route left out).
 */
export function InlineError({
  error,
  className,
  when = 'save',
  words,
  action,
}: {
  error: unknown;
  className?: string;
  when?: 'load' | 'save';
  words?: string;
  action?: ReactNode;
}) {
  useLogged(error);
  if (!error) return null;
  return (
    <div role="alert" className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-danger-border bg-danger-soft px-3 py-2.5 text-sm', className)}>
      <p className="min-w-0 flex-1 basis-52 font-medium [overflow-wrap:anywhere] text-danger-strong">{words ?? errorWords(error, when)}</p>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
