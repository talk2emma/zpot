import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Banner, EmptyState, FilterChip, Icon, LoadingState, ZpotButton, ZpotSearchBar } from '../../components/common';
import { toast } from '../../components/common/Toast';
import { LayersSheet } from '../../components/maps/LayersSheet';
import { MapControls } from '../../components/maps/MapControls';
import { ALL_LAYERS, type LayerKey, type RegionChange, type ZpotMapHandle } from '../../components/maps/types';
import { ZpotMap } from '../../components/maps/ZpotMap';
import { APP } from '../../constants/app';
import { ENV } from '../../constants/env';
import { markerLabel } from '../../features/parking/presentation';
import { useOnline } from '../../hooks/useOnline';
import { useAreaDetail, useMapLayers, useParkingOptions, useSearchParams } from '../../hooks/useParking';
import { placesApi } from '../../services/api';
import { getCurrentPosition, hasLocation } from '../../services/location/location';
import { usePrefsStore } from '../../store/prefsStore';
import { useSearchStore } from '../../store/searchStore';
import { palette, radius, shadows, useTheme } from '../../theme';
import type { MapFeatureProps } from '../../types/api';
import { haversineMeters } from '../../utils/geo';
import { ExploreSheet, type SheetSnap } from './ExploreSheet';
import { ResultsPanel } from './ResultsPanel';
import { SelectedSpotPanel } from './SelectedSpotPanel';

export function ExploreScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBar = useBottomTabBarHeight();
  const { height } = useWindowDimensions();
  const online = useOnline();
  const map = useRef<ZpotMapHandle>(null);

  const { destination, origin, plan, filters, selectedId, view, sheet, setOrigin, setFilters, select, setView, setSheet,
    setDestination } = useSearchStore();
  const locationStatus = usePrefsStore(s => s.locationStatus);
  const prefsWalk = usePrefsStore(s => s.parking.maxWalk);
  const locOn = hasLocation(locationStatus);

  const [layers, setLayers] = useState(ALL_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [panCenter, setPanCenter] = useState<RegionChange['center'] | null>(null);

  // Device position (only when permitted). Declined location never blocks guest use.
  useFocusEffect(useCallback(() => {
    if (!locOn) { setOrigin(null); return; }
    let live = true;
    getCurrentPosition().then(p => live && setOrigin({ latitude: p.latitude, longitude: p.longitude })).catch(() => undefined);
    return () => { live = false; };
  }, [locOn, setOrigin]));

  const { params, center } = useSearchParams();
  const options = useParkingOptions(params);
  const stay = { arrival_at: params?.arrival_at, duration_minutes: params?.duration_minutes ?? 120,
    vehicle_class: params?.vehicle_class, permit_type: params?.permit_type, has_disabled_badge: params?.has_disabled_badge };
  const layersQ = useMapLayers(center, stay);
  const selectedFromResults = options.data?.results.find(r => r.id === selectedId);
  const selectedDetail = useAreaDetail(selectedId !== null && !selectedFromResults ? selectedId : null,
    { ...stay, latitude: center?.latitude, longitude: center?.longitude });
  const selected = selectedFromResults ?? selectedDetail.data;

  const features = useMemo(() => layersQ.data?.features ?? [], [layersQ.data]);
  const placeName = destination?.name ?? t('explore.nearYou');
  const effectiveView = mapFailed ? 'list' : view;

  // Map/list sync: fly to a selection made outside the map (list "View on map", details screen)
  const lastFlown = useRef<number | null>(null);
  useEffect(() => {
    if (selectedId === null || lastFlown.current === selectedId) return;
    const f = features.find(x => x.properties.id === selectedId);
    if (f) { lastFlown.current = selectedId; map.current?.flyTo({ latitude: f.properties.latitude, longitude: f.properties.longitude }); }
  }, [selectedId, features]);
  // New destination → recentre
  useEffect(() => { if (center) map.current?.flyTo(center, APP.defaultZoom); setPanCenter(null); },
    [center?.latitude, center?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const topBlock = insets.top + 128;
  const heights = useMemo<Record<SheetSnap, number>>(() => ({
    peek: 190, half: Math.min(380, height * 0.45), full: height - topBlock - tabBar + 16,
  }), [height, topBlock, tabBar]);
  const snap: SheetSnap = effectiveView === 'list' ? 'full' : sheet;

  const showSearchArea = !!(panCenter && center && haversineMeters(panCenter, center) > 400);
  const searchThisArea = async () => {
    if (!panCenter) return;
    let name = t('explore.searchArea');
    try { const r = await placesApi.reverse(panCenter.latitude, panCenter.longitude); if (r.nearest_place && (r.distance_meters ?? 9999) < 600) name = r.nearest_place.name; } catch { /* keep generic label */ }
    setDestination({ id: `area:${panCenter.latitude.toFixed(4)},${panCenter.longitude.toFixed(4)}`, name, subtitle: '', ...panCenter });
  };
  const recenter = () => {
    if (origin && locOn && !destination) map.current?.flyTo(origin, APP.defaultZoom);
    else if (center) map.current?.flyTo(center, APP.defaultZoom);
    else map.current?.flyTo(APP.lisbon, 13);
    if (!locOn) toast(t('search.locationOffMsg'));
  };

  const filterCount = [filters.freeOnly, !filters.includeTimed, filters.includePaid, filters.verifiedOnly, filters.accessibleOnly,
    filters.maxCost > 0, filters.maxWalk !== prefsWalk].filter(Boolean).length;
  const timeChip = `${plan.useNow ? t('explore.now') : `${String(plan.hour).padStart(2, '0')}:00`} · ${plan.durationHours} h`;
  const subtitle = `${plan.useNow ? t('explore.now') : timeChip.split(' · ')[0]} · ${plan.durationHours} h · ${t('common.minWalk', { count: filters.maxWalk })}`;
  const label = (p: MapFeatureProps) => markerLabel(p.category, t, { rate: p.rate_per_hour, leaveBy: p.leave_by, lang: i18n.language });

  return (
    <View style={[styles.root, { backgroundColor: colors.mapBackdrop }]} testID="explore-screen">
      {!mapFailed ? (
        <ZpotMap ref={map} styleUrl={ENV.mapStyleUrl} center={center ?? APP.lisbon} initialZoom={center ? APP.defaultZoom : 12.5}
          features={features} layers={layers} selectedId={selectedId} showUserLocation={locOn}
          destination={destination ? { label: destination.name, coordinate: destination } : null}
          markerLabel={label} bottomInset={heights[snap]}
          onSelect={id => { select(id); if (id !== null && sheet === 'peek') setSheet('half'); }}
          onRegionChange={r => { if (r.userInteraction) setPanCenter(r.center); }}
          onMapError={() => { setMapFailed(true); toast(t('explore.mapFail')); }} testID="explore-map" />
      ) : null}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.row}>
          <ZpotSearchBar testID="explore-search" title={destination?.name ?? (origin ? t('explore.nearYou') : t('explore.searchPh'))}
            subtitle={subtitle} onPress={() => navigation.navigate('Search')} />
          <Pressable onPress={() => navigation.navigate('Part2', { feature: 'notifs' })} accessibilityRole="button"
            accessibilityLabel="Notifications" style={[styles.bell, shadows.card, { backgroundColor: colors.surface }]} testID="explore-bell">
            <Icon name="bell" color={colors.text} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          <FilterChip icon="filter" label={t('explore.filters')} badge={filterCount || undefined} onPress={() => navigation.navigate('Filters')} testID="chip-filters" />
          <FilterChip icon="clock" label={timeChip} onPress={() => navigation.navigate('Plan')} testID="chip-plan" />
          <FilterChip label={t('explore.freeOnly')} selected={filters.freeOnly}
            onPress={() => setFilters({ freeOnly: !filters.freeOnly, includePaid: filters.freeOnly ? filters.includePaid : false })} testID="chip-free-only" />
          {!mapFailed ? (
            <FilterChip icon={view === 'map' ? 'list' : 'map'} label={view === 'map' ? t('explore.list') : t('explore.map')}
              onPress={() => setView(view === 'map' ? 'list' : 'map')} testID="chip-view" />
          ) : null}
        </ScrollView>
        {!online ? <Banner tone="error" icon="offline" testID="offline-banner">{t('common.offline')}</Banner> : null}
        {mapFailed ? <Banner tone="warn" testID="map-fail-banner" action={{ label: t('common.retry'), onPress: () => setMapFailed(false) }}>{t('explore.mapFail')}</Banner> : null}
        {showSearchArea && effectiveView === 'map' ? (
          <Pressable onPress={searchThisArea} accessibilityRole="button" style={[styles.searchArea, shadows.card]} testID="search-this-area">
            <Icon name="search" size={16} color={palette.white} /><Text style={styles.searchAreaText}>{t('explore.searchArea')}</Text>
          </Pressable>
        ) : null}
      </View>

      {effectiveView === 'map' && snap !== 'full' ? (
        <>
          <View style={[styles.controls, { bottom: heights[snap] + 16 }]} pointerEvents="box-none">
            <MapControls onLayers={() => setLayersOpen(true)} onZoomIn={() => map.current?.zoomBy(1)}
              onZoomOut={() => map.current?.zoomBy(-1)} onRecenter={recenter} />
          </View>
          <Pressable onPress={() => navigation.navigate('Part2', { feature: 'report', areaId: selectedId ?? undefined })}
            accessibilityRole="button" accessibilityLabel={t('explore.report')} testID="explore-report"
            style={[styles.report, shadows.card, { bottom: heights[snap] + 16 }]}>
            <Icon name="flag" color={palette.white} size={18} /><Text style={styles.reportText}>{t('explore.report')}</Text>
          </Pressable>
        </>
      ) : null}

      <ExploreSheet snap={snap} heights={heights} a11yLabel={t('explore.layers')}
        onSnap={s => { if (effectiveView === 'list') { if (s !== 'full') setView('map'); } else setSheet(s); }}>
        {!center ? (
          <View style={styles.pad} testID="no-area">
            <EmptyState icon="pin" title={t('explore.noAreaTitle')} body={t('explore.noAreaBody')}>
              <ZpotButton label={t('explore.searchPh')} onPress={() => navigation.navigate('Search')} testID="no-area-search" />
              {!locOn ? <ZpotButton variant="tertiary" label={t('explore.turnOnLocation')} onPress={() => navigation.navigate('LocationPermission', { fromSettings: true })} /> : null}
            </EmptyState>
          </View>
        ) : selectedId !== null && effectiveView === 'map' ? (
          selected ? <SelectedSpotPanel option={selected} onClose={() => select(null)} />
            : <LoadingState skeleton={1} />
        ) : (
          <ResultsPanel data={options.data} loading={options.isFetching} error={options.error} onRetry={() => void options.refetch()}
            placeName={placeName} bottomPad={tabBar + 24} />
        )}
      </ExploreSheet>

      <LayersSheet visible={layersOpen} onClose={() => setLayersOpen(false)} layers={layers}
        onToggle={(k: LayerKey) => setLayers(l => ({ ...l, [k]: !l[k] }))} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 12, gap: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  bell: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 8, paddingRight: 12 },
  controls: { position: 'absolute', right: 12 },
  report: { position: 'absolute', left: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.navy900, borderRadius: 22, height: 44, paddingHorizontal: 16 },
  reportText: { color: palette.white, fontWeight: '700', fontSize: 15 },
  searchArea: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.navy900, borderRadius: 20, paddingHorizontal: 14, height: 40 },
  searchAreaText: { color: palette.white, fontWeight: '700' },
  pad: { paddingHorizontal: 16 },
});
