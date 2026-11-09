/* eslint-env jest */
// ---- in-memory AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  const api = {
    getItem: jest.fn(async k => (k in store ? store[k] : null)),
    setItem: jest.fn(async (k, v) => { store[k] = v; }),
    removeItem: jest.fn(async k => { delete store[k]; }),
    clear: jest.fn(async () => { store = {}; }),
    getAllKeys: jest.fn(async () => Object.keys(store)),
    multiGet: jest.fn(async ks => ks.map(k => [k, store[k] ?? null])),
    multiSet: jest.fn(async kv => kv.forEach(([k, v]) => { store[k] = v; })),
  };
  return { __esModule: true, default: api, ...api };
});
// ---- keychain (tokens)
jest.mock('react-native-keychain', () => {
  let saved = null;
  return {
    ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY' },
    getGenericPassword: jest.fn(async () => saved),
    setGenericPassword: jest.fn(async (username, password) => { saved = { username, password }; return true; }),
    resetGenericPassword: jest.fn(async () => { saved = null; return true; }),
  };
});
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('react-native-localize', () => ({ getLocales: () => [{ languageCode: 'en', countryCode: 'PT', languageTag: 'en-PT', isRTL: false }] }));
jest.mock('react-native-bootsplash', () => ({ __esModule: true, default: { hide: jest.fn(async () => undefined), isVisible: jest.fn(async () => false) } }));
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    setRNConfiguration: jest.fn(),
    requestAuthorization: jest.fn((ok) => ok()),
    getCurrentPosition: jest.fn((ok) => ok({ coords: { latitude: 38.7347, longitude: -9.145, accuracy: 10 } })),
  },
}));
// ---- SVG icons render as plain views
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const C = ({ children }) => React.createElement(View, null, children);
  return { __esModule: true, default: C, Svg: C, Circle: C, Line: C, Path: C, Polyline: C, Rect: C };
});
// ---- MapLibre: native map replaced by inert views; markers stay pressable for map-selection tests
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Pass = ({ children }) => React.createElement(View, null, children);
  const Camera = React.forwardRef((_p, ref) => {
    React.useImperativeHandle(ref, () => ({ flyTo: jest.fn(), zoomTo: jest.fn(), fitBounds: jest.fn(), jumpTo: jest.fn(), easeTo: jest.fn() }));
    return null;
  });
  return { Map: Pass, Camera, GeoJSONSource: Pass, Layer: () => null, Marker: Pass, UserLocation: () => null };
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(async () => ({ assets: [{ uri: 'file:///tmp/sign.jpg', type: 'image/jpeg', fileName: 'sign.jpg', fileSize: 120000 }] })),
  launchImageLibrary: jest.fn(async () => ({ assets: [{ uri: 'file:///tmp/sign.jpg', type: 'image/jpeg', fileName: 'sign.jpg', fileSize: 120000 }] })),
}));
