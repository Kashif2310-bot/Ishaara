import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  XCircle,
  Eye,
  Search,
  Sprout,
  Store,
  Zap,
} from 'lucide-react'
import { DIMENSION_LABELS } from '../../brief/metrics'
import { SOURCE_INFO } from '../../brief/sources'
import { WEEKDAYS, weekday } from '../../brief/calendar'
import { longDate, VERDICT_TEXT } from './briefFormat'
import type { Brief, CalendarEvent, Dimension, DriverValue, Metric, Tactic } from '../../brief/types'

function ago(ms: number): string {
  const m = Math.round((Date.now() - ms) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  return `${Math.round(m / 60)} h ago`
}

/** Jump to a metric row in the ledger and open its section. */
export function MetricChip({ id, metrics }: { id: string; metrics: Map<string, Metric> }) {
  const m = metrics.get(id)
  if (!m) return null
  return (
    <a
      href={`#m-${id}`}
      onClick={() => {
        const el = document.getElementById(`m-${id}`)
        const details = el?.closest('details')
        if (details) details.open = true
      }}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-forest/15 bg-white px-2 py-0.5 text-[11px] font-medium text-ink/70 hover:border-forest/40"
      title={m.method}
    >
      <span className="truncate">{m.label}</span>
      <span className="font-semibold text-ink">{m.display}</span>
    </a>
  )
}

export function VerdictCard({ brief }: { brief: Brief }) {
  const producer = brief.archetype.id === 'farm_crop' || brief.archetype.id === 'dairy' || brief.archetype.id === 'poultry'
  const v = brief.verdict
  const idx = brief.index
  return (
    <section
      aria-label="Decision for tomorrow"
      className={clsx(
        'overflow-hidden rounded-[1.75rem] p-6 sm:p-8',
        v === 'push' && 'bg-forest text-white',
        v === 'normal' && 'border border-forest/15 bg-white text-ink',
        v === 'protect' && 'border-2 border-danger/60 bg-white text-ink',
        v == null && 'border border-forest/15 bg-mist text-ink',
      )}
    >
      <p className={clsx('text-xs font-semibold uppercase tracking-[0.18em]', v === 'push' ? 'text-white/60' : 'text-ink/55')}>
        For {longDate(brief.tomorrow)} · {brief.place?.district ?? brief.place?.displayName.split(',')[0] ?? brief.input.place}
        {brief.place?.state ? `, ${brief.place.state}` : ''}
      </p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h2 className={clsx('font-display text-5xl font-bold tracking-tight sm:text-6xl', v === 'protect' && 'text-danger')}>
            {v ? (producer ? VERDICT_TEXT[v].producer : VERDICT_TEXT[v].word) : 'No call'}
          </h2>
          <p className={clsx('mt-3 max-w-2xl text-base leading-relaxed sm:text-lg', v === 'push' ? 'text-white/85' : 'text-ink/75')}>
            {brief.headline}
          </p>
        </div>
        <div className="flex gap-6 sm:gap-8">
          <Stat label="Opportunity" value={idx} suffix="/100" dark={v === 'push'} />
          <Stat label="Location" value={brief.locationStrength} suffix="/100" dark={v === 'push'} />
          <Stat label="Confidence" value={brief.confidence} suffix="/100" dark={v === 'push'} />
        </div>
      </div>
      <p className={clsx('mt-5 text-xs', v === 'push' ? 'text-white/55' : 'text-ink/50')}>
        Read as a {brief.archetype.label.toLowerCase()}
        {brief.archetype.matched ? ` (matched “${brief.archetype.matched}”)` : ''} · {brief.metrics.filter((m) => m.value != null).length} of {brief.metrics.length} metrics live ·{' '}
        {brief.coverage.live} of {brief.coverage.total} sources answered
      </p>
    </section>
  )
}

function Stat({ label, value, suffix, dark }: { label: string; value: number | null; suffix: string; dark: boolean }) {
  return (
    <div>
      <p className={clsx('text-[11px] font-semibold uppercase tracking-[0.14em]', dark ? 'text-white/55' : 'text-ink/50')}>{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums">
        {value == null ? '—' : Math.round(value)}
        <span className={clsx('text-sm font-medium', dark ? 'text-white/50' : 'text-ink/40')}>{value == null ? '' : suffix}</span>
      </p>
    </div>
  )
}

const KIND_META: Record<Tactic['kind'], { label: string; Icon: typeof Zap }> = {
  act: { label: 'Do', Icon: Zap },
  avoid: { label: 'Avoid', Icon: AlertTriangle },
  watch: { label: 'Watch', Icon: Eye },
  field: { label: 'Field', Icon: Sprout },
}

export function TacticList({ tactics, metrics }: { tactics: Tactic[]; metrics: Map<string, Metric> }) {
  const [all, setAll] = useState(false)
  const shown = all ? tactics : tactics.slice(0, 8)
  if (!tactics.length) return <p className="text-sm text-ink/60">No specific actions came out of tomorrow’s data.</p>
  return (
    <div>
      <ol className="space-y-3">
        {shown.map((t, i) => {
          const { label, Icon } = KIND_META[t.kind]
          return (
            <li key={t.id} className="rounded-2xl border border-forest/10 bg-white p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 font-display text-sm font-bold tabular-nums text-ink/35">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        t.kind === 'avoid' ? 'bg-danger/10 text-danger' : t.kind === 'act' ? 'bg-forest text-white' : 'bg-mist text-ink/70',
                      )}
                    >
                      <Icon className="h-3 w-3" aria-hidden />
                      {label}
                    </span>
                    <h3 className="font-semibold text-ink">{t.title}</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{t.detail}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.basis.map((b) => (
                      <MetricChip key={b} id={b} metrics={metrics} />
                    ))}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {tactics.length > 8 && (
        <button type="button" onClick={() => setAll((x) => !x)} className="mt-3 text-sm font-semibold text-forest underline underline-offset-4">
          {all ? 'Show the top 8' : `Show all ${tactics.length} actions`}
        </button>
      )}
    </div>
  )
}

export function DriverBars({ drivers, metrics }: { drivers: DriverValue[]; metrics: Map<string, Metric> }) {
  const max = Math.max(0.5, ...drivers.map((d) => Math.abs(d.contribution)))
  return (
    <div className="space-y-2.5">
      {drivers.map((d) => {
        const pct = (Math.abs(d.contribution) / max) * 50
        const off = d.weight === 0
        return (
          <details key={d.id} className={clsx('group rounded-xl px-2 py-1.5 open:bg-mist/60', off && 'opacity-50')}>
            <summary className="grid cursor-pointer list-none grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 sm:grid-cols-[12rem_1fr_4rem]">
              <span className="truncate text-sm font-medium text-ink">{d.label}</span>
              <span className="relative h-3 rounded-full bg-mist" aria-hidden>
                <span className="absolute inset-y-0 left-1/2 w-px bg-ink/25" />
                {d.signal != null && !off && (
                  <span
                    className={clsx('absolute inset-y-0 rounded-full', d.contribution >= 0 ? 'bg-forest' : 'bg-danger/70')}
                    style={d.contribution >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
                  />
                )}
              </span>
              <span className="text-right text-xs tabular-nums text-ink/60">
                {d.signal == null ? 'no data' : off ? 'n/a' : `${d.contribution >= 0 ? '+' : '−'}${Math.abs(d.contribution).toFixed(2)}`}
              </span>
            </summary>
            <div className="mt-2 space-y-2 pb-1 pl-1 text-xs text-ink/65">
              <p>{d.explanation}</p>
              <p>
                Signal {d.signal == null ? '—' : d.signal.toFixed(2)} × sensitivity {d.weight.toFixed(1)} = {d.contribution.toFixed(2)}
                {off ? ' (this business does not respond to it)' : ''}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {d.basis.map((b) => (
                  <MetricChip key={b} id={b} metrics={metrics} />
                ))}
              </div>
            </div>
          </details>
        )
      })}
    </div>
  )
}

export function OutlookStrip({ brief }: { brief: Brief }) {
  if (!brief.outlook.length) return <p className="text-sm text-ink/60">The forecast did not load, so there is no week view.</p>
  return (
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
      {brief.outlook.map((d, i) => (
        <div
          key={d.date}
          className={clsx(
            'min-w-[8.25rem] flex-1 snap-start rounded-2xl p-3',
            d.verdict === 'push' && 'bg-forest text-white',
            d.verdict === 'normal' && 'border border-forest/12 bg-white',
            d.verdict === 'protect' && 'border border-danger/50 bg-white',
            d.verdict == null && 'bg-mist',
          )}
        >
          <p className={clsx('text-[11px] font-semibold uppercase tracking-wider', d.verdict === 'push' ? 'text-white/60' : 'text-ink/50')}>
            {i === 0 ? 'Tomorrow' : WEEKDAYS[weekday(d.date)].slice(0, 3)} {d.date.slice(8)}
          </p>
          <p className={clsx('mt-1 font-display text-2xl font-bold tabular-nums', d.verdict === 'protect' && 'text-danger')}>
            {d.index == null ? '—' : Math.round(d.index)}
          </p>
          <p className={clsx('text-xs font-semibold', d.verdict === 'push' ? 'text-white/80' : 'text-ink/65')}>
            {d.verdict ? VERDICT_TEXT[d.verdict].word : 'No call'}
          </p>
          {d.tags.length > 0 && (
            <ul className={clsx('mt-2 space-y-0.5 text-[11px] leading-snug', d.verdict === 'push' ? 'text-white/70' : 'text-ink/55')}>
              {d.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

export function EventList({ events }: { events: CalendarEvent[] }) {
  if (!events.length) return <p className="text-sm text-ink/60">No listed holidays or festivals in the next 45 days.</p>
  return (
    <ul className="divide-y divide-forest/8">
      {events.slice(0, 12).map((e) => (
        <li key={`${e.date}-${e.name}`} className="flex gap-3 py-2.5 text-sm">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium text-ink">
              {e.name} <span className="font-normal text-ink/50">· {longDate(e.date)}</span>
            </p>
            <p className="text-xs text-ink/50">
              {e.kind === 'national' ? 'Gazetted holiday' : e.kind === 'restricted' ? 'Restricted holiday' : e.kind === 'state' ? 'State holiday' : 'Computed Islamic date'} · {e.source}
              {e.note ? ` · ${e.note}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function CompetitorList({ brief }: { brief: Brief }) {
  if (!brief.competitors.length) {
    const failed = brief.sources.find((s) => s.id === 'osm' && !s.ok)
    return (
      <p className="text-sm text-ink/60">
        {failed ? 'The map service did not answer, so competitors are unknown.' : 'No similar businesses are mapped within 2 km. Unmapped shops are not counted.'}
      </p>
    )
  }
  return (
    <ul className="divide-y divide-forest/8">
      {brief.competitors.map((c, i) => (
        <li key={`${c.name}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Store className="h-4 w-4 shrink-0 text-ink/40" aria-hidden />
            <span className="truncate">{c.name || <span className="text-ink/45">Unnamed {c.kind.replace(/_/g, ' ')}</span>}</span>
          </span>
          <span className="shrink-0 tabular-nums text-ink/55">{c.distanceM.toLocaleString('en-IN')} m</span>
        </li>
      ))}
    </ul>
  )
}

const DIM_ORDER: Dimension[] = [
  'decision',
  'weather_tomorrow',
  'weather_week',
  'climate',
  'air',
  'soil_crop',
  'water',
  'calendar',
  'demand_anchors',
  'competition',
  'place',
  'data_quality',
]

export function MetricLedger({ metrics }: { metrics: Metric[] }) {
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const hit = (m: Metric) => !needle || `${m.label} ${m.display} ${m.method} ${m.reference ?? ''}`.toLowerCase().includes(needle)
    return DIM_ORDER.map((d) => ({ d, rows: metrics.filter((m) => m.dimension === d && hit(m)) })).filter((g) => g.rows.length)
  }, [metrics, q])
  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search metrics</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${metrics.length} metrics (try “rain”, “PM2.5”, “spray”)`}
          className="w-full rounded-full border border-forest/15 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-forest/50"
        />
      </label>
      <div className="mt-4 space-y-2">
        {groups.map(({ d, rows }) => (
          <details key={d} open={q.trim() !== '' || d === 'decision'} className="group rounded-2xl border border-forest/10 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="font-semibold text-ink">{DIMENSION_LABELS[d]}</span>
              <span className="flex items-center gap-2 text-xs text-ink/50">
                {rows.filter((r) => r.value != null).length}/{rows.length}
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden />
              </span>
            </summary>
            <div className="overflow-x-auto border-t border-forest/8">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <tbody className="divide-y divide-forest/6">
                  {rows.map((m) => (
                    <tr key={m.id} id={`m-${m.id}`} className="scroll-mt-28 align-top target:bg-gold/30">
                      <td className="w-[38%] px-4 py-2.5">
                        <p className="font-medium text-ink">{m.label}</p>
                        <p className="mt-0.5 text-[11px] text-ink/45">
                          {m.method}
                          {m.reference ? ` · ${m.reference}` : ''}
                        </p>
                      </td>
                      <td className={clsx('px-4 py-2.5 font-semibold tabular-nums', m.value == null ? 'text-ink/35' : 'text-ink')}>{m.display}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] text-ink/45">{SOURCE_INFO.find((s) => s.id === m.source)?.name.split(' (')[0] ?? m.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
        {!groups.length && <p className="px-1 text-sm text-ink/55">No metric matches “{q}”.</p>}
      </div>
    </div>
  )
}

export function SourceList({ brief }: { brief: Brief }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {brief.sources.map((s) => {
        const info = SOURCE_INFO.find((i) => i.id === s.id)
        return (
          <li key={s.id} className="rounded-2xl border border-forest/10 bg-white p-3.5 text-sm">
            <div className="flex items-start gap-2">
              {s.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />}
              <div className="min-w-0">
                <a href={info?.url} target="_blank" rel="noreferrer" className="font-semibold text-ink underline-offset-4 hover:underline">
                  {info?.name ?? s.id}
                </a>
                <p className="mt-0.5 text-xs text-ink/55">{info?.note}</p>
                <p className={clsx('mt-1 text-xs font-medium', s.ok ? 'text-ink/60' : 'text-danger')}>
                  {s.ok
                    ? s.cached
                      ? `Cached from ${s.fetchedAt ? ago(s.fetchedAt) : 'earlier'} (reused for up to 3 hours)`
                      : s.id === 'calendar'
                        ? 'Built in'
                        : 'Live'
                    : `Unavailable: ${s.message ?? s.failure}`}
                  {s.ok && s.message ? ` · ${s.message}` : ''}
                </p>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
