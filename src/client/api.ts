'use client';

// Every call the pages make, against the package's routes under the base
// path in effect (./context). Errors come back as { error: { message, hint },
// requestId } and are thrown as WhatsNewError, which ErrorState and
// InlineError show in plain words.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeedAnswer, ImageAnswer, ImagesAnswer, ManagePostsAnswer, PostInput, UnseenAnswer } from '../shared/api';
import { errorFromBody, WhatsNewError } from '../ui/ui-deps';
import { usePaths } from './context';

/** Every query this package keeps is under this key, then the base path. */
export const QUERY_KEY = ['arvo-whats-new'] as const;

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, credentials: 'same-origin', headers: { accept: 'application/json', ...(init.headers ?? {}) } });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new WhatsNewError(0, { message: 'Could not reach the site. Check your connection and try again.' }, null);
  }
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw errorFromBody(response.status, body);
  return body as T;
}

function send<T>(url: string, body: unknown, method = 'POST'): Promise<T> {
  return call<T>(url, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

/** The pop-up's posts for the signed-in person. Read again when they come back to the tab. */
export function useUnseen(enabled = true) {
  const { basePath } = usePaths();
  return useQuery<UnseenAnswer, WhatsNewError>({
    queryKey: [...QUERY_KEY, basePath, 'unseen'],
    queryFn: ({ signal }) => call(`${basePath}/unseen`, { signal }),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useMarkSeen() {
  const { basePath } = usePaths();
  const client = useQueryClient();
  return useMutation<void, WhatsNewError, string>({
    mutationFn: (through) => send(`${basePath}/seen`, { through }),
    onSettled: () => client.invalidateQueries({ queryKey: [...QUERY_KEY, basePath, 'unseen'] }),
  });
}

/** What's New, newest first, ten at a time. */
export function useFeed() {
  const { basePath } = usePaths();
  return useInfiniteQuery<FeedAnswer, WhatsNewError>({
    queryKey: [...QUERY_KEY, basePath, 'feed'],
    queryFn: ({ pageParam, signal }) => call(`${basePath}/feed${pageParam ? `?before=${encodeURIComponent(String(pageParam))}` : ''}`, { signal }),
    initialPageParam: null,
    getNextPageParam: (last) => (last.hasMore ? (last.posts.at(-1)?.publishedAt ?? null) : null),
  });
}

export function useManagePosts() {
  const { basePath } = usePaths();
  return useQuery<ManagePostsAnswer, WhatsNewError>({
    queryKey: [...QUERY_KEY, basePath, 'manage', 'posts'],
    queryFn: ({ signal }) => call(`${basePath}/manage/posts`, { signal }),
  });
}

/** After any change to posts: the Admin page and the reader's views read again. */
function useRefreshAll() {
  const { basePath } = usePaths();
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: [...QUERY_KEY, basePath] });
}

export function useSavePost() {
  const { basePath } = usePaths();
  const refresh = useRefreshAll();
  return useMutation<{ id: string }, WhatsNewError, { id: string | null; input: PostInput }>({
    mutationFn: ({ id, input }) => send(id ? `${basePath}/manage/posts/${id}` : `${basePath}/manage/posts`, input),
    onSuccess: () => refresh(),
  });
}

export function useDeletePost() {
  const { basePath } = usePaths();
  const refresh = useRefreshAll();
  return useMutation<void, WhatsNewError, string>({
    mutationFn: (id) => send(`${basePath}/manage/posts/${id}`, undefined, 'DELETE'),
    onSuccess: () => refresh(),
  });
}

export function useUploadImage() {
  const { basePath } = usePaths();
  const client = useQueryClient();
  return useMutation<ImageAnswer, WhatsNewError, File>({
    mutationFn: (file) => call(`${basePath}/manage/images`, { method: 'POST', body: file, headers: { 'content-type': file.type || 'application/octet-stream' } }),
    onSuccess: () => client.invalidateQueries({ queryKey: [...QUERY_KEY, basePath, 'manage', 'images'] }),
  });
}

/** The pictures uploaded so far, for the Pictures panel. */
export function useImages(enabled = true) {
  const { basePath } = usePaths();
  return useQuery<ImagesAnswer, WhatsNewError>({
    queryKey: [...QUERY_KEY, basePath, 'manage', 'images'],
    queryFn: ({ signal }) => call(`${basePath}/manage/images`, { signal }),
    enabled,
  });
}
