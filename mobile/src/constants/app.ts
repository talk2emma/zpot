export const APP = {
  name: 'Zpot',
  slogan: 'Park smarter. Spend less.',
  deepLinkScheme: 'zpot://',
  lisbon: { latitude: 38.7223, longitude: -9.1393 },
  defaultZoom: 15,
  splashMinMs: 900,
  durations: [1, 2, 3, 4, 6, 8, 12] as const,
  walkChoices: [5, 10, 15, 20] as const,
  costChoices: [0, 2, 5, 10] as const,
};
