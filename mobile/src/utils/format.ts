export function formatEuro(value: string | number | null | undefined, locale = 'en'): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  try {
    return new Intl.NumberFormat(locale === 'pt-PT' ? 'pt-PT' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(n);
  } catch {
    return `€${n.toFixed(2)}`;
  }
}
