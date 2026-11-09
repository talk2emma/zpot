/** Lisbon-local date helpers. Arrival times are sent to the API as naive Lisbon wall-clock times. */
export const CITY_TZ = 'Europe/Lisbon';

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

function parts(d: Date, tz = CITY_TZ) {
  try {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
    const o: Record<string, string> = {};
    for (const p of f.formatToParts(d)) o[p.type] = p.value;
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, min: +o.minute, wd: o.weekday };
  } catch {
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), min: d.getMinutes(),
      wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] };
  }
}

/** Local calendar date (YYYY-MM-DD) in Lisbon, offset by `days`. */
export function cityDate(offsetDays = 0, now = new Date()): string {
  const p = parts(now);
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d + offsetDays));
  return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`;
}

/** Days until the next Saturday (1..7) in Lisbon. */
export function daysUntilSaturday(now = new Date()): number {
  const p = parts(now);
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  const diff = (6 - dow + 7) % 7;
  return diff === 0 ? 7 : diff;
}

export function naiveLocalIso(dateYmd: string, hour: number, minute = 0): string {
  return `${dateYmd}T${pad(hour)}:${pad(minute)}:00`;
}

export function cityHourNow(now = new Date()): number { return parts(now).h; }

export function formatTime(iso: string | Date, tz = CITY_TZ): string {
  const p = parts(typeof iso === 'string' ? new Date(iso) : iso, tz);
  return `${pad(p.h)}:${pad(p.min)}`;
}

export function formatDayMonth(dateYmd: string, locale: string): string {
  const [y, m, d] = dateYmd.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return dateYmd;
  }
}

export function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: CITY_TZ })
      .format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function minutesBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

export function hhmm(hour: number) { return `${pad(hour)}:00`; }
