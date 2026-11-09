import type { TFunction } from 'i18next';
import type { Category, ParkingOption } from '../../types/api';
import { formatEuro } from '../../utils/format';
import { formatDate, formatTime } from '../../utils/time';

/** Derives every user-facing string for an option from API enums (never from client-side rule logic). */
export function describeOption(o: ParkingOption, t: TFunction, lang: string) {
  const cost = formatEuro(o.expected_total_cost, lang);
  const leaveBy = o.leave_by ? formatTime(o.leave_by) : null;
  let headline: string;
  if (o.category === 'restricted') {
    const code = o.blocking_reason?.code ?? 'restricted';
    headline = ['permit_required', 'badge_required', 'temporary_closure'].includes(code)
      ? t(`headline.${code}`) : (o.blocking_reason?.label ?? t('headline.restricted'));
  } else if (o.category === 'unknown') {
    headline = t('headline.unknown');
  } else if (o.category === 'paid') {
    headline = leaveBy ? t('headline.paid_until', { cost, time: leaveBy }) : t('headline.paid', { cost });
  } else if (leaveBy) {
    headline = t('headline.free_until', { time: leaveBy });
  } else {
    headline = t(`headline.${o.category}`);
  }
  const costText = o.category === 'unknown' ? t('card.costUnknown') : o.category === 'restricted' ? '—'
    : t('card.costTotal', { cost });
  const limitText = leaveBy ? t('card.leaveBy', { time: leaveBy }) : t('card.noLimit');
  const fresh = o.verification_status === 'verified' && o.verified_at ? t('card.verified', { date: formatDate(o.verified_at, lang) })
    : o.verification_status === 'community' && o.verified_at ? t('card.community', { date: formatDate(o.verified_at, lang) })
      : t('card.notVerified');
  return {
    badge: t(`category.${o.category}`),
    headline,
    costText,
    limitText,
    walkText: t('common.minWalk', { count: o.walking_duration_minutes }),
    freshText: `${fresh} · ${t('explore.availabilityNotConfirmed')}`,
    leaveBy,
  };
}

export function markerLabel(category: Category, t: TFunction, opts: { rate?: string | null; leaveBy?: string | null; lang: string }) {
  switch (category) {
    case 'free': return t('category.free');
    case 'free_time_limited': return opts.leaveBy ? `${t('category.free')} → ${formatTime(opts.leaveBy)}` : t('category.free');
    case 'paid': return opts.rate ? `${formatEuro(opts.rate, opts.lang)}/h` : t('category.paid');
    case 'restricted': return '×';
    default: return '?';
  }
}
