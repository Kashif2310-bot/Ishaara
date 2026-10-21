// Tests for the Kalaburagi news pulse. SNAPSHOT is real public data captured on 22 Oct 2026
// (see snapshot.test-data.ts); the RSS and Apify samples below are SYNTHETIC, shaped like those
// services' responses, and labelled as such.
import { describe, expect, it } from 'vitest'
import { addDays } from '../calendar'
import { runBrief } from '../runBrief'
import * as F from '../fixtures.test-data'
import type { Place } from '../types'
import { analyzePulse, competitorPromos, median } from './analyze'
import { mapApifyInstagram, parseYouTubeFeed, PULSE_CHANNELS } from '../../../supabase/functions/_shared/pulseSources'
import { gainsFromStats, rowToItem, type PulseLoader } from './load'
import { SNAPSHOT, SNAPSHOT_CAPTURED_AT } from './snapshot.test-data'
import { datesIn, eventsIn, parseAge, parseCount, placesIn, scopeOf, topicsOf } from './text'
import type { PulseItem } from './types'

const NOW = new Date(SNAPSHOT_CAPTURED_AT)

function snapshotItems(): PulseItem[] {
  return SNAPSHOT.flatMap((c) =>
    c.rows.map(([id, title, views, age]) => {
      const pub = parseAge(age, NOW)
      return {
        key: `youtube:${id}`,
        platform: 'youtube' as const,
        channel: c.handle,
        channelName: c.name,
        kind: c.kind,
        id,
        url: c.kind === 'short' ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
        title,
        body: '',
        publishedAt: pub,
        publishedApprox: pub != null,
        views: parseCount(views),
        likes: null,
        comments: null,
        fetchedAt: SNAPSHOT_CAPTURED_AT,
        gain24h: null,
      }
    }),
  )
}

describe('reading counts, ages and dates', () => {
  it('parses YouTube count and age text', () => {
    expect(parseCount('3.4k')).toBe(3400)
    expect(parseCount('42k views')).toBe(42000)
    expect(parseCount('596')).toBe(596)
    expect(parseCount('1.2M')).toBe(1_200_000)
    expect(parseCount('')).toBeNull()
    expect(parseAge('1 day ago', NOW)?.slice(0, 10)).toBe('2026-10-20')
    expect(parseAge('7 hr ago', NOW)).toBe(new Date(NOW.getTime() - 7 * 3_600_000).toISOString())
    expect(parseAge('2 wk ago', NOW)?.slice(0, 10)).toBe('2026-10-07')
    expect(parseAge('', NOW)).toBeNull()
  })

  it('finds written dates and resolves the year from the posting day', () => {
    const range = datesIn('Buy 2 Items & Get 1 FREE! (Oct 15–18) Muslim Chowk', '2026-10-14')
    expect(range[0]).toMatchObject({ date: '2026-10-15', endDate: '2026-10-18', basis: 'stated' })
    expect(datesIn('BUY SOFA, GET TV UNIT FREE (VALID TILL OCT 25)', '2026-10-20')[0].date).toBe('2026-10-25')
    expect(datesIn('join Waqf Bachao program on 4th May at Peer Bangali Ground', '2026-04-28')[0].date).toBe('2026-05-04')
    expect(datesIn('Mega Trials in Gulbarga on October 18', '2026-10-10')[0].date).toBe('2026-10-18')
    expect(datesIn('camp on 21/11/2026 at Jagat Circle', '2026-11-01')[0].date).toBe('2026-11-21')
    expect(datesIn('Rathotsava tomorrow', '2027-03-26')[0]).toMatchObject({ date: '2027-03-27', basis: 'relative' })
  })

  it('reads topics, places and whether a post is about Kalaburagi', () => {
    const t = 'Kalaburagi: Grocery Shop Theft Near Khadri Chowk; CCTV Captures Two Thieves Escaping on a Bike.'
    expect(topicsOf(t)).toContain('crime_safety')
    expect(placesIn(t)).toEqual(['Khadri Chowk'])
    expect(scopeOf(t, placesIn(t))).toBe('local')
    expect(scopeOf('Chemical Tanker Catches Fire on Bengaluru NICE Road, 5-KM Traffic Jam', [])).toBe('outside')
    expect(topicsOf('PUBLIC NOTICE: All shops and commercial establishments must close by 11 PM.')).toContain('civic')
    expect(topicsOf('ಕಲಬುರಗಿಯಲ್ಲಿ ರೈತರ ಪ್ರತಿಭಟನೆ')).toEqual(expect.arrayContaining(['protest', 'weather_agri']))
  })
})

describe('events and notices', () => {
  const base: PulseItem = {
    key: 'youtube:x',
    platform: 'youtube',
    channel: 'gulbarganews',
    channelName: 'Gulbarga News',
    kind: 'video',
    id: 'x',
    url: 'https://www.youtube.com/watch?v=x',
    title: '',
    body: '',
    publishedAt: '2026-10-13T10:00:00Z',
    publishedApprox: false,
    views: 100,
    likes: null,
    comments: null,
    fetchedAt: '2026-10-22T00:00:00Z',
    gain24h: null,
  }
  it('turns the real closing-time notice into a standing notice', () => {
    const it0 = { ...base, title: 'PUBLIC NOTICE: All shops and commercial establishments must close by 11 PM. Citizens are urged ' }
    const ev = eventsIn(it0, topicsOf(it0.title), [], '2026-10-22')
    expect(ev[0]).toMatchObject({ kind: 'notice', date: null, title: 'Shops and commercial establishments must close by 11 PM' })
  })
  it('skips the date stamp of a daily bulletin', () => {
    const it0 = { ...base, title: 'GLB | DAILY BULLETIN 20 OCT 2026 GULBARGA' }
    expect(eventsIn(it0, topicsOf(it0.title), [], '2026-10-22')).toHaveLength(0)
  })
  it('only trusts "tomorrow" when the posting day is known', () => {
    const it0 = { ...base, title: 'SIR Verification Camp Tomorrow! Residents of Wards 27, 40 & 41', publishedAt: '2026-08-22T10:00:00Z', publishedApprox: true }
    expect(eventsIn(it0, topicsOf(it0.title), [], '2026-10-22')).toHaveLength(0)
    const exact = { ...it0, publishedApprox: false }
    expect(eventsIn(exact, topicsOf(exact.title), [], '2026-10-22')[0]).toMatchObject({ date: '2026-08-23', kind: 'gathering', dateBasis: 'relative' })
  })
  it('reads a protest with a date as a disruption', () => {
    const it0 = { ...base, title: 'Traders call Kalaburagi bandh on 30 October against road closure' }
    expect(eventsIn(it0, topicsOf(it0.title), [], '2026-10-22')[0]).toMatchObject({ kind: 'disruption', date: '2026-10-30' })
  })
})

describe('the pulse report on the real 22 Oct 2026 snapshot', () => {
  const report = analyzePulse(snapshotItems(), { now: NOW, today: '2026-10-22', windowDays: 14 })

  it('ranks posts against their own channel, not against bigger channels', () => {
    expect(report.outliers[0].title).toMatch(/Saree & Dresses in wholesale rate/)
    expect(report.outliers[0].outlier!).toBeGreaterThan(10)
    // Every outlier beats its own channel's median by at least 1.5×.
    for (const o of report.outliers) expect(o.outlier!).toBeGreaterThanOrEqual(1.5)
  })
  it('finds the closing-time notice and the furniture offer ending 25 Oct', () => {
    expect(report.notices.map((n) => n.title)).toContain('Shops and commercial establishments must close by 11 PM')
    expect(report.upcoming.some((e) => e.date === '2026-10-25' && e.kind === 'offer')).toBe(true)
  })
  it('puts the Bande Nawaz dargah at the top of places in the news', () => {
    expect(report.hotPlaces[0].place).toBe('Khwaja Bande Nawaz Dargah')
  })
  it('lists clothing rivals advertising on the channels', () => {
    const titles = competitorPromos(report, 'clothing').map((p) => p.title)
    expect(titles.some((t) => /AK Textile/.test(t))).toBe(true)
    expect(titles.some((t) => /MEN'S WEAR GRAND OPENING/.test(t))).toBe(true)
  })
  it('keeps news from elsewhere out of the local picture', () => {
    const tanker = report.items.find((i) => i.title.startsWith('Chemical Tanker'))
    expect(tanker?.scope).toBe('outside')
    expect(report.outliers.some((o) => o.scope === 'outside')).toBe(false)
  })
  it('summarises every channel it saw', () => {
    expect(report.channels.map((c) => c.channel).sort()).toEqual(['Gulbarga24News', 'GulbargaHeadlines', 'Kalaburagi247', 'gohash22', 'gulbarganews'])
    expect(median([1, 3, 2])).toBe(2)
  })
})

describe('collector parsing (synthetic samples shaped like the real services)', () => {
  const yt = PULSE_CHANNELS.find((c) => c.handle === 'gulbarganews')!
  // SYNTHETIC Atom feed in YouTube's format.
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <entry>
  <id>yt:video:AAAAAAAAAAA</id>
  <yt:videoId>AAAAAAAAAAA</yt:videoId>
  <title>Synthetic: Traffic diversion at Jagat Circle tomorrow &amp; Sunday</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=AAAAAAAAAAA"/>
  <author><name>Gulbarga News</name></author>
  <published>2026-10-21T09:30:00+00:00</published>
  <media:group>
   <media:title>Synthetic: Traffic diversion at Jagat Circle tomorrow &amp; Sunday</media:title>
   <media:description>Police notice for the procession route.</media:description>
   <media:community><media:starRating count="12" average="5.00" min="1" max="5"/><media:statistics views="1234"/></media:community>
  </media:group>
 </entry>
 <entry>
  <yt:videoId>BBBBBBBBBBB</yt:videoId>
  <title>Synthetic short</title>
  <link rel="alternate" href="https://www.youtube.com/shorts/BBBBBBBBBBB"/>
  <published>2026-10-20T09:30:00+00:00</published>
  <media:group><media:community><media:statistics views="0"/></media:community></media:group>
 </entry>
</feed>`
  it('parses a YouTube channel feed', () => {
    const rows = parseYouTubeFeed(feed, yt, '2026-10-22T00:00:00Z')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ key: 'youtube:AAAAAAAAAAA', kind: 'video', views: 1234, likes: 12, title: 'Synthetic: Traffic diversion at Jagat Circle tomorrow & Sunday', body: 'Police notice for the procession route.' })
    expect(rows[1]).toMatchObject({ kind: 'short', views: 0, channel_name: 'Gulbarga News' })
  })
  it('maps Apify Instagram posts and keeps hidden likes as unknown', () => {
    // SYNTHETIC Apify dataset items.
    const rows = mapApifyInstagram(
      [
        { shortCode: 'Cabc123', ownerUsername: 'gulbarga_ki_awaaz', caption: 'Synthetic reel\nsecond line', timestamp: '2026-10-21T12:00:00.000Z', productType: 'clips', type: 'Video', likesCount: -1, commentsCount: 4, videoPlayCount: 5000 },
        { shortCode: 'Cdef456', ownerUsername: 'someone_else', caption: 'x', type: 'Image', likesCount: 10 },
        { caption: 'no shortcode' },
      ],
      PULSE_CHANNELS,
      '2026-10-22T00:00:00Z',
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ key: 'instagram:Cabc123', kind: 'reel', channel_name: 'Gulbarga Ki Awaaz', title: 'Synthetic reel', likes: null, comments: 4, views: 5000 })
    expect(rows[1]).toMatchObject({ kind: 'post', views: null, likes: 10 })
  })
  it('computes a day’s view gain from the collector’s snapshots', () => {
    const now = new Date('2026-10-22T12:00:00Z')
    const g = gainsFromStats(
      [
        { key: 'a', captured_at: '2026-10-21T09:00:00Z', views: 100 },
        { key: 'a', captured_at: '2026-10-21T15:00:00Z', views: 150 },
        { key: 'a', captured_at: '2026-10-22T11:00:00Z', views: 400 },
        { key: 'b', captured_at: '2026-10-22T09:00:00Z', views: 50 },
      ],
      now,
    )
    // Base is the newest snapshot at least 20 h old (15:00 → 150), so the gain is 400 − 150.
    expect(g.get('a')).toBe(250)
    expect(g.has('b')).toBe(false)
  })
})

describe('the pulse inside the brief', () => {
  const KALABURAGI: Place = { query: 'Kalaburagi', displayName: 'Kalaburagi, Karnataka, India', lat: 17.3297, lng: 76.8343, district: 'Kalaburagi', state: 'Karnataka', cached: false }
  const today = '2026-10-22'
  const world = () =>
    F.routerFetch({
      forecast: F.syntheticForecast({ start: addDays(today, -7), days: 23, tMax: 31, tMin: 21, rh: 55, rainProb: 70, rainMmPerHour: 1, rainyDates: [], wind: 8 }),
      soil: F.syntheticSoil(today, 8),
      archive: F.syntheticArchive(today, 31),
      air: F.syntheticAir(today, 3, 25),
      flood: F.syntheticRiver(today, 16, 1),
      overpassCounts: (n) => F.syntheticOverpassCounts(Array.from({ length: n }, (_, i) => (i * 3) % 7)),
    })
  // Real snapshot posts plus one SYNTHETIC post announcing a gathering for tomorrow.
  const loader: PulseLoader = async () => ({
    ok: true,
    cached: false,
    fetchedAt: NOW.getTime(),
    data: {
      items: [
        ...snapshotItems(),
        rowToItem(
          { key: 'youtube:SYN', platform: 'youtube', channel: 'gulbarganews', channel_name: 'Gulbarga News', kind: 'video', item_id: 'SYN', url: 'https://www.youtube.com/watch?v=SYN', title: 'Synthetic: Kannada Rajyotsava procession from Jagat Circle on October 23', body: '', published_at: '2026-10-21T10:00:00Z', views: 900, likes: null, comments: null, fetched_at: SNAPSHOT_CAPTURED_AT },
          null,
        ),
      ],
      runs: [{ source: 'youtube', finished_at: SNAPSHOT_CAPTURED_AT, ok: true, items: 124, message: null }],
    },
  })

  it('lifts tomorrow for an announced gathering and turns notices into actions', async () => {
    const b = await runBrief({ business: 'tea stall', place: 'Kalaburagi', today }, { fetchImpl: world(), place: KALABURAGI, useCache: false, now: Date.parse(`${today}T20:00:00+05:30`), pulseLoader: loader })
    const d = b.drivers.find((x) => x.id === 'local_events')!
    expect(d.signal!).toBeGreaterThan(0)
    const ids = b.tactics.map((t) => t.id)
    expect(ids).toContain('pulse.notice')
    expect(ids.some((i) => i.startsWith('pulse.gather.'))).toBe(true)
    expect(b.metrics.find((m) => m.id === 'pulse.posts')!.value).toBeGreaterThan(50)
    expect(b.sources.find((s) => s.id === 'pulse')?.ok).toBe(true)
  })

  it('says the pulse is unavailable, and leaves its driver out, when it cannot load', async () => {
    const down: PulseLoader = async () => ({ ok: false, failure: 'not_configured', message: 'The pulse database is not connected in this build.' })
    const b = await runBrief({ business: 'tea stall', place: 'Kalaburagi', today }, { fetchImpl: world(), place: KALABURAGI, useCache: false, now: Date.parse(`${today}T20:00:00+05:30`), pulseLoader: down, pulseSnapshotFallback: false })
    expect(b.drivers.find((x) => x.id === 'local_events')?.signal).toBeNull()
    expect(b.metrics.find((m) => m.id === 'pulse.posts')?.display).toBe('Unavailable')
    expect(b.sources.find((s) => s.id === 'pulse')).toMatchObject({ ok: false, failure: 'not_configured' })
    expect(b.tactics.some((t) => t.id.startsWith('pulse.'))).toBe(false)
  })

  it('falls back to the labelled real snapshot when the live pulse is down', async () => {
    const down: PulseLoader = async () => ({ ok: false, failure: 'unreachable', message: 'Could not reach the pulse database.' })
    const b = await runBrief({ business: 'saree shop', place: 'Kalaburagi', today }, { fetchImpl: world(), place: KALABURAGI, useCache: false, now: Date.parse(`${today}T20:00:00+05:30`), pulseLoader: down })
    expect(b.pulseSnapshotAt).toBe(SNAPSHOT_CAPTURED_AT)
    expect(b.sources.find((s) => s.id === 'pulse')?.ok).toBe(false)
    expect(b.pulse?.notices.length).toBeGreaterThan(0)
    expect(b.metrics.find((m) => m.id === 'pulse.promos')!.value).toBeGreaterThan(0)
  })
})
