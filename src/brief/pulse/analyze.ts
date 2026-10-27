/**
 * Turns a set of posts into the Kalaburagi pulse report: outliers against each channel's own
 * usual reach, topic mix, places in the news, announced events and notices, and which content
 * patterns are pulling views. Pure and deterministic.
 */
import { PATTERNS, eventsIn, patternsOf, placesIn, promoFor, scopeOf, topicsOf } from './text'
import type { ChannelSummary, PatternStat, PulseEvent, PulseItem, PulseReport, ScoredItem, Topic } from './types'

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Fewer peers than this and an outlier ratio means little. */
export const MIN_PEERS = 5

export function scoreItems(items: PulseItem[], now: Date): ScoredItem[] {
  // Peer group: same channel and same format (a short and a long video reach different audiences).
  const groups = new Map<string, number[]>()
  for (const it of items) {
    if (it.views == null) continue
    const k = `${it.platform}:${it.channel}:${it.kind}`
    groups.set(k, [...(groups.get(k) ?? []), it.views])
  }
  const med = new Map([...groups].map(([k, v]) => [k, v.length >= MIN_PEERS ? median(v) : null]))
  return items.map((it) => {
    const text = `${it.title} ${it.body}`
    const topics = topicsOf(text)
    const places = placesIn(text)
    const m = med.get(`${it.platform}:${it.channel}:${it.kind}`) ?? null
    const ageDays = it.publishedAt ? Math.max((now.getTime() - Date.parse(it.publishedAt)) / 86_400_000, 1 / 24) : null
    return {
      ...it,
      topics,
      places,
      scope: scopeOf(text, places),
      outlier: it.views != null && m ? it.views / m : null,
      viewsPerDay: it.views != null && ageDays != null ? it.views / Math.max(ageDays, 1) : null,
      promoFor: promoFor(it.title, topics),
      patterns: patternsOf(it.title),
    }
  })
}

function within(it: PulseItem, now: Date, days: number): boolean {
  if (!it.publishedAt) return true
  return now.getTime() - Date.parse(it.publishedAt) <= days * 86_400_000
}

export function analyzePulse(
  items: PulseItem[],
  opts: { now: Date; today: string; windowDays?: number; freshAt?: string | null; sources?: PulseReport['sources'] },
): PulseReport {
  const windowDays = opts.windowDays ?? 14
  const scored = scoreItems(items, opts.now)
  const inWindow = scored.filter((s) => within(s, opts.now, windowDays))
  const relevant = inWindow.filter((s) => s.scope !== 'outside')

  const outliers = relevant
    .filter((s) => s.outlier != null && s.outlier >= 1.5)
    .sort((a, b) => (b.outlier ?? 0) - (a.outlier ?? 0) || (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 12)

  const rising = relevant
    .filter((s) => (s.gain24h ?? 0) > 0)
    .sort((a, b) => (b.gain24h ?? 0) - (a.gain24h ?? 0))
    .slice(0, 8)

  const topicCounts = new Map<Topic, { count: number; views: number }>()
  for (const s of relevant) {
    for (const t of s.topics) {
      const c = topicCounts.get(t) ?? { count: 0, views: 0 }
      topicCounts.set(t, { count: c.count + 1, views: c.views + (s.views ?? 0) })
    }
  }
  const topicMix = [...topicCounts]
    .map(([topic, c]) => ({ topic, ...c, share: relevant.length ? c.count / relevant.length : 0 }))
    .sort((a, b) => b.count - a.count)

  const events: PulseEvent[] = scored.flatMap((s) => (s.scope === 'outside' ? [] : eventsIn(s, s.topics, s.places, opts.today)))
  const upcoming = events
    .filter((e) => e.date != null && (e.endDate ?? e.date) >= opts.today && e.kind !== 'notice')
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const notices = events.filter((e) => e.kind === 'notice')

  const placeCounts = new Map<string, { count: number; views: number }>()
  for (const s of relevant) {
    for (const p of s.places) {
      const c = placeCounts.get(p) ?? { count: 0, views: 0 }
      placeCounts.set(p, { count: c.count + 1, views: c.views + (s.views ?? 0) })
    }
  }
  const hotPlaces = [...placeCounts].map(([place, c]) => ({ place, ...c })).sort((a, b) => b.count - a.count || b.views - a.views).slice(0, 10)

  const patterns: PatternStat[] = PATTERNS.map((p) => {
    const withP = relevant.filter((s) => s.patterns.includes(p.id) && s.outlier != null)
    return {
      pattern: p.id,
      label: p.label,
      count: withP.length,
      medianOutlier: median(withP.map((s) => s.outlier as number)),
      examples: [...withP].sort((a, b) => (b.outlier ?? 0) - (a.outlier ?? 0)).slice(0, 3),
    }
  })
    .filter((p) => p.count >= 2)
    .sort((a, b) => (b.medianOutlier ?? 0) - (a.medianOutlier ?? 0))

  const byChannel = new Map<string, ScoredItem[]>()
  for (const s of scored) byChannel.set(`${s.platform}:${s.channel}`, [...(byChannel.get(`${s.platform}:${s.channel}`) ?? []), s])
  const channels: ChannelSummary[] = [...byChannel.values()].map((list) => ({
    channel: list[0].channel,
    channelName: list[0].channelName,
    platform: list[0].platform,
    items: list.length,
    medianViews: median(list.filter((s) => s.views != null).map((s) => s.views as number)),
    newest: list.map((s) => s.publishedAt).filter((x): x is string => !!x).sort().at(-1) ?? null,
  }))

  return { generatedAt: opts.now.toISOString(), windowDays, items: scored, outliers, rising, topicMix, events, upcoming, notices, hotPlaces, patterns, channels, freshAt: opts.freshAt ?? null, sources: opts.sources ?? [] }
}

/** Offers and adverts in the same line of business, newest first. */
export function competitorPromos(report: PulseReport, archetypeId: string): ScoredItem[] {
  return report.items
    .filter((s) => s.promoFor === archetypeId && s.scope !== 'outside')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 8)
}

export const TOPIC_LABELS: Record<Topic, string> = {
  civic: 'Civic issues (roads, water, notices)',
  protest: 'Protests and agitations',
  crime_safety: 'Crime and safety',
  religious_cultural: 'Religious and cultural events',
  commerce_promo: 'Shops, offers and openings',
  politics: 'Politics',
  weather_agri: 'Weather and farming',
  health_education: 'Health and education',
  jobs_property: 'Jobs and property',
  traffic_transport: 'Traffic and transport',
  sports_entertainment: 'Sport and entertainment',
  other: 'Other',
}
