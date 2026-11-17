// The prompt behind "Copy the prompt" on Admin › What's New. Whoever writes a
// post runs it in the product's repo with the best AI model at the time,
// reads what it made, and pastes the HTML into the page. The page fills in
// the app's name and addresses.
import type { PromptFacts } from './api';

/** The prompt for a What's New post. Ends with the line where the person names the change. */
export function postPrompt(facts: PromptFacts): string {
  const site = facts.siteUrl || 'the live site';
  return `Make a What's New post for ${facts.appName}.

You're in ${facts.appName}'s repo. The people reading this are ${facts.appName}'s customers: they use it every day and don't read code. They want to know what changed for them, not the commit log. Most of this job is cutting.

1. What it covers. The change I name at the end, or, if I name a stretch of time, everything that went live on ${site} in it. Only what is live: leave out anything still on preview, behind a switch that's off, or waiting on a deploy. If you can't tell, leave it out.

2. The noise test. Keep a change only if someone who uses that page would notice it without being told: a new page, button or option; a screen that looks or works differently; something they did by hand that now happens on its own; something that broke for them and no longer does; something moved, renamed or removed. Cut the rest: tests, cleanup, speed nobody can feel, security work, background plumbing. When unsure, cut it.

3. Draw the change. No screenshots. Draw the changed part in HTML the way the real page looks: take the words, colors and layout from that page's code, show it working, and circle the new part. Names, numbers and photos in a drawing are made up: never a real customer, real money or a real photo. Use shapes or gradients where a photo would be.

4. Open buttons. Every change that has a page gets an "Open" button linking to the live page (${site}/...) with target="_blank". If there's no page, say where to click instead.

5. The words. "You can now..." Plain English, short sentences, second person. A headline, then two short lines at most per change. No commit messages, ticket numbers, code names or tech terms. No em dashes. Nothing private.

6. The file. One HTML file with everything inside it. No scripts (the page blocks them) and no pictures from other sites: a picture that isn't drawn in HTML has to be a link I give you from the Pictures panel. It opens in a pop-up about 860px wide and on phones, so check both, in light and dark (prefers-color-scheme). Put the post's title in <title>, and one line about it, under 140 characters, in <meta name="description" content="...">. The page fills both in from there, and the roundup email shows that line.

7. Hand it over. Save it to my Downloads folder as whats-new-<short-name>.html (don't overwrite a file that's already there) and copy the HTML to my clipboard. Then tell me in two plain lines where it is and that it's ready to paste into Admin › What's New. Don't post it anywhere yourself.

The change: `;
}
