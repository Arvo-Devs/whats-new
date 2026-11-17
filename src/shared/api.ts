// What the routes answer and accept, shared by the server and the pages.
// Times are ISO 8601 strings.

/** A group of people the app names ("Agencies", "Creators"). A post or email for some groups reaches only them; one for none reaches everyone. */
export type Audience = Readonly<{ key: string; label: string }>;

/**
 * A live post, as the people reading What's New get it. `html` is the whole
 * page, drawn in a sealed frame; it is left out (empty) where only the title
 * is shown, like the pop-up's "You also missed" list.
 */
export type PostView = Readonly<{
  id: string;
  title: string;
  summary: string;
  html: string;
  coverUrl: string | null;
  publishedAt: string;
}>;

/** GET unseen: the pop-up's posts, newest first: the newest with its page, then a few more by title. */
export type UnseenAnswer = Readonly<{ posts: readonly PostView[]; total: number }>;

/** GET feed: one page of What's New, newest first. `seenThrough` is the person's mark before this visit, for the New chips. */
export type FeedAnswer = Readonly<{ posts: readonly PostView[]; hasMore: boolean; seenThrough: string | null }>;

export type PostStatus = 'draft' | 'scheduled' | 'live';

/** A post as the people who write them see it. */
export type ManagedPost = Readonly<{
  id: string;
  title: string;
  summary: string;
  html: string;
  coverImageId: string | null;
  coverUrl: string | null;
  audience: readonly string[];
  status: PostStatus;
  /** When it went live or will. A draft that was live once keeps the date it first went live. */
  publishedAt: string | null;
  /** Goes in the next roundup email, when the app has @arvo/marketing-emails. */
  inEmail: boolean;
  updatedAt: string;
}>;

/** The words the page fills in a prompt with. */
export type PromptFacts = Readonly<{ appName: string; siteUrl: string; pageUrl: string }>;

export type ManagePostsAnswer = Readonly<{
  posts: readonly ManagedPost[];
  audiences: readonly Audience[];
  /** True when the app has the marketing roundup, so the editor offers "Put it in the next roundup email" and a picture for it. */
  roundupEmails: boolean;
  /** The What's New page's address in the app, for "Open What's New". */
  pageUrl: string;
  facts: PromptFacts;
}>;

export type PostInput = Readonly<{
  title: string;
  summary: string;
  html: string;
  coverImageId: string | null;
  audience: readonly string[];
  inEmail: boolean;
  /** draft keeps it hidden; now puts it live; later puts it live at publishAt. */
  publish: 'draft' | 'now' | 'later';
  publishAt?: string | null;
}>;

export type ImageAnswer = Readonly<{ id: string; url: string; fullUrl: string }>;

/** GET manage/images: the pictures uploaded so far, newest first, with the links to put in HTML. */
export type ImagesAnswer = Readonly<{ images: readonly Readonly<{ id: string; url: string; fullUrl: string; type: string; bytes: number; createdAt: string }>[] }>;
