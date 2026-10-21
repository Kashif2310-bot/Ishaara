import { useMemo, useRef, useState } from 'react'
import { ArrowRight, Loader2, MapPin, RefreshCcw } from 'lucide-react'
import { ARCHETYPES, matchArchetype } from '../brief/archetypes'
import { runBrief } from '../brief/runBrief'
import { DRIVER_LABELS, PROTECT_BELOW, PUSH_AT, TANH_SCALE } from '../brief/engine'
import type { ArchetypeId, Brief } from '../brief/types'
import {
  CompetitorList,
  DriverBars,
  EventList,
  MetricLedger,
  OutlookStrip,
  SourceList,
  TacticList,
  VerdictCard,
} from '../components/brief/BriefParts'
import { weekdayName } from '../components/brief/briefFormat'
import { PulsePanel } from '../components/brief/PulsePanel'
import { DISTRICT_PLACES } from '../brief/kalaburagi'

const EXAMPLES: Array<{ business: string; place: string; label: string }> = [
  { business: 'Lassi and buttermilk stall', place: 'Jagat Circle, Kalaburagi', label: 'Lassi stall · Jagat Circle' },
  { business: 'Tea stall near the bus stand', place: 'Kalaburagi', label: 'Tea stall · Kalaburagi' },
  { business: 'Tur dal farmer, 4 acres', place: 'Aland', label: 'Tur farmer · Aland' },
  { business: 'Dairy, 6 cows', place: 'Jevargi', label: 'Dairy · Jevargi' },
  { business: 'Saree shop', place: 'Super Market, Kalaburagi', label: 'Saree shop · Super Market' },
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

function Section({ title, kicker, children, id }: { title: string; kicker?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-forest sm:text-2xl">{title}</h2>
        {kicker && <p className="text-xs text-ink/50">{kicker}</p>}
      </div>
      {children}
    </section>
  )
}

export function BriefPage() {
  const [form, setForm] = useState<FormState>(loadForm)
  const [brief, setBrief] = useState<Brief | null>(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const run = useRef(0)

  const detected = useMemo(() => (form.business.trim() ? matchArchetype(form.business) : null), [form.business])
  const metricMap = useMemo(() => new Map((brief?.metrics ?? []).map((m) => [m.id, m])), [brief])

  async function submit(f: FormState = form) {
    if (!f.business.trim() || !f.place.trim()) {
      setError('Tell us what the business is and where it is.')
      return
    }
    const id = ++run.current
    setBusy(true)
    setError(null)
    saveForm(f)
    try {
      const b = await runBrief(
        {
          business: f.business.trim(),
          place: f.place.trim(),
          archetypeOverride: f.archetype || undefined,
          marketDay: f.marketDay === '' ? undefined : Number(f.marketDay),
        },
        { onProgress: (s) => id === run.current && setStep(s) },
      )
      if (id !== run.current) return
      if (b.error) {
        setError(b.error)
        setBrief(null)
      } else {
        setBrief(b)
        requestAnimationFrame(() => document.getElementById('brief-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }
    } catch (e) {
      if (id === run.current) setError(e instanceof Error ? e.message : 'Something went wrong while building the brief.')
    } finally {
      if (id === run.current) {
        setBusy(false)
        setStep('')
      }
    }
  }

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <div className="mx-auto max-w-5xl">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Kalaburagi daily business brief</p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] text-forest sm:text-5xl">What should you do tomorrow?</h1>
        <p className="mt-4 text-base leading-relaxed text-ink/70">
          For any business anywhere in Kalaburagi district. The brief reads tomorrow’s weather hour by hour, ten years of local climate, air quality,
          rivers, the map around the spot, Kalaburagi’s own calendar (the Urs at the Bande Nawaz dargah, the Sharanabasaveshwar jatra, Islamic dates
          as observed here), and what the city’s news channels are posting. Then it turns well over a hundred measurements into one call and a short
          list of things to do. Every number links back to where it came from.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="glass mt-8 rounded-[1.75rem] p-5 shadow-sm sm:p-7"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-ink">
            What is the business?
            <input
              value={form.business}
              onChange={(e) => set({ business: e.target.value })}
              placeholder="e.g. lassi stall, kirana, cotton farm, dairy with 6 cows"
              className="mt-1.5 w-full rounded-xl border border-forest/15 bg-white px-3.5 py-2.5 text-base outline-none focus:border-forest/60"
              autoComplete="off"
            />
            {detected && !form.archetype && (
              <span className="mt-1.5 block text-xs text-ink/55">
                Reading it as: <strong className="text-ink">{detected.archetype.label}</strong>
                {detected.matched ? '' : ' (no keyword matched; pick a type below if this is wrong)'}
              </span>
            )}
          </label>
          <label className="block text-sm font-medium text-ink">
            Where is it?
            <span className="relative mt-1.5 block">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" aria-hidden />
              <input
                value={form.place}
                onChange={(e) => set({ place: e.target.value })}
                placeholder="Area, town or village in Kalaburagi district"
                className="w-full rounded-xl border border-forest/15 bg-white py-2.5 pl-9 pr-3.5 text-base outline-none focus:border-forest/60"
                autoComplete="off"
                list="kalaburagi-places"
              />
              <datalist id="kalaburagi-places">
                {DISTRICT_PLACES.map((p) => (
                  <option key={p.name} value={p.name === 'Kalaburagi city' ? 'Kalaburagi' : p.name} />
                ))}
              </datalist>
            </span>
            <span className="mt-1.5 block text-xs text-ink/55">Kalaburagi district only for now, e.g. “Jagat Circle”, “Aland” or “Sedam”.</span>
          </label>
          <label className="block text-sm font-medium text-ink">
            Type of business <span className="font-normal text-ink/50">(optional)</span>
            <select
              value={form.archetype}
              onChange={(e) => set({ archetype: e.target.value as ArchetypeId | '' })}
              className="mt-1.5 w-full rounded-xl border border-forest/15 bg-white px-3 py-2.5 text-base outline-none focus:border-forest/60"
            >
              <option value="">Work it out from what I typed</option>
              {ARCHETYPES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-ink">
            Weekly market (santhe) day <span className="font-normal text-ink/50">(optional)</span>
            <select
              value={form.marketDay}
              onChange={(e) => set({ marketDay: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-forest/15 bg-white px-3 py-2.5 text-base outline-none focus:border-forest/60"
            >
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
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-bold text-white transition hover:bg-black disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : brief ? <RefreshCcw className="h-4 w-4" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
            {busy ? step || 'Working' : brief ? 'Run again' : 'Build tomorrow’s brief'}
          </button>
          <span className="text-xs text-ink/50">Free public data. Takes 5–20 seconds; nothing is stored on a server.</span>
        </div>

        <div className="mt-5 border-t border-forest/10 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Try one</p>
          <div className="mt-2 flex flex-wrap gap-2">
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
                className="rounded-full border border-forest/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink/75 transition hover:border-forest/50 hover:text-ink disabled:opacity-50"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </form>

      {brief && (
        <div id="brief-result" className="mt-10 scroll-mt-24 space-y-12" aria-live="polite">
          <VerdictCard brief={brief} />

          <Section title="What to do" kicker="Ranked by urgency. Tap any number to see where it came from.">
            <TacticList tactics={brief.tactics} metrics={metricMap} />
          </Section>

          <Section title="Kalaburagi news pulse" kicker="What the city’s news channels are posting, and what is pulling views">
            <PulsePanel brief={brief} />
          </Section>

          <Section title="The week ahead" kicker="Same scoring, day by day. Air quality is only forecast for tomorrow.">
            <OutlookStrip brief={brief} />
          </Section>

          <div className="grid gap-12 lg:grid-cols-[1.25fr_1fr]">
            <Section title="Why" kicker="What moved tomorrow up or down for this business">
              <DriverBars drivers={brief.drivers} metrics={metricMap} />
            </Section>
            <div className="space-y-12">
              <Section title="Coming up" kicker="Next 45 days">
                <EventList events={brief.events} />
              </Section>
              <Section title="Nearest similar businesses" kicker="Mapped in OpenStreetMap, within 2 km">
                <CompetitorList brief={brief} />
              </Section>
            </div>
          </div>

          <Section id="ledger" title="Every measurement" kicker={`${brief.metrics.filter((m) => m.value != null).length} of ${brief.metrics.length} available for this place`}>
            <MetricLedger metrics={brief.metrics} />
          </Section>

          <Section title="Sources" kicker="What answered this time">
            <SourceList brief={brief} />
          </Section>

          <Section title="How the call is made">
            <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-ink/70">
              <p>
                Each driver ({Object.values(DRIVER_LABELS).join(', ').toLowerCase()}) becomes a signal between −1 and +1. Each kind of business has a
                written-down sensitivity to each signal: heat lifts a lassi stall and hurts a tea stall, a festival lifts a sweet shop and barely moves a
                hardware store. The index is 50 + 50 · tanh(Σ sensitivity × signal / {TANH_SCALE}): 50 is an ordinary day, {PUSH_AT} or more says push,
                below {PROTECT_BELOW} says protect. Outdoor work is always set to protect in IMD heavy rain, gusts of 60 km/h or more, or a heat index of
                54 °C or more.
              </p>
              <p>
                Missing data is never filled in. If a source does not answer, the measurements that depended on it read “Unavailable”, the drivers that
                needed them are left out, and the confidence score drops. A cached result says when it was fetched.
              </p>
              <p>
                The news pulse reads public posts from Gulbarga Ki Awaaz, gohash, Gulbarga News, Gulbarga Headlines, Gulbarga 24 News and Kalaburagi 24/7.
                A post is an “outlier” when its views beat that channel’s usual views for the same format; events and notices are read from the posts’
                own words (a written date, or “tomorrow” in a post from the last two days), so open the post before acting on one.
              </p>
              <p>
                Limits worth knowing: OpenStreetMap only counts what volunteers have mapped, so small towns usually have more shops and stalls than it
                shows. Holidays come from the Government of India and Government of Karnataka lists; the Sharanabasaveshwar jatra date for 2027 is
                inferred from past years. Islamic dates (Ramadan, Shab-e-Barat, the Urs) are computed one day after the Saudi calendar, which matched every
                Indian date we checked, but the moon sighting can still move them a day. Farm and livestock notes describe conditions; ask your Krishi
                Vigyan Kendra or vet before any spray, dose or treatment. This page is in English only for now.
              </p>
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}
