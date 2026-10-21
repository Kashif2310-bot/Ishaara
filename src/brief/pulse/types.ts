/**
 * Kalaburagi pulse: what the city's own news channels are posting, and what it means for a
 * business tomorrow. Items come from public YouTube feeds and (when configured) Instagram via
 * Apify; the analysis is deterministic text rules, so every claim links to the post it came from.
 */
import type { ArchetypeId } from '../types'

export type Platform = 'youtube' | 'instagram'
export type ItemKind = 'video' | 'short' | 'reel' | 'post'

export interface PulseItem {
  /** platform:id — unique across sources. */
  key: string
  platform: Platform
  /** Channel handle without @. */
  channel: string
  channelName: string
  kind: ItemKind
  id: string
  url: string
  title: string
  /** Description or caption, if the source gives one. */
  body: string
  /** ISO time the post went up, when known. */
  publishedAt: string | null
  /** True when publishedAt was worked out from "3 days ago" style text. */
  publishedApprox: boolean
  views: number | null
  likes: number | null
  comments: number | null
  fetchedAt: string
  /** Views gained over roughly the last 24 hours, from the collector's snapshots. */
  gain24h: number | null
}

export type Topic =
  | 'civic'
  | 'protest'
  | 'crime_safety'
  | 'religious_cultural'
  | 'commerce_promo'
  | 'politics'
  | 'weather_agri'
  | 'health_education'
  | 'jobs_property'
  | 'traffic_transport'
  | 'sports_entertainment'
  | 'other'

export type Scope = 'local' | 'outside' | 'unclear'

export interface ScoredItem extends PulseItem {
  topics: Topic[]
  places: string[]
  scope: Scope
  /** Views divided by the median of the same channel and format. null with fewer than 5 peers. */
  outlier: number | null
  /** Views per day since posting, when the posting time is known. */
  viewsPerDay: number | null
  /** The business type an advert or offer is for, when it reads like one. */
  promoFor: ArchetypeId | null
  /** Content patterns this post uses (price bundle, exhibition, live crowd…). */
  patterns: string[]
}

export type EventKind = 'gathering' | 'disruption' | 'offer' | 'notice' | 'deadline'

export interface PulseEvent {
  /** YYYY-MM-DD, or null for a standing notice with no date. */
  date: string | null
  endDate: string | null
  kind: EventKind
  title: string
  places: string[]
  /** How the date was found: written in the post, or "tomorrow/today" relative to posting. */
  dateBasis: 'stated' | 'relative' | 'none'
  sourceKey: string
  url: string
  channelName: string
  /** The words in the post that this event was read from. */
  evidence: string
}

export interface ChannelSummary {
  channel: string
  channelName: string
  platform: Platform
  items: number
  medianViews: number | null
  newest: string | null
}

export interface PatternStat {
  pattern: string
  label: string
  count: number
  medianOutlier: number | null
  examples: ScoredItem[]
}

export interface PulseReport {
  generatedAt: string
  windowDays: number
  items: ScoredItem[]
  /** Local posts that beat their channel's usual views, best first. */
  outliers: ScoredItem[]
  /** Local posts gaining the most views in the last day. */
  rising: ScoredItem[]
  topicMix: Array<{ topic: Topic; count: number; views: number; share: number }>
  events: PulseEvent[]
  /** Upcoming dated events from today on. */
  upcoming: PulseEvent[]
  notices: PulseEvent[]
  hotPlaces: Array<{ place: string; count: number; views: number }>
  patterns: PatternStat[]
  channels: ChannelSummary[]
  /** Newest collection time across sources, if known. */
  freshAt: string | null
  /** The collector's latest outcome per source (YouTube, Instagram). */
  sources: Array<{ source: Platform; ok: boolean; items: number; message: string | null; finishedAt: string }>
}
