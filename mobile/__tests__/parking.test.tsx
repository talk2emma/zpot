import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { parkingApi, placesApi } from '../src/services/api';
import { ApiError } from '../src/services/api/errors';
import { ExploreScreen } from '../src/screens/explore/ExploreScreen';
import { FiltersScreen } from '../src/screens/explore/FiltersScreen';
import { SearchScreen } from '../src/screens/explore/SearchScreen';
import { NavigationPickerScreen } from '../src/screens/parking/NavigationPickerScreen';
import { ParkingDetailsScreen } from '../src/screens/parking/ParkingDetailsScreen';
import { useAuthStore } from '../src/store/authStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { DEFAULT_FILTERS, useSearchStore } from '../src/store/searchStore';
import type { MapLayersResponse, ParkingAreaDetail, ParkingOptionsResponse, PlaceResult } from '../src/types/api';
import detail from './fixtures/area-detail-paid.json';
import ac from './fixtures/autocomplete-cam.json';
import layers from './fixtures/map-layers.json';
import options from './fixtures/options-saldanha.json';
import { ALL_ROUTES, renderScreen } from './helpers/render';

jest.mock('@react-navigation/bottom-tabs', () => ({ ...jest.requireActual('@react-navigation/bottom-tabs'), useBottomTabBarHeight: () => 64 }));

const OPTS = options as unknown as ParkingOptionsResponse;
const DEST = { id: 'saldanha', name: 'Saldanha', subtitle: 'Praça Duque de Saldanha, Lisboa', latitude: 38.7347, longitude: -9.145 };

beforeEach(() => {
  jest.restoreAllMocks();
  usePrefsStore.setState({ hydrated: true, onboardingDone: true, locationStatus: 'denied', recents: [] });
  useSearchStore.setState({ destination: DEST, origin: null, filters: DEFAULT_FILTERS, selectedId: null, view: 'map', sheet: 'half',
    plan: { useNow: true, day: 'today', hour: 10, durationHours: 2 } });
  jest.spyOn(parkingApi, 'mapLayers').mockResolvedValue(layers as unknown as MapLayersResponse);
});

describe('explore results', () => {
  it('renders API results free-first with the recommended card', async () => {
    jest.spyOn(parkingApi, 'options').mockResolvedValue(OPTS);
    await renderScreen('Explore', ExploreScreen, undefined, ALL_ROUTES);
    expect(await screen.findByTestId('results-count')).toHaveTextContent(`${OPTS.count} options · Saldanha`, { exact: false });
    const rec = OPTS.results.find(r => r.is_recommended)!;
    expect(screen.getByTestId(`result-card-${rec.id}`)).toHaveTextContent(/RECOMMENDED|Recommended/);
    expect(parkingApi.options).toHaveBeenCalledWith(expect.objectContaining({ destination_latitude: 38.7347, max_walk_minutes: 10 }), expect.anything());
  });

  it('no destination and no location shows the search prompt instead of results', async () => {
    useSearchStore.setState({ destination: null });
    const spy = jest.spyOn(parkingApi, 'options');
    await renderScreen('Explore', ExploreScreen, undefined, ALL_ROUTES);
    expect(await screen.findByTestId('no-area')).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('no-area-search'));
    expect(screen.getByTestId('stub-Search')).toBeTruthy();
  });

  it('“no free parking” offers to widen the walk, change time or show paid alternatives', async () => {
    const noFree = { ...OPTS, results: [], count: 0, recommended_id: null,
      summary: { ...OPTS.summary, free_options: 0, free_beyond_walk_limit: 1, hidden: { ...OPTS.summary.hidden, paid: 3 } } };
    jest.spyOn(parkingApi, 'options').mockResolvedValue(noFree);
    await renderScreen('Explore', ExploreScreen, undefined, ALL_ROUTES);
    expect(await screen.findByTestId('no-free-state')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('widen-walk'));
    expect(useSearchStore.getState().filters.maxWalk).toBe(15);
    await fireEvent.press(screen.getByTestId('show-paid'));
    expect(useSearchStore.getState().filters.includePaid).toBe(true);
  });

  it('shows a retryable error when the API is unreachable', async () => {
    const err = new ApiError({ kind: 'network', message: 'offline' });
    const spy = jest.spyOn(parkingApi, 'options').mockRejectedValue(err);
    await renderScreen('Explore', ExploreScreen, undefined, ALL_ROUTES);
    expect(await screen.findByTestId('results-error')).toHaveTextContent(/Can’t reach Zpot/);
    spy.mockResolvedValue(OPTS);
    await fireEvent.press(screen.getByTestId('results-error-retry'));
    expect(await screen.findByTestId('results-count')).toBeTruthy();
  });

  it('unsupported cities explain the coverage instead of showing results', async () => {
    jest.spyOn(parkingApi, 'options').mockResolvedValue({ ...OPTS, results: [], count: 0,
      coverage: { status: 'unsupported', city: 'porto', area: null, note: 'Zpot isn’t available in Porto yet.' } });
    await renderScreen('Explore', ExploreScreen, undefined, ALL_ROUTES);
    expect(await screen.findByTestId('coverage-unsupported')).toHaveTextContent('Porto', { exact: false });
  });

  it('selecting a map marker shows the spot summary and its actions', async () => {
    jest.spyOn(parkingApi, 'options').mockResolvedValue(OPTS);
    await renderScreen('Explore', ExploreScreen, undefined, ALL_ROUTES);
    await screen.findByTestId('results-count');
    const rec = OPTS.results.find(r => r.is_recommended)!;
    await fireEvent.press(await screen.findByTestId(`map-marker-${rec.id}`));
    expect(await screen.findByTestId('selected-spot')).toHaveTextContent(rec.name, { exact: false });
    await fireEvent.press(screen.getByTestId('selected-navigate'));
    expect(screen.getByTestId('stub-NavigationPicker')).toHaveTextContent(`"id":${rec.id}`, { exact: false });
  });

  it('opening a result card goes to details', async () => {
    jest.spyOn(parkingApi, 'options').mockResolvedValue(OPTS);
    await renderScreen('Explore', ExploreScreen, undefined, ALL_ROUTES);
    const first = OPTS.results[1];
    await fireEvent.press(await screen.findByTestId(`result-card-${first.id}`));
    expect(screen.getByTestId('stub-ParkingDetails')).toHaveTextContent(`"id":${first.id}`, { exact: false });
  });
});

describe('destination search', () => {
  it('autocompletes from the API and selecting a place updates the search', async () => {
    jest.spyOn(placesApi, 'autocomplete').mockImplementation(async q => (q === 'cam' ? (ac as { results: PlaceResult[] }).results : []));
    useSearchStore.setState({ destination: null });
    await renderScreen('Search', SearchScreen, undefined, ALL_ROUTES);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'cam');
    const hit = await screen.findByTestId('suggestion-campo-pequeno', {}, { timeout: 2000 });
    await fireEvent.press(hit);
    expect(useSearchStore.getState().destination?.name).toBe('Campo Pequeno');
    expect(usePrefsStore.getState().recents[0].id).toBe('campo-pequeno');
  });
  it('refuses unsupported cities with an explanation', async () => {
    jest.spyOn(placesApi, 'autocomplete').mockResolvedValue([{ id: 'porto', name: 'Porto', subtitle: 'Porto, Portugal', latitude: 41.1,
      longitude: -8.6, kind: 'city', provider: 'local', coverage: { status: 'unsupported', city: 'porto', area: null, note: '' } }]);
    await renderScreen('Search', SearchScreen, undefined, ALL_ROUTES);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'porto');
    await fireEvent.press(await screen.findByTestId('suggestion-porto', {}, { timeout: 2000 }));
    expect(screen.getByTestId('search-message')).toHaveTextContent('Porto', { exact: false });
    expect(useSearchStore.getState().destination?.id).toBe('saldanha');
  });
  it('“use my current location” explains when location is off', async () => {
    await renderScreen('Search', SearchScreen, undefined, ALL_ROUTES);
    await fireEvent.press(screen.getByTestId('search-my-location'));
    expect(await screen.findByTestId('search-message')).toHaveTextContent(/Location is off/);
  });
});

describe('filters', () => {
  it('applies the draft to the store; the button shows the real API count', async () => {
    const spy = jest.spyOn(parkingApi, 'options').mockResolvedValue(OPTS);
    await renderScreen('Filters', FiltersScreen, undefined, ALL_ROUTES);
    await fireEvent.press(screen.getByTestId('filter-paid'));
    await fireEvent.press(screen.getByTestId('filter-walk-15'));
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ include_paid: true, max_walk_minutes: 15 }), expect.anything()));
    expect(await screen.findByText(/^Show \d+ results?$/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('filters-apply'));
    expect(useSearchStore.getState().filters).toMatchObject({ includePaid: true, maxWalk: 15 });
  });
});

describe('parking details', () => {
  it('renders rules, evidence and actions from the API', async () => {
    jest.spyOn(parkingApi, 'area').mockResolvedValue(detail as unknown as ParkingAreaDetail);
    await renderScreen('ParkingDetails', ParkingDetailsScreen, { id: (detail as { id: number }).id }, ALL_ROUTES);
    expect(await screen.findByTestId('details-name')).toHaveTextContent('Av. Duque de Ávila', { exact: false });
    expect(screen.getByText(/Maximum stay 4 hours/)).toBeTruthy();
    expect(screen.getByText(/Signs on the street take priority/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('details-verification-toggle'));
    expect(screen.getByTestId('details-verification')).toHaveTextContent(/Development fixture/);
    await fireEvent.press(screen.getByTestId('details-navigate'));
    expect(screen.getByTestId('stub-NavigationPicker')).toHaveTextContent('Av. Duque de', { exact: false });
  });
  it('"I parked here" asks a guest to sign in and remembers the session start', async () => {
    jest.spyOn(parkingApi, 'area').mockResolvedValue(detail as unknown as ParkingAreaDetail);
    useAuthStore.setState({ status: 'guest', pendingReturn: null });
    await renderScreen('ParkingDetails', ParkingDetailsScreen, { id: (detail as { id: number }).id }, ALL_ROUTES);
    await fireEvent.press(await screen.findByTestId('details-parked'));
    expect(await screen.findByTestId('stub-SignIn')).toBeTruthy();
    expect(useAuthStore.getState().pendingReturn).toEqual({ route: 'StartSession', params: { areaId: (detail as { id: number }).id } });
  });
  it('report opens the real report flow', async () => {
    jest.spyOn(parkingApi, 'area').mockResolvedValue(detail as unknown as ParkingAreaDetail);
    await renderScreen('ParkingDetails', ParkingDetailsScreen, { id: (detail as { id: number }).id }, ALL_ROUTES);
    await fireEvent.press(await screen.findByTestId('details-report'));
    expect(screen.getByTestId('stub-ReportType')).toHaveTextContent(`"areaId":${(detail as { id: number }).id}`, { exact: false });
  });
});

describe('navigation hand-off', () => {
  it('opens the chosen maps app with the parking coordinates and keeps the selection', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    await renderScreen('NavigationPicker', NavigationPickerScreen, { id: 2, name: 'Av. Duque de Ávila', latitude: 38.7356, longitude: -9.143 }, ALL_ROUTES);
    await fireEvent.press(await screen.findByTestId('nav-app-google'));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(open.mock.calls[0][0]).toContain('38.7356,-9.143');
    expect(useSearchStore.getState().handoff?.areaId).toBe(2);
    expect(useSearchStore.getState().selectedId).toBe(2);
  });
  it('explains when Waze is not installed', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockImplementation(async (u: string) => !u.startsWith('waze'));
    await renderScreen('NavigationPicker', NavigationPickerScreen, { id: 2, name: 'X', latitude: 38.7, longitude: -9.1 }, ALL_ROUTES);
    await screen.findByText(/Not installed on this phone/);
    await fireEvent.press(screen.getByTestId('nav-app-waze'));
    expect(await screen.findByTestId('nav-error')).toHaveTextContent(/Waze isn’t installed/);
  });
});
