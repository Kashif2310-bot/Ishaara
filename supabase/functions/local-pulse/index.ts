// Supabase Edge Function: local-pulse
//
// Collects the latest public posts from the Kalaburagi news channels in
// ../_shared/pulseSources.ts and stores them in public.pulse_items (+ a views snapshot per run
// in public.pulse_item_stats, + one public.pulse_runs row per source).
//
// WHO MAY CALL IT
//   Only a caller that sends the header `x-pulse-secret` equal to the PULSE_CRON_SECRET secret
//   (the scheduler). Without the secret set, it answers 503 "not configured". The browser never
//   calls this function: it reads the tables, which are public-read and service-role-write.
//
// SOURCES
//   YouTube: public RSS feeds, no key. Always attempted.
//   Instagram: Apify's instagram-scraper actor, only when APIFY_TOKEN is set. Apify's free plan
//   includes a monthly credit; 4 profiles × 12 posts per run is a small fraction of it, but the
//   cost depends on Apify's current pricing — check it before scheduling runs often.
//
// FAILURE HANDLING
//   Each source succeeds or fails on its own and is logged in pulse_runs with its reason.
//   A failed source writes nothing; previously stored posts stay as they were.
//
// SCHEDULE (run once in the SQL editor after deploying; adjust the time to taste):
//   select cron.schedule('local-pulse-every-3h', '7 */3 * * *', $$
//     select net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/local-pulse',
//       headers := jsonb_build_object('Content-Type', 'application/json', 'x-pulse-secret', '<PULSE_CRON_SECRET>'),
//       body := '{}'::jsonb
//     );
//   $$);
//   (needs the pg_cron and pg_net extensions enabled in the dashboard.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  apifyInstagramInput,
  mapApifyInstagram,
  parseYouTubeFeed,
  PULSE_CHANNELS,
  youtubeFeedUrl,
  type PulseRow,
} from '../_shared/pulseSources.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 20_000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

interface SourceOutcome {
  source: 'youtube' | 'instagram'
  started_at: string
  finished_at: string
  ok: boolean
  items: number
  message: string | null
  rows: PulseRow[]
}

async function collectYouTube(fetchedAt: string): Promise<SourceOutcome> {
  const started = new Date().toISOString()
  const rows: PulseRow[] = []
  const problems: string[] = []
  for (const ch of PULSE_CHANNELS.filter((c) => c.platform === 'youtube' && c.channelId)) {
    try {
      const res = await fetchWithTimeout(youtubeFeedUrl(ch.channelId!))
      if (!res.ok) {
        problems.push(`${ch.handle}: HTTP ${res.status}`)
        continue
      }
      rows.push(...parseYouTubeFeed(await res.text(), ch, fetchedAt))
    } catch (e) {
      problems.push(`${ch.handle}: ${e instanceof Error ? e.message : 'unreachable'}`)
    }
  }
  return {
    source: 'youtube',
    started_at: started,
    finished_at: new Date().toISOString(),
    ok: rows.length > 0,
    items: rows.length,
    message: problems.length ? problems.join('; ') : null,
    rows,
  }
}

async function collectInstagram(fetchedAt: string): Promise<SourceOutcome> {
  const started = new Date().toISOString()
  const token = Deno.env.get('APIFY_TOKEN')
  if (!token) {
    return { source: 'instagram', started_at: started, finished_at: started, ok: false, items: 0, message: 'not configured: set the APIFY_TOKEN secret', rows: [] }
  }
  try {
    const res = await fetchWithTimeout(
      'https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?timeout=150',
      {
        method: 'POST',
        // Token in a header, not the URL, so it never lands in request logs.
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(apifyInstagramInput(PULSE_CHANNELS)),
      },
      170_000,
    )
    if (!res.ok) {
      return { source: 'instagram', started_at: started, finished_at: new Date().toISOString(), ok: false, items: 0, message: `Apify HTTP ${res.status}`, rows: [] }
    }
    const items = await res.json()
    const rows = Array.isArray(items) ? mapApifyInstagram(items, PULSE_CHANNELS, fetchedAt) : []
    return {
      source: 'instagram',
      started_at: started,
      finished_at: new Date().toISOString(),
      ok: rows.length > 0,
      items: rows.length,
      message: rows.length ? null : 'Apify returned no posts (profiles private, renamed, or blocked)',
      rows,
    }
  } catch (e) {
    return { source: 'instagram', started_at: started, finished_at: new Date().toISOString(), ok: false, items: 0, message: e instanceof Error ? e.message : 'unreachable', rows: [] }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const secret = Deno.env.get('PULSE_CRON_SECRET')
  if (!secret) return json({ error: 'not_configured', message: 'Set the PULSE_CRON_SECRET secret.' }, 503)
  if (req.headers.get('x-pulse-secret') !== secret) return json({ error: 'unauthorized' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'not_configured', message: 'Supabase service credentials missing.' }, 503)
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const fetchedAt = new Date().toISOString()
  const outcomes = await Promise.all([collectYouTube(fetchedAt), collectInstagram(fetchedAt)])

  const summary = []
  for (const o of outcomes) {
    let message = o.message
    if (o.rows.length) {
      const up = await db.from('pulse_items').upsert(o.rows, { onConflict: 'key' })
      if (up.error) {
        message = `store failed: ${up.error.message}`
      } else {
        const stats = o.rows.map((r) => ({ key: r.key, captured_at: fetchedAt, views: r.views, likes: r.likes, comments: r.comments }))
        const st = await db.from('pulse_item_stats').upsert(stats, { onConflict: 'key,captured_at' })
        if (st.error) message = `${message ? `${message}; ` : ''}stats failed: ${st.error.message}`
      }
    }
    await db.from('pulse_runs').insert({ source: o.source, started_at: o.started_at, finished_at: o.finished_at, ok: o.ok, items: o.items, message })
    summary.push({ source: o.source, ok: o.ok, items: o.items, message })
  }
  return json({ fetchedAt, summary })
})
