/**
 * Daily Business Brief — shared types.
 *
 * The brief has three strictly separated layers:
 *   1. Sources  (sources.ts)  — live calls to public data services. A failed call is
 *      recorded as unavailable; nothing is ever substituted from another place or time.
 *   2. Metrics  (metrics.ts)  — deterministic numbers derived from those sources, each
 *      carrying its unit, its source and when it was fetched.
 *   3. Decision (engine.ts, tactics.ts) — transparent scoring and rule-based tactics.
 *      Every tactic cites the metric ids it rests on. No language model writes numbers.
 */
import type { PulseReport } from './pulse/types'

export type FailureKind = 'rate_limited' | 'timed_out' | 'unreachable' | 'no_match' | 'bad_response' | 'not_configured' | 'out_of_area'

export type SourceId =
  | 'geocode'
  | 'forecast'
  | 'climate'
  | 'air'
  | 'river'
  | 'elevation'
  | 'osm'
  | 'calendar'
  | 'pulse'

export type SourceResult<T> =
  | { ok: true; data: T; fetchedAt: number; cached: boolean }
  | { ok: false; failure: FailureKind; message: string }

export interface SourceInfo {
  id: SourceId
  name: string
  url: string
  /** What the source is good for, in one line. */
  note: string
}

export type Dimension =
  | 'decision'
  | 'weather_tomorrow'
  | 'weather_week'
  | 'climate'
  | 'air'
  | 'soil_crop'
  | 'water'
  | 'place'
  | 'demand_anchors'
  | 'competition'
  | 'calendar'
  | 'data_quality'
  | 'local_pulse'

/** Direction a metric pushes tomorrow's opportunity for THIS business, decided by the engine. */
export type Effect = 'up' | 'down' | 'neutral'

export interface Metric {
  id: string
  dimension: Dimension
  label: string
  /** null when the source for this metric was unavailable. Never a fallback value. */
  value: number | string | boolean | null
  unit?: string
  /** Display form of value, e.g. "38.4 °C". */
  display: string
  source: SourceId
  /** Short explanation of how the number was derived. */
  method: string
  /** Optional reference band used to judge it, e.g. "NAAQS 24h PM2.5 limit 60 µg/m³". */
  reference?: string
}

export type ArchetypeId =
  | 'cafe_tea'
  | 'restaurant_meals'
  | 'cold_beverages'
  | 'street_food'
  | 'sweets_bakery'
  | 'kirana'
  | 'fruit_vegetable'
  | 'clothing'
  | 'tailoring'
  | 'flowers_puja'
  | 'mobile_electronics'
  | 'pharmacy'
  | 'salon'
  | 'stationery_print'
  | 'hardware'
  | 'lodging'
  | 'transport'
  | 'dairy'
  | 'poultry'
  | 'farm_crop'
  | 'general_retail'

/** The signals the engine scores, each normalised to -1..1 (positive = more opportunity). */
export type DriverId =
  | 'heat'
  | 'rain'
  | 'outdoor_comfort'
  | 'air_quality'
  | 'festival'
  | 'weekend_holiday'
  | 'payday'
  | 'religious_gathering'
  | 'climate_anomaly'
  | 'field_conditions'
  | 'market_day'
  | 'local_events'

export interface DriverValue {
  id: DriverId
  label: string
  /** -1..1 raw signal before the business's sensitivity is applied, or null if its data is missing. */
  signal: number | null
  /** The business's sensitivity to this driver, -1..1 (sign says which way it helps). */
  weight: number
  /** signal × weight, or 0 when signal is null. */
  contribution: number
  /** Metric ids this driver read. */
  basis: string[]
  explanation: string
}

export type Verdict = 'push' | 'normal' | 'protect'

export interface DayOutlook {
  date: string
  index: number | null
  verdict: Verdict | null
  tags: string[]
}

export interface Tactic {
  id: string
  title: string
  detail: string
  /** Metric ids the tactic rests on; the UI links each one to the ledger. */
  basis: string[]
  priority: number
  kind: 'act' | 'avoid' | 'watch' | 'field'
}

export interface CalendarEvent {
  date: string
  name: string
  kind: 'national' | 'restricted' | 'state' | 'local' | 'islamic_computed'
  source: string
  /** Note shown beside the event, e.g. moon-sighting caveat. */
  note?: string
}

export interface Place {
  query: string
  displayName: string
  lat: number
  lng: number
  district?: string
  state?: string
  cached: boolean
}

export interface BriefInput {
  business: string
  place: string
  archetypeOverride?: ArchetypeId
  /** The local weekly market (santhe) day, 0 = Sunday … 6 = Saturday, if the user knows it. */
  marketDay?: number
  /** "Today" for the brief, as a local date YYYY-MM-DD in Asia/Kolkata. */
  today?: string
}

export interface SourceStatus {
  id: SourceId
  ok: boolean
  cached: boolean
  fetchedAt?: number
  failure?: FailureKind
  message?: string
}

export interface Brief {
  input: BriefInput
  archetype: { id: ArchetypeId; label: string; matched: string | null }
  place: Place | null
  today: string
  tomorrow: string
  metrics: Metric[]
  sources: SourceStatus[]
  drivers: DriverValue[]
  index: number | null
  verdict: Verdict | null
  locationStrength: number | null
  locationBasis: string[]
  outlook: DayOutlook[]
  tactics: Tactic[]
  events: CalendarEvent[]
  coverage: { live: number; total: number }
  /** One-line plain-language decision. */
  headline: string
  /** 0..100: how much of the evidence was actually available, and how far ahead the forecast is. */
  confidence: number | null
  competitors: Array<{ name: string; distanceM: number; kind: string }>
  /** The Kalaburagi news pulse behind this brief, or null if it could not be loaded. */
  pulse: PulseReport | null
  generatedAt: number
  error?: string
}
