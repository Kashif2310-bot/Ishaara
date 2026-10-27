import { useEffect, useMemo, useState } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import clsx from 'clsx'
import { Check, CloudRain, Droplets, Loader2, MapPin, Newspaper, Sun, Thermometer, Wind, X } from 'lucide-react'
import { DIMENSION_LABELS } from '../../brief/metrics'
import { SOURCE_INFO } from '../../brief/sources'
import type { Brief, Dimension, Metric, SourceId, Tactic } from '../../brief/types'
import { longDate, VERDICT_TEXT } from './briefFormat'

// ---------------------------------------------------------------- animated number

export function CountUp({ to, duration = 1.2, decimals = 0 }: { to: number; duration?: number; decimals?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / (duration * 1000))
      const eased = 1 - Math.pow(1 - p, 3)
      setV(to * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, duration])
  return <>{v.toFixed(decimals)}</>
}

// ---------------------------------------------------------------- live clock (IST)

export function IstClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return <span className="tabular-nums">{fmt.format(now)} IST</span>
}

// ---------------------------------------------------------------- radar backdrop

export function RadarBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 70% 40%, black, transparent)',
        }}
      />
      <div className="absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full border border-white/10" />
      <div className="absolute -right-16 -top-16 h-[392px] w-[392px] rounded-full border border-white/10" />
      <div className="absolute right-[88px] top-[88px] h-[144px] w-[144px] rounded-full border border-white/15" />
      <motion.div
        className="absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full"
        style={{ background: 'conic-gradient(from 0deg, rgba(255,255,255,0.18), transparent 22%, transparent)' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
      />
      <div
        className="absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(ellipse 55% 50% at 15% 10%, rgba(255,255,255,0.10), transparent 60%), radial-gradient(ellipse 40% 40% at 90% 100%, rgba(16,185,129,0.10), transparent 60%)' }}
      />
    </div>
  )
}

// ---------------------------------------------------------------- loading scan

const SCAN_ORDER: SourceId[] = ['geocode', 'forecast', 'climate', 'air', 'river', 'elevation', 'osm', 'pulse', 'calendar']

export function SourceScan({ done }: { done: Partial<Record<SourceId, boolean>> }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-black p-6 text-white sm:p-8">
      <RadarBackdrop />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">Reading Kalaburagi right now</p>
        <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Consulting {SCAN_ORDER.length} live sources</h2>
        <ul className="mt-6 grid gap-2 sm:grid-cols-3">
          {SCAN_ORDER.map((id, i) => {
            const info = SOURCE_INFO.find((s) => s.id === id)
            const state = id === 'calendar' ? true : done[id]
            return (
              <motion.li
                key={id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={clsx(
                  'flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm transition',
                  state === true && 'border-emerald-400/40 bg-emerald-400/10',
                  state === false && 'border-red-400/40 bg-red-400/10',
                  state === undefined && 'border-white/10 bg-white/[0.04]',
                )}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10">
                  {state === true ? <Check className="h-4 w-4 text-emerald-300" /> : state === false ? <X className="h-4 w-4 text-red-300" /> : <Loader2 className="h-4 w-4 animate-spin text-white/70" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{info?.name.split(' (')[0] ?? id}</span>
                  <span className="block truncate text-[11px] text-white/45">{info?.note}</span>
                </span>
              </motion.li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- gauge

function Gauge({ value, verdict }: { value: number | null; verdict: Brief['verdict'] }) {
  const r = 84
  const c = Math.PI * r
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100
  const colour = verdict === 'push' ? '#34d399' : verdict === 'protect' ? '#f87171' : '#e5e5e5'
  return (
    <svg viewBox="0 0 200 118" className="w-full max-w-[280px]" role="img" aria-label={`Opportunity index ${value == null ? 'unavailable' : Math.round(value)} of 100`}>
      <path d={`M 16 104 A ${r} ${r} 0 0 1 184 104`} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="14" strokeLinecap="round" />
      {[35, 65].map((t) => {
        const a = Math.PI * (1 - t / 100)
        return <line key={t} x1={100 + 70 * Math.cos(a)} y1={104 - 70 * Math.sin(a)} x2={100 + 98 * Math.cos(a)} y2={104 - 98 * Math.sin(a)} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      })}
      <motion.path
        d={`M 16 104 A ${r} ${r} 0 0 1 184 104`}
        fill="none"
        stroke={colour}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
      <text x="100" y="92" textAnchor="middle" fill="white" fontSize="40" fontWeight="700" fontFamily="Syne, system-ui">
        {value == null ? '—' : Math.round(value)}
      </text>
      <text x="100" y="112" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" letterSpacing="2">
        OPPORTUNITY / 100
      </text>
      <text x="14" y="117" fill="rgba(255,255,255,0.4)" fontSize="8">0</text>
      <text x="180" y="117" fill="rgba(255,255,255,0.4)" fontSize="8">100</text>
    </svg>
  )
}

function Ring({ label, value }: { label: string; value: number | null }) {
  const r = 22
  const c = 2 * Math.PI * r
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <motion.circle cx="28" cy="28" r={r} fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 1.2, delay: 0.3 }} />
      </svg>
      <div>
        <p className="font-display text-xl font-bold tabular-nums">{value == null ? '—' : <CountUp to={value} />}</p>
        <p className="text-[11px] uppercase tracking-wider text-white/50">{label}</p>
      </div>
    </div>
  )
}

function metricValue(metrics: Metric[], id: string): Metric | undefined {
  return metrics.find((m) => m.id === id)
}

export function VerdictHero({ brief }: { brief: Brief }) {
  const producer = brief.archetype.id === 'farm_crop' || brief.archetype.id === 'dairy' || brief.archetype.id === 'poultry'
  const v = brief.verdict
  const facts = [
    { Icon: Thermometer, label: 'Feels like, max', m: metricValue(brief.metrics, 'wx.feels_max') },
    { Icon: CloudRain, label: 'Rain chance, trading hours', m: metricValue(brief.metrics, 'wx.rain_prob_trading') },
    { Icon: Sun, label: 'UV peak', m: metricValue(brief.metrics, 'wx.uv') },
    { Icon: Wind, label: 'Air (Indian AQI)', m: metricValue(brief.metrics, 'air.naqi') },
    { Icon: Droplets, label: 'Comfortable hours', m: metricValue(brief.metrics, 'wx.comfort_hours') },
    { Icon: Newspaper, label: 'In the local news', m: metricValue(brief.metrics, 'pulse.events_tomorrow') },
  ]
  return (
    <MotionConfig reducedMotion="user">
      <section aria-label="Decision for tomorrow" className="relative overflow-hidden rounded-[2rem] bg-black p-6 text-white shadow-2xl shadow-black/30 sm:p-9">
        <RadarBackdrop />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {brief.place?.displayName.split(',').slice(0, 2).join(',')} · for {longDate(brief.tomorrow)}
            </p>
            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className={clsx('mt-3 font-display text-6xl font-bold tracking-tight sm:text-7xl', v === 'push' && 'text-emerald-300', v === 'protect' && 'text-red-300')}
            >
              {v ? (producer ? VERDICT_TEXT[v].producer : VERDICT_TEXT[v].word) : 'No call'}
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-3 max-w-2xl text-lg leading-relaxed text-white/85">
              {brief.headline}
            </motion.p>
            <p className="mt-3 text-xs text-white/45">
              Read as a {brief.archetype.label.toLowerCase()}
              {brief.archetype.matched ? ` (matched “${brief.archetype.matched}”)` : ''} · {brief.metrics.filter((m) => m.value != null).length} of {brief.metrics.length} measurements live ·{' '}
              {brief.coverage.live} of {brief.coverage.total} sources answered
            </p>
            <div className="mt-6 flex flex-wrap gap-6">
              <Ring label="Confidence" value={brief.confidence} />
              <Ring label="Location strength" value={brief.locationStrength} />
              <Ring label="Coverage %" value={brief.metrics.length ? (100 * brief.metrics.filter((m) => m.value != null).length) / brief.metrics.length : null} />
            </div>
          </div>
          <div className="flex flex-col items-center">
            <Gauge value={brief.index} verdict={v} />
            <p className="mt-1 max-w-[16rem] text-center text-[11px] text-white/45">Below 35 protect · 35–64 normal · 65+ push</p>
          </div>
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {facts.map(({ Icon, label, m }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.05 }} className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur">
              <Icon className="h-4 w-4 text-white/60" aria-hidden />
              <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{m?.display ?? '—'}</p>
              <p className="mt-0.5 text-[11px] text-white/45">{label}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </MotionConfig>
  )
}

// ---------------------------------------------------------------- top actions

export function TopActions({ tactics }: { tactics: Tactic[] }) {
  const top = tactics.slice(0, 3)
  if (!top.length) return null
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {top.map((t, i) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * i }}
          className={clsx(
            'relative overflow-hidden rounded-[1.5rem] p-5',
            t.kind === 'avoid' ? 'bg-red-50 ring-1 ring-red-200' : i === 0 ? 'bg-forest text-white' : 'bg-white ring-1 ring-forest/10',
          )}
        >
          <p className={clsx('font-display text-5xl font-bold', t.kind === 'avoid' ? 'text-red-200' : i === 0 ? 'text-white/15' : 'text-ink/10')}>{String(i + 1).padStart(2, '0')}</p>
          <p className={clsx('mt-1 text-[10px] font-bold uppercase tracking-[0.18em]', t.kind === 'avoid' ? 'text-red-700' : i === 0 ? 'text-white/60' : 'text-ink/50')}>
            {t.kind === 'avoid' ? 'Avoid' : t.kind === 'watch' ? 'Watch' : t.kind === 'field' ? 'In the field' : 'Do'}
          </p>
          <h3 className="mt-1 text-lg font-semibold leading-snug">{t.title}</h3>
          <p className={clsx('mt-2 text-sm leading-relaxed', i === 0 && t.kind !== 'avoid' ? 'text-white/75' : 'text-ink/70')}>{t.detail}</p>
        </motion.div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- hour by hour

export function HourlyChart({ brief }: { brief: Brief }) {
  const rows = brief.hourly
  const W = 720
  const H = 260
  const left = 40
  const right = 16
  const y0 = 20
  const plotH = 150
  const barTop = y0 + plotH + 24
  const barH = 46
  const temps = rows.flatMap((r) => [r.t, r.feels]).filter((v): v is number => v != null)
  const lo = temps.length ? Math.floor(Math.min(...temps) - 2) : 15
  const hi = temps.length ? Math.ceil(Math.max(...temps) + 2) : 40
  const x = (h: number) => left + (h / 23) * (W - left - right)
  const y = (v: number) => y0 + plotH - ((v - lo) / Math.max(1, hi - lo)) * plotH
  const line = (key: 't' | 'feels') =>
    rows
      .filter((r) => r[key] != null)
      .map((r, i) => `${i ? 'L' : 'M'} ${x(r.hour).toFixed(1)} ${y(r[key] as number).toFixed(1)}`)
      .join(' ')
  const peak = useMemo(() => rows.reduce<(typeof rows)[number] | null>((a, r) => (r.feels != null && (a == null || (a.feels ?? -99) < r.feels) ? r : a), null), [rows])
  if (!rows.length) return <p className="text-sm text-ink/55">The hourly forecast did not load.</p>
  const ticks = [lo, Math.round((lo + hi) / 2), hi]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Tomorrow hour by hour: temperature, feels-like and rain chance">
      <rect x={x(7)} y={y0 - 8} width={x(21) - x(7)} height={plotH + 8} fill="rgba(0,0,0,0.035)" rx="8" />
      <text x={x(7) + 6} y={y0 + 4} fontSize="10" fill="rgba(0,0,0,0.45)">Trading hours 07:00–21:00</text>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="rgba(0,0,0,0.07)" />
          <text x={left - 6} y={y(t) + 3} fontSize="10" textAnchor="end" fill="rgba(0,0,0,0.45)">{`${t}°`}</text>
        </g>
      ))}
      {y(35) > y0 && y(35) < y0 + plotH && (
        <g>
          <line x1={left} x2={W - right} y1={y(35)} y2={y(35)} stroke="#dc2626" strokeDasharray="4 4" strokeOpacity="0.6" />
          <text x={W - right} y={y(35) - 4} fontSize="10" textAnchor="end" fill="#dc2626">35 °C feels-like: heat hurts footfall</text>
        </g>
      )}
      <motion.path d={line('feels')} fill="none" stroke="#111" strokeWidth="2.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
      <path d={line('t')} fill="none" stroke="#111" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 3" />
      {peak?.feels != null && (
        <g>
          <circle cx={x(peak.hour)} cy={y(peak.feels)} r="4.5" fill="#111" />
          <text x={x(peak.hour)} y={y(peak.feels) - 10} fontSize="11" fontWeight="600" textAnchor="middle" fill="#111">{`${Math.round(peak.feels)}° at ${String(peak.hour).padStart(2, '0')}:00`}</text>
        </g>
      )}
      <text x={left} y={barTop - 8} fontSize="10" fill="rgba(0,0,0,0.5)">Chance of rain</text>
      {rows.map((r) => {
        const p = r.prob ?? 0
        return (
          <g key={r.hour}>
            <rect x={x(r.hour) - 8} y={barTop + barH - (p / 100) * barH} width="16" height={Math.max(1, (p / 100) * barH)} rx="3" fill="#0ea5e9" fillOpacity={0.25 + (p / 100) * 0.6}>
              <title>{`${String(r.hour).padStart(2, '0')}:00 · ${r.t ?? '—'} °C (feels ${r.feels ?? '—'} °C) · rain ${p} % · UV ${r.uv ?? '—'}`}</title>
            </rect>
            {r.hour % 3 === 0 && (
              <text x={x(r.hour)} y={H - 4} fontSize="10" textAnchor="middle" fill="rgba(0,0,0,0.5)">{String(r.hour).padStart(2, '0')}</text>
            )}
          </g>
        )
      })}
      <g fontSize="10" fill="rgba(0,0,0,0.6)">
        <line x1={W - 220} x2={W - 200} y1={10} y2={10} stroke="#111" strokeWidth="2.5" />
        <text x={W - 196} y={13}>Feels like</text>
        <line x1={W - 130} x2={W - 110} y1={10} y2={10} stroke="#111" strokeOpacity="0.35" strokeDasharray="3 3" strokeWidth="1.5" />
        <text x={W - 106} y={13}>Air temperature</text>
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------- what it considered

const DIM_ORDER: Dimension[] = ['weather_tomorrow', 'weather_week', 'climate', 'air', 'soil_crop', 'water', 'calendar', 'local_pulse', 'demand_anchors', 'competition', 'place', 'data_quality', 'decision']

export function ConsideredGrid({ metrics }: { metrics: Metric[] }) {
  const groups = DIM_ORDER.map((d) => ({ d, rows: metrics.filter((m) => m.dimension === d) })).filter((g) => g.rows.length)
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {groups.map(({ d, rows }, i) => {
        const live = rows.filter((r) => r.value != null).length
        return (
          <motion.a
            key={d}
            href="#ledger"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.03 }}
            className="group rounded-[1.25rem] bg-white p-4 ring-1 ring-forest/10 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-forest/30"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-ink">{DIMENSION_LABELS[d]}</p>
              <p className="font-display text-2xl font-bold tabular-nums text-ink">{rows.length}</p>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-mist">
              <div className="h-1.5 rounded-full bg-forest" style={{ width: `${(100 * live) / rows.length}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-ink/50">{live} live</p>
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-ink/60">{rows.slice(0, 6).map((r) => r.label).join(' · ')}</p>
          </motion.a>
        )
      })}
    </div>
  )
}
