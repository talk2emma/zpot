import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  notificationsApi, parkingApi, reportsApi, savedApi, sessionsApi, supportApi,
} from '../src/services/api';
import { ApiError } from '../src/services/api/errors';
import { NotificationsScreen } from '../src/screens/account/AccountScreens';
import { ParkingDetailsScreen } from '../src/screens/parking/ParkingDetailsScreen';
import {
  ReportDetailsScreen, ReportReviewScreen, ReportTypeScreen,
} from '../src/screens/report/ReportScreens';
import { EndSessionScreen, SessionSummaryScreen, StartSessionScreen } from '../src/screens/session/SessionScreens';
import { ContactSupportScreen, ProScreen } from '../src/screens/support/SupportScreens';
import { useAuthStore } from '../src/store/authStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { useReportDraft } from '../src/store/reportDraftStore';
import type { ParkingAreaDetail } from '../src/types/api';
import type { Report, Session, SessionSummary } from '../src/types/contracts';
import detail from './fixtures/area-detail-paid.json';
import { ALL_ROUTES, renderScreen } from './helpers/render';

const area = detail as unknown as ParkingAreaDetail;
const user = { id: 1, email: 'rita@example.pt', display_name: 'Rita', is_email_verified: true, roles: [], language: 'en' };
const authed = () => useAuthStore.setState({ status: 'authenticated', user: user as never, pendingReturn: null });
const guest = () => useAuthStore.setState({ status: 'guest', user: null, pendingReturn: null });

const session = {
  id: 'sess-1', status: 'active', area: { id: 2, name: area.name, verification_status: 'verified' }, started_at: new Date().toISOString(),
  planned_end_at: new Date(Date.now() + 2 * 3600e3).toISOString(), reminder_minutes: 15, category: 'paid', legal_status: 'permitted',
  restriction_deadline: null, restriction_reason: '', expected_cost: '3.20', evaluated_at: new Date().toISOString(),
  remaining_minutes: 120, is_overdue: false, reminders: [], events: [], created_at: '', updated_at: '',
} as unknown as Session;

const report = (over: Partial<Report> = {}) => ({
  id: 'rep-1', reference: 'ZR-123456', type: 'found', type_label: 'Found', status: 'published', area: { id: 2, name: area.name },
  location: { latitude: 38.7, longitude: -9.1 }, attachments: [], observation: null, history: [], appeal: null, created_at: '', updated_at: '',
  ...over,
}) as unknown as Report;

beforeEach(() => {
  jest.restoreAllMocks();
  guest();
  useReportDraft.setState({ draft: null });
  usePrefsStore.setState({ guestSaved: [], notifPermission: 'granted' });
});

describe('parking sessions', () => {
  it('starts a session and opens it', async () => {
    authed();
    jest.spyOn(parkingApi, 'area').mockResolvedValue(area);
    const start = jest.spyOn(sessionsApi, 'start').mockResolvedValue({ session, warnings: [] });
    await renderScreen('StartSession', StartSessionScreen, { areaId: 2 }, ALL_ROUTES);
    expect(await screen.findByTestId('start-session-area')).toHaveTextContent(area.name);
    await fireEvent.press(screen.getByTestId('start-session-duration-plus'));
    await fireEvent.press(screen.getByTestId('reminder-30'));
    await fireEvent.press(screen.getByTestId('start-session-submit'));
    expect(await screen.findByTestId('stub-Session')).toHaveTextContent('sess-1', { exact: false });
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ area_id: 2, reminder_minutes: 30 }));
  });

  it('explains an existing active session (409) instead of failing silently', async () => {
    authed();
    jest.spyOn(parkingApi, 'area').mockResolvedValue(area);
    jest.spyOn(sessionsApi, 'start').mockRejectedValue(new ApiError({ kind: 'http', status: 409, code: 'active_session_exists', message: 'x' }));
    await renderScreen('StartSession', StartSessionScreen, { areaId: 2 }, ALL_ROUTES);
    await screen.findByTestId('start-session-area');
    await fireEvent.press(screen.getByTestId('start-session-submit'));
    expect(await screen.findByTestId('start-session-already')).toBeTruthy();
  });

  it('validates the optional cost and ends with a departure share', async () => {
    authed();
    jest.spyOn(sessionsApi, 'get').mockResolvedValue(session);
    const end = jest.spyOn(sessionsApi, 'end').mockResolvedValue({ session: { ...session, status: 'ended', shared_departure: true } as Session,
      already_ended: false, summary: {} as SessionSummary });
    await renderScreen('EndSession', EndSessionScreen, { id: 'sess-1' }, ALL_ROUTES);
    await fireEvent.changeText(await screen.findByTestId('end-session-cost'), 'abc');
    expect(screen.getByText('Enter an amount like 1.50')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('end-session-cost'), '1,50');
    await fireEvent.press(screen.getByTestId('end-outcome-easy'));
    await fireEvent.press(screen.getByTestId('end-session-confirm'));
    expect(await screen.findByTestId('stub-SessionSummary')).toBeTruthy();
    expect(end).toHaveBeenCalledWith('sess-1', { share_departure: true, outcome: 'easy', cost_paid: '1.50' });
  });

  it('never invents a saving when the driver did not enter a cost', async () => {
    authed();
    jest.spyOn(sessionsApi, 'summary').mockResolvedValue({ session_id: 'sess-1', area: { id: 2, name: area.name }, status: 'ended',
      started_at: '', ended_at: '', duration_minutes: 95, verification_status: 'verified', expected_cost: null, cost_paid: null,
      estimated_saving: null, shared_departure: false, outcome: '' });
    await renderScreen('SessionSummary', SessionSummaryScreen, { id: 'sess-1' }, ALL_ROUTES);
    expect(await screen.findByTestId('session-no-saving')).toBeTruthy();
    expect(screen.queryByTestId('session-saving')).toBeNull();
  });
});

describe('community reports', () => {
  it('guests can share availability but must sign in to report a rule problem', async () => {
    jest.spyOn(parkingApi, 'area').mockResolvedValue(area);
    await renderScreen('ReportType', ReportTypeScreen, { areaId: 2 }, ALL_ROUTES);
    await waitFor(() => expect(screen.getByText(area.name)).toBeTruthy());
    await fireEvent.press(screen.getByTestId('report-type-incorrect_rule'));
    expect(await screen.findByTestId('stub-SignIn')).toBeTruthy();
    expect(useAuthStore.getState().pendingReturn?.route).toBe('ReportType');
  });

  it('a guest "found" report starts a draft at the parking location', async () => {
    jest.spyOn(parkingApi, 'area').mockResolvedValue(area);
    await renderScreen('ReportType', ReportTypeScreen, { areaId: 2 }, ALL_ROUTES);
    await waitFor(() => expect(screen.getByText(area.name)).toBeTruthy());
    await fireEvent.press(screen.getByTestId('report-type-found'));
    expect(await screen.findByTestId('stub-ReportLocation')).toBeTruthy();
    expect(useReportDraft.getState().draft).toEqual(expect.objectContaining({ type: 'found', areaId: 2, latitude: 38.7356 }));
  });

  it('requires an issue and a description for incorrect-rule reports, and attaches a photo', async () => {
    authed();
    useReportDraft.getState().start({ type: 'incorrect_rule', areaId: 2, areaName: area.name, latitude: 38.7356, longitude: -9.143 });
    await renderScreen('ReportDetails', ReportDetailsScreen, undefined, ALL_ROUTES);
    await fireEvent.press(screen.getByTestId('report-details-next'));
    expect(screen.getByTestId('report-details-error')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('detail-issue-hours'));
    await fireEvent.changeText(screen.getByTestId('detail-description'), 'Sign says 9–19 paid, app says free');
    await fireEvent.press(screen.getByTestId('report-photo-library'));
    await waitFor(() => expect(useReportDraft.getState().draft?.photo?.name).toBe('sign.jpg'));
    expect(launchImageLibrary).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('report-details-next'));
    expect(await screen.findByTestId('stub-ReportReview')).toBeTruthy();
  });

  it('submits, uploads the photo and reports an upload failure honestly', async () => {
    authed();
    useReportDraft.getState().start({ type: 'new_sign', areaId: 2, areaName: area.name, latitude: 38.7356, longitude: -9.143 });
    useReportDraft.getState().patch({ description: 'New loading bay sign', photo: { uri: 'file:///x.jpg', type: 'image/jpeg', name: 'x.jpg' } });
    const create = jest.spyOn(reportsApi, 'create').mockResolvedValue(report({ type: 'new_sign', status: 'pending_review' }));
    jest.spyOn(reportsApi, 'uploadPhoto').mockRejectedValue(new ApiError({ kind: 'http', status: 400, code: 'x', message: 'bad' }));
    await renderScreen('ReportReview', ReportReviewScreen, undefined, ALL_ROUTES);
    await fireEvent.press(screen.getByTestId('report-submit'));
    expect(await screen.findByTestId('stub-ReportSuccess')).toHaveTextContent('"photoFailed":true', { exact: false });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ type: 'new_sign', area_id: 2, description: 'New loading bay sign' }));
    expect(useReportDraft.getState().draft).toBeNull();
  });

  it('keeps the draft when offline', async () => {
    useReportDraft.getState().start({ type: 'found', areaId: 2, areaName: area.name, latitude: 38.7356, longitude: -9.143 });
    jest.spyOn(reportsApi, 'create').mockRejectedValue(new ApiError({ kind: 'network', message: 'offline' }));
    await renderScreen('ReportReview', ReportReviewScreen, undefined, ALL_ROUTES);
    await fireEvent.press(screen.getByTestId('report-submit'));
    expect(await screen.findByTestId('report-offline')).toBeTruthy();
    expect(useReportDraft.getState().draft?.type).toBe('found');
  });

  it('discarding asks first', async () => {
    useReportDraft.getState().start({ type: 'found', areaId: 2, areaName: area.name, latitude: 38.7356, longitude: -9.143 });
    await renderScreen('ReportReview', ReportReviewScreen, undefined, ALL_ROUTES);
    await fireEvent.press(screen.getByTestId('report-cancel'));
    expect(screen.getByTestId('report-cancel-dialog')).toBeTruthy();
    expect(useReportDraft.getState().draft).not.toBeNull();
  });
});

describe('saved locations', () => {
  it('a guest can keep a place on this device only', async () => {
    jest.spyOn(parkingApi, 'area').mockResolvedValue(area);
    await renderScreen('ParkingDetails', ParkingDetailsScreen, { id: 2 }, ALL_ROUTES);
    await fireEvent.press(await screen.findByTestId('details-save'));
    await fireEvent.press(await screen.findByTestId('save-guest-device'));
    expect(usePrefsStore.getState().guestSaved).toEqual([expect.objectContaining({ areaId: 2, label: area.name })]);
  });
  it('a signed-in driver saves to the account', async () => {
    authed();
    jest.spyOn(parkingApi, 'area').mockResolvedValue(area);
    const save = jest.spyOn(savedApi, 'save').mockResolvedValue({} as never);
    await renderScreen('ParkingDetails', ParkingDetailsScreen, { id: 2 }, ALL_ROUTES);
    await fireEvent.press(await screen.findByTestId('details-save'));
    await waitFor(() => expect(save).toHaveBeenCalledWith(2, area.name));
  });
});

describe('notifications', () => {
  it('lists the inbox and opens the target of a notification', async () => {
    authed();
    jest.spyOn(notificationsApi, 'list').mockResolvedValue({ next: null, previous: null, unread_count: 1, results: [
      { id: 'n1', category: 'session_reminder', template: 'session_reminder', title: 'Move soon', body: 'b', target: { kind: 'session', id: 'sess-1' },
        created_at: new Date().toISOString(), read_at: null, is_read: false } as never] });
    const read = jest.spyOn(notificationsApi, 'read').mockResolvedValue({} as never);
    await renderScreen('Notifications', NotificationsScreen, undefined, ALL_ROUTES);
    await fireEvent.press(await screen.findByTestId('notif-session_reminder'));
    expect(await screen.findByTestId('stub-Session')).toHaveTextContent('sess-1', { exact: false });
    expect(read).toHaveBeenCalledWith('n1');
  });
});

describe('support and Pro', () => {
  it('validates and sends a guest support request with a reference', async () => {
    const create = jest.spyOn(supportApi, 'create').mockResolvedValue({ id: 't1', reference: 'ZS-100200' } as never);
    await renderScreen('ContactSupport', ContactSupportScreen, { mode: 'support' }, ALL_ROUTES);
    await fireEvent.press(screen.getByTestId('support-send'));
    expect(create).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('support-topic-map_search'));
    await fireEvent.changeText(screen.getByTestId('support-description'), 'The map does not load near Saldanha');
    await fireEvent.changeText(screen.getByTestId('support-email'), 'rita@example.pt');
    await fireEvent.press(screen.getByTestId('support-send'));
    expect(await screen.findByText(/ZS-100200/)).toBeTruthy();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ category: 'map_search', contact_email: 'rita@example.pt', include_context: false }));
  });
  it('Pro preview never offers a purchase', async () => {
    await renderScreen('Pro', ProScreen, undefined, ALL_ROUTES);
    expect(screen.getByTestId('pro-cta')).toBeDisabled();
    expect(screen.getByTestId('pro-unavailable')).toBeTruthy();
  });
});
