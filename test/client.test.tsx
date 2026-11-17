// The browser side: no client file reaches into the server code (which needs
// Node and the database), and a post's page is drawn in a frame where its
// scripts can never run.
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { PostPage } from '../src/client/post-card';

const SRC = join(import.meta.dir, '..', 'src');

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) ? [join(dir, entry.name)] : [],
  );
}

describe('client files', () => {
  const clientFiles = [join(SRC, 'client.ts'), ...filesUnder(join(SRC, 'client')), ...filesUnder(join(SRC, 'ui'))];

  test('never import the server, Node or the database', () => {
    for (const file of clientFiles) {
      const imports = [...readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)].map((m) => m[1]!);
      for (const spec of imports) {
        expect({ file, spec, bad: spec.includes('/server') || spec.startsWith('node:') || spec === 'postgres' || spec.endsWith('/index') }).toEqual({ file, spec, bad: false });
      }
    }
  });

  test('every component file says it runs in the browser', () => {
    for (const file of filesUnder(join(SRC, 'client')).filter((f) => f.endsWith('.tsx'))) {
      expect({ file, client: readFileSync(file, 'utf8').startsWith("'use client';") }).toEqual({ file, client: true });
    }
  });

  test('client UI pieces come through the one seam file', () => {
    for (const file of filesUnder(join(SRC, 'client'))) {
      expect({ file, direct: /from '\.\.\/ui\/vendor\//.test(readFileSync(file, 'utf8')) }).toEqual({ file, direct: false });
    }
  });
});

describe('a post on the page', () => {
  test('its page sits in a sealed frame: no scripts, links in a new tab, its anchor for links from the pop-up and emails', () => {
    const html = renderToStaticMarkup(
      <PostPage post={{ id: 'p1', title: 'Dark mode', html: '<p>Hi <a href="https://x.example">x</a></p><script>steal()</script>', publishedAt: '2026-11-16T18:00:00Z' }} isNew />,
    );
    expect(html).toContain('id="post-p1"');
    expect(html).toContain('sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"');
    expect(html).not.toContain('allow-scripts');
    expect(html).toContain('srcDoc=');
    expect(html).toContain('target=&quot;_blank&quot;');
    expect(html).toContain('>New<');
  });
});
