/**
 * SYNTHETIC TEST DATA. NOT REAL WEATHER, AIR, RIVER OR MAP DATA.
 *
 * Shaped exactly like the public APIs' JSON so the parsers and the engine can be tested
 * offline. Values follow a simple diurnal cycle with knobs for heat and rain. Never imported
 * by app code: only by *.test.ts files.
 */
import type { FetchLike } from './sources'

export interface SyntheticWeather {
  /** First date in the response (the API's past_days start). */
  start: string
  days: number
  tMax: number
  tMin: number
  rh: number
  /** Rain probability (%) applied 14:00–20:00 on rainy days. */
  rainProb: number
  rainMmPerHour: number
  rainyDates: string[]
  wind: number
}

function datesFrom(start: string, n: number): string[] {
  const out: string[] = []
  const d = new Date(`${start}T12:00:00Z`)
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

export function syntheticForecast(w: SyntheticWeather) {
  const dates = datesFrom(w.start, w.days)
  const hourly: Record<string, Array<number | null>> & { time: string[] } = {
    time: [],
    temperature_2m: [],
    apparent_temperature: [],
    relative_humidity_2m: [],
    dew_point_2m: [],
    precipitation_probability: [],
    precipitation: [],
    weather_code: [],
    cloud_cover: [],
    wind_speed_10m: [],
    wind_gusts_10m: [],
    uv_index: [],
    is_day: [],
    cape: [],
  }
  const daily: Record<string, Array<number | string | null>> & { time: string[] } = {
    time: dates,
    weather_code: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    apparent_temperature_max: [],
    apparent_temperature_min: [],
    precipitation_sum: [],
    precipitation_hours: [],
    precipitation_probability_max: [],
    wind_speed_10m_max: [],
    wind_gusts_10m_max: [],
    uv_index_max: [],
    sunshine_duration: [],
    daylight_duration: [],
    shortwave_radiation_sum: [],
    et0_fao_evapotranspiration: [],
    sunrise: [],
    sunset: [],
  }
  for (const d of dates) {
    const rainy = w.rainyDates.includes(d)
    let rainSum = 0
    let rainHours = 0
    for (let h = 0; h < 24; h++) {
      // Coolest at 06:00, hottest at 15:00.
      const phase = Math.cos(((h - 15) / 24) * 2 * Math.PI)
      const t = w.tMin + ((w.tMax - w.tMin) * (phase + 1)) / 2
      const rh = Math.max(15, Math.min(98, w.rh - (t - w.tMin) * 2))
      const wet = rainy && h >= 14 && h <= 20
      const precip = wet ? w.rainMmPerHour : 0
      rainSum += precip
      if (precip > 0) rainHours++
      hourly.time.push(`${d}T${String(h).padStart(2, '0')}:00`)
      hourly.temperature_2m.push(+t.toFixed(1))
      hourly.apparent_temperature.push(+(t + (rh > 50 ? 2 : 0)).toFixed(1))
      hourly.relative_humidity_2m.push(Math.round(rh))
      hourly.dew_point_2m.push(+(t - (100 - rh) / 5).toFixed(1))
      hourly.precipitation_probability.push(wet ? w.rainProb : 5)
      hourly.precipitation.push(precip)
      hourly.weather_code.push(wet ? 63 : 1)
      hourly.cloud_cover.push(wet ? 90 : 20)
      hourly.wind_speed_10m.push(w.wind)
      hourly.wind_gusts_10m.push(w.wind * 1.8)
      hourly.uv_index.push(h >= 7 && h <= 17 ? Math.max(0, 10 * Math.sin(((h - 6) / 12) * Math.PI)) : 0)
      hourly.is_day.push(h >= 6 && h <= 18 ? 1 : 0)
      hourly.cape.push(wet ? 1500 : 200)
    }
    daily.weather_code.push(rainy ? 63 : 1)
    daily.temperature_2m_max.push(w.tMax)
    daily.temperature_2m_min.push(w.tMin)
    daily.apparent_temperature_max.push(w.tMax + 2)
    daily.apparent_temperature_min.push(w.tMin)
    daily.precipitation_sum.push(+rainSum.toFixed(1))
    daily.precipitation_hours.push(rainHours)
    daily.precipitation_probability_max.push(rainy ? w.rainProb : 5)
    daily.wind_speed_10m_max.push(w.wind)
    daily.wind_gusts_10m_max.push(w.wind * 1.8)
    daily.uv_index_max.push(10)
    daily.sunshine_duration.push(rainy ? 3 * 3600 : 9 * 3600)
    daily.daylight_duration.push(11.6 * 3600)
    daily.shortwave_radiation_sum.push(rainy ? 12 : 20)
    daily.et0_fao_evapotranspiration.push(rainy ? 3 : 5.5)
    daily.sunrise.push(`${d}T06:15`)
    daily.sunset.push(`${d}T18:05`)
  }
  return { hourly, daily }
}

export function syntheticArchive(today: string, tMaxNormal: number) {
  const y = Number(today.slice(0, 4))
  const dates = datesFrom(`${y - 10}-01-01`, 365 * 10 + 3)
  return {
    daily: {
      time: dates,
      // A gentle seasonal cycle plus a deterministic wobble so the spread is non-zero.
      temperature_2m_max: dates.map((_, i) => +(tMaxNormal + ((i * 7919) % 11) / 5 - 1).toFixed(1)),
      temperature_2m_min: dates.map((_, i) => +(tMaxNormal - 12 + ((i * 104729) % 7) / 5).toFixed(1)),
      precipitation_sum: dates.map((_, i) => (i % 9 === 0 ? 6 : 0)),
    },
  }
}

export function syntheticAir(start: string, days: number, pm25: number) {
  const dates = datesFrom(start, days)
  const time = dates.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`))
  return {
    hourly: {
      time,
      pm2_5: time.map(() => pm25),
      pm10: time.map(() => pm25 * 1.8),
      us_aqi: time.map(() => Math.round(pm25 * 2)),
      ozone: time.map(() => 60),
      dust: time.map(() => 10),
    },
  }
}

export function syntheticSoil(start: string, days: number) {
  const dates = datesFrom(start, days)
  const time = dates.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`))
  return {
    hourly: {
      time,
      soil_moisture_0_to_1cm: time.map(() => 0.12),
      soil_moisture_3_to_9cm: time.map(() => 0.14),
      soil_moisture_27_to_81cm: time.map(() => 0.22),
      soil_temperature_6cm: time.map(() => 30),
      vapour_pressure_deficit: time.map(() => 2.1),
    },
  }
}

export function syntheticRiver(start: string, days: number, ratio: number) {
  const time = datesFrom(start, days)
  return { daily: { time, river_discharge: time.map(() => 40 * ratio), river_discharge_median: time.map(() => 40), river_discharge_max: time.map(() => 60 * ratio) } }
}

/** Overpass "out count" answer for a query with `n` statements. */
export function syntheticOverpassCounts(totals: number[]) {
  return { elements: totals.map((t, i) => ({ type: 'count', id: i, tags: { total: String(t), nodes: String(t), ways: '0', relations: '0' } })) }
}

export interface Router {
  forecast?: unknown
  soil?: unknown
  archive?: unknown
  air?: unknown
  flood?: unknown
  elevation?: unknown
  overpassCounts?: (statements: number) => unknown
  overpassList?: unknown
  fail?: Partial<Record<'forecast' | 'soil' | 'archive' | 'air' | 'flood' | 'elevation' | 'overpass', number>>
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** A fetch stand-in that answers each public API with the synthetic data above. */
export function routerFetch(r: Router): FetchLike {
  return async (url: string, init?: RequestInit) => {
    const fail = (k: keyof NonNullable<Router['fail']>) => (r.fail?.[k] ? json({ error: true, reason: 'synthetic failure' }, r.fail[k]) : null)
    if (url.includes('overpass')) {
      const f = fail('overpass')
      if (f) return f
      const body = decodeURIComponent(String(init?.body ?? '').replace(/^data=/, ''))
      if (body.includes('out count')) return json(r.overpassCounts?.((body.match(/out count;/g) ?? []).length) ?? { elements: [] })
      return json(r.overpassList ?? { elements: [] })
    }
    if (url.includes('archive-api')) return fail('archive') ?? json(r.archive)
    if (url.includes('air-quality-api')) return fail('air') ?? json(r.air)
    if (url.includes('flood-api')) return fail('flood') ?? json(r.flood)
    if (url.includes('/v1/elevation')) return fail('elevation') ?? json(r.elevation ?? { elevation: [454] })
    if (url.includes('soil_moisture')) return fail('soil') ?? json(r.soil)
    if (url.includes('api.open-meteo.com/v1/forecast')) return fail('forecast') ?? json(r.forecast)
    return json({ error: true, reason: `unrouted ${url}` }, 404)
  }
}
