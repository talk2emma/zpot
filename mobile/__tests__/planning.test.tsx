import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { billingApi, commuteApi, detectionApi, insightsApi, parkingApi, placesApi, vehiclesApi } from '../src/services/api';
import {
  CommuteScreen, InsightsScreen, ManageSubscriptionScreen, PartnerScreen, VehiclesScreen,
} from '../src/screens/planning/PlanningScreens';
import { ZEventScreen } from '../src/screens/support/SupportScreens';
import { useAuthStore } from '../src/store/authStore';
import type { ParkingAreaDetail } from '../src/types/api';
import detail from './fixtures/area-detail-paid.json';
import { ALL_ROUTES, renderScreen } from './helpers/render';

const ent = { plan: 'free', status: 'none', provider: null, purchases_available: false, pro_preview_enabled: false,
  limits: { vehicles: 1, commute_days_visible: 1, insights_export: false }, note: '' } as never;

beforeEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState({ status: 'authenticated', user: { id: '1', email: 'r@x.pt', display_name: 'R', is_email_verified: true, roles: [], date_joined: '' } });
  jest.spyOn(billingApi, 'entitlement').mockResolvedValue(ent);
});

it('commute: creates a weekly plan and shows the soonest day while other days are honestly locked', async () => {
  jest.spyOn(commuteApi, 'list').mockResolvedValueOnce([]).mockResolvedValue([
    { id: 5, label: 'Saldanha', name: 'Saldanha', location: { latitude: 38.73, longitude: -9.14 }, days: [0, 2], arrival_minute: 540, duration_minutes: 480 } as never]);
  jest.spyOn(placesApi, 'autocomplete').mockResolvedValue([{ id: 'saldanha', name: 'Saldanha', subtitle: 'Lisboa', latitude: 38.73, longitude: -9.14, kind: 'area', provider: 'zpot' }]);
  const create = jest.spyOn(commuteApi, 'create').mockResolvedValue({} as never);
  jest.spyOn(commuteApi, 'check').mockResolvedValue({ plan_id: 5, checked_at: '', note: '', days: [
    { weekday: 0, arrival_at: '2026-11-16T09:00:00+00:00', locked: false, free_options: 3,
      best: { area_id: 1, name: 'Rua Filipe Folque', category: 'free', expected_total_cost: '0.00', leave_by: null, leave_by_reason: null, walking_duration_minutes: 4, is_recommended: true } },
    { weekday: 2, arrival_at: '2026-11-18T09:00:00+00:00', locked: true, free_options: null, best: null }] });
  await renderScreen('Commute', CommuteScreen, undefined, ALL_ROUTES);
  await fireEvent.press(await screen.findByTestId('commute-new'));
  await fireEvent.press(screen.getByTestId('commute-save'));
  expect(screen.getByTestId('commute-error')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('commute-dest-input'), 'Sal');
  await fireEvent.press(await screen.findByTestId('commute-suggestion-saldanha'));
  await fireEvent.press(screen.getByTestId('commute-day-5'));
  await fireEvent.press(screen.getByTestId('commute-save'));
  await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Saldanha', days: [0, 1, 2, 3, 4, 5], arrival_minute: 540 })));
  expect(await screen.findByText('Rua Filipe Folque')).toBeTruthy();
  expect(screen.getByTestId('commute-day-result-5-2')).toHaveTextContent(/See the whole week with Pro/);
  await fireEvent.press(screen.getByTestId('commute-open-5'));
  expect(await screen.findByTestId('stub-ParkingDetails')).toHaveTextContent('"id":1', { exact: false });
});

it('vehicles: edits the active vehicle and explains the Free limit', async () => {
  jest.spyOn(vehiclesApi, 'list').mockResolvedValue([{ id: 3, label: 'My car', vehicle_class: 'car', permit_type: null, permit_name: null, is_active: true, created_at: '' } as never]);
  const upd = jest.spyOn(vehiclesApi, 'update').mockResolvedValue({} as never);
  await renderScreen('Vehicles', VehiclesScreen, undefined, ALL_ROUTES);
  await fireEvent.press(await screen.findByTestId('vehicle-3'));
  await fireEvent.press(screen.getByTestId('vehicle-class-van'));
  await fireEvent.press(screen.getByTestId('vehicle-permit-lisbon-resident-saldanha'));
  await fireEvent.press(screen.getByTestId('vehicle-save'));
  await waitFor(() => expect(upd).toHaveBeenCalledWith(3, { label: 'My car', vehicle_class: 'van', permit_type: 'lisbon-resident-saldanha' }));
  expect(screen.getByTestId('vehicles-limit')).toBeTruthy();
});

it('insights: shows totals and never invents savings', async () => {
  jest.spyOn(insightsApi, 'get').mockResolvedValue({ sessions: 2, parked_minutes: 150, sessions_with_cost: 1, paid_total: '1.50',
    estimated_savings_total: null, estimated_savings_sessions: 0, currency: 'EUR', export_available: false, note: '' });
  await renderScreen('Insights', InsightsScreen, undefined, ALL_ROUTES);
  expect(await screen.findByTestId('insights-stats')).toHaveTextContent(/2 h 30 min/);
  expect(screen.queryByTestId('insights-savings')).toBeNull();
  await fireEvent.press(screen.getByTestId('insights-export'));
  expect(await screen.findByTestId('stub-Pro')).toBeTruthy();
});

it('partner and subscription never take payments', async () => {
  jest.spyOn(parkingApi, 'area').mockResolvedValue({ ...(detail as object), commercial: { is_partner: true, offer: 'Reserve a bay', ev_charging: '4 chargers' } } as unknown as ParkingAreaDetail);
  await renderScreen('Partner', PartnerScreen, { areaId: 2 }, ALL_ROUTES);
  expect(await screen.findByText('Reserve a bay')).toBeTruthy();
  expect(screen.getByTestId('partner-cta')).toBeDisabled();
  await renderScreen('ManageSubscription', ManageSubscriptionScreen, undefined, ALL_ROUTES);
  await fireEvent.press(await screen.findByTestId('sub-restore'));
  expect(screen.getByTestId('sub-restore-none')).toBeTruthy();
});

it('Z-Trigger event: correct the location from nearby parking, then confirm starts a session there', async () => {
  jest.spyOn(parkingApi, 'options').mockResolvedValue({ results: [{ id: 7, name: 'Rua Andrade Corvo', category: 'free_time_limited', location: { latitude: 38.7322, longitude: -9.147 } }] } as never);
  const correct = jest.spyOn(detectionApi, 'correct').mockResolvedValue({} as never);
  jest.spyOn(detectionApi, 'confirm').mockResolvedValue({} as never);
  await renderScreen('ZEvent', ZEventScreen, { id: 'e1', at: '2026-11-09T10:00:00Z', latitude: 38.73, longitude: -9.14 }, ALL_ROUTES);
  await fireEvent.press(screen.getByTestId('zevent-correct'));
  await fireEvent.press(await screen.findByTestId('zevent-area-7'));
  await waitFor(() => expect(correct).toHaveBeenCalled());
  await fireEvent.press(screen.getByTestId('zevent-confirm'));
  expect(await screen.findByTestId('stub-StartSession')).toHaveTextContent('"areaId":7', { exact: false });
});
