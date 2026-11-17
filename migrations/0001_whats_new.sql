-- @arvo/whats-new 0001: What's New posts, their pictures, and how far each
-- person has seen.
--
-- Nothing here keeps a name or an email address. People are kept by the
-- app's account id, and forgetAccount() removes an account's row when the
-- app deletes it. @arvo/marketing-emails reads whats_new_posts (never
-- writes it) for its roundup, so the columns it reads (title, summary,
-- cover_image_id, audience, status, published_at, in_email) keep their
-- names in every later version.
--
-- Never edit this file once applied: a later version adds a new one.

-- Pictures for posts, uploaded on Admin › What's New and put in the HTML by
-- their link. Served at <basePath>/images/<id> to anyone (a post's picture
-- goes out in the roundup email), so never anything private.
create table if not exists whats_new_images (
  id uuid primary key,
  content_type text not null,
  bytes bytea not null,
  created_by text,
  created_at timestamptz not null default now(),
  constraint whats_new_images_type_check check (content_type in ('image/png', 'image/jpeg', 'image/gif', 'image/webp')),
  constraint whats_new_images_size_check check (octet_length(bytes) between 1 and 2097152)
);

-- What's New posts: each is one HTML page (usually made with the page's
-- prompt), shown in a sealed frame where scripts never run. summary is the
-- one line the pop-up's list and the roundup email show, cover_image_id its
-- picture in the roundup email, in_email whether it goes in the next one.
-- status 'published' with published_at in the future is scheduled: readers
-- only ever get posts whose time has come. A post that went live keeps its
-- first published_at when it goes back to draft, so publishing it again puts
-- it back where it was without popping up twice.
create table if not exists whats_new_posts (
  id uuid primary key,
  title text not null,
  summary text not null default '',
  html text not null,
  cover_image_id uuid references whats_new_images (id) on delete set null,
  audience text[] not null default '{}',
  status text not null default 'draft',
  published_at timestamptz,
  in_email boolean not null default true,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whats_new_posts_status_check check (status in ('draft', 'published')),
  constraint whats_new_posts_published_check check (status = 'draft' or published_at is not null),
  constraint whats_new_posts_title_check check (char_length(title) between 1 and 120),
  constraint whats_new_posts_summary_check check (char_length(summary) <= 200),
  constraint whats_new_posts_html_check check (char_length(html) between 1 and 1000000)
);
create index if not exists whats_new_posts_live_idx on whats_new_posts (published_at desc) where status = 'published';

-- How far each person has seen: every post published at or before
-- seen_through has been shown to them or put away. It only moves forward.
create table if not exists whats_new_readers (
  user_id text primary key,
  seen_through timestamptz not null,
  updated_at timestamptz not null default now()
);
