/**
 * Calendar layer: holidays, festivals, Islamic dates and the trading calendar.
 *
 * Sources (all dates below are copied from the orders, not computed):
 *   - DoPT, holidays in Central Government offices, 2026 (October to December used here)
 *     https://www.gconnect.in/news/holidays-to-be-observed-in-central-government-offices-during-the-year-2026.html
 *   - DoPT, holidays in Central Government offices, 2027 (F. No. 12/2/2023-JCA)
 *     https://www.gconnect.in/gc22/wp-content/uploads/2026/07/Holiday-list-2027.pdf
 *   - Kannada Rajyotsava, 1 November, Karnataka state holiday.
 *   - Urs of Khwaja Bande Nawaz, Kalaburagi (Gulbarga): 15, 16 and 17 Dhu al-Qadah.
 *     https://en.wikipedia.org/wiki/Bande_Nawaz
 *
 * Islamic dates are computed in the browser from the Umm al-Qura calendar (Intl API) and shifted
 * to India's observed dates (see hijri()). The real date follows the local moon sighting, so
 * every computed Islamic date carries that caveat. Dates outside the two DoPT lists are not invented: the brief
 * says the calendar is not covered for them.
 */
import type { CalendarEvent } from './types'

const DOPT_2026 = 'DoPT holiday list 2026'
const DOPT_2027 = 'DoPT holiday list 2027 (F. No. 12/2/2023-JCA)'
const MOON = 'Islamic date; subject to moon sighting.'

export interface CalendarEntry extends CalendarEvent {
  /** Festivals that bring buying, gifting, special food or travel. Drives the "festival" signal. */
  retail: boolean
  /**
   * States where the festival is a major local observance. When set, the festival only drives
   * buying in those states; elsewhere it is still listed. This regional tagging is an editorial
   * judgement, not part of the DoPT orders.
   */
  regions?: string[]
}

const NORTH = ['punjab', 'haryana', 'rajasthan', 'uttar pradesh', 'delhi', 'madhya pradesh', 'himachal pradesh', 'uttarakhand', 'jammu and kashmir', 'chandigarh']
const REGIONAL: Record<string, string[]> = {
  'Karwa Chauth': NORTH,
  'Chhath Puja': ['bihar', 'jharkhand', 'uttar pradesh', 'delhi', 'west bengal'],
  'Bhai Duj': [...NORTH, 'bihar', 'jharkhand', 'gujarat', 'maharashtra', 'goa', 'chhattisgarh', 'west bengal'],
  'Bahag Bihu': ['assam'],
  Onam: ['kerala'],
  "Pongal / Guru Gobind Singh's Birthday": ['tamil nadu', 'puducherry', 'punjab'],
  'Rath Yatra': ['odisha'],
  'Vaisakhi / Vishu': ['punjab', 'haryana', 'kerala'],
  'Basant Panchami': [...NORTH, 'bihar', 'jharkhand', 'west bengal', 'odisha', 'assam', 'tripura'],
}

/** Does this festival drive buying at a place in `state`? */
export function retailHere(e: CalendarEntry, state: string | undefined): boolean {
  if (!e.retail) return false
  if (!e.regions) return true
  const s = (state ?? '').toLowerCase()
  return s !== '' && e.regions.some((r) => s.includes(r))
}

function e(date: string, name: string, kind: CalendarEvent['kind'], source: string, retail: boolean, note?: string): CalendarEntry {
  const base: CalendarEntry = note ? { date, name, kind, source, retail, note } : { date, name, kind, source, retail }
  const regions = REGIONAL[name]
  return regions ? { ...base, regions } : base
}

export const HOLIDAYS: CalendarEntry[] = [
  // 2026, October to December
  e('2026-10-02', 'Gandhi Jayanti', 'national', DOPT_2026, false),
  e('2026-10-20', 'Dussehra', 'national', DOPT_2026, true),
  e('2026-10-26', 'Maharishi Valmiki Jayanti', 'restricted', DOPT_2026, false),
  e('2026-10-29', 'Karwa Chauth', 'restricted', DOPT_2026, true),
  e('2026-11-08', 'Diwali (Deepavali)', 'national', DOPT_2026, true),
  e('2026-11-08', 'Naraka Chaturdasi', 'restricted', DOPT_2026, true),
  e('2026-11-09', 'Govardhan Puja', 'restricted', DOPT_2026, true),
  e('2026-11-11', 'Bhai Duj', 'restricted', DOPT_2026, true),
  e('2026-11-15', 'Chhath Puja', 'restricted', DOPT_2026, true),
  e('2026-11-24', "Guru Nanak's Birthday", 'national', DOPT_2026, true),
  e('2026-11-24', "Guru Teg Bahadur's Martyrdom Day", 'restricted', DOPT_2026, false),
  e('2026-12-23', "Hazarat Ali's Birthday", 'restricted', DOPT_2026, false, MOON),
  e('2026-12-24', 'Christmas Eve', 'restricted', DOPT_2026, true),
  e('2026-12-25', 'Christmas Day', 'national', DOPT_2026, true),
  // 2027
  e('2027-01-01', "New Year's Day", 'restricted', DOPT_2027, true),
  e('2027-01-14', 'Makar Sankranti', 'restricted', DOPT_2027, true),
  e('2027-01-15', "Pongal / Guru Gobind Singh's Birthday", 'restricted', DOPT_2027, true),
  e('2027-01-26', 'Republic Day', 'national', DOPT_2027, false),
  e('2027-02-11', 'Basant Panchami', 'restricted', DOPT_2027, true),
  e('2027-02-19', 'Shivaji Jayanti', 'restricted', DOPT_2027, false),
  e('2027-02-20', "Guru Ravidas's Birthday", 'restricted', DOPT_2027, false),
  e('2027-03-02', 'Swami Dayananda Saraswati Jayanti', 'restricted', DOPT_2027, false),
  e('2027-03-05', 'Jamat-ul-Vida', 'restricted', DOPT_2027, false, MOON),
  e('2027-03-06', 'Maha Shivaratri', 'restricted', DOPT_2027, true),
  e('2027-03-10', 'Id-ul-Fitr', 'national', DOPT_2027, true, MOON),
  e('2027-03-22', 'Holika Dahan', 'restricted', DOPT_2027, true),
  e('2027-03-23', 'Holi', 'national', DOPT_2027, true),
  e('2027-03-26', 'Good Friday', 'national', DOPT_2027, false),
  e('2027-03-28', 'Easter Sunday', 'restricted', DOPT_2027, true),
  e('2027-04-07', 'Ugadi / Chaitra Sukladi / Gudi Padava', 'restricted', DOPT_2027, true),
  e('2027-04-14', 'Vaisakhi / Vishu', 'restricted', DOPT_2027, true),
  e('2027-04-15', 'Ram Navami', 'national', DOPT_2027, true),
  e('2027-04-15', 'Bahag Bihu', 'restricted', DOPT_2027, true),
  e('2027-04-19', 'Mahavir Jayanti', 'national', DOPT_2027, false),
  e('2027-05-09', "Rabindranath Tagore's Birthday", 'restricted', DOPT_2027, false),
  e('2027-05-17', 'Id-ul-Zuha (Bakrid)', 'national', DOPT_2027, true, MOON),
  e('2027-05-20', 'Buddha Purnima', 'national', DOPT_2027, false),
  e('2027-06-16', 'Muharram', 'national', DOPT_2027, false, MOON),
  e('2027-07-05', 'Rath Yatra', 'restricted', DOPT_2027, true),
  e('2027-08-15', 'Independence Day', 'national', DOPT_2027, false),
  e('2027-08-15', "Milad-un-Nabi (Prophet Mohammad's Birthday)", 'national', DOPT_2027, true, MOON),
  e('2027-08-15', 'Parsi New Year (Navroz)', 'restricted', DOPT_2027, false),
  e('2027-08-17', 'Raksha Bandhan', 'restricted', DOPT_2027, true),
  e('2027-08-25', 'Janmashtami', 'national', DOPT_2027, true),
  e('2027-09-04', 'Ganesh Chaturthi / Vinayaka Chaturthi', 'restricted', DOPT_2027, true),
  e('2027-09-12', 'Onam', 'restricted', DOPT_2027, true),
  e('2027-10-02', 'Gandhi Jayanti', 'national', DOPT_2027, false),
  e('2027-10-06', 'Dussehra (Saptami)', 'restricted', DOPT_2027, true),
  e('2027-10-07', 'Dussehra (Maha Ashtami)', 'restricted', DOPT_2027, true),
  e('2027-10-08', 'Dussehra (Maha Navami)', 'restricted', DOPT_2027, true),
  e('2027-10-09', 'Dussehra', 'national', DOPT_2027, true),
  e('2027-10-15', 'Maharishi Valmiki Jayanti', 'restricted', DOPT_2027, false),
  e('2027-10-18', 'Karwa Chauth', 'restricted', DOPT_2027, true),
  e('2027-10-28', 'Naraka Chaturdasi', 'restricted', DOPT_2027, true),
  e('2027-10-29', 'Diwali (Deepavali)', 'national', DOPT_2027, true),
  e('2027-10-30', 'Govardhan Puja', 'restricted', DOPT_2027, true),
  e('2027-10-31', 'Bhai Duj', 'restricted', DOPT_2027, true),
  e('2027-11-04', 'Chhath Puja', 'restricted', DOPT_2027, true),
  e('2027-11-14', "Guru Nanak's Birthday", 'national', DOPT_2027, true),
  e('2027-11-24', "Guru Teg Bahadur's Martyrdom Day", 'restricted', DOPT_2027, false),
  e('2027-12-12', "Hazrat Ali's Birthday", 'restricted', DOPT_2027, false, MOON),
  e('2027-12-24', 'Christmas Eve', 'restricted', DOPT_2027, true),
  e('2027-12-25', 'Christmas Day', 'national', DOPT_2027, true),
]

/** The span the holiday table actually covers. Outside it the brief says "not covered". */
export const CALENDAR_COVERAGE = { from: '2026-10-01', to: '2027-12-31' }

/** State holidays applied only when the place resolves to that state. */
const STATE_HOLIDAYS: Array<{ state: string; month: number; day: number; name: string; retail: boolean }> = [
  { state: 'karnataka', month: 11, day: 1, name: 'Kannada Rajyotsava', retail: true },
]

// ---------------------------------------------------------------- date helpers (YYYY-MM-DD, no time zone drift)

export function toUtcDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: string, n: number): string {
  const d = toUtcDate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return isoDate(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcDate(b).getTime() - toUtcDate(a).getTime()) / 86_400_000)
}

/** Today's date in India, whatever the device clock's time zone. */
export function todayInIndia(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function weekday(iso: string): number {
  return toUtcDate(iso).getUTCDay()
}

export function daysInMonth(iso: string): number {
  const d = toUtcDate(iso)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
}

// ---------------------------------------------------------------- Islamic (Umm al-Qura) calendar

export interface HijriDate {
  year: number
  month: number
  day: number
}

let hijriFormatter: Intl.DateTimeFormat | null | undefined

function formatter(): Intl.DateTimeFormat | null {
  if (hijriFormatter !== undefined) return hijriFormatter
  try {
    const f = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    // A runtime without this calendar silently falls back to Gregorian; detect that.
    hijriFormatter = f.resolvedOptions().calendar === 'islamic-umalqura' ? f : null
  } catch {
    hijriFormatter = null
  }
  return hijriFormatter
}

/**
 * Islamic date as observed in India (Kalaburagi follows the Deccan / Hyderabad moon sighting).
 *
 * Computed as the Umm al-Qura date of the previous day, because India's observed dates have run
 * one day behind Umm al-Qura on every date we could check:
 *   - Id-ul-Fitr 2027: DoPT 10 Mar; Umm al-Qura 1 Shawwal = 9 Mar
 *   - Id-ul-Zuha 2027: DoPT 17 May; Umm al-Qura 10 Dhu al-Hijjah = 16 May
 *   - Muharram (Ashura) 2027: DoPT 16 Jun; Umm al-Qura 10 Muharram = 15 Jun
 *   - Milad-un-Nabi 2027: DoPT 15 Aug; Umm al-Qura 12 Rabi' al-Awwal = 14 Aug
 *   - 622nd Urs of Bande Nawaz: held 3–5 May 2026 (17 Dhu al-Qadah = 5 May); Umm al-Qura 17 = 4 May
 * The real date still depends on the local moon sighting, so every Islamic event keeps that note.
 */
export function hijri(iso: string): HijriDate | null {
  return hijriUmmAlQura(addDays(iso, -1))
}

/** The Saudi Umm al-Qura calendar date, as computed by the browser. */
export function hijriUmmAlQura(iso: string): HijriDate | null {
  const f = formatter()
  if (!f) return null
  const parts = f.formatToParts(toUtcDate(iso))
  const num = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '', 10)
  const out = { year: num('year'), month: num('month'), day: num('day') }
  return Number.isFinite(out.year) && Number.isFinite(out.month) && Number.isFinite(out.day) ? out : null
}

export const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qa'dah",
  'Dhu al-Hijjah',
]

export function hijriLabel(h: HijriDate | null): string {
  return h ? `${h.day} ${HIJRI_MONTHS[h.month - 1] ?? h.month} ${h.year} AH` : 'unavailable'
}

/** Next day (from `from`, inclusive, within `horizon` days) on which `test` holds for the Hijri date. */
export function findHijri(from: string, horizon: number, test: (h: HijriDate) => boolean): string | null {
  for (let i = 0; i <= horizon; i++) {
    const d = addDays(from, i)
    const h = hijri(d)
    if (h && test(h)) return d
  }
  return null
}

/** 15–17 Dhu al-Qadah, the Urs of Khwaja Bande Nawaz in Kalaburagi. */
export function isUrsDay(h: HijriDate | null): boolean {
  return h != null && h.month === 11 && h.day >= 15 && h.day <= 17
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ---------------------------------------------------------------- events for a window

/**
 * National and state holidays between `from` and `to` (inclusive) for this place. Kalaburagi's
 * own events (the Urs, the jatra, Islamic observances) come from kalaburagi.ts.
 */
export function eventsBetween(
  from: string,
  to: string,
  place: { lat: number; lng: number; state?: string } | null,
): CalendarEntry[] {
  const out: CalendarEntry[] = HOLIDAYS.filter((h) => h.date >= from && h.date <= to)
  const state = place?.state?.toLowerCase() ?? ''
  const span = daysBetween(from, to)
  for (let i = 0; i <= span; i++) {
    const d = addDays(from, i)
    const [, m, day] = d.split('-').map(Number)
    for (const s of STATE_HOLIDAYS) {
      if (state.includes(s.state) && s.month === m && s.day === day) {
        out.push(e(d, s.name, 'state', `${s.state[0].toUpperCase()}${s.state.slice(1)} state holiday`, s.retail))
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** IMD's four seasons for India. */
export function imdSeason(iso: string): string {
  const m = Number(iso.slice(5, 7))
  if (m <= 2) return 'Winter (Jan to Feb)'
  if (m <= 5) return 'Pre-monsoon (Mar to May)'
  if (m <= 9) return 'Southwest monsoon (Jun to Sep)'
  return 'Post-monsoon (Oct to Dec)'
}

/** Kharif / rabi / summer (zaid) crop season by month, the common Indian convention. */
export function cropSeason(iso: string): string {
  const m = Number(iso.slice(5, 7))
  if (m >= 6 && m <= 10) return 'Kharif (Jun to Oct)'
  if (m >= 11 || m <= 3) return 'Rabi (Nov to Mar)'
  return 'Summer / zaid (Apr to May)'
}
