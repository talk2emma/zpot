import { Linking, Platform } from 'react-native';

export type NavApp = 'apple' | 'google' | 'waze' | 'system';

export interface NavTarget { latitude: number; longitude: number; label: string }

interface Candidate { app: NavApp; urls: string[] }

function candidates(t: NavTarget): Candidate[] {
  const ll = `${t.latitude},${t.longitude}`;
  const label = encodeURIComponent(t.label);
  return [
    { app: 'apple', urls: Platform.OS === 'ios' ? [`maps://?daddr=${ll}&dirflg=d`, `https://maps.apple.com/?daddr=${ll}&dirflg=d`] : [] },
    {
      app: 'google',
      urls: Platform.OS === 'ios'
        ? [`comgooglemaps://?daddr=${ll}&directionsmode=driving`, `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=driving`]
        : [`google.navigation:q=${ll}&mode=d`, `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=driving`],
    },
    { app: 'waze', urls: [`waze://?ll=${ll}&navigate=yes`] },
    { app: 'system', urls: Platform.OS === 'ios' ? [`https://maps.apple.com/?daddr=${ll}`] : [`geo:${ll}?q=${ll}(${label})`] },
  ];
}

export async function availableApps(t: NavTarget): Promise<Record<NavApp, boolean>> {
  const out: Record<NavApp, boolean> = { apple: false, google: false, waze: false, system: true };
  for (const c of candidates(t)) {
    if (!c.urls.length) continue;
    if (c.app === 'system') continue;
    // first URL is the native scheme; https fallbacks always "open" (browser), so check the scheme
    try { out[c.app] = await Linking.canOpenURL(c.urls[0]); } catch { out[c.app] = false; }
    if (c.app === 'apple' && Platform.OS === 'ios') out.apple = true;
  }
  return out;
}

/** Opens turn-by-turn navigation. Resolves false when no URL for that app could be opened. */
export async function openNavigation(app: NavApp, t: NavTarget): Promise<boolean> {
  const c = candidates(t).find(x => x.app === app);
  for (const url of c?.urls ?? []) {
    try {
      await Linking.openURL(url);
      return true;
    } catch { /* try next fallback */ }
  }
  return false;
}
