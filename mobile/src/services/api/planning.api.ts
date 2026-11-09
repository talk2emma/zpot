import type { components } from '../../types/openapi';
import { api } from './client';

type S = components['schemas'];
export type Vehicle = S['Vehicle'];
export type CommutePlan = S['CommutePlan'];
export type Entitlement = S['Entitlement'];
export type Insights = S['SessionInsights'];
export interface CommuteDay {
  weekday: number; arrival_at: string; locked: boolean; free_options: number | null;
  best: null | { area_id: number; name: string; category: string; expected_total_cost: string | null; leave_by: string | null;
    leave_by_reason: { label: string } | null; walking_duration_minutes: number; is_recommended: boolean };
}
export interface CommuteCheck { plan_id: number; checked_at: string; days: CommuteDay[]; note: string }

export const vehiclesApi = {
  list: () => api.get<Vehicle[]>('/vehicles/').then(r => r.data),
  create: (b: { label: string; vehicle_class: string; permit_type?: string | null }) => api.post<Vehicle>('/vehicles/', b).then(r => r.data),
  update: (id: number, b: Partial<{ label: string; vehicle_class: string; permit_type: string | null }>) =>
    api.patch<Vehicle>(`/vehicles/${id}/`, b).then(r => r.data),
  remove: (id: number) => api.delete(`/vehicles/${id}/`).then(() => undefined),
  activate: (id: number) => api.post<Vehicle>(`/vehicles/${id}/activate/`).then(r => r.data),
};

export const commuteApi = {
  list: () => api.get<CommutePlan[]>('/commute/plans/').then(r => r.data),
  create: (b: { label: string; name: string; latitude: number; longitude: number; days: number[]; arrival_minute: number; duration_minutes: number }) =>
    api.post<CommutePlan>('/commute/plans/', b).then(r => r.data),
  update: (id: number, b: Partial<{ days: number[]; arrival_minute: number; duration_minutes: number; label: string }>) =>
    api.patch<CommutePlan>(`/commute/plans/${id}/`, b).then(r => r.data),
  remove: (id: number) => api.delete(`/commute/plans/${id}/`).then(() => undefined),
  check: (id: number) => api.get<CommuteCheck>(`/commute/plans/${id}/check/`).then(r => r.data),
};

export const billingApi = {
  entitlement: () => api.get<Entitlement>('/billing/entitlement/').then(r => r.data),
};

export const insightsApi = {
  get: () => api.get<Insights>('/sessions/insights/').then(r => r.data),
};
