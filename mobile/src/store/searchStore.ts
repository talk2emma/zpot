import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LatLng } from '../types/api';
import { cityDate, daysUntilSaturday, naiveLocalIso } from '../utils/time';
import { asyncJSONStorage } from './persist';

export interface Destination { id: string; name: string; subtitle: string; latitude: number; longitude: number }

export type DayChoice = 'today' | 'tomorrow' | 'saturday';

export interface StayPlan {
  useNow: boolean;
  day: DayChoice;
  hour: number; // Lisbon local hour 0..23
  durationHours: number; // 1..12
}

export interface SearchFilters {
  freeOnly: boolean;
  includeTimed: boolean;
  includePaid: boolean;
  verifiedOnly: boolean;
  accessibleOnly: boolean;
  maxWalk: number;
  maxCost: number; // 0 = any
}

export const DEFAULT_FILTERS: SearchFilters = {
  freeOnly: false, includeTimed: true, includePaid: false, verifiedOnly: false, accessibleOnly: false, maxWalk: 10,
  maxCost: 0,
};

export const DEFAULT_PLAN: StayPlan = { useNow: true, day: 'today', hour: 10, durationHours: 2 };

interface SearchState {
  destination: Destination | null;
  origin: LatLng | null; // device position (only when location permitted)
  plan: StayPlan;
  filters: SearchFilters;
  selectedId: number | null;
  view: 'map' | 'list';
  sheet: 'peek' | 'half' | 'full';
  handoff: { areaId: number; app: string; at: string } | null;
  setDestination(d: Destination | null): void;
  setOrigin(o: LatLng | null): void;
  setPlan(p: Partial<StayPlan>): void;
  setFilters(f: Partial<SearchFilters>): void;
  resetFilters(maxWalk: number): void;
  select(id: number | null): void;
  setView(v: 'map' | 'list'): void;
  setSheet(s: 'peek' | 'half' | 'full'): void;
  setHandoff(h: SearchState['handoff']): void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    set => ({
      destination: null,
      origin: null,
      plan: DEFAULT_PLAN,
      filters: DEFAULT_FILTERS,
      selectedId: null,
      view: 'map',
      sheet: 'half',
      handoff: null,
      setDestination: destination => set({ destination, selectedId: null, sheet: 'half' }),
      setOrigin: origin => set({ origin }),
      setPlan: p => set(s => ({ plan: { ...s.plan, ...p } })),
      setFilters: f => set(s => ({ filters: { ...s.filters, ...f } })),
      resetFilters: maxWalk => set({ filters: { ...DEFAULT_FILTERS, maxWalk } }),
      select: selectedId => set({ selectedId }),
      setView: view => set({ view, selectedId: null }),
      setSheet: sheet => set({ sheet }),
      setHandoff: handoff => set({ handoff }),
    }),
    {
      name: 'zpot.search.v1',
      storage: asyncJSONStorage,
      // keep the journey across an external-navigation hand-off / app restart
      partialize: s => ({ destination: s.destination, plan: s.plan, filters: s.filters, selectedId: s.selectedId,
        handoff: s.handoff }),
    },
  ),
);

export function planDate(plan: StayPlan, now = new Date()): string {
  const off = plan.day === 'today' ? 0 : plan.day === 'tomorrow' ? 1 : daysUntilSaturday(now);
  return cityDate(off, now);
}

/** Arrival as a naive Lisbon-local ISO string (API interprets naive times in city time); undefined = now. */
export function arrivalParam(plan: StayPlan, now = new Date()): string | undefined {
  return plan.useNow ? undefined : naiveLocalIso(planDate(plan, now), plan.hour);
}
