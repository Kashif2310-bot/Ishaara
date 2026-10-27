/**
 * Loads the stored Kalaburagi pulse from Supabase (public read-only tables filled by the
 * local-pulse Edge Function). The browser never scrapes anything itself.
 */
import { tryCreateAnonClient } from '../../backend/supabase/client'
import type { SourceResult } from '../types'
import type { PulseRow } from './channels'
import type { PulseItem } from './types'

export interface PulseRun {
  source: 'youtube' | 'instagram'
  finished_at: string
  ok: boolean
  items: number
  message: string | null
}

export interface PulseData {
  items: PulseItem[]
  /** Latest run per source. */
  runs: PulseRun[]
}

export type PulseLoader = (now: Date) => Promise<SourceResult<PulseData>>

interface StatRow {
  key: string
  captured_at: string
  views: number | null
}

/** Views gained since the newest snapshot that is at least 20 hours old (looking back up to 48 h). */
export function gainsFromStats(stats: StatRow[], now: Date): Map<string, number> {
  const byKey = new Map<string, StatRow[]>()
  for (const s of stats) byKey.set(s.key, [...(byKey.get(s.key) ?? []), s])
  const out = new Map<string, number>()
  const cutoff = now.getTime() - 20 * 3_600_000
  for (const [key, rows] of byKey) {
    const sorted = rows.filter((r) => r.views != null).sort((a, b) => a.captured_at.localeCompare(b.captured_at))
    const newest = sorted.at(-1)
    const base = [...sorted].reverse().find((r) => Date.parse(r.captured_at) <= cutoff)
    if (newest && base && newest.views != null && base.views != null) out.set(key, Math.max(0, newest.views - base.views))
  }
  return out
}

export function rowToItem(r: PulseRow, gain: number | null): PulseItem {
  return {
    key: r.key,
    platform: r.platform,
    channel: r.channel,
    channelName: r.channel_name,
    kind: r.kind,
    id: r.item_id,
    url: r.url,
    title: r.title,
    body: r.body,
    publishedAt: r.published_at,
    publishedApprox: false,
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    fetchedAt: r.fetched_at,
    gain24h: gain,
  }
}

export const loadPulseFromSupabase: PulseLoader = async (now) => {
  const db = tryCreateAnonClient()
  if (!db) return { ok: false, failure: 'not_configured', message: 'The pulse database is not connected in this build.' }
  const since = new Date(now.getTime() - 35 * 86_400_000).toISOString()
  const statsSince = new Date(now.getTime() - 48 * 3_600_000).toISOString()
  try {
    const [items, stats, runs] = await Promise.all([
      db.from('pulse_items').select('*').or(`published_at.gte.${since},published_at.is.null`).order('published_at', { ascending: false }).limit(600),
      db.from('pulse_item_stats').select('key,captured_at,views').gte('captured_at', statsSince).limit(5000),
      db.from('pulse_runs').select('source,finished_at,ok,items,message').order('finished_at', { ascending: false }).limit(20),
    ])
    if (items.error) {
      const missing = /relation .* does not exist|schema cache/i.test(items.error.message)
      return { ok: false, failure: missing ? 'not_configured' : 'bad_response', message: missing ? 'The pulse tables are not set up yet (run the local_pulse migration).' : items.error.message }
    }
    const gains = stats.error ? new Map<string, number>() : gainsFromStats((stats.data ?? []) as StatRow[], now)
    const rows = (items.data ?? []) as PulseRow[]
    if (!rows.length) return { ok: false, failure: 'no_match', message: 'No posts collected yet. The collector runs on a schedule; check that it is deployed.' }
    const latest = new Map<string, PulseRun>()
    for (const r of (runs.data ?? []) as PulseRun[]) if (!latest.has(r.source)) latest.set(r.source, r)
    return {
      ok: true,
      cached: false,
      fetchedAt: Math.max(...rows.map((r) => Date.parse(r.fetched_at))),
      data: { items: rows.map((r) => rowToItem(r, gains.get(r.key) ?? null)), runs: [...latest.values()] },
    }
  } catch {
    return { ok: false, failure: 'unreachable', message: 'Could not reach the pulse database.' }
  }
}
