/**
 * Reading Kalaburagi news posts: counts, ages, topics, places, dates and events.
 * Plain rules over the post text (English, Hinglish, Urdu in Latin script, Kannada), so each
 * result can be traced back to the words that produced it.
 */
import { matchArchetype } from '../archetypes'
import { LOCAL_MARKERS, LOCALITIES } from '../kalaburagi'
import type { ArchetypeId } from '../types'
import type { EventKind, PulseEvent, PulseItem, Scope, Topic } from './types'

// ---------------------------------------------------------------- numbers and ages

/** "3.4k" → 3400, "42K views" → 42000, "1.2M" → 1200000, "1,234" → 1234. */
export function parseCount(text: string | null | undefined): number | null {
  if (!text) return null
  const m = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([kKmMbB]|lakh|crore)?/)
  if (!m) return null
  const n = parseFloat(m[1])
  const unit = (m[2] ?? '').toLowerCase()
  const mult = unit === 'k' ? 1e3 : unit === 'm' ? 1e6 : unit === 'b' ? 1e9 : unit === 'lakh' ? 1e5 : unit === 'crore' ? 1e7 : 1
  return Math.round(n * mult)
}

const AGE_UNITS: Array<[RegExp, number]> = [
  [/^(sec|second)/, 1 / 86400],
  [/^(min|minute)/, 1 / 1440],
  [/^(hr|hour)/, 1 / 24],
  [/^day/, 1],
  [/^(wk|week)/, 7],
  [/^(mo|month)/, 30],
  [/^(yr|year)/, 365],
]

/** "7 hr ago" / "3 days ago" / "2 wk ago" → ISO time, relative to `now`. */
export function parseAge(text: string | null | undefined, now: Date): string | null {
  if (!text) return null
  const m = text.toLowerCase().match(/(\d+)\s*([a-z]+)\s*ago/)
  if (!m) return null
  const unit = AGE_UNITS.find(([re]) => re.test(m[2]))
  if (!unit) return null
  return new Date(now.getTime() - Number(m[1]) * unit[1] * 86_400_000).toISOString()
}

// ---------------------------------------------------------------- topics, places, scope

const TOPIC_RULES: Array<[Topic, RegExp]> = [
  ['protest', /protest|dharna|rally|aandolan|andolan|agitation|\bbandh\b|\bstrike\b|memorandum|candlelight|ehtejaj|jail bharo|ಪ್ರತಿಭಟನೆ|ಬಂದ್|ಮುಷ್ಕರ/i],
  ['crime_safety', /theft|thie(f|ves)|stolen|robbery|murder|m@rder|k!lled|killed|\barrest|detain|lokayukta|\braid|bribe|\bfire\b|blast|explosion|high alert|accident|crash|chain[- ]?snatch|\bcctv\b.*(captur|caught)|escape|rowdies|fraud|police commissioner|ಕಳ್ಳತನ|ಅಪಘಾತ/i],
  ['religious_cultural', /\burs\b|urs-|dargah|jatra|jatre|jatri|rathotsava|mushaira|\bnaat|milad|seerat|jalsa|\beid\b|ramzan|ramadan|navratri|dasara|dussehra|dasserah|diwali|deepavali|ganesh|\btemple|mandir|masjid|pooja|puja|appaji|sharanabas|bande ?nawaz|bandanawaz|gesudaraz|istisqaa|muharram|umrah|\bhaj\b|rangoli|bhandara|ಜಾತ್ರೆ|ರಥೋತ್ಸವ|ಉರುಸ್|ದರ್ಗಾ|ಹಬ್ಬ/i],
  ['commerce_promo', /\boffer|\bsale\b|% ?off|discount|exhibition|\bexpo\b|grand opening|now open|opens in|franchise|wholesale|₹|\bbuy \d|free gifts?|dhamaka|showroom|collection|fashions?\b|textile|furniture|\bstore\b|for rent|for sale|admissions open|packages?\b|\bmela\b/i],
  ['politics', /minister|\bmla\b|\bmp\b|congress|\bbjp\b|aimim|\bjds\b|\baap\b|\bsdpi\b|\brss\b|chief minister|\bcm\b|election|constituency|kharge|owaisi|rahul gandhi|\bmodi\b|delimitation|\bsir\b|india alliance|india bloc|press conference|press meet|corporator|mayor|party/i],
  ['weather_agri', /\brain|drought|flood|farmer|kisan|kisano|sugarcane|ganne|\btur\b|\btoor\b|\bcrop|harvest|\bmsp\b|support price|irrigation|istisqaa|heatwave|ಮಳೆ|ರೈತ/i],
  ['health_education', /hospital|clinic|health camp|doctor|medical|hijama|ayurveda|unani|wellness|\bschool|college|university|admission|course|training|workshop|students?\b|\bexam|library|study (hall|center|centre)|career|rehabilitation/i],
  ['jobs_property', /for rent|for sale|apartment|plots?\b|commercial (space|property)|property|\bearn\b|\bjobs?\b|vacancy|recruitment|hiring|hr services|real estate/i],
  ['civic', /\bugd\b|drainage|sewage|water (supply|works)|borewell|pothole|roads? (damaged|issue|repair)|road issue|where are the roads|ward no|garbage|street ?light|power cut|gescom|electricity|aadhaar|\bkuda\b|municipal|palike|\bdc\b|deputy commissioner|district collector|\bzoo\b|bus service|public notice|must close|nighttime shop|rti rules|ಪಾಲಿಕೆ|ನೀರು|ರಸ್ತೆ/i],
  ['traffic_transport', /traffic|\bbus\b|\btrain\b|railway|kkrtc|ksrtc|road closure|diversion|flyover|\bjam\b|highway/i],
  ['sports_entertainment', /cricket|football|league|trials|circus|\bfilm\b|movie|releasing|\brcb\b|\bipl\b|\bmatch\b|concert/i],
]

export function topicsOf(text: string): Topic[] {
  const out = TOPIC_RULES.filter(([, re]) => re.test(text)).map(([t]) => t)
  return out.length ? out : ['other']
}

export function placesIn(text: string): string[] {
  const t = ` ${text.toLowerCase()} `
  return LOCALITIES.filter((l) => l.aliases.some((a) => t.includes(a))).map((l) => l.name)
}

const OUTSIDE = /delhi|bengaluru|bangalore|mumbai|hyderabad|andhra|telangana|manipur|assam|nagpur|maharashtra|kerala|bihar|uttar pradesh|gorakhpur|kolkata|west bengal|ujjain|ajmer|nepal|riyadh|saudi|ukraine|russia|france|rajasthan|uttarakhand|shivamogga|raichur|bidar|yadgir|mansa|chennai|pune|punjab|guwahati|kittur|jantar mantar|supreme court|\btrump\b|zelensk|putin|imf/i

export function scopeOf(text: string, places: string[]): Scope {
  const t = text.toLowerCase()
  const local = places.length > 0 || LOCAL_MARKERS.some((m) => t.includes(m))
  if (local) return 'local'
  return OUTSIDE.test(text) ? 'outside' : 'unclear'
}

/** The business type an advert is for, only when a keyword clearly says so. */
export function promoFor(text: string, topics: Topic[]): ArchetypeId | null {
  if (!topics.includes('commerce_promo')) return null
  // Course and admission adverts mention "hotel management" and the like; they are not shops.
  if (/admission|course|academy|institute|school|college|training/i.test(text)) return null
  const m = matchArchetype(text)
  if (m.matched) return m.archetype.id
  if (/furniture|sofa|tv unit|cctv|décor|decor/i.test(text)) return 'general_retail'
  return null
}

// ---------------------------------------------------------------- content patterns

export const PATTERNS: Array<{ id: string; label: string; re: RegExp }> = [
  { id: 'price_bundle', label: 'A price, bundle or % off in the title', re: /\d+\s*(?:for|@)\s*₹\s?[\d,]+|₹\s?[\d,]+|\d+\s*%\s*off|buy \d+.*get \d+|\bfree\b|wholesale rate/i },
  { id: 'exhibition', label: 'Exhibition, expo or mela', re: /exhibition|\bexpo\b|\bmela\b|shopping event/i },
  { id: 'opening', label: 'Grand opening or launch', re: /grand opening|now open|opens in|inaugurat|launch/i },
  { id: 'live_crowd', label: 'Live visuals of a crowd', re: /\blive\b|visuals|crowd|gathers|huge|massive/i },
  { id: 'civic_complaint', label: 'Residents’ complaint naming a ward or street', re: /ward no|residents|problem|unrepaired|damaged|where are the roads|disappointed/i },
  { id: 'breaking', label: 'Breaking news or crime', re: /breaking|detain|arrest|caught|theft|\bfire\b|alert|bribe/i },
  { id: 'known_face', label: 'A known face visits or speaks', re: /\bvisits\b|session with|coming to|appreciates|addresses/i },
  { id: 'religious_event', label: 'Coverage of a religious gathering', re: /\burs\b|urs e|jatra|rathotsava|mushaira|milad|jalsa|seerat/i },
  { id: 'daily_bulletin', label: 'Daily news bulletin', re: /bulletin/i },
]

export function patternsOf(text: string): string[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id)
}

// ---------------------------------------------------------------- dates and events

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}
const MON = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?'

const pad = (n: number) => String(n).padStart(2, '0')

/** Pick the year that puts day/month nearest the reference date, allowing up to 60 days back. */
function withYear(day: number, month: number, ref: string, year?: number): string | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  if (year) return `${year}-${pad(month)}-${pad(day)}`
  const ry = Number(ref.slice(0, 4))
  const refT = Date.parse(`${ref}T00:00:00Z`)
  let best: { iso: string; score: number } | null = null
  for (const y of [ry - 1, ry, ry + 1]) {
    const iso = `${y}-${pad(month)}-${pad(day)}`
    const diff = (Date.parse(`${iso}T00:00:00Z`) - refT) / 86_400_000
    if (diff < -60 || diff > 300) continue
    const score = diff >= 0 ? diff : 1000 - diff
    if (!best || score < best.score) best = { iso, score }
  }
  return best?.iso ?? null
}

export interface FoundDate {
  date: string
  endDate: string | null
  basis: 'stated' | 'relative'
  match: string
}

/** Dates written in a post, resolved against the day it was posted (`ref`, YYYY-MM-DD). */
export function datesIn(text: string, ref: string): FoundDate[] {
  const out: FoundDate[] = []
  const seen = new Set<string>()
  const push = (f: FoundDate | null) => {
    if (f && !seen.has(f.date)) {
      seen.add(f.date)
      out.push(f)
    }
  }
  // "Oct 15–18", "October 18", "OCT 25 2026", "Sep 20 & 21"
  for (const m of text.matchAll(new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:[–-]|&|and|to)\\s*(\\d{1,2})(?:st|nd|rd|th)?)?(?:,?\\s*(20\\d{2}))?\\b`, 'gi'))) {
    const month = MONTHS[m[1].toLowerCase().slice(0, 3)]
    const d = withYear(Number(m[2]), month, ref, m[4] ? Number(m[4]) : undefined)
    const end = m[3] ? withYear(Number(m[3]), month, ref, m[4] ? Number(m[4]) : undefined) : null
    if (d) push({ date: d, endDate: end && end > d ? end : null, basis: 'stated', match: m[0] })
  }
  // "4th May", "16th April, 7:30 PM", "22 October 2024", "14, 15 & 16 September"
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:[–-]|&|and|to)\\s*(\\d{1,2})(?:st|nd|rd|th)?)?\\s+(?:of\\s+)?${MON}(?:,?\\s*(20\\d{2}))?\\b`, 'gi'))) {
    const month = MONTHS[m[3].toLowerCase().slice(0, 3)]
    const y = m[4] ? Number(m[4]) : undefined
    const first = withYear(Number(m[1]), month, ref, y)
    const last = m[2] ? withYear(Number(m[2]), month, ref, y) : null
    if (first) push({ date: first, endDate: last && last > first ? last : null, basis: 'stated', match: m[0] })
  }
  // 21/10/2026, 21-10-2026, 21.10.2026 (Indian day-first order)
  for (const m of text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/g)) {
    push({ date: `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`, endDate: null, basis: 'stated', match: m[0] })
  }
  const addDay = (n: number) => {
    const d = new Date(`${ref}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
  }
  const rel = text.match(/\b(tomorrow|tonight|today)\b|ನಾಳೆ|ಇಂದು/i)
  if (rel) {
    const w = rel[0].toLowerCase()
    push({ date: addDay(w === 'tomorrow' || w === 'ನಾಳೆ' ? 1 : 0), endDate: null, basis: 'relative', match: rel[0] })
  }
  return out
}

function kindOf(text: string, topics: Topic[]): EventKind {
  if (/public notice|must close|prohibitory|section 144|curfew|\bban(ned)?\b|order issued/i.test(text)) return 'notice'
  if (/\bbandh\b|\bstrike\b|road closure|diversion|power cut|shutdown|water supply (cut|stop|disrupt)/i.test(text) || topics.includes('protest')) return 'disruption'
  if (topics.includes('commerce_promo') && /offer|sale|% ?off|discount|valid till|buy \d|free|dhamaka/i.test(text)) return 'offer'
  if (/trials|\bcamp\b|\bmela\b|exhibition|\bexpo\b|jalsa|mushaira|\burs\b|jatra|rathotsava|\bmatch\b|workshop|session|programme|program\b|celebrat|procession|juloos/i.test(text)) return 'gathering'
  if (/last date|deadline|registration|admissions open|apply by/i.test(text)) return 'deadline'
  return 'gathering'
}

function snippet(text: string, match: string): string {
  const i = text.toLowerCase().indexOf(match.toLowerCase())
  if (i < 0) return text.slice(0, 140)
  return text.slice(Math.max(0, i - 60), Math.min(text.length, i + match.length + 60)).trim()
}

const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

/** Events and notices announced in a post. Daily bulletins only carry their own date stamp, so they are skipped. */
export function eventsIn(item: PulseItem, topics: Topic[], places: string[], todayRef: string): PulseEvent[] {
  const text = `${item.title} ${item.body}`.replace(/\s+/g, ' ').trim()
  if (/bulletin/i.test(item.title)) return []
  const ref = item.publishedAt ? item.publishedAt.slice(0, 10) : todayRef
  const base = { title: clip(item.title.trim()), places, sourceKey: item.key, url: item.url, channelName: item.channelName }
  const out: PulseEvent[] = []
  const kind = kindOf(text, topics)
  const hours = text.match(/must close by\s*(\d{1,2})\s*(pm|am)/i)
  if (kind === 'notice') {
    out.push({
      ...base,
      title: hours ? `Shops and commercial establishments must close by ${hours[1]} ${hours[2].toUpperCase()}` : base.title,
      date: null,
      endDate: null,
      kind: 'notice',
      dateBasis: 'none',
      evidence: snippet(text, hours?.[0] ?? 'notice'),
    })
  }
  // "Tomorrow" only means something when the posting day is known to the day: an exact time,
  // or an approximate one from "1 day ago" style text no more than two days old.
  const ageDays = item.publishedAt ? (Date.parse(`${todayRef}T12:00:00Z`) - Date.parse(item.publishedAt)) / 86_400_000 : null
  const dayKnown = item.publishedAt != null && (!item.publishedApprox || (ageDays != null && ageDays <= 2.5))
  const dates = datesIn(text, ref).filter((d) => d.basis === 'stated' || dayKnown)
  for (const d of dates) {
    out.push({ ...base, date: d.date, endDate: d.endDate, kind, dateBasis: d.basis, evidence: snippet(text, d.match) })
  }
  return out
}
