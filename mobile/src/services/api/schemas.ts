import { z } from 'zod';

/** Runtime schemas for the API contracts the mobile app depends on (used by the contract test suite). */
const reason = z.object({ code: z.string(), label: z.string(), at: z.string().nullable() }).nullable();
const category = z.enum(['free', 'free_time_limited', 'paid', 'unknown', 'restricted']);
const coverage = z.object({ status: z.enum(['full', 'partial', 'mapping', 'outside_mapped_areas', 'unsupported']),
  city: z.string().nullable(), area: z.object({ slug: z.string(), name: z.string() }).nullable(), note: z.string() });

export const parkingOptionSchema = z.object({
  id: z.number(), name: z.string(), address: z.string(), kind: z.enum(['on_street', 'car_park', 'bay']),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
  geometry: z.object({ type: z.string(), coordinates: z.array(z.any()) }),
  category, rank: z.number().int(), is_recommended: z.boolean(),
  legal_status: z.enum(['permitted', 'permitted_until', 'not_permitted', 'unknown']),
  pricing_status: z.enum(['free', 'paid', 'unknown', 'not_applicable']),
  eligibility_status: z.enum(['eligible', 'permit_required', 'badge_required', 'vehicle_not_allowed', 'unknown']),
  availability_status: z.enum(['unknown', 'recently_reported_available', 'reported_occupied', 'conflicting_reports']),
  expected_total_cost: z.string().regex(/^\d+\.\d{2}$/).nullable(), currency: z.literal('EUR'),
  arrival_at: z.string(), duration_minutes: z.number().int(), leave_by: z.string().nullable(),
  leave_by_reason: reason, blocking_reason: reason, has_paid_periods: z.boolean(),
  walking_distance_meters: z.number(), walking_duration_minutes: z.number().int().positive(), distance_meters: z.number(),
  verified_at: z.string().nullable(), verification_status: z.enum(['verified', 'community', 'unverified']),
  data_source: z.object({ id: z.number(), name: z.string(), kind: z.string(), is_development_fixture: z.boolean() }).passthrough().nullable(),
  evidence_status: z.string(), confidence_label: z.enum(['high', 'medium', 'low']), is_accessible: z.boolean(),
  explanation_codes: z.array(z.string()),
  recommendation_reason: z.object({ code: z.string(), params: z.record(z.string(), z.any()), text: z.string() }),
  commercial: z.object({ is_partner: z.boolean(), offer: z.string().nullable(), ev_charging: z.string().nullable() }).nullable(),
});

export const parkingOptionsSchema = z.object({
  query: z.record(z.string(), z.any()), coverage, recommended_id: z.number().nullable(), count: z.number().int(),
  next_cursor: z.string().nullable(), results: z.array(parkingOptionSchema), disclaimer: z.string(),
  summary: z.object({ candidates: z.number(), free_options: z.number(), free_beyond_walk_limit: z.number(),
    no_free_within_limits: z.boolean(), by_category: z.record(category, z.number()),
    hidden: z.object({ restricted: z.number(), paid: z.number(), unknown: z.number(), over_max_price: z.number(), not_accessible: z.number() }) }),
});

export const areaDetailSchema = parkingOptionSchema.extend({
  rule_lines: z.array(z.string()), evidence_count: z.number(), disclaimer: z.string(),
  supported_area: z.object({ slug: z.string(), name: z.string(), coverage: z.string(), coverage_note: z.string() }).nullable(),
});

export const placeSchema = z.object({ id: z.string(), name: z.string(), subtitle: z.string(), latitude: z.number(),
  longitude: z.number(), kind: z.string(), provider: z.string(), coverage: coverage.optional() });

export const mapLayersSchema = z.object({ type: z.literal('FeatureCollection'), features: z.array(z.object({
  type: z.literal('Feature'), id: z.number(), geometry: z.object({ type: z.string() }),
  properties: z.object({ id: z.number(), name: z.string(), category, layer: z.enum(['free', 'timed', 'paid', 'restrict', 'unknown']),
    latitude: z.number(), longitude: z.number(), rate_per_hour: z.string().nullable(), leave_by: z.string().nullable() }).passthrough() })) });

export const userSchema = z.object({ id: z.string(), email: z.string().email(), display_name: z.string(),
  is_email_verified: z.boolean(), date_joined: z.string(), roles: z.array(z.string()) });
export const authResponseSchema = z.object({ user: userSchema, tokens: z.object({ access: z.string(), refresh: z.string() }) });
export const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.any(), request_id: z.string().nullable() }) });
export const configSchema = z.object({ api_version: z.string(), map: z.object({ style_url: z.string().url() }).passthrough(),
  search_defaults: z.object({ max_walk_minutes: z.number(), duration_minutes: z.number() }).passthrough(),
  features: z.array(z.object({ key: z.string(), enabled: z.boolean(), phase: z.string() })) }).passthrough();
