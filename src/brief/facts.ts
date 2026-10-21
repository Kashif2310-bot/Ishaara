/**
 * Facts: typed, per-day numbers derived from the raw source responses. The metric ledger
 * (metrics.ts) and the decision engine (engine.ts) both read these, so a number shown to the
 * user and a number the engine scored are always the same number.
 *
 * Nothing here invents a value. A missing hour stays missing; a day with too few hours of data
 * gets null for the aggregates that need them.
 */
import { addDays, daysBetween, eventsBetween, hijri, isUrsDay, distanceKm, findHijri, retailHere, type CalendarEntry } from './calendar'
import { KALABURAGI_CITY, kalaburagiEventsBetween, URS_CROWD_RADIUS_KM } from './kalaburagi'
import {
  clamp,
  gdd,
  heatIndexC,
  mean,
  sd,
  thi,
  wbgtShadeC,
  wetBulbC,
} from './formulas'
import type { AirResponse, ArchiveResponse, ForecastResponse, OsmResult, RiverResponse } from './sources'
import type { Place, SourceResult } from './types'
import type { PulseReport } from './pulse/types'

export const TRADING_HOURS = { from: 7, to: 21 } // inclusive: 15 hours
export const FIELD_HOURS = { from: 6, to: 18 }

export interface HourRow {
  hour: number
  t: number | null
  feels: number | null
  rh: number | null
  dew: number | null
  prob: number | null
  precip: number | null
  code: number | null
  cloud: number | null
  wind: number | null
  gust: number | null
  uv: number | null
  isDay: number | null
  cape: number | null
}

export interface DayFacts {
  date: string
  hoursAvailable: number
  tMax: number | null
  tMin: number | null
  feelsMax: number | null
  feelsMin: number | null
  rainMm: number | null
  rainHours: number | null
  rainProbMax: number | null
  rainProbTrading: number | null
  rainHoursTrading: number | null
  firstRainHour: number | null
  comfortableHours: number | null
  hotHours: number | null
  heatIndexMax: number | null
  heatIndexPeakHour: number | null
  wbgtMax: number | null
  thiMax: number | null
  thiStressHours: number | null
  wetBulbMax: number | null
  rhMean: number | null
  rhMinDay: number | null
  dewMax: number | null
  windMax: number | null
  gustMax: number | null
  uvMax: number | null
  uvHighHours: number | null
  cloudMeanDay: number | null
  sunshineH: number | null
  daylightH: number | null
  radiationMj: number | null
  et0: number | null
  code: number | null
  capeMax: number | null
  thunder: boolean | null
  fogHours: number | null
  sprayHours: number | null
  sprayWindow: string | null
  fieldHours: number | null
  leafWetHours: number | null
  diseaseHours: number | null
  dryingHours: number | null
  poultryHeatHours: number | null
  gdd: number | null
  sunrise: string | null
  sunset: string | null
  morningTemp: number | null
  eveningTemp: number | null
  eveningComfortHours: number | null
  afterSunsetTradingHours: number | null
  /** The hourly rows behind the day's figures, for the hour-by-hour chart. */
  hours: HourRow[]
}

export interface ClimateNormal {
  date: string
  samplesTmax: number[]
  normTmax: number | null
  sdTmax: number | null
  normTmin: number | null
  rainChancePct: number | null
  normRainPerDay: number | null
  recordTmax: number | null
  recordRain: number | null
}

export interface AirFacts {
  pm25Mean: number | null
  pm25Max: number | null
  pm10Mean: number | null
  usAqiMax: number | null
  ozoneMax: number | null
  dustMax: number | null
}

export interface SoilFacts {
  sm0: number | null
  sm3: number | null
  sm27: number | null
  soilTemp6Max: number | null
  vpdMax: number | null
}

export interface RiverFacts {
  tomorrow: number | null
  median: number | null
  ensembleMax: number | null
  peak: number | null
  peakDate: string | null
  trendPct: number | null
}

export interface CompetitorFact {
  name: string
  kind: string
  distanceM: number
  lat: number
  lng: number
}

export interface OsmFacts {
  counts: Record<string, number>
  competitors: CompetitorFact[]
}

export interface CalendarFacts {
  events: CalendarEntry[]
  /** Events within the next 45 days, for the "coming up" list. */
  upcoming: CalendarEntry[]
  /** Within the city, where the Urs crowd is felt directly. */
  nearKalaburagi: boolean
  distanceFromCityKm: number | null
  nextUrs: string | null
  /** State of the place, used to decide which regional festivals drive buying. */
  state?: string
}

export interface Facts {
  today: string
  tomorrow: string
  todayFacts: DayFacts | null
  /** Tomorrow and the six days after it. Empty when the forecast is unavailable. */
  days: DayFacts[]
  /** All forecast days from tomorrow (up to 15), for rain totals. */
  allDays: DayFacts[]
  past7: { rainMm: number | null; tMaxMean: number | null; lastRainDaysAgo: number | null; days: number }
  normals: Map<string, ClimateNormal>
  air: AirFacts | null
  soil: SoilFacts | null
  river: RiverFacts | null
  elevation: number | null
  osm: OsmFacts | null
  calendar: CalendarFacts
  /** What Kalaburagi's news channels are posting; null when the pulse could not be loaded. */
  pulse: PulseReport | null
}

// ---------------------------------------------------------------- helpers

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const nums = (xs: Array<number | null>) => xs.filter((x): x is number => x != null)
const maxOf = (xs: Array<number | null>) => {
  const v = nums(xs)
  return v.length ? Math.max(...v) : null
}
const minOf = (xs: Array<number | null>) => {
  const v = nums(xs)
  return v.length ? Math.min(...v) : null
}
const avg = (xs: Array<number | null>) => mean(nums(xs))
const countIf = <T>(xs: T[], p: (x: T) => boolean) => xs.filter(p).length
const inRange = (h: number, r: { from: number; to: number }) => h >= r.from && h <= r.to
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

function hoursByDate(hourly: { time: string[] } & Record<string, Array<number | null>>): Map<string, number[]> {
  const map = new Map<string, number[]>()
  hourly.time.forEach((t, i) => {
    const d = t.slice(0, 10)
    const arr = map.get(d)
    if (arr) arr.push(i)
    else map.set(d, [i])
  })
  return map
}

/** Longest run of consecutive hours, as "06:00–10:00" (end is the end of the last hour). */
function longestRun(hours: number[]): string | null {
  if (!hours.length) return null
  const sorted = [...hours].sort((a, b) => a - b)
  let bestStart = sorted[0]
  let bestLen = 1
  let start = sorted[0]
  let len = 1
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) len++
    else {
      start = sorted[i]
      len = 1
    }
    if (len > bestLen) {
      bestLen = len
      bestStart = start
    }
  }
  return `${hh(bestStart)}–${hh(bestStart + bestLen)}`
}

function dailyValue(daily: ForecastResponse['daily'], key: string, i: number): number | null {
  return num(daily[key]?.[i])
}

function dailyString(daily: ForecastResponse['daily'], key: string, i: number): string | null {
  const v = daily[key]?.[i]
  return typeof v === 'string' ? v : null
}

// ---------------------------------------------------------------- weather days

export function dayFacts(fc: ForecastResponse, date: string, byDate: Map<string, number[]>): DayFacts | null {
  const di = fc.daily.time.indexOf(date)
  const idx = byDate.get(date) ?? []
  if (di < 0 && idx.length === 0) return null
  const H = fc.hourly
  const rows: HourRow[] = idx.map((i) => ({
    hour: Number(H.time[i].slice(11, 13)),
    t: num(H.temperature_2m?.[i]),
    feels: num(H.apparent_temperature?.[i]),
    rh: num(H.relative_humidity_2m?.[i]),
    dew: num(H.dew_point_2m?.[i]),
    prob: num(H.precipitation_probability?.[i]),
    precip: num(H.precipitation?.[i]),
    code: num(H.weather_code?.[i]),
    cloud: num(H.cloud_cover?.[i]),
    wind: num(H.wind_speed_10m?.[i]),
    gust: num(H.wind_gusts_10m?.[i]),
    uv: num(H.uv_index?.[i]),
    isDay: num(H.is_day?.[i]),
    cape: num(H.cape?.[i]),
  }))
  const enough = rows.length >= 20
  const trading = rows.filter((r) => inRange(r.hour, TRADING_HOURS))
  const field = rows.filter((r) => inRange(r.hour, FIELD_HOURS))
  const daytime = rows.filter((r) => (r.isDay != null ? r.isDay === 1 : r.hour >= 6 && r.hour <= 18))

  const hi = rows.map((r) => (r.t != null && r.rh != null ? heatIndexC(r.t, r.rh) : null))
  const hiMax = maxOf(hi)
  const hiPeak = hiMax != null ? rows[hi.indexOf(hiMax)]?.hour ?? null : null
  const thiVals = rows.map((r) => (r.t != null && r.rh != null ? thi(r.t, r.rh) : null))
  const deltaT = (r: HourRow) => (r.t != null && r.rh != null ? r.t - wetBulbC(r.t, r.rh) : null)

  const isWetHour = (r: HourRow) => (r.precip ?? 0) >= 0.2 || (r.prob ?? 0) >= 60
  const sprayOk = (r: HourRow) => {
    const dT = deltaT(r)
    return (
      (r.isDay ?? (r.hour >= 6 && r.hour <= 18 ? 1 : 0)) === 1 &&
      r.wind != null &&
      r.wind >= 3 &&
      r.wind <= 15 &&
      (r.prob ?? 100) < 30 &&
      (r.precip ?? 1) === 0 &&
      dT != null &&
      dT >= 2 &&
      dT <= 8
    )
  }
  const sprayHours = rows.filter(sprayOk).map((r) => r.hour)
  const leafWet = (r: HourRow) => (r.rh != null && r.rh >= 90) || (r.precip ?? 0) > 0
  const sunrise = di >= 0 ? dailyString(fc.daily, 'sunrise', di) : null
  const sunset = di >= 0 ? dailyString(fc.daily, 'sunset', di) : null
  const sunsetHour = sunset ? Number(sunset.slice(11, 13)) + Number(sunset.slice(14, 16)) / 60 : null
  const probs = rows.map((r) => r.prob)
  const codeDaily = di >= 0 ? dailyValue(fc.daily, 'weather_code', di) : null
  const capeMax = maxOf(rows.map((r) => r.cape))
  const rainProbMax = di >= 0 ? dailyValue(fc.daily, 'precipitation_probability_max', di) ?? maxOf(probs) : maxOf(probs)
  const at = (h: number) => rows.find((r) => r.hour === h)?.t ?? null

  return {
    date,
    hoursAvailable: rows.length,
    tMax: di >= 0 ? dailyValue(fc.daily, 'temperature_2m_max', di) : maxOf(rows.map((r) => r.t)),
    tMin: di >= 0 ? dailyValue(fc.daily, 'temperature_2m_min', di) : minOf(rows.map((r) => r.t)),
    feelsMax: di >= 0 ? dailyValue(fc.daily, 'apparent_temperature_max', di) : maxOf(rows.map((r) => r.feels)),
    feelsMin: di >= 0 ? dailyValue(fc.daily, 'apparent_temperature_min', di) : minOf(rows.map((r) => r.feels)),
    rainMm: di >= 0 ? dailyValue(fc.daily, 'precipitation_sum', di) : null,
    rainHours: di >= 0 ? dailyValue(fc.daily, 'precipitation_hours', di) : null,
    rainProbMax,
    rainProbTrading: maxOf(trading.map((r) => r.prob)),
    rainHoursTrading: enough ? countIf(trading, isWetHour) : null,
    firstRainHour: trading.find((r) => (r.prob ?? 0) >= 50 || (r.precip ?? 0) >= 0.5)?.hour ?? null,
    comfortableHours: enough
      ? countIf(trading, (r) => r.feels != null && r.feels >= 18 && r.feels <= 32 && (r.prob ?? 0) < 40 && (r.precip ?? 0) < 0.2)
      : null,
    hotHours: enough ? countIf(trading, (r) => r.feels != null && r.feels >= 35) : null,
    heatIndexMax: hiMax,
    heatIndexPeakHour: hiPeak,
    wbgtMax: maxOf(rows.map((r) => (r.t != null && r.rh != null ? wbgtShadeC(r.t, r.rh) : null))),
    thiMax: maxOf(thiVals),
    thiStressHours: enough ? countIf(thiVals, (v) => v != null && v >= 72) : null,
    wetBulbMax: maxOf(rows.map((r) => (r.t != null && r.rh != null ? wetBulbC(r.t, r.rh) : null))),
    rhMean: avg(rows.map((r) => r.rh)),
    rhMinDay: minOf(daytime.map((r) => r.rh)),
    dewMax: maxOf(rows.map((r) => r.dew)),
    windMax: di >= 0 ? dailyValue(fc.daily, 'wind_speed_10m_max', di) : maxOf(rows.map((r) => r.wind)),
    gustMax: di >= 0 ? dailyValue(fc.daily, 'wind_gusts_10m_max', di) : maxOf(rows.map((r) => r.gust)),
    uvMax: di >= 0 ? dailyValue(fc.daily, 'uv_index_max', di) : maxOf(rows.map((r) => r.uv)),
    uvHighHours: enough ? countIf(rows, (r) => (r.uv ?? 0) >= 8) : null,
    cloudMeanDay: avg(daytime.map((r) => r.cloud)),
    sunshineH: di >= 0 && dailyValue(fc.daily, 'sunshine_duration', di) != null ? dailyValue(fc.daily, 'sunshine_duration', di)! / 3600 : null,
    daylightH: di >= 0 && dailyValue(fc.daily, 'daylight_duration', di) != null ? dailyValue(fc.daily, 'daylight_duration', di)! / 3600 : null,
    radiationMj: di >= 0 ? dailyValue(fc.daily, 'shortwave_radiation_sum', di) : null,
    et0: di >= 0 ? dailyValue(fc.daily, 'et0_fao_evapotranspiration', di) : null,
    code: codeDaily,
    capeMax,
    thunder:
      codeDaily == null && capeMax == null
        ? null
        : (codeDaily != null && codeDaily >= 95) || (capeMax != null && capeMax >= 1000 && (rainProbMax ?? 0) >= 40),
    fogHours: enough
      ? countIf(rows, (r) => r.code === 45 || r.code === 48 || (r.hour >= 3 && r.hour <= 9 && (r.rh ?? 0) >= 97 && (r.wind ?? 99) < 5))
      : null,
    sprayHours: enough ? sprayHours.length : null,
    sprayWindow: longestRun(sprayHours),
    fieldHours: enough
      ? countIf(field, (r) => (r.prob ?? 100) < 40 && (r.precip ?? 1) < 0.2 && (r.feels ?? 99) < 38 && (r.wind ?? 99) < 30)
      : null,
    leafWetHours: enough ? countIf(rows, leafWet) : null,
    diseaseHours: enough ? countIf(rows, (r) => leafWet(r) && r.t != null && r.t >= 15 && r.t <= 30) : null,
    dryingHours: enough
      ? countIf(rows, (r) => r.hour >= 8 && r.hour <= 17 && (r.rh ?? 100) < 60 && (r.prob ?? 100) < 20 && (r.precip ?? 1) === 0 && (r.cloud ?? 100) < 60)
      : null,
    poultryHeatHours: enough ? countIf(rows, (r) => (r.feels ?? 0) >= 32) : null,
    gdd:
      di >= 0 && dailyValue(fc.daily, 'temperature_2m_max', di) != null && dailyValue(fc.daily, 'temperature_2m_min', di) != null
        ? gdd(dailyValue(fc.daily, 'temperature_2m_max', di)!, dailyValue(fc.daily, 'temperature_2m_min', di)!)
        : null,
    sunrise: sunrise ? sunrise.slice(11, 16) : null,
    sunset: sunset ? sunset.slice(11, 16) : null,
    morningTemp: at(8),
    eveningTemp: at(19),
    eveningComfortHours: enough
      ? countIf(rows, (r) => r.hour >= 17 && r.hour <= 22 && r.feels != null && r.feels >= 18 && r.feels <= 32 && (r.prob ?? 0) < 40)
      : null,
    afterSunsetTradingHours: sunsetHour != null ? clamp(TRADING_HOURS.to + 1 - sunsetHour, 0, 24) : null,
    hours: rows,
  }
}

// ---------------------------------------------------------------- climate normals

function doy(iso: string): number {
  const [, m, d] = iso.split('-').map(Number)
  return Math.round((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 86_400_000)
}

/** Normals for `date` from all archive days within ±7 calendar days, over every archive year. */
export function climateNormal(arch: ArchiveResponse, date: string, windowDays = 7): ClimateNormal {
  const target = doy(date)
  const tmax: number[] = []
  const tmin: number[] = []
  const rain: number[] = []
  arch.daily.time.forEach((t, i) => {
    let d = Math.abs(doy(t) - target)
    d = Math.min(d, 365 - d)
    if (d > windowDays) return
    const a = num(arch.daily.temperature_2m_max[i])
    const b = num(arch.daily.temperature_2m_min?.[i])
    const r = num(arch.daily.precipitation_sum[i])
    if (a != null) tmax.push(a)
    if (b != null) tmin.push(b)
    if (r != null) rain.push(r)
  })
  return {
    date,
    samplesTmax: tmax,
    normTmax: mean(tmax),
    sdTmax: tmax.length >= 10 ? sd(tmax) : null,
    normTmin: mean(tmin),
    rainChancePct: rain.length ? (100 * rain.filter((r) => r >= 2.5).length) / rain.length : null,
    normRainPerDay: mean(rain),
    recordTmax: tmax.length ? Math.max(...tmax) : null,
    recordRain: rain.length ? Math.max(...rain) : null,
  }
}

// ---------------------------------------------------------------- build

export interface RawSources {
  forecast: SourceResult<ForecastResponse>
  soil: SourceResult<{ hourly: { time: string[] } & Record<string, Array<number | null>> }>
  climate: SourceResult<ArchiveResponse>
  air: SourceResult<AirResponse>
  river: SourceResult<RiverResponse>
  elevation: SourceResult<{ elevation: number[] }>
  osm: SourceResult<OsmResult>
}

export function buildFacts(place: Place | null, today: string, raw: Partial<RawSources>): Facts {
  const tomorrow = addDays(today, 1)
  let todayFacts: DayFacts | null = null
  let days: DayFacts[] = []
  let allDays: DayFacts[] = []
  const past7 = { rainMm: null as number | null, tMaxMean: null as number | null, lastRainDaysAgo: null as number | null, days: 0 }

  if (raw.forecast?.ok) {
    const fc = raw.forecast.data
    const byDate = hoursByDate(fc.hourly)
    todayFacts = dayFacts(fc, today, byDate)
    for (const d of fc.daily.time) {
      if (d < tomorrow) continue
      const f = dayFacts(fc, d, byDate)
      if (f) allDays.push(f)
    }
    days = allDays.slice(0, 7)
    const pastIdx = fc.daily.time.map((d, i) => ({ d, i })).filter((x) => x.d < today && x.d >= addDays(today, -7))
    const pastRain = pastIdx.map((x) => num(fc.daily.precipitation_sum?.[x.i]))
    const pastTmax = pastIdx.map((x) => num(fc.daily.temperature_2m_max?.[x.i]))
    if (nums(pastRain).length) {
      past7.rainMm = nums(pastRain).reduce((a, b) => a + b, 0)
      past7.days = nums(pastRain).length
      const lastWet = [...pastIdx].reverse().find((x) => (num(fc.daily.precipitation_sum?.[x.i]) ?? 0) >= 2.5)
      past7.lastRainDaysAgo = lastWet ? daysBetween(lastWet.d, today) : null
    }
    past7.tMaxMean = avg(pastTmax)
  }

  const normals = new Map<string, ClimateNormal>()
  if (raw.climate?.ok) {
    const arch = raw.climate.data
    for (let i = -7; i <= 15; i++) {
      const d = addDays(today, i)
      normals.set(d, climateNormal(arch, d))
    }
  }

  let air: AirFacts | null = null
  if (raw.air?.ok) {
    const h = raw.air.data.hourly
    const idx = h.time.map((t, i) => ({ t, i })).filter((x) => x.t.startsWith(tomorrow)).map((x) => x.i)
    if (idx.length >= 12) {
      const pick = (k: string) => idx.map((i) => num(h[k]?.[i]))
      air = {
        pm25Mean: avg(pick('pm2_5')),
        pm25Max: maxOf(pick('pm2_5')),
        pm10Mean: avg(pick('pm10')),
        usAqiMax: maxOf(pick('us_aqi')),
        ozoneMax: maxOf(pick('ozone')),
        dustMax: maxOf(pick('dust')),
      }
    }
  }

  let soil: SoilFacts | null = null
  if (raw.soil?.ok) {
    const h = raw.soil.data.hourly
    const idx = h.time.map((t, i) => ({ t, i })).filter((x) => x.t.startsWith(tomorrow)).map((x) => x.i)
    if (idx.length >= 12) {
      const pick = (k: string) => idx.map((i) => num(h[k]?.[i]))
      soil = {
        sm0: avg(pick('soil_moisture_0_to_1cm')),
        sm3: avg(pick('soil_moisture_3_to_9cm')),
        sm27: avg(pick('soil_moisture_27_to_81cm')),
        soilTemp6Max: maxOf(pick('soil_temperature_6cm')),
        vpdMax: maxOf(pick('vapour_pressure_deficit')),
      }
    }
  }

  let river: RiverFacts | null = null
  if (raw.river?.ok) {
    const d = raw.river.data.daily
    const i = d.time.indexOf(tomorrow)
    const q = d.river_discharge ?? []
    if (i >= 0 && num(q[i]) != null) {
      const future = d.time.map((t, k) => ({ t, v: num(q[k]) })).filter((x) => x.t >= tomorrow && x.v != null) as Array<{ t: string; v: number }>
      const peak = future.reduce((a, b) => (b.v > a.v ? b : a), future[0])
      const week = future.slice(0, 7)
      river = {
        tomorrow: num(q[i]),
        median: num(d.river_discharge_median?.[i]),
        ensembleMax: num(d.river_discharge_max?.[i]),
        peak: peak?.v ?? null,
        peakDate: peak?.t ?? null,
        trendPct: week.length >= 2 && week[0].v > 0 ? (100 * (week[week.length - 1].v - week[0].v)) / week[0].v : null,
      }
    }
  }

  const elevation = raw.elevation?.ok ? num(raw.elevation.data.elevation?.[0]) : null

  let osm: OsmFacts | null = null
  if (raw.osm?.ok && place) {
    osm = {
      counts: raw.osm.data.counts,
      competitors: raw.osm.data.competitors
        .map((c) => ({ name: c.name, kind: c.kind, lat: c.lat, lng: c.lng, distanceM: Math.round(distanceKm(place.lat, place.lng, c.lat, c.lng) * 1000) }))
        .sort((a, b) => a.distanceM - b.distanceM),
    }
  }

  const distanceFromCityKm = place ? distanceKm(place.lat, place.lng, KALABURAGI_CITY.lat, KALABURAGI_CITY.lng) : null
  const nearKalaburagi = distanceFromCityKm != null && distanceFromCityKm <= URS_CROWD_RADIUS_KM
  const withLocal = (from: string, to: string) =>
    [...eventsBetween(from, to, place), ...kalaburagiEventsBetween(from, to, distanceFromCityKm ?? 999)]
      // Regional festivals observed elsewhere (Karwa Chauth, Chhath, Onam…) are left out of Kalaburagi's list.
      .filter((e) => !e.regions || retailHere(e, place?.state))
      .sort((a, b) => a.date.localeCompare(b.date))
  const calendar: CalendarFacts = {
    events: withLocal(addDays(today, -1), addDays(today, 15)),
    upcoming: withLocal(tomorrow, addDays(today, 45)),
    nearKalaburagi,
    distanceFromCityKm,
    nextUrs: findHijri(tomorrow, 400, (h) => isUrsDay(h)),
    state: place?.state,
  }

  return { today, tomorrow, todayFacts, days, allDays, past7, normals, air, soil, river, elevation, osm, calendar, pulse: null }
}

/** Retail-festival proximity for a date: 1 on the eve, fading to 0 five days out. Festival day itself counts 0.6. */
export function festivalSignal(date: string, events: CalendarEntry[], state?: string): { signal: number; event: CalendarEntry | null; daysAway: number | null } {
  let best = { signal: 0, event: null as CalendarEntry | null, daysAway: null as number | null }
  for (const e of events) {
    if (!retailHere(e, state)) continue
    const d = daysBetween(date, e.date)
    if (d < 0 || d > 5) continue
    const s = d === 0 ? 0.6 : 1 - (d - 1) / 5
    if (s > best.signal) best = { signal: s, event: e, daysAway: d }
  }
  return best
}

export function isHoliday(date: string, events: CalendarEntry[]): CalendarEntry | null {
  return events.find((e) => e.date === date && (e.kind === 'national' || e.kind === 'state')) ?? null
}

/** Is `date` one of the three Urs days (India-observed, computed)? */
export function ursOn(date: string): boolean {
  return isUrsDay(hijri(date))
}
