// Tests for the Daily Business Brief. All weather, air, river and map inputs here are
// SYNTHETIC (see fixtures.test-data.ts); only the formulas are checked against published values.
import { describe, expect, it } from 'vitest'
import { matchArchetype } from './archetypes'
import { addDays, eventsBetween, findHijri, hijri, HOLIDAYS, retailHere, todayInIndia } from './calendar'
import { districtQuery, inKalaburagiDistrict, kalaburagiEventsBetween, ursStrength } from './kalaburagi'
import { buildFacts, festivalSignal } from './facts'
import {
  heatIndexC,
  imdDepartureCategory,
  imdRainCategory,
  indianAqiFromPm,
  moonAgeDays,
  percentileOf,
  thi,
  wetBulbC,
} from './formulas'
import * as F from './fixtures.test-data'
import { runBrief } from './runBrief'
import { buildCountQuery, fetchJson, fetchOsm, parseCounts } from './sources'
import type { Place } from './types'

const KALABURAGI: Place = { query: 'Kalaburagi', displayName: 'Kalaburagi, Karnataka, India', lat: 17.3297, lng: 76.8343, district: 'Kalaburagi', state: 'Karnataka', cached: false }
const MYSURU: Place = { query: 'Mysuru', displayName: 'Mysuru, Karnataka, India', lat: 12.2958, lng: 76.6394, district: 'Mysuru', state: 'Karnataka', cached: false }
const ALAND: Place = { query: 'Aland', displayName: 'Aland, Kalaburagi, Karnataka, India', lat: 17.5642, lng: 76.5688, district: 'Kalaburagi', state: 'Karnataka', cached: false }

function world(today: string, w: Partial<F.SyntheticWeather> = {}, extra: Partial<F.Router> = {}) {
  const start = addDays(today, -7)
  return F.routerFetch({
    forecast: F.syntheticForecast({ start, days: 23, tMax: 33, tMin: 22, rh: 60, rainProb: 80, rainMmPerHour: 3, rainyDates: [], wind: 9, ...w }),
    soil: F.syntheticSoil(today, 8),
    archive: F.syntheticArchive(today, 33),
    air: F.syntheticAir(today, 3, 30),
    flood: F.syntheticRiver(today, 16, 1),
    overpassCounts: (n) => F.syntheticOverpassCounts(Array.from({ length: n }, (_, i) => (i * 5) % 9)),
    overpassList: { elements: [{ type: 'node', lat: 17.3304, lon: 76.8349, tags: { amenity: 'ice_cream', name: 'Synthetic Cool Corner' } }] },
    ...extra,
  })
}

const at = (today: string) => Date.parse(`${today}T20:00:00+05:30`)

describe('formulas match published reference values', () => {
  it('heat index: 35 °C at 50 % RH is about 41 °C (NOAA table: 95 °F, 50 % → 105 °F)', () => {
    expect(heatIndexC(35, 50)).toBeGreaterThan(40)
    expect(heatIndexC(35, 50)).toBeLessThan(41.5)
  })
  it('wet bulb: Stull (2011) worked example, 20 °C and 50 % RH → 13.7 °C', () => {
    expect(wetBulbC(20, 50)).toBeCloseTo(13.7, 1)
  })
  it('THI: 30 °C at 60 % RH ≈ 79.8 (moderate stress)', () => {
    expect(thi(30, 60)).toBeCloseTo(79.84, 1)
  })
  it('Indian AQI from PM follows the CPCB breakpoints', () => {
    expect(indianAqiFromPm(30, null)).toBe(50)
    expect(indianAqiFromPm(60, null)).toBe(100)
    expect(indianAqiFromPm(45, null)).toBe(75)
    expect(indianAqiFromPm(null, 250)).toBe(200)
    expect(indianAqiFromPm(null, null)).toBeNull()
  })
  it('IMD rainfall and departure categories', () => {
    expect(imdRainCategory(0)).toBe('no rain')
    expect(imdRainCategory(10)).toBe('light')
    expect(imdRainCategory(20)).toBe('moderate')
    expect(imdRainCategory(70)).toBe('heavy')
    expect(imdDepartureCategory(25)).toBe('excess')
    expect(imdDepartureCategory(-30)).toBe('deficient')
    expect(imdDepartureCategory(5)).toBe('normal')
  })
  it('moon age stays within one synodic month; percentile is mid-rank', () => {
    const a = moonAgeDays('2026-10-22')
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(29.54)
    expect(percentileOf([1, 2, 3, 4], 3)).toBe(62.5)
  })
})

describe('calendar', () => {
  it('uses the date in India, not the device time zone', () => {
    expect(todayInIndia(new Date('2026-10-21T20:00:00Z'))).toBe('2026-10-22')
    expect(todayInIndia(new Date('2026-10-21T18:00:00Z'))).toBe('2026-10-21')
  })
  it('carries the DoPT 2026 and 2027 dates exactly', () => {
    const find = (d: string, n: string) => HOLIDAYS.some((h) => h.date === d && h.name.includes(n))
    expect(find('2026-11-08', 'Diwali')).toBe(true)
    expect(find('2027-03-10', 'Id-ul-Fitr')).toBe(true)
    expect(find('2027-10-29', 'Diwali')).toBe(true)
    expect(find('2027-09-04', 'Ganesh Chaturthi')).toBe(true)
  })
  it('finds 1 Shawwal 1448 on the DoPT Id-ul-Fitr date (10 Mar 2027)', () => {
    expect(findHijri('2027-03-01', 20, (h) => h.month === 10 && h.day === 1)).toBe('2027-03-10')
  })
  it('puts Islamic dates on India’s observed calendar (one day after Umm al-Qura)', () => {
    // DoPT 2027: Id-ul-Fitr 10 Mar, Id-ul-Zuha 17 May, Muharram (Ashura) 16 Jun, Milad-un-Nabi 15 Aug.
    expect(hijri('2027-03-10')).toMatchObject({ month: 10, day: 1 })
    expect(hijri('2027-05-17')).toMatchObject({ month: 12, day: 10 })
    expect(hijri('2027-06-16')).toMatchObject({ month: 1, day: 10 })
    expect(hijri('2027-08-15')).toMatchObject({ month: 3, day: 12 })
  })
  it('matches the 2026 Urs (3–5 May) and the 2027 listing (24 Apr)', () => {
    const urs26 = kalaburagiEventsBetween('2026-04-28', '2026-05-10', 0).filter((e) => e.name.startsWith('Urs')).map((e) => e.date)
    expect(urs26).toEqual(['2026-05-03', '2026-05-04', '2026-05-05'])
    const urs27 = kalaburagiEventsBetween('2027-04-15', '2027-04-30', 0).filter((e) => e.name.startsWith('Urs')).map((e) => e.date)
    expect(urs27).toContain('2027-04-24')
  })
  it('weighs the Urs fully in the city and lightly elsewhere in the district', () => {
    expect(ursStrength(3)).toBe(1)
    expect(ursStrength(40)).toBeLessThan(0.5)
    const far = kalaburagiEventsBetween('2026-05-03', '2026-05-03', 40).find((e) => e.name.startsWith('Urs'))
    expect(far?.note).toMatch(/outside the city/)
  })
  it('keeps the brief inside Kalaburagi district', () => {
    expect(inKalaburagiDistrict(KALABURAGI)).toBe(true)
    expect(inKalaburagiDistrict(ALAND)).toBe(true)
    expect(inKalaburagiDistrict(MYSURU)).toBe(false)
    expect(districtQuery('Aland')).toBe('Aland, Kalaburagi, Karnataka')
    expect(districtQuery('Gulbarga')).toBe('Gulbarga, Karnataka')
  })
  it('adds Kannada Rajyotsava only in Karnataka', () => {
    expect(eventsBetween('2026-11-01', '2026-11-01', MYSURU).some((e) => e.name === 'Kannada Rajyotsava')).toBe(true)
    expect(eventsBetween('2026-11-01', '2026-11-01', { ...MYSURU, state: 'Kerala' }).some((e) => e.name === 'Kannada Rajyotsava')).toBe(false)
  })
  it('regional festivals only drive buying where they are observed', () => {
    const kc = HOLIDAYS.find((h) => h.name === 'Karwa Chauth')!
    expect(retailHere(kc, 'Karnataka')).toBe(false)
    expect(retailHere(kc, 'Punjab')).toBe(true)
    const diwali = HOLIDAYS.find((h) => h.date === '2026-11-08' && h.name.startsWith('Diwali'))!
    expect(retailHere(diwali, 'Karnataka')).toBe(true)
    // The eve of Diwali is a full-strength buying day; five days out barely registers.
    expect(festivalSignal('2026-11-07', HOLIDAYS, 'Karnataka').signal).toBe(1)
    expect(festivalSignal('2026-11-02', HOLIDAYS, 'Karnataka').signal).toBe(0)
  })
})

describe('archetype matching', () => {
  const cases: Array<[string, string]> = [
    ['lassi stall', 'cold_beverages'],
    ['Sugarcane juice cart', 'cold_beverages'],
    ['vegetable farmer', 'farm_crop'],
    ['vegetable seller', 'fruit_vegetable'],
    ['poultry farm', 'poultry'],
    ['dairy farm with 6 cows', 'dairy'],
    ['Iyengar bakery', 'sweets_bakery'],
    ['ಟೀ ಅಂಗಡಿ', 'cafe_tea'],
    ['xerox and stationery', 'stationery_print'],
    ['something else entirely', 'general_retail'],
  ]
  it.each(cases)('%s → %s', (text, id) => {
    expect(matchArchetype(text).archetype.id).toBe(id)
  })
})

describe('sources', () => {
  it('builds one count statement per spec and refuses a short answer', () => {
    const specs = [
      { key: 'a', filters: ['["amenity"="school"]'], radiusM: 1000 },
      { key: 'b', filters: ['["shop"]', '["amenity"="cafe"]'], radiusM: 500 },
    ]
    const q = buildCountQuery(12.3, 76.6, specs)
    expect(q.match(/out count;/g)).toHaveLength(2)
    expect(parseCounts(F.syntheticOverpassCounts([4, 9]).elements, specs)).toEqual({ a: 4, b: 9 })
    expect(parseCounts(F.syntheticOverpassCounts([4]).elements, specs)).toBeNull()
  })
  it('names the failure: 429 is rate limited, bad JSON is a bad response, a hang is a timeout', async () => {
    const r429 = await fetchJson('x', { fetchImpl: async () => new Response('{}', { status: 429 }) })
    expect(r429.ok ? null : r429.failure).toBe('rate_limited')
    const bad = await fetchJson('x', { fetchImpl: async () => new Response('<html>', { status: 200 }) })
    expect(bad.ok ? null : bad.failure).toBe('bad_response')
    const hang = await fetchJson('x', {
      timeoutMs: 20,
      fetchImpl: (_u, init) => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))),
    })
    expect(hang.ok ? null : hang.failure).toBe('timed_out')
  })
  it('treats an Overpass "runtime error" remark as a failure, not as zero features', async () => {
    const res = await fetchOsm(1, 2, [{ key: 'a', filters: ['["shop"]'], radiusM: 100 }], [], 500, {
      useCache: false,
      fetchImpl: async () => new Response(JSON.stringify({ elements: [], remark: 'runtime error: Query timed out' }), { status: 200 }),
    })
    expect(res.ok).toBe(false)
  })
  it('falls through to the second Overpass mirror', async () => {
    const res = await fetchOsm(1, 2, [{ key: 'a', filters: ['["shop"]'], radiusM: 100 }], [], 500, {
      useCache: false,
      fetchImpl: async (url) =>
        url.includes('kumi') ? new Response(JSON.stringify(F.syntheticOverpassCounts([7])), { status: 200 }) : new Response('{}', { status: 504 }),
    })
    expect(res.ok && res.data.counts.a).toBe(7)
  })
})

describe('the brief, end to end on synthetic data', () => {
  it('pushes a lassi stall on a hot day and says to chill stock', async () => {
    const today = '2026-10-22'
    const b = await runBrief(
      { business: 'lassi stall', place: 'Kalaburagi', today },
      { fetchImpl: world(today, { tMax: 41, tMin: 27, rh: 40 }), place: KALABURAGI, useCache: false, now: at(today) },
    )
    expect(b.archetype.id).toBe('cold_beverages')
    expect(b.verdict).toBe('push')
    expect(b.tactics.map((t) => t.id)).toContain('heat.cold_stock')
    expect(b.outlook).toHaveLength(7)
    expect(b.headline).toMatch(/^Push tomorrow\./)
  })

  it('protects a street-food cart in heavy rain', async () => {
    const today = '2026-10-22'
    const b = await runBrief(
      { business: 'gobi manchurian cart', place: 'Aland', today },
      { fetchImpl: world(today, { rainyDates: ['2026-10-23'], rainMmPerHour: 12, rainProb: 95 }), place: ALAND, useCache: false, now: at(today) },
    )
    expect(b.archetype.id).toBe('street_food')
    expect(b.verdict).toBe('protect')
    expect(b.tactics.map((t) => t.id)).toEqual(expect.arrayContaining(['rain.cover', 'storm.thunder']))
  })

  it('gives a farmer field conditions and never names a pesticide', async () => {
    const today = '2026-10-22'
    const b = await runBrief(
      { business: 'cotton farmer, 4 acres', place: 'Raichur', today },
      { fetchImpl: world(today, { tMax: 32, rh: 55 }), place: ALAND, useCache: false, now: at(today) },
    )
    expect(b.archetype.id).toBe('farm_crop')
    expect(b.tactics.some((t) => t.id === 'farm.spray' || t.id === 'farm.no_spray')).toBe(true)
    const text = b.tactics.map((t) => `${t.title} ${t.detail}`).join(' ').toLowerCase()
    for (const word of ['chlorpyrifos', 'imidacloprid', 'glyphosate', 'ml per litre', 'ml/l']) expect(text).not.toContain(word)
    expect(text).toContain('kvk')
  })

  it('has well over a hundred metrics, unique ids, and every cited basis exists', async () => {
    const today = '2026-10-22'
    const b = await runBrief({ business: 'kirana', place: 'Kalaburagi', today }, { fetchImpl: world(today), place: KALABURAGI, useCache: false, now: at(today) })
    const ids = b.metrics.map((m) => m.id)
    expect(ids.length).toBeGreaterThanOrEqual(150)
    expect(new Set(ids).size).toBe(ids.length)
    const cited = [...b.tactics.flatMap((t) => t.basis), ...b.drivers.flatMap((d) => d.basis), ...b.locationBasis]
    for (const id of cited) expect(ids).toContain(id)
  })

  it('never fills a failed source: no forecast means no call and "Unavailable" weather', async () => {
    const today = '2026-10-22'
    const b = await runBrief(
      { business: 'tea stall', place: 'Aland', today },
      { fetchImpl: world(today, {}, { fail: { forecast: 503, soil: 503 } }), place: ALAND, useCache: false, now: at(today) },
    )
    expect(b.verdict).toBeNull()
    expect(b.index).toBeNull()
    expect(b.outlook).toHaveLength(0)
    const weather = b.metrics.filter((m) => m.dimension === 'weather_tomorrow' && m.source === 'forecast')
    expect(weather.length).toBeGreaterThan(30)
    for (const m of weather) {
      expect(m.value).toBeNull()
      expect(m.display).toBe('Unavailable')
    }
    expect(b.sources.find((s) => s.id === 'forecast')?.ok).toBe(false)
    expect(b.tactics.some((t) => t.basis.some((x) => x.startsWith('wx.')))).toBe(false)
  })

  it('drops a missing driver instead of zeroing it, and confidence falls', async () => {
    const today = '2026-10-22'
    const full = await runBrief({ business: 'tea stall', place: 'Aland', today }, { fetchImpl: world(today), place: ALAND, useCache: false, now: at(today) })
    const noAir = await runBrief(
      { business: 'tea stall', place: 'Aland', today },
      { fetchImpl: world(today, {}, { fail: { air: 500, overpass: 429 } }), place: ALAND, useCache: false, now: at(today) },
    )
    expect(noAir.drivers.find((d) => d.id === 'air_quality')?.signal).toBeNull()
    expect(noAir.metrics.find((m) => m.id === 'air.pm25')?.value).toBeNull()
    expect(noAir.metrics.find((m) => m.id === 'osm.schools')?.value).toBeNull()
    expect(noAir.locationStrength).toBeNull()
    expect(noAir.confidence!).toBeLessThan(full.confidence!)
    expect(noAir.sources.find((s) => s.id === 'osm')?.failure).toBe('rate_limited')
  })

  it('refuses a place outside Kalaburagi district', async () => {
    const today = '2026-10-22'
    const b = await runBrief({ business: 'tea stall', place: 'Mysuru', today }, { fetchImpl: world(today), place: MYSURU, useCache: false, now: at(today) })
    expect(b.error).toMatch(/Kalaburagi district only/)
    expect(b.sources[0].failure).toBe('out_of_area')
  })

  it('stops with a clear message when the place cannot be found', async () => {
    const b = await runBrief({ business: 'tea', place: '   ' }, { useCache: false })
    expect(b.error).toMatch(/village, town or district/i)
    expect(b.metrics).toHaveLength(0)
  })

  it('builds facts for exactly tomorrow and the six days after', () => {
    const today = '2026-10-22'
    const fc = F.syntheticForecast({ start: addDays(today, -7), days: 23, tMax: 30, tMin: 20, rh: 60, rainProb: 70, rainMmPerHour: 1, rainyDates: [], wind: 5 })
    const facts = buildFacts(ALAND, today, { forecast: { ok: true, data: fc, fetchedAt: 0, cached: false } })
    expect(facts.days.map((d) => d.date)).toEqual(Array.from({ length: 7 }, (_, i) => addDays(today, i + 1)))
    expect(facts.days[0].hoursAvailable).toBe(24)
    expect(facts.past7.days).toBe(7)
  })
})
