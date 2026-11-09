import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { type DayChoice, planDate, type StayPlan } from '../../store/searchStore';
import { formatDayMonth, hhmm } from '../../utils/time';
import { FilterChip, SectionLabel, Stepper, Wrap } from '../common/Primitives';

/** Arrival (Now / Today / Tomorrow / Saturday + hour) and duration selector. All times are Lisbon local. */
export function DateTimeSelector({ value, onChange }: { value: StayPlan; onChange: (p: Partial<StayPlan>) => void }) {
  const { t, i18n } = useTranslation();
  const days: DayChoice[] = ['today', 'tomorrow', 'saturday'];
  return (
    <View style={styles.col}>
      <SectionLabel>{t('plan.arrival')}</SectionLabel>
      <Wrap>
        <FilterChip label={t('plan.now')} selected={value.useNow} onPress={() => onChange({ useNow: true })} testID="plan-day-now" />
        {days.map(d => (
          <FilterChip key={d} testID={`plan-day-${d}`} selected={!value.useNow && value.day === d}
            label={`${t(`plan.${d}`)} · ${formatDayMonth(planDate({ ...value, day: d }), i18n.language).replace(/^\S+\s/, '')}`}
            onPress={() => onChange({ useNow: false, day: d })} />
        ))}
      </Wrap>
      {!value.useNow ? (
        <>
          <SectionLabel>{t('plan.arrivalTime')}</SectionLabel>
          <Stepper testID="plan-hour" value={hhmm(value.hour)} minusLabel={t('plan.earlier')} plusLabel={t('plan.later')}
            onMinus={() => onChange({ hour: (value.hour + 23) % 24 })} onPlus={() => onChange({ hour: (value.hour + 1) % 24 })} />
        </>
      ) : null}
      <SectionLabel>{t('plan.duration')}</SectionLabel>
      <Stepper testID="plan-duration" value={t('common.hours', { count: value.durationHours })} minusLabel={t('plan.less')} plusLabel={t('plan.more')}
        onMinus={() => onChange({ durationHours: Math.max(1, value.durationHours - 1) })}
        onPlus={() => onChange({ durationHours: Math.min(12, value.durationHours + 1) })} />
    </View>
  );
}

const styles = StyleSheet.create({ col: { gap: 10 } });
