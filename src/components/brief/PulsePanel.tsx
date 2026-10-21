import clsx from 'clsx'
import { ExternalLink, Megaphone, TrendingUp } from 'lucide-react'
import { competitorPromos, TOPIC_LABELS } from '../../brief/pulse/analyze'
import { TRACKED_CHANNELS } from '../../brief/pulse/channels'
import type { PulseEvent, ScoredItem } from '../../brief/pulse/types'
import type { Brief } from '../../brief/types'
import { longDate } from './briefFormat'

const fmtViews = (n: number | null) => (n == null ? '—' : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n))

function PostLink({ item, extra }: { item: ScoredItem; extra?: string }) {
  return (
    <li className="py-2.5">
      <a href={item.url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink group-hover:underline">{item.title}</span>
          <span className="mt-0.5 block text-xs text-ink/50">
            {item.channelName} · {item.platform === 'youtube' ? (item.kind === 'short' ? 'YouTube short' : 'YouTube') : 'Instagram'}
            {item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
            {item.places.length ? ` · ${item.places.join(', ')}` : ''}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs tabular-nums text-ink/60">
          <span className="block font-semibold text-ink">{fmtViews(item.views)} views</span>
          {extra && <span className="block">{extra}</span>}
        </span>
      </a>
    </li>
  )
}

function EventRow({ e }: { e: PulseEvent }) {
  return (
    <li className="flex gap-3 py-2.5 text-sm">
      <span
        className={clsx(
          'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
          e.kind === 'disruption' || e.kind === 'notice' ? 'bg-danger/10 text-danger' : e.kind === 'gathering' ? 'bg-forest text-white' : 'bg-mist text-ink/70',
        )}
      >
        {e.kind}
      </span>
      <div className="min-w-0">
        <a href={e.url} target="_blank" rel="noreferrer" className="font-medium text-ink hover:underline">
          {e.title}
        </a>
        <p className="text-xs text-ink/50">
          {e.date ? `${longDate(e.date)}${e.endDate ? ` to ${longDate(e.endDate)}` : ''}` : 'Standing notice'}
          {e.dateBasis === 'relative' ? ' (from “tomorrow/today” in the post)' : ''} · {e.channelName}
        </p>
      </div>
    </li>
  )
}

function Block({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-forest/10 bg-white p-4 sm:p-5">
      <h3 className="font-semibold text-ink">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-ink/50">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  )
}

export function PulsePanel({ brief }: { brief: Brief }) {
  const P = brief.pulse
  const status = brief.sources.find((s) => s.id === 'pulse')
  if (!P) {
    return (
      <div className="rounded-2xl border border-forest/10 bg-mist/60 p-5 text-sm text-ink/70">
        <p className="font-semibold text-ink">The local news pulse did not load.</p>
        <p className="mt-1">{status?.message ?? 'No reason was given.'}</p>
        <p className="mt-3 text-xs text-ink/55">
          It reads these channels once the collector is deployed: {TRACKED_CHANNELS.map((c) => `${c.name} (${c.platform === 'youtube' ? 'YouTube' : 'Instagram'})`).join(', ')}. The rest of the brief does not depend on it.
        </p>
      </div>
    )
  }
  const rivals = competitorPromos(P, brief.archetype.id)
  const topics = P.topicMix.filter((t) => t.topic !== 'other').slice(0, 8)
  const maxTopic = Math.max(1, ...topics.map((t) => t.count))
  const ig = P.sources.find((s) => s.source === 'instagram')
  return (
    <div className="space-y-4">
      <p className="text-xs text-ink/55">
        {P.items.length} posts from {P.channels.length} channels
        {P.freshAt ? `, collected ${new Date(P.freshAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}.{' '}
        {ig && !ig.ok ? `Instagram not collected: ${ig.message ?? 'failed'}.` : ''} Outlier = views ÷ that channel’s usual views for the same format.
      </p>

      {(P.notices.length > 0 || P.upcoming.length > 0) && (
        <Block title="Announced in the local news" hint="Read from the posts’ own words. Open a post before acting on it.">
          <ul className="divide-y divide-forest/8">
            {[...P.notices.slice(0, 2), ...P.upcoming.slice(0, 8)].map((e) => (
              <EventRow key={`${e.sourceKey}-${e.date}-${e.kind}`} e={e} />
            ))}
          </ul>
        </Block>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Beating their usual reach" hint={`Local posts from the last ${P.windowDays} days`}>
          {P.outliers.length ? (
            <ul className="divide-y divide-forest/8">
              {P.outliers.slice(0, 6).map((o) => (
                <PostLink key={o.key} item={o} extra={`${(o.outlier ?? 0).toFixed(1)}× usual`} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/55">No local post beat its channel by 1.5× or more.</p>
          )}
        </Block>

        <Block title={`Rivals advertising: ${brief.archetype.label.toLowerCase()}`} hint="Paid features and offers on these channels">
          {rivals.length ? (
            <ul className="divide-y divide-forest/8">
              {rivals.slice(0, 6).map((o) => (
                <PostLink key={o.key} item={o} extra={o.outlier != null ? `${o.outlier.toFixed(1)}× usual` : undefined} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/55">No adverts for this line of business in the posts collected.</p>
          )}
        </Block>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Block title="What the city is talking about">
          <ul className="space-y-2">
            {topics.map((t) => (
              <li key={t.topic} className="text-xs">
                <div className="flex justify-between gap-2 text-ink/70">
                  <span>{TOPIC_LABELS[t.topic]}</span>
                  <span className="tabular-nums">{t.count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-mist">
                  <div className="h-1.5 rounded-full bg-forest" style={{ width: `${(100 * t.count) / maxTopic}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Places in the news">
          {P.hotPlaces.length ? (
            <ul className="space-y-1.5 text-sm">
              {P.hotPlaces.slice(0, 8).map((p) => (
                <li key={p.place} className="flex justify-between gap-2">
                  <span className="text-ink">{p.place}</span>
                  <span className="tabular-nums text-ink/50">{p.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/55">No locality named in the posts.</p>
          )}
        </Block>

        <Block title="What gets views here" hint="Median outlier of posts using each pattern">
          {P.patterns.length ? (
            <ul className="space-y-2 text-sm">
              {P.patterns.slice(0, 6).map((p) => (
                <li key={p.pattern} className="flex items-start justify-between gap-2">
                  <span className="flex items-start gap-1.5 text-ink">
                    {(p.medianOutlier ?? 0) >= 1.2 ? <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> : <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/40" aria-hidden />}
                    {p.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink/60">{p.medianOutlier?.toFixed(1)}× · {p.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/55">Not enough posts yet.</p>
          )}
        </Block>
      </div>

      {P.rising.length > 0 && (
        <Block title="Rising in the last day" hint="Views gained between collection runs">
          <ul className="divide-y divide-forest/8">
            {P.rising.slice(0, 5).map((o) => (
              <PostLink key={o.key} item={o} extra={`+${fmtViews(o.gain24h)} in a day`} />
            ))}
          </ul>
        </Block>
      )}

      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/50">
        Following:
        {TRACKED_CHANNELS.map((c) => (
          <a key={`${c.platform}-${c.handle}`} href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline-offset-4 hover:underline">
            {c.name} ({c.platform === 'youtube' ? 'YT' : 'IG'}) <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ))}
      </p>
    </div>
  )
}
