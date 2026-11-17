# @arvo/whats-new

**What's New** for your app's customers. Built like
[@arvo/traffic](https://github.com/Arvo-Devs/traffic) and
[@arvo/signup-funnel](https://github.com/Arvo-Devs/signup-funnel): one
package, installed in each app pinned to a commit.

It gives an app four things:

- **The What's New pop-up.** When someone signs in and there is a post they
  haven't seen, it opens in the middle of the screen with the newest post's
  page in full and up to three more by title. **Got it** or **See all**, and
  however it is closed, it never comes back for the same posts.
- **The What's New page** (and a header button with a dot while there is
  something new): every post, newest first, in months.
- **Admin › What's New**: a post is one HTML page. **Copy the prompt**, run it
  in the product's repo with the best AI model at the time, and paste the
  page it makes (or drop its file). Its title and one line fill in from the
  page's own head, and the preview shows exactly what customers get. Publish
  now, later or keep a draft, and pick who it is for.
- **Pictures**: upload one and copy its link into the HTML (or give it to the
  AI). Pictures live in the app's own database and load from the app's own
  site, so there's no storage to set up.

**Every app keeps its own posts in its own database.** Nothing goes to a
central server, and no name or email address is stored: people are kept by
account id.

With [@arvo/marketing-emails](https://github.com/Arvo-Devs/marketing-emails)
in the same app, new posts also go out in a roundup email on its schedule
(section 6).

## Installing

Pin to a **commit SHA** (tags move; the SHA is the pin):

```jsonc
// package.json
"dependencies": {
  "@arvo/whats-new": "github:Arvo-Devs/whats-new#<full-commit-sha>"
}
```

```ts
// next.config.ts: the package ships TypeScript source, and the app compiles it
transpilePackages: ["@arvo/whats-new"],
```

Copy `migrations/0001_whats_new.sql` into the app's migrations, unchanged.
Updating means reading `git diff <old-sha>..<new-sha>` here, moving the SHA,
installing, committing the lockfile, and copying any new migration.

## Requirements

The same as the other imports, so an app that has Traffic has them all:

- **Next.js (App Router) and React 19**, with **@tanstack/react-query v5**
  around the pages (your `QueryClientProvider`).
- **Postgres** through a [postgres.js](https://github.com/porsager/postgres)
  client nothing wraps with drizzle.
- **Tailwind CSS v4**, with a source line so it sees the pages' classes:

  ```css
  @source "../node_modules/@arvo/whats-new/src";
  ```

## Theming

The pages use the same color names as @arvo/traffic, @arvo/team and
@arvo/support-inbox, the shadcn way (`background`, `foreground`, `card`,
`muted`, `primary`, `accent`, `border`, `input`, `ring`, and the
`success`/`warning`/`danger` `-strong`, `-soft` and `-border` trios). An
app that already maps them for another import has nothing to add.
Otherwise import the defaults once:

```css
@import "@arvo/whats-new/styles/tokens.css";
```

Adapting to another design system means editing one file, `src/ui/ui-deps.ts`.

## 1. One server file

```ts
// lib/whats-new/whats-new.server.ts
import { createWhatsNew } from '@arvo/whats-new';

export const whatsNew = createWhatsNew({
  db: () => siteSql, // postgres.js, not wrapped by drizzle
  signedInUser: async (request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return null;
    return {
      id: session.user.id,
      createdAt: session.user.createdAt, // a new account never gets older posts in the pop-up
      viewedAs: Boolean(session.session.impersonatedBy), // staff looking as a customer: no pop-up, nothing marked
    };
  },
  canManage: (user) => hasMassAccess(user.id),
  siteUrl: 'https://yourapp.com',
  appName: 'Your app',
  pageUrl: '/dashboard/whats-new',
  roundupEmails: true, // only with @arvo/marketing-emails
});
```

| It asks for | What to give it |
|---|---|
| `db` | The app's own Postgres, through a client drizzle doesn't wrap. |
| `signedInUser` | The app's own sign-in, checked on every request. `createdAt`, `viewedAs` and `audiences` are optional but each makes something work (see the comments above). |
| `canManage(user)` | Who may write posts on **Admin › What's New**: Mass Access, or the Team import's check for that page. Everyone else gets "not found". |
| `siteUrl`, `appName` | The site's public address (pictures are served from it) and the app's name; both go in the prompt. |
| `pageUrl` | Where the app shows the What's New page. |
| `audiences` | Optional groups, like `[{ key: 'agency', label: 'Agencies' }, { key: 'creator', label: 'Creators' }]`. A post can then be for some of them; give each person's keys in `signedInUser`. Leave it out and every post is for everyone. |
| `roundupEmails` | True when the app has @arvo/marketing-emails with its roundup: the editor then offers "Put it in the next roundup email" and a picture for it. |

## 2. Routes

One catch-all route file:

```ts
// app/api/whats-new/[[...route]]/route.ts
import { whatsNew } from '@/lib/whats-new/whats-new.server';

export const dynamic = 'force-dynamic';
export const { GET, POST, DELETE } = whatsNew.routeHandlers;
```

**Pictures are public** (`/api/whats-new/images/<id>`), because a post's
picture goes out in the roundup email. If the app's middleware sends
signed-out requests to a sign-in page, let that address through.
Everything else checks the sign-in itself.

## 3. Pages

Every component goes inside the app's `QueryClientProvider`:

```tsx
import { WhatsNewButton, WhatsNewFeed, WhatsNewManager, WhatsNewPopup } from '@arvo/whats-new/client';
```

| Where | What |
|---|---|
| The signed-in layout, once | `<WhatsNewPopup />` |
| The header | `<WhatsNewButton />` |
| The What's New page, in the left nav | `<WhatsNewFeed />` under the page title |
| Admin › What's New | `<WhatsNewManager />` under the page title |

The calls go to `/api/whats-new` and links to `/whats-new` unless the
`basePath` and `pageUrl` props, or one `<WhatsNewProvider>` around them,
say otherwise. `WhatsNewPopup` takes `hiddenOn={(path) => ...}` for pages it
should never open on (sign-up steps, say).

## 4. Deleting an account

Call `whatsNew.forgetAccount(userId)` from the app's delete-account code. It
removes how far the account has seen. It never throws; false means try
again later.

## 5. The rules

**The pop-up**

- It shows live posts for the person (their groups, or everyone) that are
  newer than their mark, newer than their account, and at most 30 days old.
- The newest in full, then up to three more by title. **Got it**, **See
  all**, the X, Escape and a click outside all put it away, and putting it
  away moves the person's mark up to the newest post it showed. The server
  sets the mark from that post and it only moves forward, so an old tab can't
  bring posts back, and a post published while the pop-up was open still
  shows next time.
- It never opens on the What's New page, in a view-as session, on top of
  another pop-up (it waits up to a minute for that one to close), or twice in
  one tab. It never makes anyone wait to close it.
- Opening the What's New page counts everything on it as seen.

**Posts**

- One HTML page (up to 1 MB), a title (120), one line (200), an optional
  picture for the roundup email, groups, and "Put it in the next roundup".
  Left empty, the title comes from the page's `<title>` and the line from its
  `<meta name="description">`, which the prompt asks the AI to write.
- The page shows in a sealed frame: its scripts never run and nothing in it
  can reach the app. Links open in a new tab; `#links` scroll inside it. The
  frame grows to the page's height and follows the app's light or dark (a
  `.dark` class on `<html>`).
- Pictures are PNG, JPG, GIF or WebP up to 2 MB, kept in the app's database
  and served to anyone, so never anything private. They are never removed on
  their own: a post uses one by its link, which the package can't follow.
- Scheduled posts are just posts whose time hasn't come: readers only ever
  get posts whose time has passed.
- **A post keeps the time it first went live.** Back to draft hides it;
  publishing it again puts it back where it was, so nobody who put it away
  sees it pop up a second time.

## 6. With @arvo/marketing-emails

@arvo/marketing-emails, in the same database, reads `whats_new_posts` for
its roundup email: each live post with "Put it in the next roundup" ticked
goes in one roundup, once, with its title, its one line and its picture,
linked to the post on What's New. It never writes this package's tables.
Drawings in a post's HTML don't survive email apps, which is why a post has
a separate picture for the email: a screenshot of its drawing.

## Tests

`bun test` runs the rules without a database. With
`WHATS_NEW_TEST_PG_URL` (a Postgres the tests may create databases on) it
also runs everything against a real database: posts, the pop-up, pictures
and routes. CI runs both.
