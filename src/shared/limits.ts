// Every size and count the package holds to, in one place, so the forms,
// the routes and the database checks say the same thing.

export const LIMITS = {
  postTitle: 120,
  /** The one line about a post: the pop-up's list and the roundup email show it. */
  postSummary: 200,
  /** A post's HTML page. Drawings in HTML are small; pictures go in by link. */
  html: 1_000_000,
  /** A picture: PNG, JPEG, GIF or WebP up to 2 MB. */
  imageBytes: 2 * 1024 * 1024,
} as const;

/** The pop-up shows posts from this many days back at most, so someone back after months sees only the latest. */
export const POPUP_WINDOW_DAYS = 30;

/** Under the newest post, the pop-up lists this many more by title. */
export const POPUP_ALSO = 3;

/** Posts per load on the What's New page: each is a whole page of HTML. */
export const FEED_PAGE = 5;
