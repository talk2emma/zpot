import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReportType } from '../types/contracts';
import { asyncJSONStorage } from './persist';

export interface DraftPhoto { uri: string; type: string; name: string; fileSize?: number }

export interface ReportDraft {
  type: ReportType | null;
  areaId: number | null;
  areaName: string;
  latitude: number;
  longitude: number;
  dx: number; // pin nudges (≈4 m steps), max ±12 (≈50 m)
  dy: number;
  scope: 'spot' | 'segment';
  details: { confirm?: boolean; issue?: string; until?: string; spot_size?: string };
  description: string;
  photo: DraftPhoto | null;
  sessionId: string | null;
}

interface DraftState {
  draft: ReportDraft | null;
  start(p: Pick<ReportDraft, 'areaId' | 'areaName' | 'latitude' | 'longitude'> & { sessionId?: string | null; type?: ReportType | null }): void;
  patch(p: Partial<ReportDraft>): void;
  clear(): void;
}

/** Persisted so an unsent report is never silently lost (offline, app killed, sign-in detour). */
export const useReportDraft = create<DraftState>()(persist(set => ({
  draft: null,
  start: p => set({ draft: { type: p.type ?? null, areaId: p.areaId, areaName: p.areaName, latitude: p.latitude,
    longitude: p.longitude, dx: 0, dy: 0, scope: 'spot', details: {}, description: '', photo: null, sessionId: p.sessionId ?? null } }),
  patch: p => set(s => (s.draft ? { draft: { ...s.draft, ...p, details: { ...s.draft.details, ...(p.details ?? {}) } } } : s)),
  clear: () => set({ draft: null }),
}), { name: 'zpot.report-draft.v1', storage: asyncJSONStorage }));

/** Pin offset → coordinates (each step ≈ 4 m). */
export function draftCoordinates(d: ReportDraft) {
  const dLat = (-d.dy * 4) / 111_320;
  const dLng = (d.dx * 4) / (111_320 * Math.cos((d.latitude * Math.PI) / 180));
  return { latitude: d.latitude + dLat, longitude: d.longitude + dLng };
}

export const EPHEMERAL: ReportType[] = ['leaving', 'found', 'occupied'];
