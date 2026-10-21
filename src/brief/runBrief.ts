/**
 * Orchestrates one brief: place → live sources in parallel → facts → metric ledger →
 * decision → tactics. Pure apart from the network calls, which are injectable for tests.
 */
import { ANCHORS, archetypeById, matchArchetype } from './archetypes'
import { addDays, todayInIndia } from './calendar'
import { buildFacts, type RawSources } from './facts'
import { headline, locationStrength, outlook, score, severeWeather, signalsFor, verdictOf, PUSH_AT, PROTECT_BELOW, TANH_SCALE } from './engine'
import { buildLedger } from './metrics'
import {
  fetchAir,
  fetchClimate,
  fetchElevation,
  fetchForecast,
  fetchOsm,
  fetchRiver,
  fetchSoil,
  resolvePlace,
  type FetchLike,
  type OsmCountSpec,
} from './sources'
import { buildTactics } from './tactics'
import { inKalaburagiDistrict } from './kalaburagi'
import { analyzePulse } from './pulse/analyze'
import { loadPulseFromSupabase, type PulseLoader } from './pulse/load'
import type { PulseReport } from './pulse/types'
import type { Brief, BriefInput, Metric, Place, SourceId, SourceResult, SourceStatus } from './types'

export interface RunOptions {
  fetchImpl?: FetchLike
  useCache?: boolean
  /** Inject a resolved place (tests, or a map click) instead of geocoding the text. */
  place?: Place
  now?: number
  onProgress?: (step: string) => void
  /** Where the Kalaburagi news pulse comes from (Supabase by default; injected in tests). */
  pulseLoader?: PulseLoader
}

function status<T>(id: SourceId, r: SourceResult<T> | undefined): SourceStatus {
  if (!r) return { id, ok: false, cached: false, failure: 'unreachable', message: 'Not requested.' }
  return r.ok ? { id, ok: true, cached: r.cached, fetchedAt: r.fetchedAt } : { id, ok: false, cached: false, failure: r.failure, message: r.message }
}

export function osmSpecs(competitorFilters: string[]): OsmCountSpec[] {
  const specs: OsmCountSpec[] = ANCHORS.map((a) => ({ key: a.key, filters: a.filters, radiusM: a.radiusM, elements: a.elements }))
  if (competitorFilters.length) {
    specs.push({ key: 'comp500', filters: competitorFilters, radiusM: 500 })
    specs.push({ key: 'comp1000', filters: competitorFilters, radiusM: 1000 })
    specs.push({ key: 'comp2000', filters: competitorFilters, radiusM: 2000 })
  }
  return specs
}

export async function runBrief(input: BriefInput, opts: RunOptions = {}): Promise<Brief> {
  const now = opts.now ?? Date.now()
  const today = input.today ?? todayInIndia(new Date(now))
  const tomorrow = addDays(today, 1)
  const matched = matchArchetype(input.business)
  const archetype = input.archetypeOverride ? archetypeById(input.archetypeOverride) : matched.archetype
  const so = { fetchImpl: opts.fetchImpl, useCache: opts.useCache }

  const empty = (error: string, sources: SourceStatus[]): Brief => ({
    input,
    archetype: { id: archetype.id, label: archetype.label, matched: input.archetypeOverride ? null : matched.matched },
    place: null,
    today,
    tomorrow,
    metrics: [],
    sources,
    drivers: [],
    index: null,
    verdict: null,
    locationStrength: null,
    locationBasis: [],
    outlook: [],
    tactics: [],
    events: [],
    coverage: { live: sources.filter((s) => s.ok).length, total: 9 },
    headline: error,
    pulse: null,
    confidence: null,
    competitors: [],
    generatedAt: now,
    error,
  })

  opts.onProgress?.('Finding the place')
  let place: Place
  let geoStatus: SourceStatus
  if (opts.place) {
    place = opts.place
    geoStatus = { id: 'geocode', ok: true, cached: place.cached, fetchedAt: now }
  } else {
    const g = await resolvePlace(input.place)
    if (!g.ok) return empty(g.message, [status('geocode', g)])
    place = g.data
    geoStatus = status('geocode', g)
  }
  // The brief is built for Kalaburagi district only: its calendar, news channels and places.
  if (!inKalaburagiDistrict(place)) {
    return empty(
      `“${place.displayName.split(',').slice(0, 3).join(',')}” is outside Kalaburagi district. The brief covers Kalaburagi district only for now: try a town, village or area there, such as Aland, Sedam or Jagat Circle.`,
      [{ id: 'geocode', ok: false, cached: false, failure: 'out_of_area', message: 'Outside Kalaburagi district.' }],
    )
  }

  opts.onProgress?.('Reading weather, climate, air, rivers, the map and the local news')
  const { lat, lng } = place
  const loadPulse = opts.pulseLoader ?? loadPulseFromSupabase
  const [forecast, soil, climate, air, river, elevation, osm, pulseRes] = await Promise.all([
    fetchForecast(lat, lng, so),
    fetchSoil(lat, lng, so),
    fetchClimate(lat, lng, today, so),
    fetchAir(lat, lng, so),
    fetchRiver(lat, lng, so),
    fetchElevation(lat, lng, so),
    fetchOsm(lat, lng, osmSpecs(archetype.competitorFilters), archetype.competitorFilters, 2000, so),
    loadPulse(new Date(now)),
  ])
  const raw: RawSources = { forecast, soil, climate, air, river, elevation, osm }

  // Soil variables come from the same forecast service; report them under it.
  const forecastStatus = status('forecast', forecast)
  if (forecast.ok && !soil.ok) forecastStatus.message = `Soil variables unavailable: ${soil.message}`
  const sources: SourceStatus[] = [
    geoStatus,
    forecastStatus,
    status('climate', climate),
    status('air', air),
    status('river', river),
    status('elevation', elevation),
    status('osm', osm),
    status('pulse', pulseRes),
    { id: 'calendar', ok: true, cached: false, fetchedAt: now },
  ]

  opts.onProgress?.('Scoring tomorrow')
  const facts = buildFacts(place, today, raw)
  const pulse: PulseReport | null = pulseRes.ok
    ? analyzePulse(pulseRes.data.items, {
        now: new Date(now),
        today,
        freshAt: new Date(pulseRes.fetchedAt).toISOString(),
        sources: pulseRes.data.runs.map((r) => ({ source: r.source, ok: r.ok, items: r.items, message: r.message, finishedAt: r.finished_at })),
      })
    : null
  facts.pulse = pulse
  const metrics: Metric[] = buildLedger({ facts, place, archetype, marketDay: input.marketDay, sources, now })

  const T = facts.days[0] ?? null
  const sig = signalsFor(facts, T, tomorrow, input.marketDay, true)
  const scored = score(sig, archetype)
  let verdict = verdictOf(scored.index)
  const severe = archetype.traits.outdoorStall || archetype.traits.farm || archetype.traits.livestock ? severeWeather(T) : null
  if (severe && verdict) verdict = 'protect'
  // Without the forecast there is no honest call on tomorrow, whatever the calendar says.
  if (!forecast.ok) verdict = null
  const index = forecast.ok ? scored.index : null
  const out = outlook(facts, archetype, input.marketDay)
  const loc = locationStrength(facts, archetype)
  const live = sources.filter((s) => s.ok).length
  const confidence = index == null ? null : Math.round(100 * (0.7 * scored.weightShare + 0.3 * (live / sources.length)))
  const tactics = buildTactics(facts, archetype, verdict, out, input.marketDay)

  const fmt = (v: number | null, s = '') => (v == null ? 'Unavailable' : `${Math.round(v)}${s}`)
  const decision: Metric[] = [
    {
      id: 'brief.index',
      dimension: 'decision',
      label: 'Opportunity index for tomorrow',
      value: index,
      display: fmt(index, ' / 100'),
      source: 'forecast',
      method: `50 + 50 · tanh(Σ weight × signal / ${TANH_SCALE}); push ≥ ${PUSH_AT}, protect < ${PROTECT_BELOW}.`,
    },
    {
      id: 'brief.verdict',
      dimension: 'decision',
      label: 'Verdict',
      value: verdict,
      display: verdict ? verdict[0].toUpperCase() + verdict.slice(1) + (severe && verdict === 'protect' ? ` (severe weather: ${severe})` : '') : 'Unavailable',
      source: 'forecast',
      method: 'From the index; overridden to Protect for outdoor work in IMD heavy rain, gusts ≥ 60 km/h or heat index ≥ 54 °C.',
    },
    {
      id: 'brief.location',
      dimension: 'decision',
      label: 'Location strength',
      value: loc.value,
      display: fmt(loc.value, ' / 100'),
      source: 'osm',
      method: 'Footfall-anchor score, discounted up to 35 % for nearby competition (14 % for businesses that benefit from clusters).',
    },
    {
      id: 'brief.confidence',
      dimension: 'decision',
      label: 'Confidence',
      value: confidence,
      display: fmt(confidence, ' / 100'),
      source: 'forecast',
      method: '70 % share of driver weight that had live data + 30 % share of sources that answered.',
    },
  ]

  return {
    input,
    archetype: { id: archetype.id, label: archetype.label, matched: input.archetypeOverride ? null : matched.matched },
    place,
    today,
    tomorrow,
    metrics: [...decision, ...metrics],
    sources,
    drivers: scored.drivers,
    index,
    verdict,
    locationStrength: loc.value,
    locationBasis: loc.basis,
    outlook: out,
    tactics,
    events: facts.calendar.upcoming.map(({ date, name, kind, source, note }) => ({ date, name, kind, source, ...(note ? { note } : {}) })),
    coverage: { live, total: sources.length },
    headline: forecast.ok ? headline(verdict, scored.drivers, severe, archetype) : 'The weather forecast did not load, so there is no call on tomorrow. Try again in a minute.',
    confidence,
    competitors: (facts.osm?.competitors ?? []).slice(0, 12).map((c) => ({ name: c.name, distanceM: c.distanceM, kind: c.kind })),
    pulse,
    generatedAt: now,
  }
}
