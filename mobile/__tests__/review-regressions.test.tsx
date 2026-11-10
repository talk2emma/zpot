/** Regression tests for defects found in the 2026-11 code review (see docs/code-review/REMEDIATION_LOG.md). */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { parkingApi, vehiclesApi, billingApi } from '../src/services/api';
import { queryClient } from '../src/services/queryClient';
import { VehiclesScreen } from '../src/screens/planning/PlanningScreens';
import { ParkingDetailsScreen } from '../src/screens/parking/ParkingDetailsScreen';
import { useAuthStore } from '../src/store/authStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { useSearchStore } from '../src/store/searchStore';
import type { ParkingAreaDetail } from '../src/types/api';
import detail from './fixtures/area-detail-paid.json';
import { ALL_ROUTES, renderScreen } from './helpers/render';

beforeEach(() => { jest.restoreAllMocks(); });

it('M-01: signing out / session expiry drops every cached server response of the previous user', async () => {
  queryClient.setQueryData(['notifications'], { results: [{ id: 'private' }], unread_count: 1 });
  queryClient.setQueryData(['saved-locations'], [{ id: 1 }]);
  await useAuthStore.getState().clearLocalSession(true);
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});

it('M-02: "View on map" keeps the spot selected and switches to the map', async () => {
  jest.spyOn(parkingApi, 'area').mockResolvedValue(detail as unknown as ParkingAreaDetail);
  useSearchStore.setState({ view: 'list', selectedId: null });
  await renderScreen('ParkingDetails', ParkingDetailsScreen, { id: 2 }, ALL_ROUTES);
  await fireEvent.press(await screen.findByTestId('details-view-map'));
  expect(useSearchStore.getState().view).toBe('map');
  expect(useSearchStore.getState().selectedId).toBe(2);
});

it('M-07: changing the active vehicle updates the vehicle/permit used by parking searches', async () => {
  useAuthStore.setState({ status: 'authenticated' });
  usePrefsStore.getState().setParking({ vehicleClass: 'car', permitType: null });
  jest.spyOn(billingApi, 'entitlement').mockResolvedValue({ limits: { vehicles: 1 } } as never);
  const v = { id: 3, label: 'Van', vehicle_class: 'van', permit_type: 'lisbon-resident-saldanha', permit_name: 'x', is_active: true, created_at: '' };
  jest.spyOn(vehiclesApi, 'list').mockResolvedValue([{ ...v, vehicle_class: 'car', permit_type: null }] as never);
  jest.spyOn(vehiclesApi, 'update').mockResolvedValue(v as never);
  await renderScreen('Vehicles', VehiclesScreen, undefined, ALL_ROUTES);
  await fireEvent.press(await screen.findByTestId('vehicle-3'));
  await fireEvent.press(screen.getByTestId('vehicle-class-van'));
  await fireEvent.press(screen.getByTestId('vehicle-permit-lisbon-resident-saldanha'));
  await fireEvent.press(screen.getByTestId('vehicle-save'));
  await waitFor(() => expect(usePrefsStore.getState().parking).toEqual(expect.objectContaining({ vehicleClass: 'van', permitType: 'lisbon-resident-saldanha' })));
});

it('M-08: long inboxes are not silently cut at the first page', async () => {
  const api = require('../src/services/api');
  const { NotificationsScreen } = require('../src/screens/account/AccountScreens');
  useAuthStore.setState({ status: 'authenticated', user: { id: '1', email: 'a@b.pt', display_name: '', is_email_verified: true, roles: [], date_joined: '' } });
  const n = (i: number) => ({ id: `n${i}`, category: 'service', template: `t${i}`, title: `Note ${i}`, body: '', created_at: new Date().toISOString(), is_read: true });
  jest.spyOn(api.notificationsApi, 'list').mockResolvedValue({ next: 'http://localhost/api/v1/notifications/?cursor=abc', previous: null, unread_count: 0, results: [n(1)] });
  const { api: http } = require('../src/services/api/client');
  const next = jest.spyOn(http, 'get').mockResolvedValue({ data: { next: null, previous: null, results: [n(2)] } });
  await renderScreen('Notifications', NotificationsScreen, undefined, ALL_ROUTES);
  expect(await screen.findByText('Note 1')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('notif-load-more'));
  expect(await screen.findByText('Note 2')).toBeTruthy();
  expect(next).toHaveBeenCalledWith('http://localhost/api/v1/notifications/?cursor=abc');
  expect(screen.queryByTestId('notif-load-more')).toBeNull();
});
