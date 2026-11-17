// A post's pasted HTML: what the package reads from it (the title and the
// one-line summary the prompt puts in its head) and how it is made ready for
// its sealed frame. Plain string work, no parser, so it runs the same in the
// browser and on the server. Imports nothing.

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** The few entities a title or a line of text carries. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (match, name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16) || 32);
    if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10) || 32);
    return ENTITIES[lower] ?? match;
  });
}

function oneLine(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** The text of the page's <title>, or ''. */
export function titleOf(html: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? oneLine(match[1] ?? '') : '';
}

/** The page's <meta name="description" content="...">, or ''. */
export function descriptionOf(html: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/\bname\s*=\s*["']?description["']?/i.test(tag)) continue;
    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    if (content) return oneLine(content[1] ?? content[2] ?? '');
  }
  return '';
}

/** Puts `snippet` right after <head> (or makes a head, or puts it first). */
export function addToHead(html: string, snippet: string): string {
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (open) => `${open}${snippet}`);
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, (open) => `${open}<head>${snippet}</head>`);
  return `${snippet}${html}`;
}

/** True when the text looks like an HTML page or fragment rather than plain words. */
export function looksLikeHtml(value: string): boolean {
  return /<([a-z][a-z0-9]*)\b[^>]*>/i.test(value);
}

/**
 * A post's page made ready for its sealed frame: links to
 * other pages open in a new tab, and #links scroll inside the post instead of
 * loading the app inside the frame. The page's own <base>, if it has one, is
 * kept. Pictures must be full addresses, which the Pictures panel gives.
 */
export function sealPostHtml(html: string): string {
  const withTargets = html.replace(/<a\b[^>]*>/gi, (tag) => {
    if (/\starget\s*=/i.test(tag)) return tag;
    const href = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const value = (href?.[1] ?? href?.[2] ?? '').trim();
    if (!value || value.startsWith('#')) return tag;
    return tag.replace(/^<a\b/i, '<a target="_blank" rel="noopener noreferrer"');
  });
  return /<base\b/i.test(withTargets) ? withTargets : addToHead(withTargets, '<base href="about:srcdoc">');
}
