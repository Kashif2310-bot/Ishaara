/**
 * The metric ledger: every number the brief knows, with its unit, source and method.
 *
 * Metrics never carry a fallback. When the source behind a metric was unavailable, its value
 * is null and it displays "Unavailable", so the reader sees exactly what the decision did not
 * have.
 */
import { ANCHORS, type Archetype } from './archetypes'
import {
  addDays,
  CALENDAR_COVERAGE,
  cropSeason,
  daysBetween,
  daysInMonth,
  hijri,
  hijriLabel,
  imdSeason,
  retailHere,
  weekday,
  WEEKDAYS,
} from './calendar'
import { festivalSignal, isHoliday, type Facts } from './facts'
import {
  dewPointBand,
  heatIndexBand,
  humidex,
  imdDepartureCategory,
  imdRainCategory,
  indianAqiFromPm,
  moonAgeDays,
  moonIllumination,
  moonPhaseName,
  naqiBand,
  percentileOf,
  slope,
  thiBand,
  usAqiBand,
  uvBand,
  wbgtBand,
  WMO_TEXT,
} from './formulas'
import type { Dimension, Metric, Place, SourceId, SourceStatus } from './types'

type V = number | string | boolean | null

export const DIMENSION_LABELS: Record<Dimension, string> = {
  decision: 'The decision',
  weather_tomorrow: 'Tomorrow’s weather',
  weather_week: 'The week ahead',
  climate: 'Against the 10-year normal',
  air: 'Air quality',
  soil_crop: 'Soil, crops and livestock',
  water: 'Rivers and terrain',
  place: 'The place',
  demand_anchors: 'Footfall anchors nearby',
  competition: 'Competition nearby',
  calendar: 'Calendar and festivals',
  data_quality: 'Data quality',
}

/** Saturation counts used to turn anchor counts into a 0..1 score (log scale). */
export const ANCHOR_SATURATION: Record<string, number> = {
  schools: 6,
  colleges: 4,
  hospitals: 8,
  worship: 10,
  mosques: 5,
  temples: 8,
  churches: 3,
  busStops: 8,
  busStations: 2,
  rail: 1,
  markets: 3,
  banks: 8,
  govt: 8,
  fuel: 3,
  lodging: 8,
  attractions: 6,
  cinemas: 2,
  parks: 4,
  offices: 20,
  shops: 80,
  eateries: 25,
  buildings: 1500,
  mainRoads: 8,
  roads: 120,
  industrial: 4,
  farmland: 40,
  water: 4,
  agriSupply: 4,
  vets: 2,
}

const f0 = (n: number) => Math.round(n).toLocaleString('en-IN')
const f1 = (n: number) => n.toFixed(1)
const f2 = (n: number) => n.toFixed(2)
const signed = (n: number, d = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}`
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

export interface LedgerContext {
  facts: Facts
  place: Place | null
  archetype: Archetype
  marketDay?: number
  sources: SourceStatus[]
  now: number
}

export function anchorScore(counts: Record<string, number>, archetype: Archetype): { score: number; parts: Array<{ key: string; norm: number; weight: number }> } {
  const parts = Object.entries(archetype.anchors).map(([key, weight]) => {
    const c = counts[key] ?? 0
    const s = ANCHOR_SATURATION[key] ?? 10
    return { key, weight: weight ?? 0, norm: Math.min(1, Math.log1p(c) / Math.log1p(s)) }
  })
  const wsum = parts.reduce((a, p) => a + p.weight, 0)
  const score = wsum > 0 ? (100 * parts.reduce((a, p) => a + p.weight * p.norm, 0)) / wsum : 0
  return { score, parts }
}

export function buildLedger(ctx: LedgerContext): Metric[] {
  const { facts, place, archetype } = ctx
  const out: Metric[] = []
  const push = (
    id: string,
    dimension: Dimension,
    label: string,
    value: V,
    source: SourceId,
    method: string,
    opts: { unit?: string; fmt?: (v: never) => string; reference?: string } = {},
  ) => {
    let display: string
    if (value == null) display = 'Unavailable'
    else if (opts.fmt) display = (opts.fmt as (v: V) => string)(value)
    else if (typeof value === 'number') display = `${f1(value)}${opts.unit ? ` ${opts.unit}` : ''}`
    else if (typeof value === 'boolean') display = value ? 'Yes' : 'No'
    else display = value
    out.push({ id, dimension, label, value, unit: opts.unit, display, source, method, ...(opts.reference ? { reference: opts.reference } : {}) })
  }

  const T = facts.days[0] ?? null
  const td = facts.todayFacts
  const n = <K extends keyof NonNullable<typeof T>>(k: K) => (T ? (T[k] as NonNullable<typeof T>[K]) : null)

  // ------------------------------------------------------------ tomorrow's weather
  const WT: Dimension = 'weather_tomorrow'
  push('wx.summary', WT, 'Sky', n('code') != null ? WMO_TEXT[n('code') as number] ?? `WMO code ${n('code')}` : null, 'forecast', 'Daily WMO weather code from the model.')
  push('wx.tmax', WT, 'Maximum temperature', n('tMax'), 'forecast', 'Daily maximum 2 m air temperature.', { unit: '°C' })
  push('wx.tmin', WT, 'Minimum temperature', n('tMin'), 'forecast', 'Daily minimum 2 m air temperature.', { unit: '°C' })
  push('wx.range', WT, 'Day–night temperature swing', T?.tMax != null && T.tMin != null ? T.tMax - T.tMin : null, 'forecast', 'Maximum minus minimum.', { unit: '°C' })
  push('wx.feels_max', WT, 'Feels-like maximum', n('feelsMax'), 'forecast', 'Apparent temperature (heat, humidity, wind and sun).', { unit: '°C' })
  push('wx.feels_min', WT, 'Feels-like minimum', n('feelsMin'), 'forecast', 'Apparent temperature minimum.', { unit: '°C' })
  push('wx.heat_index', WT, 'Heat index peak', n('heatIndexMax'), 'forecast', 'NOAA Rothfusz regression from hourly temperature and humidity; highest hour.', {
    fmt: ((v: number) => `${f1(v)} °C, ${heatIndexBand(v)}${T?.heatIndexPeakHour != null ? ` at ${hh(T.heatIndexPeakHour)}` : ''}`) as never,
    unit: '°C',
    reference: 'NOAA bands: 27 caution, 32 extreme caution, 41 danger, 54 extreme danger (°C)',
  })
  push('wx.humidex', WT, 'Humidex peak', T?.tMax != null && T.dewMax != null ? humidex(T.tMax, T.dewMax) : null, 'forecast', 'Environment Canada humidex from max temperature and max dew point (upper bound).', {
    unit: '°C',
    reference: '30–39 some discomfort, 40–45 great discomfort, 46+ dangerous',
  })
  push('wx.wbgt', WT, 'Wet-bulb globe temperature (shade) peak', n('wbgtMax'), 'forecast', 'Australian BoM shade approximation 0.567T + 0.393e + 3.94; full sun adds about 2–3 °C.', {
    fmt: ((v: number) => `${f1(v)} °C, ${wbgtBand(v)}`) as never,
    unit: '°C',
    reference: 'TB MED 507 flags: 27.8 yellow, 29.4 red, 31.1 black (°C)',
  })
  push('wx.wetbulb', WT, 'Wet-bulb temperature peak', n('wetBulbMax'), 'forecast', 'Stull (2011) formula, highest hour.', { unit: '°C', reference: 'Sustained wet-bulb above about 31 °C is hazardous even at rest' })
  push('wx.hot_hours', WT, 'Trading hours at feels-like 35 °C or more', n('hotHours'), 'forecast', 'Hours 07:00–21:00 with apparent temperature ≥ 35 °C.', { fmt: ((v: number) => `${v} of 15 h`) as never })
  push('wx.comfort_hours', WT, 'Comfortable trading hours', n('comfortableHours'), 'forecast', 'Hours 07:00–21:00 with feels-like 18–32 °C, rain chance under 40 % and no rain.', { fmt: ((v: number) => `${v} of 15 h`) as never })
  push('wx.evening_comfort', WT, 'Comfortable evening hours (17:00–22:00)', n('eveningComfortHours'), 'forecast', 'Evening hours with feels-like 18–32 °C and rain chance under 40 %.', { fmt: ((v: number) => `${v} of 6 h`) as never })
  push('wx.morning_temp', WT, 'Temperature at 08:00', n('morningTemp'), 'forecast', 'Hourly forecast.', { unit: '°C' })
  push('wx.evening_temp', WT, 'Temperature at 19:00', n('eveningTemp'), 'forecast', 'Hourly forecast.', { unit: '°C' })
  push('wx.rain_mm', WT, 'Rainfall', n('rainMm'), 'forecast', 'Daily precipitation sum.', {
    fmt: ((v: number) => `${f1(v)} mm, ${imdRainCategory(v)}`) as never,
    unit: 'mm',
    reference: 'IMD: 2.5–15.5 light, 15.6–64.4 moderate, 64.5–115.5 heavy',
  })
  push('wx.rain_prob', WT, 'Highest chance of rain', n('rainProbMax'), 'forecast', 'Daily maximum precipitation probability.', { unit: '%' , fmt: ((v: number) => `${f0(v)} %`) as never })
  push('wx.rain_prob_trading', WT, 'Highest chance of rain in trading hours', n('rainProbTrading'), 'forecast', 'Maximum hourly probability, 07:00–21:00.', { fmt: ((v: number) => `${f0(v)} %`) as never, unit: '%' })
  push('wx.rain_hours_trading', WT, 'Wet trading hours', n('rainHoursTrading'), 'forecast', 'Hours 07:00–21:00 with ≥ 0.2 mm or ≥ 60 % chance.', { fmt: ((v: number) => `${v} of 15 h`) as never })
  push('wx.first_rain', WT, 'First likely rain', T ? (T.firstRainHour != null ? hh(T.firstRainHour) : 'None expected in trading hours') : null, 'forecast', 'First trading hour with ≥ 50 % chance or ≥ 0.5 mm.')
  push('wx.rain_hours', WT, 'Hours with rain', n('rainHours'), 'forecast', 'Daily precipitation hours.', { unit: 'h' })
  push('wx.humidity', WT, 'Average humidity', n('rhMean'), 'forecast', 'Mean of hourly relative humidity.', { unit: '%', fmt: ((v: number) => `${f0(v)} %`) as never })
  push('wx.humidity_min', WT, 'Lowest daytime humidity', n('rhMinDay'), 'forecast', 'Minimum daytime relative humidity.', { unit: '%', fmt: ((v: number) => `${f0(v)} %`) as never })
  push('wx.dew', WT, 'Highest dew point', n('dewMax'), 'forecast', 'Hourly maximum.', { fmt: ((v: number) => `${f1(v)} °C, ${dewPointBand(v)}`) as never, unit: '°C', reference: '16 humid, 20 very humid, 24 oppressive (°C)' })
  push('wx.wind', WT, 'Strongest wind', n('windMax'), 'forecast', 'Daily maximum 10 m wind speed.', { unit: 'km/h' })
  push('wx.gust', WT, 'Strongest gust', n('gustMax'), 'forecast', 'Daily maximum gust.', { unit: 'km/h', reference: 'Above about 40 km/h, loose canopies and signboards are at risk' })
  push('wx.uv', WT, 'UV index peak', n('uvMax'), 'forecast', 'Daily maximum UV index.', { fmt: ((v: number) => `${f1(v)}, ${uvBand(v)}`) as never, reference: 'WHO: 6–7 high, 8–10 very high, 11+ extreme' })
  push('wx.uv_hours', WT, 'Hours at UV 8 or more', n('uvHighHours'), 'forecast', 'Hourly UV index ≥ 8.', { unit: 'h' })
  push('wx.cloud', WT, 'Daytime cloud cover', n('cloudMeanDay'), 'forecast', 'Mean daytime cloud cover.', { unit: '%', fmt: ((v: number) => `${f0(v)} %`) as never })
  push('wx.sunshine', WT, 'Sunshine', n('sunshineH'), 'forecast', 'Daily sunshine duration.', { unit: 'h' })
  push('wx.daylight', WT, 'Daylight', n('daylightH'), 'forecast', 'Sunrise to sunset.', { unit: 'h' })
  push('wx.sunrise', WT, 'Sunrise', n('sunrise'), 'forecast', 'Local time (IST).')
  push('wx.sunset', WT, 'Sunset', n('sunset'), 'forecast', 'Local time (IST).')
  push('wx.after_dark', WT, 'Trading hours after sunset', n('afterSunsetTradingHours'), 'forecast', 'Hours between sunset and 22:00 that need lighting.', { unit: 'h' })
  push('wx.radiation', WT, 'Solar energy', n('radiationMj'), 'forecast', 'Daily shortwave radiation sum.', { unit: 'MJ/m²', reference: 'Useful for solar dryers and pumps' })
  push('wx.cape', WT, 'Atmospheric instability (CAPE) peak', n('capeMax'), 'forecast', 'Convective available potential energy, hourly maximum.', { unit: 'J/kg', fmt: ((v: number) => `${f0(v)} J/kg`) as never, reference: '> 1,000 moderate, > 2,500 strong thunderstorm potential' })
  push('wx.thunder', WT, 'Thunderstorm risk', n('thunder'), 'forecast', 'WMO thunderstorm code, or CAPE ≥ 1,000 J/kg with ≥ 40 % rain chance.')
  push('wx.fog', WT, 'Fog-risk hours', n('fogHours'), 'forecast', 'Fog codes, or humidity ≥ 97 % with calm wind 03:00–09:00.', { unit: 'h' })
  push('wx.tmax_change', WT, 'Change in maximum from today', T?.tMax != null && td?.tMax != null ? T.tMax - td.tMax : null, 'forecast', 'Tomorrow minus today.', { fmt: ((v: number) => `${signed(v)} °C`) as never, unit: '°C' })
  push('wx.rain_change', WT, 'Change in rain chance from today', T?.rainProbMax != null && td?.rainProbMax != null ? T.rainProbMax - td.rainProbMax : null, 'forecast', 'Tomorrow minus today, percentage points.', { fmt: ((v: number) => `${signed(v, 0)} pts`) as never })
  push('wx.hours', 'data_quality', 'Forecast hours available for tomorrow', n('hoursAvailable'), 'forecast', 'Count of hourly rows for tomorrow (24 expected).', { fmt: ((v: number) => `${v} of 24`) as never })

  // ------------------------------------------------------------ the week ahead
  const WK: Dimension = 'weather_week'
  const wk = facts.days
  const has = wk.length > 0
  const sumOf = (xs: Array<number | null>) => (xs.some((x) => x == null) || !xs.length ? null : (xs as number[]).reduce((a, b) => a + b, 0))
  push('wk.rain_total', WK, 'Rain over the next 7 days', has ? sumOf(wk.map((d) => d.rainMm)) : null, 'forecast', 'Sum of daily precipitation.', { unit: 'mm' })
  push('wk.rainy_days', WK, 'Rainy days in the next 7', has ? wk.filter((d) => (d.rainMm ?? 0) >= 2.5).length : null, 'forecast', 'Days with ≥ 2.5 mm (IMD rainy day).', { fmt: ((v: number) => `${v} of ${wk.length}`) as never })
  push('wk.rain_16', WK, 'Rain over the full 16-day forecast', facts.allDays.length ? sumOf(facts.allDays.map((d) => d.rainMm)) : null, 'forecast', 'Sum of daily precipitation, all forecast days.', { unit: 'mm' })
  const wettest = has ? wk.reduce((a, b) => ((b.rainMm ?? 0) > (a.rainMm ?? 0) ? b : a)) : null
  push('wk.wettest', WK, 'Wettest day', wettest && (wettest.rainMm ?? 0) > 0 ? `${WEEKDAYS[weekday(wettest.date)]} ${wettest.date.slice(8)}, ${f1(wettest.rainMm ?? 0)} mm` : has ? 'No rain expected' : null, 'forecast', 'Day with the largest daily total.')
  push('wk.tmax_max', WK, 'Hottest maximum', has ? Math.max(...wk.map((d) => d.tMax ?? -99)) : null, 'forecast', 'Highest daily maximum in the next 7 days.', { unit: '°C' })
  push('wk.tmin_min', WK, 'Coolest minimum', has ? Math.min(...wk.map((d) => d.tMin ?? 99)) : null, 'forecast', 'Lowest daily minimum in the next 7 days.', { unit: '°C' })
  push('wk.hot_days', WK, 'Days at 35 °C or more', has ? wk.filter((d) => (d.tMax ?? 0) >= 35).length : null, 'forecast', 'Daily maximum ≥ 35 °C.', { fmt: ((v: number) => `${v} of ${wk.length}`) as never })
  push('wk.very_hot_days', WK, 'Days at 40 °C or more', has ? wk.filter((d) => (d.tMax ?? 0) >= 40).length : null, 'forecast', 'Daily maximum ≥ 40 °C.', { fmt: ((v: number) => `${v} of ${wk.length}`) as never })
  push('wk.heat_index_max', WK, 'Highest heat index', has ? Math.max(...wk.map((d) => d.heatIndexMax ?? -99)) : null, 'forecast', 'Highest hourly heat index in the next 7 days.', { fmt: ((v: number) => `${f1(v)} °C, ${heatIndexBand(v)}`) as never })
  push('wk.thunder_days', WK, 'Days with thunderstorm risk', has ? wk.filter((d) => d.thunder).length : null, 'forecast', 'Same rule as tomorrow’s thunderstorm risk.', { fmt: ((v: number) => `${v} of ${wk.length}`) as never })
  push('wk.trend', WK, 'Temperature trend', has && wk.every((d) => d.tMax != null) ? slope(wk.map((d) => d.tMax as number)) : null, 'forecast', 'Least-squares slope of daily maximum over 7 days.', { fmt: ((v: number) => `${signed(v, 2)} °C per day`) as never })
  let run = 0
  let best = 0
  for (const d of wk) {
    if ((d.rainMm ?? 0) < 2.5) run++
    else run = 0
    best = Math.max(best, run)
  }
  push('wk.dry_spell', WK, 'Longest dry spell', has ? best : null, 'forecast', 'Most consecutive days under 2.5 mm.', { fmt: ((v: number) => `${v} days`) as never })
  const nextWeekend = wk.filter((d) => weekday(d.date) === 0 || weekday(d.date) === 6)
  push('wk.weekend_rain', WK, 'Rain chance this coming weekend', nextWeekend.length ? Math.max(...nextWeekend.map((d) => d.rainProbMax ?? 0)) : null, 'forecast', 'Highest rain chance on the next Saturday and Sunday in range.', { fmt: ((v: number) => `${f0(v)} %`) as never })
  push('wk.comfort_total', WK, 'Comfortable trading hours this week', has ? sumOf(wk.map((d) => d.comfortableHours)) : null, 'forecast', 'Sum over 7 days.', { fmt: ((v: number) => `${v} of ${wk.length * 15} h`) as never })
  push('wk.past_rain', WK, 'Rain in the past 7 days', facts.past7.rainMm, 'forecast', 'Model analysis for the last 7 days.', { unit: 'mm' })
  push('wk.past_tmax', WK, 'Average maximum, past 7 days', facts.past7.tMaxMean, 'forecast', 'Mean of daily maximum, last 7 days.', { unit: '°C' })
  push('wk.last_rain', WK, 'Days since last rainy day', facts.past7.days ? (facts.past7.lastRainDaysAgo ?? `More than ${facts.past7.days}`) : null, 'forecast', 'Last day with ≥ 2.5 mm, within the past week.', { fmt: ((v: V) => (typeof v === 'number' ? `${v} days` : `${v} days`)) as never })

  // ------------------------------------------------------------ climate normal
  const CL: Dimension = 'climate'
  const N = facts.normals.get(facts.tomorrow) ?? null
  push('cl.norm_tmax', CL, 'Normal maximum for this date', N?.normTmax ?? null, 'climate', '10-year mean of daily maximum within ±7 days of the date (ERA5).', { unit: '°C' })
  push('cl.anom_tmax', CL, 'Tomorrow vs normal maximum', T?.tMax != null && N?.normTmax != null ? T.tMax - N.normTmax : null, 'climate', 'Forecast maximum minus the 10-year normal.', { fmt: ((v: number) => `${signed(v)} °C`) as never, unit: '°C' })
  push('cl.z_tmax', CL, 'How unusual (standard deviations)', T?.tMax != null && N?.normTmax != null && N.sdTmax ? (T.tMax - N.normTmax) / N.sdTmax : null, 'climate', 'Anomaly divided by the 10-year spread for the season.', { fmt: ((v: number) => `${signed(v, 2)} σ`) as never, reference: 'Beyond ±1 σ is unusual; beyond ±2 σ is rare' })
  push('cl.pct_tmax', CL, 'Percentile of tomorrow’s maximum', T?.tMax != null && N?.samplesTmax.length ? percentileOf(N.samplesTmax, T.tMax) : null, 'climate', 'Share of same-season days in the last 10 years that were cooler.', { fmt: ((v: number) => `${f0(v)}th`) as never })
  push('cl.record_tmax', CL, 'Hottest same-season day in 10 years', N?.recordTmax ?? null, 'climate', 'Maximum within ±7 days of the date, 10 years.', { unit: '°C' })
  push('cl.norm_tmin', CL, 'Normal minimum for this date', N?.normTmin ?? null, 'climate', '10-year mean of daily minimum within ±7 days.', { unit: '°C' })
  push('cl.anom_tmin', CL, 'Tomorrow vs normal minimum', T?.tMin != null && N?.normTmin != null ? T.tMin - N.normTmin : null, 'climate', 'Forecast minimum minus normal.', { fmt: ((v: number) => `${signed(v)} °C`) as never, unit: '°C' })
  push('cl.rain_chance', CL, 'Historical chance of a rainy day', N?.rainChancePct ?? null, 'climate', 'Share of same-season days in 10 years with ≥ 2.5 mm.', { fmt: ((v: number) => `${f0(v)} %`) as never })
  push('cl.norm_rain', CL, 'Normal rain per day this season', N?.normRainPerDay ?? null, 'climate', '10-year mean daily precipitation within ±7 days.', { unit: 'mm' })
  push('cl.record_rain', CL, 'Wettest same-season day in 10 years', N?.recordRain ?? null, 'climate', 'Maximum daily precipitation within ±7 days, 10 years.', { unit: 'mm' })
  const weekNormal = wk.length && facts.normals.size ? wk.reduce((a, d) => a + (facts.normals.get(d.date)?.normRainPerDay ?? 0), 0) : null
  const weekRain = has ? sumOf(wk.map((d) => d.rainMm)) : null
  const dep = weekRain != null && weekNormal != null && weekNormal > 0.5 ? (100 * (weekRain - weekNormal)) / weekNormal : null
  push('cl.week_rain_dep', CL, 'Next-7-day rain vs normal', dep, 'climate', 'Forecast 7-day total against the 10-year normal for the same days. Skipped when the normal is under 0.5 mm (dry season).', {
    fmt: ((v: number) => `${signed(v, 0)} %, ${imdDepartureCategory(v)}`) as never,
    reference: 'IMD: ≥ +20 % excess, −19 to +19 normal, −20 to −59 deficient, ≤ −60 large deficient',
  })
  const pastNormal = facts.normals.size ? Array.from({ length: 7 }, (_, i) => facts.normals.get(addDays(facts.today, -7 + i))?.normRainPerDay ?? 0).reduce((a, b) => a + b, 0) : null
  push('cl.past_rain_dep', CL, 'Past-7-day rain vs normal', facts.past7.rainMm != null && pastNormal != null && pastNormal > 0.5 ? (100 * (facts.past7.rainMm - pastNormal)) / pastNormal : null, 'climate', 'Last 7 days against the 10-year normal. Skipped in the dry season.', {
    fmt: ((v: number) => `${signed(v, 0)} %, ${imdDepartureCategory(v)}`) as never,
  })
  const heatwave = T?.tMax != null && N?.normTmax != null ? (T.tMax >= 45 || (T.tMax >= 40 && T.tMax - N.normTmax >= 4.5)) : null
  push('cl.heatwave', CL, 'IMD heat-wave criterion (plains)', heatwave, 'climate', 'Maximum ≥ 40 °C and ≥ 4.5 °C above normal, or ≥ 45 °C.', { reference: 'IMD heat-wave definition for plains stations' })
  const coldwave = T?.tMin != null && N?.normTmin != null ? T.tMin <= 10 && T.tMin - N.normTmin <= -4.5 : null
  push('cl.coldwave', CL, 'IMD cold-wave criterion (plains)', coldwave, 'climate', 'Minimum ≤ 10 °C and ≥ 4.5 °C below normal.', { reference: 'IMD cold-wave definition for plains stations' })
  push('cl.samples', 'data_quality', 'Climate sample size', N ? N.samplesTmax.length : null, 'climate', 'Days in the 10-year ±7-day window.', { fmt: ((v: number) => `${v} days`) as never })

  // ------------------------------------------------------------ air
  const AI: Dimension = 'air'
  const A = facts.air
  push('air.pm25', AI, 'PM2.5, 24-hour average', A?.pm25Mean ?? null, 'air', 'Mean of hourly CAMS forecast for tomorrow.', { unit: 'µg/m³', fmt: ((v: number) => `${f0(v)} µg/m³`) as never, reference: 'CPCB NAAQS 60; WHO 2021 guideline 15 (24-hour)' })
  push('air.pm25_naaqs', AI, 'PM2.5 vs the Indian standard', A?.pm25Mean != null ? A.pm25Mean / 60 : null, 'air', 'PM2.5 average divided by the 60 µg/m³ NAAQS.', { fmt: ((v: number) => `${f2(v)}× the limit`) as never })
  push('air.pm25_who', AI, 'PM2.5 vs the WHO guideline', A?.pm25Mean != null ? A.pm25Mean / 15 : null, 'air', 'PM2.5 average divided by WHO 15 µg/m³.', { fmt: ((v: number) => `${f1(v)}× the guideline`) as never })
  push('air.pm25_peak', AI, 'PM2.5 worst hour', A?.pm25Max ?? null, 'air', 'Hourly maximum.', { unit: 'µg/m³', fmt: ((v: number) => `${f0(v)} µg/m³`) as never })
  push('air.pm10', AI, 'PM10, 24-hour average', A?.pm10Mean ?? null, 'air', 'Mean of hourly forecast.', { unit: 'µg/m³', fmt: ((v: number) => `${f0(v)} µg/m³`) as never, reference: 'CPCB NAAQS 100; WHO 2021 guideline 45' })
  const naqi = A ? indianAqiFromPm(A.pm25Mean, A.pm10Mean) : null
  push('air.naqi', AI, 'Indian AQI (from PM2.5 and PM10)', naqi, 'air', 'CPCB National AQI sub-indices for PM2.5 and PM10, the higher of the two. Other pollutants not included.', {
    fmt: ((v: number) => `${v}, ${naqiBand(v)}`) as never,
    reference: 'CPCB: 0–50 good, 51–100 satisfactory, 101–200 moderate, 201–300 poor, 301–400 very poor',
  })
  push('air.us_aqi', AI, 'US AQI worst hour', A?.usAqiMax ?? null, 'air', 'Model US EPA AQI, hourly maximum.', { fmt: ((v: number) => `${f0(v)}, ${usAqiBand(v)}`) as never })
  push('air.ozone', AI, 'Ozone worst hour', A?.ozoneMax ?? null, 'air', 'Hourly maximum.', { unit: 'µg/m³', fmt: ((v: number) => `${f0(v)} µg/m³`) as never, reference: 'CPCB NAAQS 8-hour 100, 1-hour 180' })
  push('air.dust', AI, 'Dust worst hour', A?.dustMax ?? null, 'air', 'Hourly maximum mineral dust.', { unit: 'µg/m³', fmt: ((v: number) => `${f0(v)} µg/m³`) as never })

  // ------------------------------------------------------------ soil, crops, livestock
  const SC: Dimension = 'soil_crop'
  const S = facts.soil
  push('soil.sm_surface', SC, 'Soil moisture, top 1 cm', S?.sm0 ?? null, 'forecast', 'Model volumetric water content, daily mean.', { unit: 'm³/m³', fmt: ((v: number) => `${f2(v)} m³/m³`) as never })
  push('soil.sm_root', SC, 'Soil moisture, 3–9 cm', S?.sm3 ?? null, 'forecast', 'Model volumetric water content, daily mean.', { unit: 'm³/m³', fmt: ((v: number) => `${f2(v)} m³/m³`) as never })
  push('soil.sm_deep', SC, 'Soil moisture, 27–81 cm', S?.sm27 ?? null, 'forecast', 'Model volumetric water content, daily mean.', { unit: 'm³/m³', fmt: ((v: number) => `${f2(v)} m³/m³`) as never, reference: 'Model values; check against a field feel test before deciding to irrigate' })
  push('soil.temp', SC, 'Soil temperature at 6 cm, peak', S?.soilTemp6Max ?? null, 'forecast', 'Hourly maximum.', { unit: '°C' })
  push('soil.vpd', SC, 'Vapour pressure deficit, peak', S?.vpdMax ?? null, 'forecast', 'Hourly maximum.', { unit: 'kPa', fmt: ((v: number) => `${f2(v)} kPa`) as never, reference: 'Above about 1.5–2 kPa many crops close stomata and wilt' })
  push('crop.et0', SC, 'Crop water demand (ET₀)', n('et0'), 'forecast', 'FAO-56 reference evapotranspiration.', { unit: 'mm' })
  const et7 = has ? sumOf(wk.map((d) => d.et0)) : null
  push('crop.et0_week', SC, 'ET₀ over the next 7 days', et7, 'forecast', 'Sum of daily ET₀.', { unit: 'mm' })
  push('crop.balance', SC, '7-day water balance', et7 != null && weekRain != null ? weekRain - et7 : null, 'forecast', 'Forecast rain minus ET₀. Negative means the soil is drying.', { fmt: ((v: number) => `${signed(v)} mm`) as never })
  push('crop.gdd', SC, 'Growing degree days', n('gdd'), 'forecast', '(max + min) / 2 − 10 °C, floored at 0.', { reference: 'Base 10 °C; crop-specific bases differ' })
  push('crop.gdd_week', SC, 'Growing degree days, next 7', has ? sumOf(wk.map((d) => d.gdd)) : null, 'forecast', 'Sum of daily GDD.', {})
  push('crop.spray_hours', SC, 'Spray-suitable hours', n('sprayHours'), 'forecast', 'Daylight, wind 3–15 km/h, rain chance < 30 %, no rain, Delta T 2–8 °C.', { unit: 'h', reference: 'GRDC spray guidance: Delta T 2–8 °C ideal, wind 3–15 km/h' })
  push('crop.spray_window', SC, 'Best spray window', T ? T.sprayWindow ?? 'No suitable window' : null, 'forecast', 'Longest run of spray-suitable hours.')
  push('crop.field_hours', SC, 'Field-work hours', n('fieldHours'), 'forecast', '06:00–18:00 with rain chance < 40 %, feels-like < 38 °C, wind < 30 km/h.', { fmt: ((v: number) => `${v} of 13 h`) as never })
  push('crop.leaf_wet', SC, 'Leaf-wetness hours (proxy)', n('leafWetHours'), 'forecast', 'Hours with humidity ≥ 90 % or rain.', { unit: 'h', reference: 'Long leaf wetness favours fungal disease' })
  push('crop.disease_hours', SC, 'Disease-favourable hours', n('diseaseHours'), 'forecast', 'Leaf-wet hours at 15–30 °C.', { unit: 'h' })
  push('crop.drying_hours', SC, 'Produce-drying hours', n('dryingHours'), 'forecast', '08:00–17:00 with humidity < 60 %, rain chance < 20 %, cloud < 60 %.', { unit: 'h' })
  push('crop.season', SC, 'Crop season', cropSeason(facts.tomorrow), 'calendar', 'Kharif / rabi / summer by month (common Indian convention).')
  push('stock.thi', SC, 'Cattle temperature-humidity index, peak', n('thiMax'), 'forecast', 'NRC (1971) THI, hourly maximum.', { fmt: ((v: number) => `${f0(v)}, ${thiBand(v)}`) as never, reference: 'Armstrong (1994): 72 mild, 79 moderate, 89 severe' })
  push('stock.thi_hours', SC, 'Cattle heat-stress hours', n('thiStressHours'), 'forecast', 'Hours with THI ≥ 72.', { unit: 'h' })
  push('stock.poultry_hours', SC, 'Poultry heat hours', n('poultryHeatHours'), 'forecast', 'Hours with feels-like ≥ 32 °C (rule of thumb for broiler heat stress).', { unit: 'h' })

  // ------------------------------------------------------------ water and terrain
  const WA: Dimension = 'water'
  const R = facts.river
  push('river.q', WA, 'Nearest river flow tomorrow', R?.tomorrow ?? null, 'river', 'GloFAS forecast discharge for the nearest river cell (about 5 km grid).', { unit: 'm³/s', fmt: ((v: number) => `${f1(v)} m³/s`) as never })
  push('river.median', WA, 'Typical flow for this date', R?.median ?? null, 'river', 'GloFAS ensemble median.', { unit: 'm³/s', fmt: ((v: number) => `${f1(v)} m³/s`) as never })
  push('river.ratio', WA, 'Flow vs typical', R?.tomorrow != null && R.median ? R.tomorrow / R.median : null, 'river', 'Forecast divided by the ensemble median.', { fmt: ((v: number) => `${f2(v)}×`) as never, reference: 'Well above 1 means high water; well below 1 means low flow' })
  push('river.peak', WA, 'Highest flow in the forecast', R?.peak != null ? R.peak : null, 'river', 'Maximum daily discharge over the forecast.', { fmt: ((v: number) => `${f1(v)} m³/s${R?.peakDate ? ` on ${R.peakDate}` : ''}`) as never })
  push('river.trend', WA, 'Flow trend over the week', R?.trendPct ?? null, 'river', 'Change from tomorrow to day 7.', { fmt: ((v: number) => `${signed(v, 0)} %`) as never })
  push('geo.elevation', WA, 'Elevation', facts.elevation, 'elevation', 'Copernicus DEM, 90 m.', { unit: 'm', fmt: ((v: number) => `${f0(v)} m`) as never })

  // ------------------------------------------------------------ place
  const PL: Dimension = 'place'
  push('place.name', PL, 'Place found', place?.displayName ?? null, 'geocode', 'OpenStreetMap Nominatim, first match in India.')
  push('place.district', PL, 'District', place?.district ?? null, 'geocode', 'From the geocoder’s address.')
  push('place.state', PL, 'State', place?.state ?? null, 'geocode', 'From the geocoder’s address.')
  push('place.coords', PL, 'Coordinates', place ? `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}` : null, 'geocode', 'Latitude, longitude.')

  // ------------------------------------------------------------ OSM anchors and competition
  const O = facts.osm
  for (const a of ANCHORS) {
    push(`osm.${a.key}`, 'demand_anchors', a.label, O ? O.counts[a.key] ?? 0 : null, 'osm', `OpenStreetMap features: ${a.filters.join(' or ')}. Unmapped features are not counted.`, {
      fmt: ((v: number) => f0(v)) as never,
    })
  }
  if (O) {
    const sc = anchorScore(O.counts, archetype)
    push('osm.anchor_score', 'demand_anchors', `Footfall-anchor score for a ${archetype.label.toLowerCase()}`, sc.score, 'osm', 'Weighted log-scaled counts of the anchors that bring this business’s customers, 0–100.', { fmt: ((v: number) => `${f0(v)} / 100`) as never })
  } else {
    push('osm.anchor_score', 'demand_anchors', 'Footfall-anchor score', null, 'osm', 'Weighted log-scaled anchor counts, 0–100.')
  }
  push('osm.transit', 'demand_anchors', 'Public transport within reach', O ? (O.counts.busStops ?? 0) + (O.counts.busStations ?? 0) + (O.counts.rail ?? 0) > 0 : null, 'osm', 'Any bus stop (500 m), bus stand or railway station (2 km).')
  push('osm.worship_mix', 'demand_anchors', 'Worship places by faith (1 km)', O ? `${O.counts.temples ?? 0} temples · ${O.counts.mosques ?? 0} mosques/dargahs · ${O.counts.churches ?? 0} churches` : null, 'osm', 'Counts by religion tag; untagged places are in the total only.')

  const CO: Dimension = 'competition'
  const hasComp = archetype.competitorFilters.length > 0
  const c500 = O && hasComp ? O.counts.comp500 ?? 0 : null
  const c1k = O && hasComp ? O.counts.comp1000 ?? 0 : null
  const c2k = O && hasComp ? O.counts.comp2000 ?? 0 : null
  const label = archetype.competitorLabel || 'similar businesses'
  push('comp.500', CO, `Mapped ${label} within 500 m`, c500, 'osm', `OpenStreetMap: ${archetype.competitorFilters.join(' or ') || 'not applicable'}.`, { fmt: ((v: number) => f0(v)) as never })
  push('comp.1000', CO, `Mapped ${label} within 1 km`, c1k, 'osm', 'Same filters, 1 km.', { fmt: ((v: number) => f0(v)) as never })
  push('comp.2000', CO, `Mapped ${label} within 2 km`, c2k, 'osm', 'Same filters, 2 km.', { fmt: ((v: number) => f0(v)) as never })
  push('comp.density', CO, 'Competitor density', c1k != null ? c1k / Math.PI : null, 'osm', 'Competitors within 1 km divided by 3.14 km².', { fmt: ((v: number) => `${f1(v)} per km²`) as never })
  const nearest = O?.competitors[0]
  push('comp.nearest', CO, 'Nearest mapped competitor', O && hasComp ? (nearest ? nearest.distanceM : 'None mapped within 2 km') : null, 'osm', 'Straight-line distance.', {
    fmt: ((v: V) => (typeof v === 'number' ? `${f0(v)} m${nearest?.name ? ` (${nearest.name})` : ''}` : String(v))) as never,
  })
  push('comp.per_100_buildings', CO, 'Competitors per 100 mapped buildings (500 m)', c500 != null && O && (O.counts.buildings ?? 0) >= 20 ? (100 * c500) / O.counts.buildings : null, 'osm', 'Saturation proxy. Skipped when fewer than 20 buildings are mapped.', { fmt: ((v: number) => f2(v)) as never })
  push('comp.named_share', CO, 'Share of competitors with a mapped name', O && O.competitors.length ? (100 * O.competitors.filter((c) => c.name).length) / O.competitors.length : null, 'osm', 'Named / all in the competitor list. A low share means thin mapping.', { fmt: ((v: number) => `${f0(v)} %`) as never })
  push('comp.cluster', CO, 'Shops of any kind within 500 m', O ? O.counts.shops ?? 0 : null, 'osm', 'Retail cluster size. Clusters draw shoppers but also split them.', { fmt: ((v: number) => f0(v)) as never })

  // ------------------------------------------------------------ calendar
  const CA: Dimension = 'calendar'
  const tm = facts.tomorrow
  const wdi = weekday(tm)
  const ev = facts.calendar.events
  const inCoverage = tm >= CALENDAR_COVERAGE.from && tm <= CALENDAR_COVERAGE.to
  push('cal.weekday', CA, 'Tomorrow is', `${WEEKDAYS[wdi]}, ${tm}`, 'calendar', 'Local date in India.')
  push('cal.weekend', CA, 'Weekend', wdi === 0 || wdi === 6, 'calendar', 'Saturday or Sunday.')
  const hol = isHoliday(tm, ev)
  push('cal.holiday', CA, 'Gazetted or state holiday', inCoverage ? (hol ? hol.name : 'None') : null, 'calendar', 'DoPT compulsory holidays and listed state holidays.')
  const restricted = ev.filter((e) => e.date === tm && e.kind === 'restricted').map((e) => e.name)
  push('cal.restricted', CA, 'Restricted holidays / festivals', inCoverage ? (restricted.length ? restricted.join(', ') : 'None') : null, 'calendar', 'DoPT restricted holidays (many are major festivals).')
  const fest = festivalSignal(tm, ev, facts.calendar.state)
  push('cal.festival', CA, 'Festival buying window', inCoverage ? (fest.event ? `${fest.event.name} ${fest.daysAway === 0 ? 'is tomorrow' : `in ${(fest.daysAway ?? 0) + 1} days (${fest.event.date})`}` : 'None within 5 days') : null, 'calendar', 'Nearest shopping or food festival within 5 days of tomorrow.')
  const next = facts.calendar.upcoming.find((e) => retailHere(e, facts.calendar.state) && e.date >= tm)
  push('cal.next_festival', CA, 'Next festival', next ? `${next.name}, ${next.date} (${daysBetween(facts.today, next.date)} days)` : inCoverage ? 'None in the next 45 days' : null, 'calendar', 'Next festival in the holiday lists or computed Islamic calendar.')
  const nextHol = facts.calendar.upcoming.find((e) => e.kind === 'national' || e.kind === 'state')
  push('cal.next_holiday', CA, 'Next gazetted holiday', nextHol ? `${nextHol.name}, ${nextHol.date}` : inCoverage ? 'None in the next 45 days' : null, 'calendar', 'DoPT compulsory list and state holidays.')
  const longWeekend = [-1, 0, 1].some((k) => {
    const d = addDays(tm, k)
    const w = weekday(d)
    return isHoliday(d, ev) != null && (w === 1 || w === 5)
  })
  push('cal.long_weekend', CA, 'Long weekend', inCoverage ? longWeekend : null, 'calendar', 'A gazetted holiday on a Monday or Friday next to tomorrow.')
  const dom = Number(tm.slice(8, 10))
  const dim = daysInMonth(tm)
  push('cal.day_of_month', CA, 'Day of the month', dom, 'calendar', 'Calendar day.', { fmt: ((v: number) => `${v} of ${dim}`) as never })
  push('cal.payday', CA, 'Salary and pension week', dom <= 7, 'calendar', 'Days 1–7, when monthly wages and pensions are usually paid.')
  push('cal.month_end', CA, 'Month-end squeeze', dom >= dim - 4, 'calendar', 'Last five days of the month, when household cash is tightest.')
  push('cal.school_day', CA, 'Likely school and office day', inCoverage ? wdi !== 0 && !hol : null, 'calendar', 'Not Sunday and not a gazetted holiday. School vacations are not in the data.')
  const H = hijri(tm)
  push('cal.hijri', CA, 'Islamic date (computed)', H ? hijriLabel(H) : null, 'calendar', 'Umm al-Qura calendar; the Indian date often runs one day later.')
  push('cal.ramadan', CA, 'Ramadan', H ? H.month === 9 : null, 'calendar', 'Computed; subject to moon sighting.')
  if (facts.calendar.nearKalaburagi) {
    const ursActive = ev.some((e) => e.date === tm && e.name.startsWith('Urs'))
    push('cal.urs', CA, 'Urs of Khwaja Bande Nawaz', ursActive ? 'On tomorrow (computed)' : facts.calendar.nextUrs ? `Next: ${facts.calendar.nextUrs} (${daysBetween(facts.today, facts.calendar.nextUrs)} days, computed)` : null, 'calendar', '15–17 Dhu al-Qadah, computed; confirm with the dargah committee.')
  } else {
    push('cal.urs', CA, 'Urs of Khwaja Bande Nawaz', 'Not applicable (more than 15 km from Kalaburagi)', 'calendar', 'Applied only near Kalaburagi.')
  }
  const age = moonAgeDays(tm)
  push('cal.moon', CA, 'Moon phase (approximate)', `${moonPhaseName(age)}, ${f0(100 * moonIllumination(age))} % lit`, 'calendar', 'Mean synodic month from the 6 Jan 2000 new moon; good to about a day.', { reference: 'Purnima and Amavasya shift temple visits and some food habits' })
  const toFull = (14.77 - age + 29.53) % 29.53
  const toNew = (29.53 - age) % 29.53
  push('cal.moon_next', CA, 'Next full moon / new moon', `Full in ~${f0(toFull)} days · New in ~${f0(toNew)} days`, 'calendar', 'Approximate.')
  push('cal.season', CA, 'Season', imdSeason(tm), 'calendar', 'IMD seasons.')
  push('cal.market_day', CA, 'Weekly market (santhe) tomorrow', ctx.marketDay != null ? ctx.marketDay === wdi : null, 'calendar', 'From the market day you entered.')
  push('cal.coverage', 'data_quality', 'Holiday calendar covers tomorrow', inCoverage, 'calendar', `Holiday lists cover ${CALENDAR_COVERAGE.from} to ${CALENDAR_COVERAGE.to}.`)

  // ------------------------------------------------------------ data quality
  const DQ: Dimension = 'data_quality'
  const live = ctx.sources.filter((s) => s.ok).length
  push('dq.sources', DQ, 'Live sources answered', live, 'calendar', 'Sources that returned data this run.', { fmt: ((v: number) => `${v} of ${ctx.sources.length}`) as never })
  push('dq.cached', DQ, 'Sources served from the 3-hour cache', ctx.sources.filter((s) => s.ok && s.cached).length, 'calendar', 'Reused results from an earlier run in this browser.', { fmt: ((v: number) => f0(v)) as never })
  const noonTomorrow = Date.parse(`${tm}T12:00:00+05:30`)
  push('dq.lead', DQ, 'Forecast lead time to tomorrow noon', (noonTomorrow - ctx.now) / 3_600_000, 'forecast', 'Shorter is more reliable.', { fmt: ((v: number) => `${f0(v)} h`) as never })
  const bld = O?.counts.buildings
  push('dq.osm_density', DQ, 'Map detail around the spot', bld != null ? bld : null, 'osm', 'Mapped buildings within 500 m.', {
    fmt: ((v: number) => `${f0(v)} buildings, ${v < 20 ? 'sparse: counts understate what is there' : v < 200 ? 'partial' : 'detailed'}`) as never,
  })
  return out
}
