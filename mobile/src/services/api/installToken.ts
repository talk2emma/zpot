import AsyncStorage from '@react-native-async-storage/async-storage';

/** Opaque random per-install token (X-Zpot-Client). Lets guests see their own reports; never an identity. */
const KEY = 'zpot.install-token.v1';
let cached: string | null = null;

function random(): string {
  const a = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i++) s += a[Math.floor(Math.random() * 16)];
  return s;
}

export async function installToken(): Promise<string> {
  if (cached) return cached;
  try {
    const t = await AsyncStorage.getItem(KEY);
    if (t && t.length >= 16) { cached = t; return t; }
    const n = random();
    await AsyncStorage.setItem(KEY, n);
    cached = n;
  } catch {
    cached = cached ?? random();
  }
  return cached;
}
