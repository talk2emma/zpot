import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { parkingApi } from '../services/api';
import { usePrefsStore } from '../store/prefsStore';
import { arrivalParam, useSearchStore } from '../store/searchStore';
import type { LatLng, ParkingSearchParams } from '../types/api';
import { bboxAround } from '../utils/geo';

/** Builds API query parameters from UI state. Every filter maps to a real query parameter. */
export function useSearchParams(): { params: ParkingSearchParams | null; center: LatLng | null } {
  const { destination, origin, plan, filters } = useSearchStore();
  const parking = usePrefsStore(s => s.parking);
  return useMemo(() => {
    const center = destination ? { latitude: destination.latitude, longitude: destination.longitude } : origin;
    if (!center) return { params: null, center: null };
    const includePaid = filters.includePaid && !filters.freeOnly;
    const params: ParkingSearchParams = {
      ...(destination ? { destination_latitude: center.latitude, destination_longitude: center.longitude } : {}),
      ...(origin ? { latitude: origin.latitude, longitude: origin.longitude } : {}),
      arrival_at: arrivalParam(plan),
      duration_minutes: plan.durationHours * 60,
      max_walk_minutes: filters.maxWalk,
      free_only: filters.freeOnly || undefined,
      include_paid: includePaid || undefined,
      max_price: includePaid && filters.maxCost ? String(filters.maxCost) : undefined,
      verified_only: filters.verifiedOnly || undefined,
      accessible_only: filters.accessibleOnly || undefined,
      vehicle_class: parking.vehicleClass,
      permit_type: parking.permitType ?? undefined,
      has_disabled_badge: parking.hasDisabledBadge || undefined,
      limit: 30,
    };
    return { params, center };
  }, [destination, origin, plan, filters, parking]);
}

export function useParkingOptions(params: ParkingSearchParams | null) {
  return useQuery({
    queryKey: ['parking-options', params],
    queryFn: ({ signal }) => parkingApi.options(params!, signal),
    enabled: !!params,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useMapLayers(center: LatLng | null, stay: Pick<ParkingSearchParams, 'arrival_at' | 'duration_minutes' | 'vehicle_class' | 'permit_type' | 'has_disabled_badge'>) {
  const bbox = center ? bboxAround(center, 1400) : null;
  return useQuery({
    queryKey: ['map-layers', bbox?.map(n => n.toFixed(4)), stay],
    queryFn: ({ signal }) => parkingApi.mapLayers(bbox!, stay, signal),
    enabled: !!bbox,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useAreaDetail(id: number | null, stay: Parameters<typeof parkingApi.area>[1]) {
  return useQuery({
    queryKey: ['parking-area', id, stay],
    queryFn: ({ signal }) => parkingApi.area(id!, stay, signal),
    enabled: id !== null,
    staleTime: 60_000,
  });
}
