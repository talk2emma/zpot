import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { placesApi } from '../services/api';
import type { LatLng } from '../types/api';

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function useAutocomplete(q: string, near?: LatLng | null) {
  const dq = useDebounced(q.trim(), 250);
  return useQuery({
    queryKey: ['autocomplete', dq, near?.latitude?.toFixed(3), near?.longitude?.toFixed(3)],
    queryFn: ({ signal }) => placesApi.autocomplete(dq, near ?? undefined, signal),
    enabled: dq.length >= 1,
    staleTime: 5 * 60_000,
  });
}

/** Popular places come from the same gazetteer (no static production list). */
export function usePopularPlaces() {
  return useQuery({
    queryKey: ['popular-places'],
    queryFn: async ({ signal }) => {
      const names = ['Campo Pequeno', 'LX Factory', 'Mercado de Arroios', 'Hub Criativo do Beato'];
      const lists = await Promise.all(names.map(n => placesApi.autocomplete(n, undefined, signal)));
      return lists.map(l => l[0]).filter(Boolean);
    },
    staleTime: 60 * 60_000,
  });
}
