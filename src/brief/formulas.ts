/**
 * Published formulas and reference bands the brief uses. Pure functions, unit-tested.
 * Each one names where it comes from so a reader can check it.
 */

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
export { clamp }

/** Heat index (°C) from air temperature (°C) and relative humidity (%). NOAA/NWS Rothfusz regression. */
export function heatIndexC(tC: number, rh: number): number {
  const T = tC * 1.8 + 32
  const simple = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094)
  let hi = simple
  if ((simple + T) / 2 >= 80) {
    hi =
      -42.379 +
      2.04901523 * T +
      10.14333127 * rh -
      0.22475541 * T * rh -
      0.00683783 * T * T -
      0.05481717 * rh * rh +
      0.00122874 * T * T * rh +
      0.00085282 * T * rh * rh -
      0.00000199 * T * T * rh * rh
    if (rh < 13 && T >= 80 && T <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17)
    else if (rh > 85 && T >= 80 && T <= 87) hi += ((rh - 85) / 10) * ((87 - T) / 5)
  }
  return (hi - 32) / 1.8
}

/** NOAA heat index bands. */
export function heatIndexBand(hiC: number): string {
  if (hiC >= 54) return 'extreme danger'
  if (hiC >= 41) return 'danger'
  if (hiC >= 32) return 'extreme caution'
  if (hiC >= 27) return 'caution'
  return 'no heat risk'
}

/** Humidex (Environment Canada), from temperature and dew point in °C. */
export function humidex(tC: number, dewC: number): number {
  const e = 6.11 * Math.exp(5417.753 * (1 / 273.16 - 1 / (273.15 + dewC)))
  return tC + 0.5555 * (e - 10)
}

/** Water vapour pressure (hPa) from temperature (°C) and RH (%). */
export function vapourPressureHpa(tC: number, rh: number): number {
  return (rh / 100) * 6.105 * Math.exp((17.27 * tC) / (237.7 + tC))
}

/**
 * Wet-bulb globe temperature estimate for shade and light wind, Australian Bureau of Meteorology
 * approximation: WBGT = 0.567 T + 0.393 e + 3.94. Sun exposure adds roughly 2 to 3 °C more.
 */
export function wbgtShadeC(tC: number, rh: number): number {
  return 0.567 * tC + 0.393 * vapourPressureHpa(tC, rh) + 3.94
}

/** US Army TB MED 507 flag bands (°C). */
export function wbgtBand(w: number): string {
  if (w >= 31.1) return 'black flag'
  if (w >= 29.4) return 'red flag'
  if (w >= 27.8) return 'yellow flag'
  if (w >= 26.7) return 'green flag'
  return 'below flag thresholds'
}

/** Wet-bulb temperature (°C), Stull (2011) empirical formula; valid roughly RH 5 to 99 %, T −20 to 50 °C. */
export function wetBulbC(tC: number, rh: number): number {
  return (
    tC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(tC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  )
}

/** Temperature-humidity index for cattle (NRC 1971 form). */
export function thi(tC: number, rh: number): number {
  return 1.8 * tC + 32 - (0.55 - 0.0055 * rh) * (1.8 * tC - 26)
}

/** Cattle heat-stress bands after Armstrong (1994). Many now treat 68 as the onset for high-yield cows. */
export function thiBand(v: number): string {
  if (v >= 89) return 'severe stress'
  if (v >= 79) return 'moderate stress'
  if (v >= 72) return 'mild stress'
  if (v >= 68) return 'stress onset for high-yield cows'
  return 'no stress'
}

/** Growing degree days, simple averaging method. */
export function gdd(tMax: number, tMin: number, base = 10): number {
  return Math.max(0, (tMax + tMin) / 2 - base)
}

/** WHO UV index categories. */
export function uvBand(uv: number): string {
  if (uv >= 11) return 'extreme'
  if (uv >= 8) return 'very high'
  if (uv >= 6) return 'high'
  if (uv >= 3) return 'moderate'
  return 'low'
}

/** IMD daily rainfall categories (mm in 24 h). */
export function imdRainCategory(mm: number): string {
  if (mm >= 204.5) return 'extremely heavy'
  if (mm >= 115.6) return 'very heavy'
  if (mm >= 64.5) return 'heavy'
  if (mm >= 15.6) return 'moderate'
  if (mm >= 2.5) return 'light'
  if (mm >= 0.1) return 'very light'
  return 'no rain'
}

/** IMD categories for rainfall departure from normal over a period (%). */
export function imdDepartureCategory(pct: number): string {
  if (pct >= 60) return 'large excess'
  if (pct >= 20) return 'excess'
  if (pct > -20) return 'normal'
  if (pct > -60) return 'deficient'
  if (pct > -100) return 'large deficient'
  return 'no rain'
}

/** Dew-point comfort bands commonly used by weather services. */
export function dewPointBand(d: number): string {
  if (d >= 24) return 'oppressive'
  if (d >= 20) return 'very humid'
  if (d >= 16) return 'humid'
  if (d >= 10) return 'comfortable'
  return 'dry'
}

/** CPCB National AQI breakpoints for PM2.5 and PM10 (24-hour average, µg/m³). */
const NAQI_BANDS = [
  { lo: 0, hi: 50, label: 'Good' },
  { lo: 51, hi: 100, label: 'Satisfactory' },
  { lo: 101, hi: 200, label: 'Moderate' },
  { lo: 201, hi: 300, label: 'Poor' },
  { lo: 301, hi: 400, label: 'Very poor' },
  { lo: 401, hi: 500, label: 'Severe' },
]
const PM25_BP = [0, 30, 60, 90, 120, 250, 380]
const PM10_BP = [0, 50, 100, 250, 350, 430, 510]

/** Piecewise-linear sub-index, treating the CPCB bands as continuous segments. */
function subIndex(c: number, bp: number[]): number {
  const idx = [0, 50, 100, 200, 300, 400, 500]
  for (let i = 0; i < 6; i++) {
    if (c <= bp[i + 1] || i === 5) {
      const v = idx[i] + ((idx[i + 1] - idx[i]) * (c - bp[i])) / (bp[i + 1] - bp[i])
      return Math.min(500, Math.max(0, v))
    }
  }
  return 500
}

/** India's National AQI from PM only (the other pollutants are not forecast here). */
export function indianAqiFromPm(pm25: number | null, pm10: number | null): number | null {
  const parts = [pm25 != null ? subIndex(pm25, PM25_BP) : null, pm10 != null ? subIndex(pm10, PM10_BP) : null].filter(
    (x): x is number => x != null,
  )
  return parts.length ? Math.round(Math.max(...parts)) : null
}

export function naqiBand(aqi: number): string {
  return (NAQI_BANDS.find((b) => aqi <= b.hi) ?? NAQI_BANDS[5]).label
}

/** US EPA AQI categories. */
export function usAqiBand(aqi: number): string {
  if (aqi > 300) return 'Hazardous'
  if (aqi > 200) return 'Very unhealthy'
  if (aqi > 150) return 'Unhealthy'
  if (aqi > 100) return 'Unhealthy for sensitive groups'
  if (aqi > 50) return 'Moderate'
  return 'Good'
}

/**
 * Approximate moon phase from the mean synodic month (29.530588853 days) and the new moon of
 * 6 January 2000, 18:14 UTC. Good to about a day, which is why the brief labels it approximate.
 */
export function moonAgeDays(iso: string): number {
  const SYNODIC = 29.530588853
  const ref = Date.UTC(2000, 0, 6, 18, 14)
  const t = Date.parse(`${iso}T12:00:00Z`)
  const age = ((t - ref) / 86_400_000) % SYNODIC
  return age < 0 ? age + SYNODIC : age
}

export function moonIllumination(age: number): number {
  return (1 - Math.cos((2 * Math.PI * age) / 29.530588853)) / 2
}

export function moonPhaseName(age: number): string {
  if (age < 1.5 || age > 28) return 'New moon (around Amavasya)'
  if (age < 7) return 'Waxing crescent'
  if (age < 8.5) return 'First quarter'
  if (age < 14) return 'Waxing gibbous'
  if (age < 16) return 'Full moon (around Purnima)'
  if (age < 22) return 'Waning gibbous'
  if (age < 23.5) return 'Last quarter'
  return 'Waning crescent'
}

/** Population standard deviation. */
export function sd(xs: number[]): number {
  if (xs.length < 2) return 0
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
}

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

/** Share of values strictly below x, 0..100. */
export function percentileOf(xs: number[], x: number): number {
  if (!xs.length) return 50
  const below = xs.filter((v) => v < x).length
  const equal = xs.filter((v) => v === x).length
  return (100 * (below + equal / 2)) / xs.length
}

/** Least-squares slope per step. */
export function slope(ys: number[]): number {
  const n = ys.length
  if (n < 2) return 0
  const xm = (n - 1) / 2
  const ym = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  ys.forEach((y, i) => {
    num += (i - xm) * (y - ym)
    den += (i - xm) ** 2
  })
  return den ? num / den : 0
}

/** WMO weather interpretation codes used by Open-Meteo. */
export const WMO_TEXT: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
}
