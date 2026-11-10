import { useInfiniteQuery } from '@tanstack/react-query';
import { nextPage } from '../services/api';
import type { Paginated } from '../types/contracts';

/**
 * Cursor-paginated list (notifications, history, reports, tickets). Uses `[...prefix, 'paged']` as its key so
 * invalidating the prefix (e.g. ['notifications']) refreshes it, without sharing a key with non-paged queries.
 */
export function usePaged<T>(prefix: readonly unknown[], first: () => Promise<Paginated<T>>, enabled = true,
  refetchInterval: number | false = false) {
  const q = useInfiniteQuery({
    queryKey: [...prefix, 'paged'],
    queryFn: ({ pageParam }) => (pageParam ? nextPage<T>(pageParam) : first()),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.next ?? null,
    enabled,
    refetchInterval, // pauses in the background (focusManager ↔ AppState)
  });
  const items = q.data?.pages.flatMap(p => p.results) ?? [];
  return { ...q, items };
}
