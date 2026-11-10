export const APP = {
  name: 'Zpot',
  version: '0.2.0', // keep in sync with package.json "version"
  /** Bundled fallback; the server's /config/ legal.privacy_version wins when reachable. */
  privacyPolicyVersion: '2026-11-10-draft',
  slogan: 'Park smarter. Spend less.',
  deepLinkScheme: 'zpot://',
  lisbon: { latitude: 38.7223, longitude: -9.1393 },
  defaultZoom: 15,
  splashMinMs: 900,
  durations: [1, 2, 3, 4, 6, 8, 12] as const,
  walkChoices: [5, 10, 15, 20] as const,
  costChoices: [0, 2, 5, 10] as const,
};
