'use client';

// A post's HTML page on screen, in a sealed frame where scripts never run
// and nothing inside can reach the app.
// Links open in a new tab. The frame grows to the page's height and follows
// the app's light or dark, so a page written for both looks right in each.
import { useEffect, useMemo, useRef, useState } from 'react';
import { sealPostHtml } from '../shared/html';
import { cn } from '../ui/ui-deps';

// No allow-scripts, ever: with it, allow-same-origin would let the page undo
// its own sandbox. Same origin without scripts only lets the app measure it.
const SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox';
/** The least a measured page gets, so an empty one still shows as a line. `minHeight` is only the height before the page loads. */
const MEASURED_MIN = 24;

/** True while the app shows dark: a .dark class (or data-theme="dark") on <html>, the same switch the package's colors follow. */
export function useAppDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains('dark') || root.dataset.theme === 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export function HtmlFrame({ html, title, className, minHeight = 160 }: { html: string; title: string; className?: string; minHeight?: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);
  const dark = useAppDark();
  const doc = useMemo(() => sealPostHtml(html), [html]);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const measure = () => {
      const inner = frame.contentDocument;
      const root = inner?.documentElement;
      const body = inner?.body;
      if (!root || !body) return;
      // The page's own height, never the frame's: scrollHeight is at least the
      // frame's height, so a short post would keep the frame's first (or a
      // narrower window's) height, with empty space under it.
      const view = inner.defaultView;
      const margin = view ? Number.parseFloat(view.getComputedStyle(body).marginBottom) || 0 : 0;
      const content = Math.ceil(body.getBoundingClientRect().bottom + margin + (view?.scrollY ?? 0));
      // Anything that spills past the body (a float, a positioned box) still shows.
      const spill = root.scrollHeight > root.clientHeight ? root.scrollHeight : 0;
      const next = Math.max(MEASURED_MIN, content, spill);
      setHeight((now) => (Math.abs(now - next) > 1 ? next : now));
    };
    // Pictures and fonts arrive after load: measure again a few times, and whenever the width changes.
    const onLoad = () => {
      measure();
      for (const ms of [120, 400, 1000, 2500]) timers.push(setTimeout(measure, ms));
    };
    frame.addEventListener('load', onLoad);
    window.addEventListener('resize', measure);
    return () => {
      frame.removeEventListener('load', onLoad);
      window.removeEventListener('resize', measure);
      timers.forEach(clearTimeout);
    };
  }, [doc, minHeight]);

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={doc}
      sandbox={SANDBOX}
      loading="lazy"
      style={{ height, colorScheme: dark ? 'dark' : 'light' }}
      className={cn('block w-full border-0 bg-transparent', className)}
    />
  );
}
