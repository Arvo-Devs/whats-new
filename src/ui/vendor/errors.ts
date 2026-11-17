// Vendored from betterfanslink lib/rpc.ts (main d4138f9): RpcError as WhatsNewError, and errorFromBody, for the What's New routes' error body.

/** What a What's New route sends when it refuses: { error: { type, code, message, hint?, param? }, requestId }. */
export type WhatsNewErrorBody = { type?: string; code?: string; message: string; hint?: string; param?: string };

/**
 * An error from a What's New route. Carries the body's code, hint and request
 * id, so ErrorState and InlineError can tell the cases apart and log them
 * (never show them: see states.tsx).
 */
export class WhatsNewError extends Error {
  readonly status: number;
  readonly code: string;
  readonly type: string;
  readonly hint: string | null;
  readonly param: string | null;
  readonly requestId: string | null;

  constructor(status: number, body: WhatsNewErrorBody, requestId: string | null) {
    super(body.message);
    this.name = 'WhatsNewError';
    this.status = status;
    this.code = body.code ?? (status === 0 ? 'network_error' : 'internal_error');
    this.type = body.type ?? (status === 0 ? 'network' : 'internal');
    this.hint = body.hint ?? null;
    this.param = body.param ?? null;
    this.requestId = requestId;
  }
}

/** A string, or undefined for anything else, so a field the page shows is always text. */
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

export function isApiError(value: unknown): value is { error: { message: string }; requestId?: unknown } {
  if (!value || typeof value !== 'object') return false;
  const err = (value as { error?: unknown }).error;
  return !!err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string';
}

export function errorFromBody(status: number, body: unknown): WhatsNewError {
  if (isApiError(body)) {
    const error = body.error as Record<string, unknown>;
    return new WhatsNewError(
      status,
      { message: error.message as string, type: text(error.type), code: text(error.code), hint: text(error.hint), param: text(error.param) },
      text(body.requestId) ?? null,
    );
  }
  return new WhatsNewError(status, { message: status >= 500 ? 'The server could not answer. Try again in a minute.' : `The request failed with status ${status}.` }, null);
}
