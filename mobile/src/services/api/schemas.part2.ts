import { z } from 'zod';

/** Runtime schemas for the Part 2 contracts the app renders (verified against the live API by the contract suite). */
const latlng = z.object({ latitude: z.number(), longitude: z.number() });
const areaRef = z.object({ id: z.number(), name: z.string() }).passthrough();
const money = z.string().regex(/^\d+\.\d{2}$/);

export const reminderSchema = z.object({ id: z.number(), kind: z.string(), minutes_before: z.number(), fire_at: z.string(),
  status: z.enum(['scheduled', 'sent', 'cancelled', 'failed']), sent_at: z.string().nullable() });

export const sessionSchema = z.object({
  id: z.string().uuid(), status: z.enum(['active', 'ended', 'expired']), area: areaRef, started_at: z.string(), planned_end_at: z.string(),
  ended_at: z.string().nullable(), reminder_minutes: z.number(), category: z.string(), legal_status: z.string(),
  restriction_deadline: z.string().nullable(), restriction_reason: z.string(), expected_cost: money.nullable(),
  evaluated_at: z.string(), remaining_minutes: z.number().nullable(), is_overdue: z.boolean(),
  cost_paid: money.nullable(), shared_departure: z.boolean(), reminders: z.array(reminderSchema),
}).passthrough();

export const sessionWithWarningsSchema = z.object({ session: sessionSchema,
  warnings: z.array(z.object({ code: z.string(), message: z.string() }).passthrough()) });

export const sessionSummarySchema = z.object({ session_id: z.string(), area: areaRef, duration_minutes: z.number(),
  cost_paid: money.nullable(), expected_cost: money.nullable(),
  estimated_saving: z.object({ amount: money, compared_with: z.string(), rate_per_hour: z.string(), hours: z.number() }).passthrough().nullable(),
  shared_departure: z.boolean() }).passthrough();

export const reportSchema = z.object({
  id: z.string().uuid(), reference: z.string().regex(/^ZR-\d{6}$/),
  type: z.enum(['leaving', 'found', 'occupied', 'incorrect_rule', 'new_sign', 'closure', 'obstruction', 'wrong_location', 'other']),
  status: z.enum(['published', 'pending_review', 'under_review', 'accepted', 'rejected', 'superseded', 'expired', 'appeal_review', 'duplicate']),
  area: areaRef.nullable(), location: latlng, attachments: z.array(z.any()),
  observation: z.object({ id: z.number(), state: z.string(), expires_at: z.string(), confirmations: z.number(), contradictions: z.number() }).nullable(),
  history: z.array(z.object({ event: z.string(), at: z.string() }).passthrough()), appeal: z.any().nullable(), created_at: z.string(),
}).passthrough();

export const observationSchema = z.object({ id: z.number(), kind: z.enum(['available', 'leaving', 'occupied']),
  state: z.enum(['recently_reported_available', 'reported_occupied', 'conflicting_reports', 'observation_expired', 'unknown']),
  location: latlng, expires_at: z.string(), confirmations: z.number(), contradictions: z.number(), age_minutes: z.number(),
  report_id: z.string().nullable() }).passthrough();

export const savedLocationSchema = z.object({ id: z.number(), label: z.string(), area: areaRef.extend({ latitude: z.number(), longitude: z.number() }),
  current: z.object({ category: z.string(), rules_changed: z.boolean(), blocking_reason: z.any().nullable() }).passthrough() }).passthrough();

export const notificationSchema = z.object({ id: z.string(), category: z.string(), title: z.string(), body: z.string(),
  target: z.object({ route: z.string(), id: z.string().optional() }).nullable().or(z.object({}).strict()),
  is_read: z.boolean(), created_at: z.string(),
  push_status: z.enum(['pending', 'sent', 'failed', 'not_configured', 'no_device', 'suppressed']).optional() }).passthrough();

export const notificationListSchema = z.object({ unread_count: z.number(), results: z.array(notificationSchema) }).passthrough();

export const ticketSchema = z.object({ id: z.string(), reference: z.string().regex(/^ZS-\d{6}$/), category: z.string(),
  status: z.string(), staff_reply: z.string() }).passthrough();

export const privacyRequestSchema = z.object({ id: z.string(), reference: z.string(), kind: z.enum(['export', 'deletion']),
  status: z.enum(['received', 'processing', 'completed', 'failed', 'expired']), download_available: z.boolean() }).passthrough();

export const contributionsSchema = z.object({ karma: z.number(), reports: z.number(), accepted: z.number(), verifications: z.number(),
  level: z.enum(['new', 'contributor', 'trusted']), recent_events: z.array(z.object({ reason: z.string(), delta: z.number(), created_at: z.string() })) });

export const helpArticleSchema = z.object({ id: z.number(), slug: z.string(), title: z.string(), body: z.string() }).passthrough();

export const vehicleSchema = z.object({ id: z.number(), label: z.string(), vehicle_class: z.enum(['car', 'van', 'motorcycle']).or(z.string()),
  permit_type: z.string().nullable(), permit_name: z.string().nullable(), is_active: z.boolean() }).passthrough();

export const commutePlanSchema = z.object({ id: z.number(), label: z.string(), name: z.string(), location: latlng,
  days: z.array(z.number().int().min(0).max(6)), arrival_minute: z.number(), duration_minutes: z.number() }).passthrough();

export const commuteCheckSchema = z.object({ plan_id: z.number(), note: z.string(), days: z.array(z.object({
  weekday: z.number(), arrival_at: z.string(), locked: z.boolean(), free_options: z.number().nullable(),
  best: z.object({ area_id: z.number(), name: z.string(), category: z.enum(['free', 'free_time_limited', 'paid', 'unknown', 'restricted']),
    expected_total_cost: money.nullable(), leave_by: z.string().nullable(), walking_duration_minutes: z.number() }).passthrough().nullable() })) });

export const insightsSchema = z.object({ sessions: z.number(), parked_minutes: z.number(), sessions_with_cost: z.number(), paid_total: money,
  estimated_savings_total: money.nullable(), estimated_savings_sessions: z.number(), export_available: z.boolean() }).passthrough();

export const entitlementSchema = z.object({ plan: z.literal('free'), status: z.literal('none'), provider: z.null(),
  purchases_available: z.literal(false), limits: z.object({ vehicles: z.number() }).passthrough() }).passthrough();
