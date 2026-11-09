/** Part 2 contracts — aliases over types generated from the live OpenAPI schema (npm run api:types). */
import type { components } from './openapi';

type S = components['schemas'];

export type Session = S['SessionDetail'];
export type SessionListItem = S['Session'];
export type SessionWarning = { code: string; message: string; deadline?: string; reason?: string };
export type SessionWithWarnings = { session: Session; warnings: SessionWarning[] };
export type SessionSummary = S['SessionSummary'];
export type Reminder = S['Reminder'];

export type Report = S['Report'];
export type ReportType = S['CreateReportRequest']['type'];
export type CreateReport = S['CreateReportRequest'];
export type Observation = S['Observation'];
export type VerificationAnswer = 'still_available' | 'taken' | 'unsure';

export type SavedLocation = S['SavedLocation'];
export type SavedDestination = S['SavedDestination'];
export type RecentSearch = S['SearchHistory'];

export type AppNotification = S['Notification'];
export type NotificationPrefs = S['NotificationPreference'];

export type HelpArticle = S['HelpArticle'];
export type Ticket = S['Ticket'];
export type TicketCategory = S['CreateTicketRequest']['category'];

export type PrivacyRequest = S['PrivacyRequest'];
export type ScoutAssignment = S['Assignment'];
export type ParkEvent = S['ParkEvent'];

export type Paginated<T> = { next: string | null; previous: string | null; results: T[] };
