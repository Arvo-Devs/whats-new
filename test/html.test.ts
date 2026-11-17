// A post's pasted HTML: the title and the one line read from its head, the
// page made ready for its sealed frame, the prompt, and pictures told apart
// by their first bytes.
import { describe, expect, test } from 'bun:test';
import { descriptionOf, looksLikeHtml, sealPostHtml, titleOf } from '../src/shared/html';
import { postPrompt } from '../src/shared/prompts';
import { sniffImage } from '../src/server/images';

describe('reading a pasted page', () => {
  const page = '<!DOCTYPE html><html><head><meta charset="utf-8"><title> Dark mode &amp; more </title><meta content="Easier on the eyes." name="description"></head><body><p>Hi</p></body></html>';

  test('the title and the one line from the head', () => {
    expect(titleOf(page)).toBe('Dark mode & more');
    expect(descriptionOf(page)).toBe('Easier on the eyes.');
    expect(titleOf('<p>no head</p>')).toBe('');
    expect(descriptionOf("<meta name='description' content='single quotes'>")).toBe('single quotes');
  });

  test('HTML or not', () => {
    expect(looksLikeHtml('<p>x</p>')).toBe(true);
    expect(looksLikeHtml('just words')).toBe(false);
  });

  test('ready for its frame: links open in a new tab, #links stay inside', () => {
    const sealed = sealPostHtml('<html><head></head><body><a href="https://x.example">X</a><a href="#top">Top</a><a href="/y" target="_self">Y</a></body></html>');
    expect(sealed).toContain('<base href="about:srcdoc">');
    expect(sealed).toContain('<a target="_blank" rel="noopener noreferrer" href="https://x.example">');
    expect(sealed).toContain('<a href="#top">');
    expect(sealed).toContain('<a href="/y" target="_self">');
    // A page with its own <base> keeps it.
    expect(sealPostHtml('<head><base href="https://a.example/"></head>')).not.toContain('about:srcdoc');
  });
});

describe('the prompt', () => {
  test('names the app and its site, and asks for the head the page reads', () => {
    const text = postPrompt({ appName: 'Northwind', siteUrl: 'https://northwind.example', pageUrl: 'https://northwind.example/whats-new' });
    expect(text).toContain("Make a What's New post for Northwind.");
    expect(text).toContain('https://northwind.example');
    expect(text).toContain('<meta name="description"');
    expect(text).toContain('No scripts');
    expect(text).not.toMatch(/[–—]/);
  });
});

describe('sniffImage', () => {
  test('by the first bytes, never the name', () => {
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImage(new TextEncoder().encode('GIF89a...'))).toBe('image/gif');
    expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
  });
});
