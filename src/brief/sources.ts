/**
 * Live data sources for the Daily Business Brief.
 *
 * Every service here is public, keyless and callable from a browser (CORS-enabled):
 *   - Open-Meteo forecast, archive (ERA5), air-quality, flood (GloFAS) and elevation APIs
 *   - OpenStreetMap Nominatim (via the app's existing rate-limited geocoder)
 *   - OpenStreetMap Overpass (two public mirrors, raced)
 *
 * Rules this file keeps:
 *   - One request shape per concern, so a single rejected variable can't take down the rest.
 *   - A failure is returned as { ok: false, failure } and never replaced with another place's
 *     or another day's data. Callers show "unavailable" for the metrics that depended on it.
 *   - Only successful responses are cached (reusing the scan cache, 3-hour TTL), and a cached
 *     result says so (cached: true) instead of passing as fresh.
 */
import { geocodeLocationDetailed } from '../lib/geo'
import { districtQuery } from './kalaburagi'
import { readScanCache, writeScanCache } from '../lib/scanCache'
import type { FailureKind, Place, SourceInfo, SourceResult } from './types'

export const SOURCE_INFO: SourceInfo[] = [
  {
    id: 'geocode',
    name: 'OpenStreetMap Nominatim',
    url: 'https://nominatim.openstreetmap.org/',
    note: 'Turns the place you type into coordinates, district and state.',
  },
  {
    id: 'forecast',
    name: 'Open-Meteo Forecast API',
    url: 'https://open-meteo.com/en/docs',
    note: 'Hourly and daily weather for the next 16 days and the past 7, plus soil moisture and evapotranspiration.',
  },
  {
    id: 'climate',
    name: 'Open-Meteo Historical Weather API (ERA5 reanalysis)',
    url: 'https://open-meteo.com/en/docs/historical-weather-api',
    note: 'Ten years of daily history for this exact spot, used as the "normal" to compare tomorrow against.',
  },
  {
    id: 'air',
    name: 'Open-Meteo Air Quality API (CAMS)',
    url: 'https://open-meteo.com/en/docs/air-quality-api',
    note: 'PM2.5, PM10, ozone, dust and the US AQI forecast.',
  },
  {
    id: 'river',
    name: 'Open-Meteo Flood API (GloFAS)',
    url: 'https://open-meteo.com/en/docs/flood-api',
    note: 'Forecast river discharge for the nearest river cell, against its typical level.',
  },
  {
    id: 'elevation',
    name: 'Open-Meteo Elevation API (Copernicus DEM)',
    url: 'https://open-meteo.com/en/docs/elevation-api',
    note: 'Height above sea level.',
  },
  {
    id: 'osm',
    name: 'OpenStreetMap Overpass API',
    url: 'https://wiki.openstreetmap.org/wiki/Overpass_API',
    note: 'Counts of mapped schools, worship places, stations, markets, competitors and more around the spot.',
  },
  {
    id: 'pulse',
    name: 'Kalaburagi news channels (YouTube feeds; Instagram via Apify when set up)',
    url: 'https://www.youtube.com/@gohash22',
    note: 'Posts from Gulbarga Ki Awaaz, gohash, Gulbarga News, Gulbarga Headlines, Gulbarga 24 News and Kalaburagi 24/7, collected on a schedule.',
  },
  {
    id: 'calendar',
    name: 'DoPT 2026–2027 holidays, Karnataka holidays, Kalaburagi events and the Islamic calendar',
    url: 'https://www.gconnect.in/news/holidays-to-be-observed-in-central-government-offices-during-the-year-2026.html',
    note: 'Government holiday orders; Kalaburagi jatra, Urs and festival dates with sources; Islamic dates computed for India.',
  },
]

const TZ = 'Asia%2FKolkata'
const DEFAULT_TIMEOUT_MS = 12_000
const OVERPASS_TIMEOUT_MS = 30_000
const CACHE_PREFIX = 'brief:'

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

/** Injected in tests; the browser's fetch everywhere else. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

function failureFromStatus(status: number): FailureKind {
  if (status === 429) return 'rate_limited'
  if (status === 504 || status === 503) return 'timed_out'
  if (status === 400) return 'bad_response'
  return 'unreachable'
}

export async function fetchJson<T>(
  url: string,
  opts: { fetchImpl?: FetchLike; timeoutMs?: number; init?: RequestInit } = {},
): Promise<SourceResult<T>> {
  const doFetch = opts.fetchImpl ?? ((u: string, i?: RequestInit) => fetch(u, i))
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const res = await doFetch(url, { ...opts.init, signal: ctrl.signal })
    if (!res.ok) {
      let reason = `HTTP ${res.status}`
      try {
        const body = (await res.json()) as { reason?: string }
        if (body?.reason) reason = `HTTP ${res.status}: ${body.reason}`
      } catch {
        // Body was not JSON; the status code is enough.
      }
      return { ok: false, failure: failureFromStatus(res.status), message: reason }
    }
    let data: T
    try {
      data = (await res.json()) as T
    } catch {
      return { ok: false, failure: 'bad_response', message: 'The service answered with something that is not JSON.' }
    }
    return { ok: true, data, fetchedAt: Date.now(), cached: false }
  } catch {
    return ctrl.signal.aborted
      ? { ok: false, failure: 'timed_out', message: 'No answer before the timeout.' }
      : { ok: false, failure: 'unreachable', message: 'Could not reach the service.' }
  } finally {
    clearTimeout(timer)
  }
}

/** Serve from the 3-hour scan cache when fresh; otherwise fetch and cache only a success. */
async function cached<T>(key: string, load: () => Promise<SourceResult<T>>, useCache: boolean): Promise<SourceResult<T>> {
  if (useCache) {
    const hit = readScanCache<T>(CACHE_PREFIX + key)
    if (hit) return { ok: true, data: hit.value, fetchedAt: hit.fetchedAt, cached: true }
  }
  const result = await load()
  if (result.ok && useCache) writeScanCache(CACHE_PREFIX + key, result.data, result.fetchedAt)
  return result
}

const r3 = (n: number) => n.toFixed(3)

export interface SourceOpts {
  fetchImpl?: FetchLike
  useCache?: boolean
}

// ---------------------------------------------------------------- geocode

export async function resolvePlace(query: string): Promise<SourceResult<Place>> {
  const q = query.trim()
  if (!q) return { ok: false, failure: 'no_match', message: 'Type a village, town or district.' }
  const res = await geocodeLocationDetailed(districtQuery(q))
  if (!res.hit) {
    const messages: Record<string, string> = {
      no_match: `No place called "${q}" was found in Kalaburagi district. Try the town, village or area name, for example "Aland" or "Jagat Circle".`,
      rate_limited: 'The place-search service is limiting requests right now. Wait a minute and try again.',
      timed_out: 'The place-search service did not answer in time. Try again.',
      unreachable: 'Could not reach the place-search service. Check the connection and try again.',
    }
    return { ok: false, failure: res.failure, message: messages[res.failure] ?? messages.unreachable }
  }
  const h = res.hit
  return {
    ok: true,
    cached: res.cachedAt != null,
    fetchedAt: res.cachedAt ?? Date.now(),
    data: {
      query: q,
      displayName: h.displayName,
      lat: h.lat,
      lng: h.lng,
      district: h.county ?? h.city ?? h.town,
      state: h.state,
      cached: res.cachedAt != null,
    },
  }
}

// ---------------------------------------------------------------- Open-Meteo

export interface ForecastResponse {
  hourly: Record<string, Array<number | null>> & { time: string[] }
  daily: Record<string, Array<number | string | null>> & { time: string[] }
}

const HOURLY_WEATHER = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'dew_point_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_gusts_10m',
  'uv_index',
  'is_day',
  'cape',
].join(',')

const DAILY_WEATHER = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'precipitation_sum',
  'precipitation_hours',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'uv_index_max',
  'sunshine_duration',
  'daylight_duration',
  'shortwave_radiation_sum',
  'et0_fao_evapotranspiration',
  'sunrise',
  'sunset',
].join(',')

export function forecastUrl(lat: number, lng: number): string {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${r3(lat)}&longitude=${r3(lng)}` +
    `&hourly=${HOURLY_WEATHER}&daily=${DAILY_WEATHER}&timezone=${TZ}&forecast_days=16&past_days=7`
  )
}

export function fetchForecast(lat: number, lng: number, o: SourceOpts = {}) {
  return cached<ForecastResponse>(
    `forecast:${r3(lat)},${r3(lng)}`,
    () => fetchJson<ForecastResponse>(forecastUrl(lat, lng), { fetchImpl: o.fetchImpl }),
    o.useCache ?? true,
  )
}

const HOURLY_SOIL = [
  'soil_moisture_0_to_1cm',
  'soil_moisture_3_to_9cm',
  'soil_moisture_27_to_81cm',
  'soil_temperature_6cm',
  'vapour_pressure_deficit',
].join(',')

/** Soil and crop variables are a separate request so an unsupported one can't sink the weather. */
export function soilUrl(lat: number, lng: number): string {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${r3(lat)}&longitude=${r3(lng)}` +
    `&hourly=${HOURLY_SOIL}&timezone=${TZ}&forecast_days=8`
  )
}

export function fetchSoil(lat: number, lng: number, o: SourceOpts = {}) {
  return cached<{ hourly: Record<string, Array<number | null>> & { time: string[] } }>(
    `soil:${r3(lat)},${r3(lng)}`,
    () => fetchJson(soilUrl(lat, lng), { fetchImpl: o.fetchImpl }),
    o.useCache ?? true,
  )
}

export interface ArchiveResponse {
  daily: {
    time: string[]
    temperature_2m_max: Array<number | null>
    temperature_2m_min: Array<number | null>
    precipitation_sum: Array<number | null>
  }
}

/** The ten most recent complete calendar years before `today`. */
export function climateYears(today: string): { start: string; end: string; years: number } {
  const y = Number(today.slice(0, 4))
  return { start: `${y - 10}-01-01`, end: `${y - 1}-12-31`, years: 10 }
}

export function climateUrl(lat: number, lng: number, today: string): string {
  const { start, end } = climateYears(today)
  return (
    `https://archive-api.open-meteo.com/v1/archive?latitude=${r3(lat)}&longitude=${r3(lng)}` +
    `&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=${TZ}`
  )
}

export function fetchClimate(lat: number, lng: number, today: string, o: SourceOpts = {}) {
  return cached<ArchiveResponse>(
    `climate:${r3(lat)},${r3(lng)}:${today.slice(0, 4)}`,
    () => fetchJson<ArchiveResponse>(climateUrl(lat, lng, today), { fetchImpl: o.fetchImpl, timeoutMs: 20_000 }),
    o.useCache ?? true,
  )
}

export interface AirResponse {
  hourly: { time: string[] } & Record<string, Array<number | null>>
}

export function airUrl(lat: number, lng: number): string {
  return (
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${r3(lat)}&longitude=${r3(lng)}` +
    `&hourly=pm2_5,pm10,us_aqi,ozone,dust&timezone=${TZ}&forecast_days=3`
  )
}

export function fetchAir(lat: number, lng: number, o: SourceOpts = {}) {
  return cached<AirResponse>(
    `air:${r3(lat)},${r3(lng)}`,
    () => fetchJson<AirResponse>(airUrl(lat, lng), { fetchImpl: o.fetchImpl }),
    o.useCache ?? true,
  )
}

export interface RiverResponse {
  daily: { time: string[]; river_discharge: Array<number | null>; river_discharge_median?: Array<number | null>; river_discharge_max?: Array<number | null> }
}

export function riverUrl(lat: number, lng: number, withStats: boolean): string {
  const vars = withStats ? 'river_discharge,river_discharge_median,river_discharge_max' : 'river_discharge'
  return `https://flood-api.open-meteo.com/v1/flood?latitude=${r3(lat)}&longitude=${r3(lng)}&daily=${vars}&forecast_days=16`
}

export function fetchRiver(lat: number, lng: number, o: SourceOpts = {}) {
  return cached<RiverResponse>(
    `river:${r3(lat)},${r3(lng)}`,
    async () => {
      const full = await fetchJson<RiverResponse>(riverUrl(lat, lng, true), { fetchImpl: o.fetchImpl })
      // If the ensemble statistics are rejected, ask for the plain forecast. This is a smaller
      // question to the same service for the same spot, not a substitute value.
      if (!full.ok && full.failure === 'bad_response') {
        return fetchJson<RiverResponse>(riverUrl(lat, lng, false), { fetchImpl: o.fetchImpl })
      }
      return full
    },
    o.useCache ?? true,
  )
}

export function fetchElevation(lat: number, lng: number, o: SourceOpts = {}) {
  return cached<{ elevation: number[] }>(
    `elevation:${r3(lat)},${r3(lng)}`,
    () =>
      fetchJson<{ elevation: number[] }>(
        `https://api.open-meteo.com/v1/elevation?latitude=${r3(lat)}&longitude=${r3(lng)}`,
        { fetchImpl: o.fetchImpl },
      ),
    o.useCache ?? true,
  )
}

// ---------------------------------------------------------------- Overpass

/** One counted feature class: an Overpass tag filter (or several, unioned) within a radius. */
export interface OsmCountSpec {
  key: string
  filters: string[]
  radiusM: number
  /** Element types to count. Default "nwr" (nodes, ways and relations). */
  elements?: 'nwr' | 'way' | 'node'
}

export interface OsmPoint {
  name: string
  lat: number
  lng: number
  kind: string
}

export interface OsmResult {
  counts: Record<string, number>
  competitors: OsmPoint[]
  competitorRadiusM: number
}

export function buildCountQuery(lat: number, lng: number, specs: OsmCountSpec[]): string {
  const at = (r: number) => `(around:${r},${lat.toFixed(5)},${lng.toFixed(5)})`
  const lines = specs.map((s) => {
    const el = s.elements ?? 'nwr'
    const parts = s.filters.map((f) => `${el}${f}${at(s.radiusM)};`).join('')
    return `(${parts});out count;`
  })
  return `[out:json][timeout:25];\n${lines.join('\n')}`
}

export function buildCompetitorQuery(lat: number, lng: number, filters: string[], radiusM: number): string {
  const at = `(around:${radiusM},${lat.toFixed(5)},${lng.toFixed(5)})`
  return `[out:json][timeout:20];(${filters.map((f) => `nwr${f}${at};`).join('')});out center 150;`
}

interface OverpassElement {
  type: string
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export function parseCounts(elements: OverpassElement[], specs: OsmCountSpec[]): Record<string, number> | null {
  const countEls = elements.filter((e) => e.type === 'count')
  if (countEls.length !== specs.length) return null
  const out: Record<string, number> = {}
  specs.forEach((s, i) => {
    out[s.key] = Number(countEls[i].tags?.total ?? 0)
  })
  return out
}

async function overpassOnce(
  endpoint: string,
  query: string,
  fetchImpl?: FetchLike,
): Promise<SourceResult<OverpassElement[]>> {
  const res = await fetchJson<{ elements?: OverpassElement[]; remark?: string }>(endpoint, {
    fetchImpl,
    timeoutMs: OVERPASS_TIMEOUT_MS,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    },
  })
  if (!res.ok) return res
  // A 200 with a "runtime error" remark means the query ran out of time or memory: a failure,
  // not "nothing mapped here".
  if (res.data.remark?.includes('runtime error')) {
    return { ok: false, failure: 'timed_out', message: 'The map service ran out of time for this query.' }
  }
  return { ...res, data: res.data.elements ?? [] }
}

/** Race the public mirrors; the first success wins. */
async function overpass(query: string, fetchImpl?: FetchLike): Promise<SourceResult<OverpassElement[]>> {
  const attempts = OVERPASS_ENDPOINTS.map((e) =>
    overpassOnce(e, query, fetchImpl).then((r) => (r.ok ? r : Promise.reject(r))),
  )
  try {
    return await Promise.any(attempts)
  } catch (err) {
    const failures = ((err as AggregateError).errors ?? []) as Array<{ failure: FailureKind; message: string }>
    const priority: FailureKind[] = ['rate_limited', 'timed_out', 'bad_response', 'unreachable']
    const pick = priority.find((p) => failures.some((f) => f.failure === p)) ?? 'unreachable'
    return {
      ok: false,
      failure: pick,
      message:
        pick === 'rate_limited'
          ? 'The OpenStreetMap query service is busy (rate limited). Try again in a minute.'
          : 'The OpenStreetMap query service did not answer. Try again in a minute.',
    }
  }
}

export async function fetchOsm(
  lat: number,
  lng: number,
  specs: OsmCountSpec[],
  competitorFilters: string[],
  competitorRadiusM: number,
  o: SourceOpts = {},
): Promise<SourceResult<OsmResult>> {
  const specKey = specs.map((s) => `${s.key}:${s.radiusM}`).join('|')
  const key = `osm:${r3(lat)},${r3(lng)}:${hash(specKey + competitorFilters.join(''))}`
  return cached<OsmResult>(
    key,
    async () => {
      const countsRes = await overpass(buildCountQuery(lat, lng, specs), o.fetchImpl)
      if (!countsRes.ok) return countsRes
      const counts = parseCounts(countsRes.data, specs)
      if (!counts) return { ok: false, failure: 'bad_response', message: 'The map service returned an incomplete answer.' }
      let competitors: OsmPoint[] = []
      if (competitorFilters.length > 0) {
        const list = await overpass(buildCompetitorQuery(lat, lng, competitorFilters, competitorRadiusM), o.fetchImpl)
        // The list only adds names and the nearest distance. If it fails, the counts still stand.
        if (list.ok) {
          competitors = list.data
            .map((el) => {
              const la = el.lat ?? el.center?.lat
              const lo = el.lon ?? el.center?.lon
              if (la == null || lo == null) return null
              const t = el.tags ?? {}
              return { name: t.name ?? '', lat: la, lng: lo, kind: t.amenity ?? t.shop ?? t.craft ?? t.tourism ?? '' }
            })
            .filter((p): p is OsmPoint => p != null)
        }
      }
      return {
        ok: true,
        cached: false,
        fetchedAt: countsRes.fetchedAt,
        data: { counts, competitors, competitorRadiusM },
      }
    },
    o.useCache ?? true,
  )
}

/** Tiny stable string hash for cache keys. */
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
