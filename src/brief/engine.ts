/**
 * Decision engine. Turns facts into driver signals, scores each day, and returns a verdict.
 *
 *   signal  s ∈ [-1, 1]  what the world is doing (hotter, wetter, festival nearer…)
 *   weight  w ∈ [-1, 1]  how this kind of business responds to that signal
 *   index   = 50 + 50 · tanh( Σ w·s / 2 )           (0..100, 50 = an ordinary day)
 *   verdict = push ≥ 65 · normal 35–64 · protect < 35
 *
 * Drivers whose data is missing are left out of the sum, not set to zero, and the brief's
 * confidence drops by the weight they would have carried.
 */
import type { Archetype } from './archetypes'
import { CALENDAR_COVERAGE, daysInMonth, hijri, weekday, WEEKDAYS } from './calendar'
import { festivalSignal, isHoliday, ursOn, type DayFacts, type Facts } from './facts'
import { clamp, moonAgeDays } from './formulas'
import { anchorScore } from './metrics'
import { ursStrength } from './kalaburagi'
import type { DayOutlook, DriverId, DriverValue, Verdict } from './types'

export const DRIVER_LABELS: Record<DriverId, string> = {
  heat: 'Heat',
  rain: 'Rain',
  outdoor_comfort: 'Comfortable hours outdoors',
  air_quality: 'Clean air',
  festival: 'Festival buying',
  weekend_holiday: 'Weekend or holiday',
  payday: 'Salary week',
  religious_gathering: 'Religious gathering',
  climate_anomaly: 'Warmer than normal',
  field_conditions: 'Field-work conditions',
  market_day: 'Weekly market day',
  local_events: 'Events in the local news',
}

const ORDER: DriverId[] = [
  'heat',
  'rain',
  'outdoor_comfort',
  'air_quality',
  'festival',
  'weekend_holiday',
  'payday',
  'religious_gathering',
  'climate_anomaly',
  'field_conditions',
  'market_day',
  'local_events',
]

export const TANH_SCALE = 2
export const PUSH_AT = 65
export const PROTECT_BELOW = 35

interface Signal {
  signal: number | null
  basis: string[]
  explanation: string
}

const f1 = (n: number) => n.toFixed(1)

export function signalsFor(facts: Facts, d: DayFacts | null, date: string, marketDay: number | undefined, isTomorrow: boolean): Record<DriverId, Signal> {
  const ev = facts.calendar.events
  const inCal = date >= CALENDAR_COVERAGE.from && date <= CALENDAR_COVERAGE.to
  const wd = weekday(date)
  const dom = Number(date.slice(8, 10))
  const dim = daysInMonth(date)
  const normal = facts.normals.get(date)
  const out = {} as Record<DriverId, Signal>

  out.heat =
    d?.feelsMax != null
      ? { signal: clamp((d.feelsMax - 33) / 7, -1, 1), basis: ['wx.feels_max', 'wx.heat_index'], explanation: `Feels-like maximum ${f1(d.feelsMax)} °C (33 °C is neutral, 40 °C is full strength).` }
      : { signal: null, basis: ['wx.feels_max'], explanation: 'Forecast unavailable.' }

  const p = d ? (d.rainProbTrading ?? d.rainProbMax) : null
  out.rain =
    d && (p != null || d.rainMm != null)
      ? {
          signal: clamp(0.6 * ((p ?? 0) / 100) + 0.4 * Math.min(1, (d.rainMm ?? 0) / 20), 0, 1),
          basis: ['wx.rain_prob_trading', 'wx.rain_mm'],
          explanation: `Rain chance in trading hours ${p != null ? `${Math.round(p)} %` : 'unknown'}, ${f1(d.rainMm ?? 0)} mm expected.`,
        }
      : { signal: null, basis: ['wx.rain_prob_trading'], explanation: 'Forecast unavailable.' }

  out.outdoor_comfort =
    d?.comfortableHours != null
      ? { signal: clamp((d.comfortableHours - 9) / 6, -1, 1), basis: ['wx.comfort_hours'], explanation: `${d.comfortableHours} of 15 trading hours are comfortable outdoors (9 is an ordinary day).` }
      : { signal: null, basis: ['wx.comfort_hours'], explanation: 'Hourly forecast unavailable.' }

  out.air_quality =
    isTomorrow && facts.air?.pm25Mean != null
      ? { signal: clamp(1 - facts.air.pm25Mean / 60, -1, 1), basis: ['air.pm25', 'air.naqi'], explanation: `PM2.5 ${Math.round(facts.air.pm25Mean)} µg/m³ against the 60 µg/m³ standard.` }
      : { signal: null, basis: ['air.pm25'], explanation: isTomorrow ? 'Air-quality forecast unavailable.' : 'Air quality is forecast for tomorrow only.' }

  const fest = festivalSignal(date, ev, facts.calendar.state)
  out.festival = inCal
    ? {
        signal: fest.signal,
        basis: ['cal.festival', 'cal.next_festival'],
        explanation: fest.event ? `${fest.event.name} ${fest.daysAway === 0 ? 'falls on this day' : `is ${fest.daysAway} day${fest.daysAway === 1 ? '' : 's'} after this day`}.` : 'No festival within 5 days.',
      }
    : { signal: null, basis: ['cal.coverage'], explanation: 'Holiday lists do not cover this date.' }

  const hol = isHoliday(date, ev)
  const wh = Math.max(wd === 0 ? 1 : wd === 6 ? 0.5 : 0, hol ? 1 : 0)
  out.weekend_holiday = {
    signal: wh,
    basis: ['cal.weekend', 'cal.holiday'],
    explanation: hol ? `${hol.name} (gazetted holiday).` : wd === 0 ? 'Sunday.' : wd === 6 ? 'Saturday.' : `${WEEKDAYS[wd]}, a working day.`,
  }

  out.payday = {
    signal: dom <= 7 ? 1 : dom >= dim - 4 ? -0.5 : 0,
    basis: ['cal.payday', 'cal.month_end'],
    explanation: dom <= 7 ? `Day ${dom}: salaries and pensions have just been paid.` : dom >= dim - 4 ? `Day ${dom} of ${dim}: month-end, cash is tight.` : `Day ${dom}: mid-month.`,
  }

  const counts = facts.osm?.counts
  const parts: Array<{ v: number; why: string; id: string }> = []
  if (ursOn(date)) {
    const v = ursStrength(facts.calendar.distanceFromCityKm ?? 999)
    parts.push({ v, why: v === 1 ? 'Urs of Khwaja Bande Nawaz in the city (computed date).' : 'Urs of Khwaja Bande Nawaz: pilgrims travel through the district (computed date).', id: 'cal.urs' })
  }
  const h = hijri(date)
  if (h?.month === 9) parts.push({ v: 0.4, why: 'Ramadan: evening iftar buying (computed date).', id: 'cal.ramadan' })
  if (wd === 5 && (counts?.mosques ?? 0) > 0) parts.push({ v: 0.3, why: `Friday prayers at ${counts?.mosques} mosque(s) within 1 km.`, id: 'osm.mosques' })
  const age = moonAgeDays(date)
  const moonDay = age < 1.5 || age > 28 || (age >= 14 && age < 16)
  if (moonDay && (counts?.temples ?? 0) > 0) parts.push({ v: 0.25, why: `Around Purnima/Amavasya, with ${counts?.temples} temple(s) within 1 km.`, id: 'osm.temples' })
  const top = parts.sort((a, b) => b.v - a.v)[0]
  out.religious_gathering = top
    ? { signal: top.v, basis: [top.id, 'cal.moon'], explanation: top.why }
    : { signal: 0, basis: ['cal.urs', 'cal.hijri', 'cal.moon'], explanation: 'No gathering found in the calendar for this day.' }

  out.climate_anomaly =
    d?.tMax != null && normal?.normTmax != null
      ? { signal: clamp((d.tMax - normal.normTmax) / 4, -1, 1), basis: ['cl.anom_tmax', 'cl.norm_tmax'], explanation: `${d.tMax - normal.normTmax >= 0 ? '+' : ''}${f1(d.tMax - normal.normTmax)} °C against the 10-year normal of ${f1(normal.normTmax)} °C.` }
      : { signal: null, basis: ['cl.anom_tmax'], explanation: 'Climate normal or forecast unavailable.' }

  out.field_conditions =
    d?.fieldHours != null
      ? {
          signal: clamp((2 * d.fieldHours) / 13 - 1 - ((d.rainMm ?? 0) >= 15 ? 0.5 : 0), -1, 1),
          basis: ['crop.field_hours', 'wx.rain_mm'],
          explanation: `${d.fieldHours} of 13 daylight hours are workable${(d.rainMm ?? 0) >= 15 ? ', and heavy rain will waterlog fields' : ''}.`,
        }
      : { signal: null, basis: ['crop.field_hours'], explanation: 'Hourly forecast unavailable.' }

  if (!facts.pulse) {
    out.local_events = { signal: null, basis: ['pulse.posts'], explanation: 'The local news pulse is not available.' }
  } else {
    const on = facts.pulse.events.filter((e) => e.date != null && e.kind !== 'notice' && e.date <= date && (e.endDate ?? e.date) >= date)
    const val = (k: string) => (k === 'gathering' ? 0.6 : k === 'disruption' ? -0.6 : k === 'offer' ? 0.15 : 0)
    const sum = on.reduce((a, e) => a + val(e.kind), 0)
    out.local_events = {
      signal: clamp(sum, -1, 1),
      basis: ['pulse.events', 'pulse.posts'],
      explanation: on.length
        ? `Announced for this day: ${on.slice(0, 3).map((e) => `${e.title} (${e.kind}, ${e.channelName})`).join('; ')}.`
        : 'No event announced for this day in the posts collected.',
    }
  }

  out.market_day =
    marketDay != null
      ? { signal: marketDay === wd ? 1 : 0, basis: ['cal.market_day'], explanation: marketDay === wd ? 'Weekly market (santhe) day.' : `Not the market day (${WEEKDAYS[marketDay]}).` }
      : { signal: null, basis: ['cal.market_day'], explanation: 'Market day not entered.' }

  return out
}

export function score(signals: Record<DriverId, Signal>, archetype: Archetype): { index: number | null; drivers: DriverValue[]; weightShare: number } {
  let sum = 0
  let used = 0
  let total = 0
  const drivers: DriverValue[] = ORDER.map((id) => {
    const s = signals[id]
    const w = archetype.weights[id]
    // Market day only counts when the user told us theirs.
    if (!(id === 'market_day' && s.signal == null)) total += Math.abs(w)
    const contribution = s.signal != null ? w * s.signal : 0
    if (s.signal != null && w !== 0) {
      sum += contribution
      used += Math.abs(w)
    }
    return { id, label: DRIVER_LABELS[id], signal: s.signal, weight: w, contribution, basis: s.basis, explanation: s.explanation }
  })
  const index = used > 0 ? 50 + 50 * Math.tanh(sum / TANH_SCALE) : null
  return { index, drivers, weightShare: total > 0 ? used / total : 0 }
}

export function verdictOf(index: number | null): Verdict | null {
  if (index == null) return null
  if (index >= PUSH_AT) return 'push'
  if (index < PROTECT_BELOW) return 'protect'
  return 'normal'
}

/** Weather severe enough that an outdoor stall should protect itself whatever demand says. */
export function severeWeather(d: DayFacts | null): string | null {
  if (!d) return null
  if ((d.rainMm ?? 0) >= 64.5) return `heavy rain (${f1(d.rainMm ?? 0)} mm, IMD "heavy")`
  if ((d.gustMax ?? 0) >= 60) return `damaging gusts up to ${Math.round(d.gustMax ?? 0)} km/h`
  if ((d.heatIndexMax ?? 0) >= 54) return `extreme heat (heat index ${f1(d.heatIndexMax ?? 0)} °C)`
  return null
}

const CLUSTER_FRIENDLY = new Set(['clothing', 'sweets_bakery', 'mobile_electronics', 'hardware', 'restaurant_meals', 'street_food', 'general_retail', 'fruit_vegetable'])

/** 0..100: footfall anchors, discounted for nearby competition. Not part of tomorrow's index. */
export function locationStrength(facts: Facts, archetype: Archetype): { value: number | null; basis: string[] } {
  if (!facts.osm) return { value: null, basis: ['osm.anchor_score'] }
  const anchors = anchorScore(facts.osm.counts, archetype).score
  if (!archetype.competitorFilters.length) return { value: anchors, basis: ['osm.anchor_score'] }
  const c500 = facts.osm.counts.comp500 ?? 0
  const pressure = Math.min(1, Math.log1p(c500) / Math.log1p(12))
  const factor = CLUSTER_FRIENDLY.has(archetype.id) ? 0.4 : 1
  return { value: clamp(anchors * (1 - 0.35 * pressure * factor), 0, 100), basis: ['osm.anchor_score', 'comp.500'] }
}

export function outlook(facts: Facts, archetype: Archetype, marketDay: number | undefined): DayOutlook[] {
  return facts.days.map((d, i) => {
    const sig = signalsFor(facts, d, d.date, marketDay, i === 0)
    const { index } = score(sig, archetype)
    const tags: string[] = []
    const hol = isHoliday(d.date, facts.calendar.events)
    if (hol) tags.push(hol.name)
    const fest = festivalSignal(d.date, facts.calendar.events, facts.calendar.state)
    if (fest.event && fest.daysAway && fest.daysAway > 0) tags.push(`${fest.daysAway}d to ${fest.event.name}`)
    if (ursOn(d.date)) tags.push('Urs')
    if (marketDay != null && marketDay === weekday(d.date)) tags.push('Market day')
    if ((d.rainProbTrading ?? 0) >= 60 || (d.rainMm ?? 0) >= 15.6) tags.push(`Rain ${Math.round(d.rainProbTrading ?? d.rainProbMax ?? 0)}%`)
    if ((d.feelsMax ?? 0) >= 38) tags.push(`Hot ${Math.round(d.feelsMax ?? 0)}°`)
    if (d.thunder) tags.push('Thunder')
    let verdict = verdictOf(index)
    if (archetype.traits.outdoorStall && severeWeather(d)) verdict = 'protect'
    return { date: d.date, index, verdict, tags }
  })
}

const VERDICT_WORD: Record<Verdict, string> = { push: 'Push', normal: 'Run a normal day', protect: 'Protect' }
const PRODUCER_WORD: Record<Verdict, string> = {
  push: 'Good working day tomorrow.',
  normal: 'An ordinary working day tomorrow.',
  protect: 'Protect your crop and animals tomorrow.',
}

/** How each driver reads in a sentence, by the sign of its signal. */
const PHRASE: Record<DriverId, [string, string]> = {
  heat: ['the heat', 'the cool weather'],
  rain: ['rain', 'dry weather'],
  outdoor_comfort: ['comfortable weather', 'few comfortable hours outdoors'],
  air_quality: ['clean air', 'poor air'],
  festival: ['the coming festival', 'the festival calendar'],
  weekend_holiday: ['the weekend or holiday', 'a working day'],
  payday: ['salary week', 'the month-end cash squeeze'],
  religious_gathering: ['the religious gathering', 'the religious calendar'],
  climate_anomaly: ['unusually hot weather for the season', 'cooler weather than usual'],
  field_conditions: ['good field conditions', 'poor field conditions'],
  market_day: ['market day', 'no market'],
  local_events: ['events in the local news', 'disruptions in the local news'],
}

export function phrase(d: DriverValue): string {
  return PHRASE[d.id][(d.signal ?? 0) >= 0 ? 0 : 1]
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function headline(verdict: Verdict | null, drivers: DriverValue[], severe: string | null, archetype: Archetype): string {
  if (!verdict) return 'Not enough live data to call tomorrow. See which sources failed below.'
  const ups = drivers.filter((d) => d.contribution > 0.05).sort((a, b) => b.contribution - a.contribution)
  const downs = drivers.filter((d) => d.contribution < -0.05).sort((a, b) => a.contribution - b.contribution)
  const lift = ups.slice(0, 2).map(phrase)
  const drag = downs.slice(0, 2).map(phrase)
  const producer = !!(archetype.traits.farm || archetype.traits.livestock)
  const who = producer ? 'the day' : 'demand'
  const parts: string[] = [producer ? PRODUCER_WORD[verdict] : `${VERDICT_WORD[verdict]} tomorrow.`]
  if (severe && verdict === 'protect') parts.push(`Severe weather: ${severe}.`)
  if (lift.length) parts.push(`${cap(lift.join(' and '))} ${lift.length > 1 ? 'lift' : 'lifts'} ${who}${drag.length ? ';' : '.'}`)
  if (drag.length) parts.push(`${lift.length ? drag.join(' and ') : cap(drag.join(' and '))} ${drag.length > 1 ? 'hold it back' : 'holds it back'}.`)
  if (!lift.length && !drag.length) parts.push('No strong signal either way.')
  return parts.join(' ')
}
