// Kalaburagi pulse: the channels we follow and how their public feeds map to rows.
//
// Pure TypeScript with no imports, so the same file runs in the Edge Function (Deno) and is
// unit-tested by the app's test suite. Nothing here holds a key or calls the network.
//
// YouTube: the public RSS feed at https://www.youtube.com/feeds/videos.xml?channel_id=… needs no
// key and returns each channel's latest 15 uploads with publish time, description and views.
// Instagram: read through Apify's instagram-scraper actor when APIFY_TOKEN is set as a Supabase
// secret (https://apify.com/apify/instagram-scraper). Without it, Instagram is reported as not
// configured; nothing is invented in its place.

export interface PulseChannel {
  platform: 'youtube' | 'instagram'
  handle: string
  name: string
  url: string
  /** YouTube channel id, for the RSS feed. */
  channelId?: string
  /** Audience shown on the channel page when it was added (context only, not refreshed). */
  audience: string
  note?: string
}

// YouTube ids were read from the channels' own pages on 22 Oct 2026; Instagram handles were
// given by the project owner and their follower counts read from the public profiles that day.
export const PULSE_CHANNELS: PulseChannel[] = [
  { platform: 'instagram', handle: 'gulbarga_ki_awaaz', name: 'Gulbarga Ki Awaaz', url: 'https://www.instagram.com/gulbarga_ki_awaaz/', audience: '195k followers', note: "Calls itself Kalyan Karnataka Region's most credible source of news." },
  { platform: 'instagram', handle: 'gohash_network', name: 'gohash.in', url: 'https://www.instagram.com/gohash_network/', audience: '81k followers' },
  { platform: 'instagram', handle: 'gulbarganewss', name: 'Gulbarga News', url: 'https://www.instagram.com/gulbarganewss/', audience: '67.4k followers' },
  { platform: 'instagram', handle: 'kalaburagi24.7', name: 'Kalaburagi 24/7', url: 'https://www.instagram.com/kalaburagi24.7/', audience: '59.2k followers', note: 'Breaking, civic, crime and events.' },
  { platform: 'youtube', handle: 'gohash22', name: 'gohash', channelId: 'UCXkdatbW1bd57EJ93zF3MXg', url: 'https://www.youtube.com/@gohash22', audience: '295k subscribers', note: 'Posts a "GLB | Daily Bulletin" every day.' },
  { platform: 'youtube', handle: 'GulbargaHeadlines', name: 'Gulbarga Headlines', channelId: 'UCwqnrbnF5EJuuIdums-VGYA', url: 'https://www.youtube.com/@GulbargaHeadlines', audience: '123k subscribers' },
  { platform: 'youtube', handle: 'gulbarganews', name: 'Gulbarga News', channelId: 'UCMUIlfF-aLr870AAXOpAllA', url: 'https://www.youtube.com/@gulbarganews', audience: '64.9k subscribers', note: 'Linked from the @gulbarganewss Instagram profile.' },
  { platform: 'youtube', handle: 'Gulbarga24News', name: 'Gulbarga 24 News', channelId: 'UCTJo3BiZq1EXxYXMWr_f2_Q', url: 'https://www.youtube.com/@Gulbarga24News', audience: '10.2k subscribers' },
  { platform: 'youtube', handle: 'Kalaburagi247', name: 'Kalaburagi 24.7', channelId: 'UC72jKlBY4V2yWWLG88AhIAQ', url: 'https://www.youtube.com/@Kalaburagi247', audience: '5.89k subscribers', note: 'YouTube side of @kalaburagi24.7.' },
]

/** One row of public.pulse_items. */
export interface PulseRow {
  key: string
  platform: 'youtube' | 'instagram'
  channel: string
  channel_name: string
  kind: 'video' | 'short' | 'reel' | 'post'
  item_id: string
  url: string
  title: string
  body: string
  published_at: string | null
  views: number | null
  likes: number | null
  comments: number | null
  fetched_at: string
}

export function youtubeFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))
  return m ? decodeXml(m[1]).trim() : null
}

function attr(block: string, name: string, attribute: string): string | null {
  const m = block.match(new RegExp(`<${name}\\s[^>]*${attribute}="([^"]*)"`))
  return m ? decodeXml(m[1]) : null
}

const int = (s: string | null): number | null => {
  if (s == null || s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : null
}

/** Parse a YouTube channel Atom feed. Rows without a video id are skipped, never guessed. */
export function parseYouTubeFeed(xml: string, channel: PulseChannel, fetchedAt: string): PulseRow[] {
  const rows: PulseRow[] = []
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1]
    const id = tag(e, 'yt:videoId')
    if (!id) continue
    const link = attr(e, 'link', 'href') ?? `https://www.youtube.com/watch?v=${id}`
    rows.push({
      key: `youtube:${id}`,
      platform: 'youtube',
      channel: channel.handle,
      channel_name: tag(e, 'name') ?? channel.name,
      kind: link.includes('/shorts/') ? 'short' : 'video',
      item_id: id,
      url: link,
      title: tag(e, 'title') ?? tag(e, 'media:title') ?? '',
      body: tag(e, 'media:description') ?? '',
      published_at: tag(e, 'published'),
      views: int(attr(e, 'media:statistics', 'views')),
      likes: int(attr(e, 'media:starRating', 'count')),
      comments: null,
      fetched_at: fetchedAt,
    })
  }
  return rows
}

/** Apify instagram-scraper input for the followed profiles. */
export function apifyInstagramInput(channels: PulseChannel[], perProfile = 12) {
  return {
    directUrls: channels.filter((c) => c.platform === 'instagram').map((c) => c.url),
    resultsType: 'posts',
    resultsLimit: perProfile,
    addParentData: false,
  }
}

interface ApifyPost {
  id?: string
  shortCode?: string
  url?: string
  caption?: string
  timestamp?: string
  type?: string
  productType?: string
  ownerUsername?: string
  ownerFullName?: string
  likesCount?: number
  commentsCount?: number
  videoViewCount?: number
  videoPlayCount?: number
}

/** Map Apify instagram-scraper dataset items. Hidden like counts (-1) become null, not zero. */
export function mapApifyInstagram(items: unknown[], channels: PulseChannel[], fetchedAt: string): PulseRow[] {
  const byHandle = new Map(channels.map((c) => [c.handle.toLowerCase(), c]))
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null)
  const rows: PulseRow[] = []
  for (const raw of items) {
    const p = raw as ApifyPost
    const code = p.shortCode
    const owner = (p.ownerUsername ?? '').toLowerCase()
    if (!code || !owner) continue
    const ch = byHandle.get(owner)
    const caption = (p.caption ?? '').trim()
    const firstLine = caption.split('\n').find((l) => l.trim()) ?? ''
    rows.push({
      key: `instagram:${code}`,
      platform: 'instagram',
      channel: ch?.handle ?? owner,
      channel_name: ch?.name ?? p.ownerFullName ?? owner,
      kind: p.productType === 'clips' ? 'reel' : p.type === 'Video' ? 'video' : 'post',
      item_id: code,
      url: p.url ?? `https://www.instagram.com/p/${code}/`,
      title: firstLine.length > 160 ? `${firstLine.slice(0, 159)}…` : firstLine,
      body: caption,
      published_at: p.timestamp ?? null,
      views: n(p.videoPlayCount) ?? n(p.videoViewCount),
      likes: n(p.likesCount),
      comments: n(p.commentsCount),
      fetched_at: fetchedAt,
    })
  }
  return rows
}
