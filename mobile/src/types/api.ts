/** API contracts mirrored from the Django API (see docs/api/endpoints.md and /api/v1/schema/). */

export type Category = 'free' | 'free_time_limited' | 'paid' | 'unknown' | 'restricted';
export type LegalStatus = 'permitted' | 'permitted_until' | 'not_permitted' | 'unknown';
export type PricingStatus = 'free' | 'paid' | 'unknown' | 'not_applicable';
export type EligibilityStatus = 'eligible' | 'permit_required' | 'badge_required' | 'vehicle_not_allowed' | 'unknown';
export type AvailabilityStatus = 'unknown' | 'recently_reported_available' | 'reported_occupied' | 'conflicting_reports';
export type VerificationStatus = 'verified' | 'community' | 'unverified';
export type ConfidenceLabel = 'high' | 'medium' | 'low';
export type CoverageStatus = 'full' | 'partial' | 'mapping' | 'outside_mapped_areas' | 'unsupported';
export type VehicleClass = 'car' | 'motorcycle' | 'van' | 'ev';
export type Language = 'en' | 'pt-PT';

export interface LatLng { latitude: number; longitude: number }

export interface Reason { code: string; label: string; at: string | null }

export interface DataSource {
  id: number; name: string; kind: string; is_development_fixture: boolean; attribution?: string;
}

export interface Coverage {
  status: CoverageStatus;
  city: string | null;
  area: { slug: string; name: string } | null;
  note: string;
}

export interface RecommendationReason {
  code: string;
  params: { walk_minutes: number; cost?: string; leave_by?: string; leave_by_reason?: string; blocking_reason?: string };
  text: string;
}

export interface ParkingOption {
  id: number;
  name: string;
  address: string;
  kind: 'on_street' | 'car_park' | 'bay';
  location: LatLng;
  geometry: GeoJSON.Geometry;
  category: Category;
  rank: number;
  is_recommended: boolean;
  legal_status: LegalStatus;
  pricing_status: PricingStatus;
  eligibility_status: EligibilityStatus;
  availability_status: AvailabilityStatus;
  availability: { status: AvailabilityStatus; observed_at?: string; expires_at?: string };
  expected_total_cost: string | null;
  currency: 'EUR';
  arrival_at: string;
  duration_minutes: number;
  leave_by: string | null;
  leave_by_reason: Reason | null;
  blocking_reason: Reason | null;
  has_paid_periods: boolean;
  walking_distance_meters: number;
  walking_duration_minutes: number;
  distance_meters: number;
  verified_at: string | null;
  verification_status: VerificationStatus;
  data_source: DataSource | null;
  evidence_status: string;
  confidence_label: ConfidenceLabel;
  is_accessible: boolean;
  explanation_codes: string[];
  recommendation_reason: RecommendationReason;
  commercial: { is_partner: boolean; offer: string | null; ev_charging: string | null } | null;
}

export interface ParkingAreaDetail extends ParkingOption {
  supported_area: { slug: string; name: string; coverage: string; coverage_note: string } | null;
  operator_name: string | null;
  capacity_estimate: number | null;
  rule_lines: string[];
  evidence_count: number;
  disclaimer: string;
}

export interface SearchSummary {
  candidates: number;
  free_options: number;
  free_beyond_walk_limit: number;
  no_free_within_limits: boolean;
  by_category: Record<Category, number>;
  hidden: { restricted: number; paid: number; unknown: number; over_max_price: number; not_accessible: number };
}

export interface ParkingOptionsResponse {
  query: Record<string, unknown>;
  coverage: Coverage;
  summary: SearchSummary;
  recommended_id: number | null;
  count: number;
  next_cursor: string | null;
  results: ParkingOption[];
  disclaimer: string;
}

export interface ParkingSearchParams {
  destination_latitude?: number;
  destination_longitude?: number;
  latitude?: number;
  longitude?: number;
  arrival_at?: string;
  duration_minutes: number;
  radius_meters?: number;
  max_walk_minutes: number;
  max_price?: string;
  free_only?: boolean;
  include_paid?: boolean;
  verified_only?: boolean;
  accessible_only?: boolean;
  vehicle_class?: VehicleClass;
  permit_type?: string;
  has_disabled_badge?: boolean;
  limit?: number;
  cursor?: string;
}

export interface MapFeatureProps {
  id: number; name: string; category: Category; layer: 'free' | 'timed' | 'paid' | 'restrict' | 'unknown';
  kind: string; rate_per_hour: string | null; leave_by: string | null; latitude: number; longitude: number;
  availability_status: AvailabilityStatus;
}
export type MapLayersResponse = GeoJSON.FeatureCollection<GeoJSON.Geometry, MapFeatureProps>;

export interface RuleWindow { days: number[]; start_minute: number; end_minute: number; text: string }
export interface Rule {
  id: number; area: number; kind: string; label: string; text: string; windows: RuleWindow[];
  tariff: { rate_per_hour: string; currency: string; billing_increment_minutes: number } | null;
  permit_type: string | null; max_stay_minutes: number | null; valid_from: string | null; valid_until: string | null;
  source: DataSource | null; verified_at: string | null;
}
export interface Closure { id: number; area: number; area_name: string; reason: string; starts_at: string; ends_at: string }
export interface AreaRulesResponse {
  area_id: number; verification_status: VerificationStatus; rules: Rule[]; restrictions: Rule[];
  closures: Closure[]; rule_lines: string[];
}
export interface EvidenceItem {
  id: number; kind: string; description: string; captured_at: string; url: string; source: DataSource;
}
export interface AreaEvidenceResponse {
  area_id: number; evidence_status: string; verification_status: VerificationStatus; verified_at: string | null;
  evidence: EvidenceItem[];
}

export interface PlaceResult {
  id: string; name: string; subtitle: string; latitude: number; longitude: number; kind: string;
  provider: string; coverage?: Coverage;
}

export interface User {
  id: string; email: string; display_name: string; is_email_verified: boolean; date_joined: string; roles: string[];
}
export interface Tokens { access: string; refresh: string }
export interface AuthResponse { user: User; tokens: Tokens }

export interface Preferences {
  language: Language; max_walk_minutes: number; free_only_default: boolean; offer_paid_alternatives: boolean;
  default_reminder_minutes: number; vehicle_class: VehicleClass; permit_type: string | null;
  has_disabled_badge: boolean; personalised_results: boolean; analytics_opt_in: boolean; personalised_ads: boolean;
  updated_at?: string;
}

export interface FeatureFlag { key: string; enabled: boolean; phase: 'part1' | 'part2' | 'experimental' }
export interface PublicConfig {
  api_version: string; min_supported_app_version: string; default_city: string;
  map: { style_url: string; attribution: string };
  search_defaults: { radius_meters: number; max_radius_meters: number; duration_minutes: number; max_walk_minutes: number; limit: number };
  data_notice: string; features: FeatureFlag[];
  legal?: { privacy_version: string; terms_version: string };
}

export interface ApiErrorBody {
  error: { code: string; message: string; details: Record<string, unknown>; request_id: string | null };
}
