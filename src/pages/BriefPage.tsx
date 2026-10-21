import { useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { ArrowRight, Loader2, MapPin, Printer, RefreshCcw, Sparkles, Store } from 'lucide-react'
import { ARCHETYPES, matchArchetype } from '../brief/archetypes'
import { runBrief } from '../brief/runBrief'
import { DRIVER_LABELS, PROTECT_BELOW, PUSH_AT, TANH_SCALE } from '../brief/engine'
import { DISTRICT_PLACES } from '../brief/kalaburagi'
import { TRACKED_CHANNELS } from '../brief/pulse/channels'
import type { ArchetypeId, Brief, SourceId } from '../brief/types'
import { CompetitorList, DriverBars, EventList, MetricLedger, OutlookStrip, SourceList, TacticList } from '../components/brief/BriefParts'
import { weekdayName } from '../components/brief/briefFormat'
import { PulsePanel } from '../components/brief/PulsePanel'
import { BriefMap } from '../components/brief/BriefMap'
import { ConsideredGrid, CountUp, HourlyChart, IstClock, RadarBackdrop, SourceScan, TopActions, VerdictHero } from '../components/brief/BriefVisuals'

const EXAMPLES: Array<{ business: string; place: string; label: string }> = [
  { business: 'Saree shop', place: 'Super Market, Kalaburagi', label: 'Saree shop · Super Market' },
  { business: 'Lassi and buttermilk stall', place: 'Jagat Circle, Kalaburagi', label: 'Lassi stall · Jagat Circle' },
  { business: 'Tea stall near the bus stand', place: 'Kalaburagi', label: 'Tea stall · Kalaburagi' },
  { business: 'Tur dal farmer, 4 acres', place: 'Aland', label: 'Tur farmer · Aland' },
  { business: 'Dairy, 6 cows', place: 'Jevargi', label: 'Dairy · Jevargi' },
  { business: 'Flower and puja items seller', place: 'Ganagapur', label: 'Flowers · Ganagapur' },
]

const STORE_KEY = 'ishaara.brief.lastInput.v1'

interface FormState {
  business: string
  place: string
  archetype: ArchetypeId | ''
  marketDay: string
}

function loadForm(): FormState {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return { business: '', place: '', archetype: '', marketDay: '', ...(JSON.parse(raw) as Partial<FormState>) }
  } catch {
    // Storage blocked or corrupt: start empty.
  }
  return { business: '', place: '', archetype: '', marketDay: '' }
}

function saveForm(f: FormState) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(f))
  } catch {
    // Not essential.
  }
}

function Section({ title, kicker, children, id, eyebrow }: { title: string; kicker?: string; children: ReactNode; id?: string; eyebrow?: string }) {
  return (
    <motion.section id={id} className="scroll-mt-28" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.45 }}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/45">{eyebrow}</p>}
          <h2 className="font-display text-2xl font-bold text-forest sm:text-3xl">{title}</h2>
        </div>
        {kicker && <p className="max-w-md text-xs text-ink/50 sm:text-right">{kicker}</p>}
      </div>
      {children}
    </motion.section>
  )
}

const NAV = [
  ['decision', 'Decision'],
  ['actions', 'Actions'],
  ['tomorrow', 'Hour by hour'],
  ['news', 'Local news'],
  ['week', 'Week'],
  ['why', 'Why'],
  ['considered', 'Considered'],
  ['ledger', 'Every number'],
  ['sources', 'Sources'],
] as const

const inputCls = 'mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.07] px-3.5 py-3 text-base text-white placeholder:text-white/35 outline-none transition focus:border-white/60 focus:bg-white/[0.1]'

export function BriefPage() {
  const [form, setForm] = useState<FormState>(loadForm)
  const [brief, setBrief] = useState<Brief | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Partial<Record<SourceId, boolean>>>({})
  const [error, setError] = useState<string | null>(null)
  const run = useRef(0)

  const detected = useMemo(() => (form.business.trim() ? matchArchetype(form.business) : null), [form.business])
  const metricMap = useMemo(() => new Map((brief?.metrics ?? []).map((m) => [m.id, m])), [brief])

  async function submit(f: FormState = form) {
    if (!f.business.trim() || !f.place.trim()) {
      setError('Tell us what the business is and where it is in Kalaburagi district.')
      return
    }
    const id = ++run.current
    setBusy(true)
    setError(null)
    setDone({})
    setBrief(null)
    saveForm(f)
    requestAnimationFrame(() => document.getElementById('brief-scan')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    try {
      const b = await runBrief(
        {
          business: f.business.trim(),
          place: f.place.trim(),
          archetypeOverride: f.archetype || undefined,
          marketDay: f.marketDay === '' ? undefined : Number(f.marketDay),
        },
        { onSource: (sid, ok) => id === run.current && setDone((d) => ({ ...d, [sid]: ok })) },
      )
      if (id !== run.current) return
      if (b.error) {
        setError(b.error)
      } else {
        setBrief(b)
        requestAnimationFrame(() => document.getElementById('decision')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }
    } catch (e) {
      if (id === run.current) setError(e instanceof Error ? e.message : 'Something went wrong while building the brief.')
    } finally {
      if (id === run.current) setBusy(false)
    }
  }

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-6xl">
        {/* ------------------------------------------------------------ hero + form */}
        <section className="relative overflow-hidden rounded-[2rem] bg-black px-5 py-8 text-white shadow-2xl shadow-black/30 sm:px-10 sm:py-12">
          <RadarBackdrop />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
              <span className="inline-flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Kalaburagi · daily business intelligence
              </span>
              <IstClock />
            </div>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6 max-w-3xl font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl">
              Tomorrow, decided.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-5 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
              One question for any shop, stall, farm or dairy in Kalaburagi district: should I push, run normally, or protect tomorrow? The answer comes from live weather hour by hour, ten years of climate, air, rivers, the street map, Kalaburagi’s own calendar and what the city’s news channels are posting.
            </motion.p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                [9, 'live sources'],
                [200, 'measurements'],
                [13, 'dimensions'],
                [TRACKED_CHANNELS.length, 'news accounts'],
                [21, 'business types'],
              ].map(([n, l], i) => (
                <motion.div key={l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.06 }} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="font-display text-3xl font-bold tabular-nums">
                    <CountUp to={Number(n)} />
                    {n === 200 ? '+' : ''}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-white/50">{l}</p>
                </motion.div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
              className="mt-8 rounded-[1.5rem] border border-white/12 bg-white/[0.05] p-5 backdrop-blur-md sm:p-6"
            >
              <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
                <label className="block text-sm font-medium text-white/85">
                  <span className="inline-flex items-center gap-1.5"><Store className="h-4 w-4" aria-hidden /> What is the business?</span>
                  <input value={form.business} onChange={(e) => set({ business: e.target.value })} placeholder="e.g. saree shop, lassi stall, kirana, tur farm, dairy with 6 cows" className={inputCls} autoComplete="off" />
                  {detected && !form.archetype && (
                    <span className="mt-1.5 block text-xs text-white/50">
                      Reading it as <strong className="text-white">{detected.archetype.label}</strong>
                      {detected.matched ? '' : ' (no keyword matched; pick a type below if wrong)'}
                    </span>
                  )}
                </label>
                <label className="block text-sm font-medium text-white/85">
                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden /> Where in Kalaburagi district?</span>
                  <input value={form.place} onChange={(e) => set({ place: e.target.value })} placeholder="Area, town or village, e.g. Super Market, Aland" className={inputCls} autoComplete="off" list="kalaburagi-places" />
                  <datalist id="kalaburagi-places">
                    {DISTRICT_PLACES.map((p) => (
                      <option key={p.name} value={p.name === 'Kalaburagi city' ? 'Kalaburagi' : p.name} />
                    ))}
                  </datalist>
                </label>
                <label className="block text-sm font-medium text-white/85">
                  Type of business <span className="font-normal text-white/45">(optional)</span>
                  <select value={form.archetype} onChange={(e) => set({ archetype: e.target.value as ArchetypeId | '' })} className={`${inputCls} [&>option]:text-black`}>
                    <option value="">Work it out from what I typed</option>
                    {ARCHETYPES.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-white/85">
                  Weekly market (santhe) day <span className="font-normal text-white/45">(optional)</span>
                  <select value={form.marketDay} onChange={(e) => set({ marketDay: e.target.value })} className={`${inputCls} [&>option]:text-black`}>
                    <option value="">No market / don’t know</option>
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                      <option key={d} value={String(d)}>
                        {weekdayName(d)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="submit" disabled={busy} className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-black shadow-lg shadow-white/10 transition hover:scale-[1.02] disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : brief ? <RefreshCcw className="h-4 w-4" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                  {busy ? 'Reading Kalaburagi…' : brief ? 'Run again' : 'Build tomorrow’s brief'}
                  {!busy && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />}
                </button>
                <span className="text-xs text-white/45">Free public data · 5–20 seconds · nothing stored on a server</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                <span className="mr-1 self-center text-[11px] font-semibold uppercase tracking-wider text-white/40">Try</span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const f = { ...form, business: ex.business, place: ex.place, archetype: '' as const }
                      setForm(f)
                      void submit(f)
                    }}
                    className="rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white/80 transition hover:border-white/50 hover:bg-white/[0.12] hover:text-white disabled:opacity-50"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
              {error && (
                <p role="alert" className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                  {error}
                </p>
              )}
            </form>
          </div>
        </section>

        {busy && (
          <div id="brief-scan" className="mt-8 scroll-mt-28">
            <SourceScan done={done} />
          </div>
        )}

        {brief && !busy && (
          <div className="mt-8 space-y-14" aria-live="polite">
            <nav className="no-print sticky top-[4.5rem] z-30 -mx-1 flex gap-1 overflow-x-auto rounded-full border border-forest/10 bg-white/85 p-1 shadow-sm backdrop-blur-md">
              {NAV.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink/65 transition hover:bg-forest hover:text-white">
                  {label}
                </a>
              ))}
              <button type="button" onClick={() => window.print()} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-forest px-3.5 py-1.5 text-xs font-semibold text-white">
                <Printer className="h-3.5 w-3.5" aria-hidden /> Print
              </button>
            </nav>

            <div id="decision" className="scroll-mt-32">
              <VerdictHero brief={brief} />
            </div>

            <Section id="actions" eyebrow="Do this first" title="Tomorrow’s three moves" kicker="Ranked by urgency. Every one is backed by numbers you can open below.">
              <TopActions tactics={brief.tactics} />
              {brief.tactics.length > 3 && (
                <div className="mt-6">
                  <p className="mb-3 text-sm font-semibold text-ink/70">Everything else worth doing</p>
                  <TacticList tactics={brief.tactics.slice(3)} metrics={metricMap} />
                </div>
              )}
            </Section>

            <Section id="tomorrow" eyebrow="Tomorrow" title="Hour by hour, and the street around you" kicker="Hover a bar for the hour’s numbers. Red dots are similar businesses mapped in OpenStreetMap.">
              <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
                <div className="rounded-[1.5rem] bg-white p-4 ring-1 ring-forest/10">
                  <HourlyChart brief={brief} />
                </div>
                <BriefMap brief={brief} />
              </div>
            </Section>

            <Section id="news" eyebrow="Kalaburagi news pulse" title="What the city is posting" kicker="Gulbarga Ki Awaaz, gohash, Gulbarga News, Gulbarga Headlines, Gulbarga 24 News, Kalaburagi 24/7">
              {brief.pulseSnapshotAt && (
                <p className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  The live news collector isn’t connected in this build, so this section shows the real snapshot of these channels captured on{' '}
                  <strong>{new Date(brief.pulseSnapshotAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST</strong>. Every post links to the original.
                </p>
              )}
              <PulsePanel brief={brief} />
            </Section>

            <Section id="week" eyebrow="The next 7 days" title="The week ahead" kicker="Same scoring, day by day. Air quality is forecast for tomorrow only.">
              <OutlookStrip brief={brief} />
            </Section>

            <div id="why" className="grid scroll-mt-28 gap-12 lg:grid-cols-[1.25fr_1fr]">
              <Section eyebrow="Explainable" title="Why this call" kicker="Each driver: signal × this business’s sensitivity. Open one to see its numbers.">
                <DriverBars drivers={brief.drivers} metrics={metricMap} />
              </Section>
              <div className="space-y-12">
                <Section eyebrow="Calendar" title="Coming up" kicker="Next 45 days, with sources">
                  <EventList events={brief.events} />
                </Section>
                <Section eyebrow="Competition" title="Nearest similar businesses" kicker="Mapped within 2 km">
                  <CompetitorList brief={brief} />
                </Section>
              </div>
            </div>

            <Section id="considered" eyebrow="Nothing left out" title={`Everything this brief considered: ${brief.metrics.length} measurements`} kicker="Grouped by what they tell you. Grey bars show how many were live for this place.">
              <ConsideredGrid metrics={brief.metrics} />
            </Section>

            <Section id="ledger" eyebrow="Audit trail" title="Every number, with its source and method" kicker={`${brief.metrics.filter((m) => m.value != null).length} of ${brief.metrics.length} available. Nothing is filled in when a source fails.`}>
              <MetricLedger metrics={brief.metrics} />
            </Section>

            <Section id="sources" eyebrow="Provenance" title="Sources" kicker="What answered this time">
              <SourceList brief={brief} />
            </Section>

            <Section title="How the call is made" eyebrow="Method">
              <div className="grid gap-4 text-sm leading-relaxed text-ink/70 lg:grid-cols-3">
                <div className="rounded-[1.25rem] bg-white p-5 ring-1 ring-forest/10">
                  <p className="font-semibold text-ink">1 · Signals</p>
                  <p className="mt-2">
                    Each driver ({Object.values(DRIVER_LABELS).join(', ').toLowerCase()}) becomes a signal between −1 and +1, read from the live measurements.
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-white p-5 ring-1 ring-forest/10">
                  <p className="font-semibold text-ink">2 · Sensitivity</p>
                  <p className="mt-2">
                    Each of 21 business types has a written-down sensitivity to each signal: heat lifts a lassi stall and hurts a tea stall; a festival lifts a sweet shop and barely moves a hardware store.
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-white p-5 ring-1 ring-forest/10">
                  <p className="font-semibold text-ink">3 · Call</p>
                  <p className="mt-2">
                    Index = 50 + 50 · tanh(Σ sensitivity × signal / {TANH_SCALE}). {PUSH_AT}+ push, below {PROTECT_BELOW} protect. Outdoor work is always protected in IMD heavy rain, gusts of 60 km/h+ or a heat index of 54 °C+.
                  </p>
                </div>
              </div>
              <p className="mt-4 max-w-4xl text-xs leading-relaxed text-ink/55">
                Missing data is never filled in: a failed source shows as unavailable, its drivers are left out, and confidence drops. OpenStreetMap counts only what volunteers have mapped. Islamic dates are computed one day after the Saudi calendar, which matched every Indian date checked, but the moon sighting can move them a day; the 2027 Sharanabasaveshwar jatra date is inferred from past years. Farm and livestock notes describe conditions: ask your Krishi Vigyan Kendra or vet before any spray, dose or treatment.
              </p>
            </Section>
          </div>
        )}
      </div>
    </MotionConfig>
  )
}
