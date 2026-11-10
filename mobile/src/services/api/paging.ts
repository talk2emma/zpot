import type { Paginated } from '../../types/contracts';
import { api } from './client';

/** Follows a DRF cursor `next` link (absolute URL from the server). */
export const nextPage = <T>(url: string) => api.get<Paginated<T>>(url).then(r => r.data);
