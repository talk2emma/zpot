import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner, FilterChip, Screen, ScreenHeader, SectionLabel, Toggle, Wrap, ZpotButton } from '../../components/common';
import { DateTimeSelector } from '../../components/forms/DateTimeSelector';
import { APP } from '../../constants/app';
import type { RootScreenProps } from '../../navigation/types';
import { usePrefsStore } from '../../store/prefsStore';
import { planDate, type StayPlan, useSearchStore } from '../../store/searchStore';
import { radius, typography, useTheme } from '../../theme';
import { cityHourNow, formatDayMonth, hhmm } from '../../utils/time';

export function PlanScreen({ navigation }: RootScreenProps<'Plan'>) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const store = useSearchStore();
  const parking = usePrefsStore(s => s.parking);
  const setParking = usePrefsStore(s => s.setParking);
  const [draft, setDraft] = useState<StayPlan>(store.plan);
  const [walk, setWalk] = useState(store.filters.maxWalk);
  const [freeOnly, setFreeOnly] = useState(store.filters.freeOnly);
  const [paid, setPaid] = useState(store.filters.includePaid);
  const [permit, setPermit] = useState(parking.permitType);

  const nowHour = cityHourNow();
  const past = !draft.useNow && draft.day === 'today' && draft.hour < nowHour;
  const endHour = (draft.useNow ? nowHour : draft.hour) + draft.durationHours;
  const crossesMidnight = endHour >= 24;
  const summary = draft.useNow ? `${t('plan.now')} → +${draft.durationHours} h`
    : `${formatDayMonth(planDate(draft), i18n.language)}, ${hhmm(draft.hour)} → ${hhmm(endHour % 24)}${crossesMidnight ? ` ${t('plan.midnight')}` : ''} · ${draft.durationHours} h`;

  const apply = () => {
    store.setPlan(draft);
    store.setFilters({ maxWalk: walk, freeOnly, includePaid: freeOnly ? false : paid });
    setParking({ permitType: permit });
    navigation.goBack();
  };

  return (
    <Screen testID="plan-screen" header={<ScreenHeader title={t('plan.title')} onBack={navigation.goBack} close backLabel={t('common.close')} />}
      footer={<ZpotButton label={t('common.apply')} onPress={apply} disabled={past} testID="plan-apply" />}>
      <DateTimeSelector value={draft} onChange={p => setDraft(d => ({ ...d, ...p }))} />
      {past ? <Banner tone="warn" testID="plan-past">{t('plan.past')}</Banner> : null}
      <View style={[styles.sum, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[typography.label, { color: colors.textMuted }]}>{t('plan.yourStay')}</Text>
        <Text style={[typography.bodyStrong, { color: colors.text, fontSize: 16 }]} testID="plan-summary">{summary}</Text>
        <Text style={[typography.small, { color: colors.textMuted, fontWeight: '400' }]}>{t('plan.tzNote')}</Text>
      </View>
      <SectionLabel>{t('plan.maxWalk')}</SectionLabel>
      <Wrap>{APP.walkChoices.map(w => <FilterChip key={w} label={`${w} min`} selected={walk === w} onPress={() => setWalk(w)} testID={`plan-walk-${w}`} />)}</Wrap>
      <Toggle label={t('plan.freeOnly')} sub={t('plan.freeOnlySub')} value={freeOnly} onValueChange={setFreeOnly} testID="plan-free-only" />
      <Toggle label={t('plan.paid')} sub={t('plan.paidSub')} value={paid && !freeOnly} disabled={freeOnly} onValueChange={setPaid} testID="plan-paid" />
      <SectionLabel>{t('plan.permit')}</SectionLabel>
      <Wrap>
        <FilterChip label={t('plan.noPermit')} selected={!permit} onPress={() => setPermit(null)} testID="plan-permit-none" />
        <FilterChip label={t('plan.residentPermit')} selected={permit === 'lisbon-resident-saldanha'}
          onPress={() => setPermit('lisbon-resident-saldanha')} testID="plan-permit-resident" />
      </Wrap>
    </Screen>
  );
}

const styles = StyleSheet.create({ sum: { padding: 14, borderRadius: radius.lg, gap: 4 } });
