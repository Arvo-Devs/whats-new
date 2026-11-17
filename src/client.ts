// The client entry of @arvo/whats-new. Mount them inside the app's own
// QueryClientProvider:
//
//   WhatsNewPopup      once, in the signed-in layout
//   WhatsNewButton     in the header
//   WhatsNewFeed       the What's New page's body
//   WhatsNewManager    Admin › What's New's body
//
// The calls go to /api/whats-new and links to /whats-new unless the
// basePath and pageUrl props (or one WhatsNewProvider around them) say
// otherwise.

export { WhatsNewButton } from './client/button';
export type { WhatsNewButtonProps } from './client/button';
export { WhatsNewProvider } from './client/context';
export { FeedSkeleton, WhatsNewFeed } from './client/feed';
export type { WhatsNewFeedProps } from './client/feed';
export { ManagerSkeleton, WhatsNewManager } from './client/manager';
export type { WhatsNewManagerProps } from './client/manager';
export { WhatsNewPopup } from './client/popup';
export type { WhatsNewPopupProps } from './client/popup';
