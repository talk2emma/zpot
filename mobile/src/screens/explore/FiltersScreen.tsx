import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterChip, Screen, ScreenHeader, SectionLabel, Toggle, Wrap, ZpotButton } from '../../components/common';
import { APP } from '../../constants/app';
import { useParkingOptions, useSearchParams } from '../../hooks/useParking';
import type { RootScreenProps } from '../../navigation/types';
import { usePrefsStore } from '../../store/prefsStore';
import { DEFAULT_FILTERS, type SearchFilters, useSearchStore } from '../../store/searchStore';

/** ParkingFilterSheet. Edits a draft; the apply button shows the real result count for the draft. */
export function FiltersScreen({ navigation }: RootScreenProps<'Filters'>) {
  const { t } = useTranslation();
  const store = useSearchStore();
  const prefsWalk = usePrefsStore(s => s.parking.maxWalk);
  const [d, setD] = useState<SearchFilters>(store.filters);
  const set = (p: Partial<SearchFilters>) => setD(x => ({ ...x, ...p }));
  const { params } = useSearchParams();
  const draftParams = useMemo(() => params && ({
    ...params, max_walk_minutes: d.maxWalk, free_only: d.freeOnly || undefined, include_paid: (d.includePaid && !d.freeOnly) || undefined,
    max_price: d.includePaid && !d.freeOnly && d.maxCost ? String(d.maxCost) : undefined, verified_only: d.verifiedOnly || undefined,
    accessible_only: d.accessibleOnly || undefined,
  }), [params, d]);
  const preview = useParkingOptions(draftParams);
  const count = preview.data ? preview.data.results.filter(r => d.includeTimed || r.category !== 'free_time_limited').length : null;

  return (
    <Screen testID="filters-screen"
      header={<ScreenHeader title={t('filters.title')} onBack={navigation.goBack} close backLabel={t('common.close')}
        right={<ZpotButton variant="tertiary" label={t('common.reset')} onPress={() => setD({ ...DEFAULT_FILTERS, maxWalk: prefsWalk })} testID="filters-reset" />} />}
      footer={<ZpotButton testID="filters-apply" label={count === null ? t('common.apply') : t('filters.show', { count })}
        loading={preview.isFetching && count === null} onPress={() => { store.setFilters(d); navigation.goBack(); }} />}>
      <Toggle label={t('filters.freeOnly')} sub={t('filters.freeOnlySub')} value={d.freeOnly}
        onValueChange={v => set({ freeOnly: v, includePaid: v ? false : d.includePaid })} testID="filter-free-only" />
      <Toggle label={t('filters.timed')} sub={t('filters.timedSub')} value={d.includeTimed} onValueChange={v => set({ includeTimed: v })} testID="filter-timed" />
      <Toggle label={t('filters.paid')} sub={t('filters.paidSub')} value={d.includePaid && !d.freeOnly} disabled={d.freeOnly}
        onValueChange={v => set({ includePaid: v })} testID="filter-paid" />
      <Toggle label={t('filters.verified')} sub={t('filters.verifiedSub')} value={d.verifiedOnly} onValueChange={v => set({ verifiedOnly: v })} testID="filter-verified" />
      <Toggle label={t('filters.accessible')} sub={t('filters.accessibleSub')} value={d.accessibleOnly} onValueChange={v => set({ accessibleOnly: v })} testID="filter-accessible" />
      <SectionLabel>{t('filters.maxWalk')}</SectionLabel>
      <Wrap>{APP.walkChoices.map(w => <FilterChip key={w} label={`${w} min`} selected={d.maxWalk === w} onPress={() => set({ maxWalk: w })} testID={`filter-walk-${w}`} />)}</Wrap>
      <SectionLabel>{t('filters.maxCost')}</SectionLabel>
      <Wrap>{APP.costChoices.map(c => (
        <FilterChip key={c} label={c ? t('filters.upTo', { n: c }) : t('filters.any')} selected={d.maxCost === c}
          onPress={() => set({ maxCost: c, includePaid: c ? true : d.includePaid, freeOnly: c ? false : d.freeOnly })} testID={`filter-cost-${c}`} />
      ))}</Wrap>
    </Screen>
  );
}
