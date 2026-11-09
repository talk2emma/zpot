import type { HelpArticle, Paginated, Ticket, TicketCategory } from '../../types/contracts';
import { api } from './client';
import type { PhotoFile } from './reports.api';

export const supportApi = {
  articles: (lang: string) => api.get<HelpArticle[]>('/help/articles/', { params: { lang } }).then(r => r.data),
  article: (id: number, lang: string) => api.get<HelpArticle>(`/help/articles/${id}/`, { params: { lang } }).then(r => r.data),
  tickets: () => api.get<Paginated<Ticket>>('/support/tickets/').then(r => r.data),
  ticket: (id: string) => api.get<Ticket>(`/support/tickets/${id}/`).then(r => r.data),
  create: (b: { category: TicketCategory; description: string; contact_email?: string; include_context?: boolean;
    context?: Record<string, unknown> }) => api.post<Ticket>('/support/tickets/', b).then(r => r.data),
  attach: (id: string, file: PhotoFile) => {
    const form = new FormData();
    form.append('file', file as unknown as Blob);
    return api.post(`/support/tickets/${id}/attachments/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};
