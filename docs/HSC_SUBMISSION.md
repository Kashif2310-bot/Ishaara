# Hack for Social Cause — submission material

Draft text for the deck and the registration form. **Every claim here is taken from this repository**; nothing is invented. Where a statistic about the wider world would strengthen a point, it is marked **[ADD SOURCE]** — fill it with a citation or delete it. Do not present a marked line without a source.

Theme: **Rural Development & Livelihoods**. Team: Md. Mujtaba Kashif, Jordan Varghese, Prerana Prakash.

---

## Part A — Deck text (7 slides)

### Slide 1 — The problem is not only "no loan"

> **Rural enterprise failure is rarely just "no loan". More often it is the wrong activity, the wrong timing, or the wrong loan structure.**

A rural micro-entrepreneur deciding what to start faces three separate questions, and existing tools answer at most one:

- **What should I start, here?** Most advice is anecdotal — what a neighbour did.
- **Which government scheme fits me, and am I actually eligible?** Scheme rules are spread across ministry PDFs, state corporation pages and portals, each with its own eligibility ladder.
- **How do I structure the money, and who signs it off?**

[ADD SOURCE] — number of rural micro-enterprises in India, or share that fail within N years.
[ADD SOURCE] — share of eligible applicants who never apply to livelihood schemes, or awareness figures.

### Slide 2 — Why the usual tools do not close it

- **Eligibility checklists** stop at a yes/no and leave the citizen to find the scheme themselves.
- **Generic chatbots** will confidently state a loan figure or an eligibility rule they cannot back up. For a citizen deciding whether to borrow, a wrong number is worse than no number.
- **Nothing tells them about tomorrow.** Day-to-day decisions — how much to prepare, whether to push stock before a festival, whether rain will cost the day — are made on instinct.

Ishaara's working rule: **no language model writes a number, an eligibility result or a rule.** Every figure traces to a source, and a failed data source is shown as unavailable rather than filled in.

### Slide 3 — Solution: an advisor that answers the whole question

**Ishaara** — a hyperlocal business advisor and government-scheme assistant for rural micro-entrepreneurs.

| Capability | What it does |
|---|---|
| **Voice and text scheme assistant** | The citizen describes their situation in plain language, by voice or typing. Profile facts are extracted by deterministic rules — never guessed — and 14 government schemes are ranked by a deterministic eligibility engine. Voice runs on Gemini Live native audio in **English, Kannada and Hindi** |
| **Verified scheme catalog** | **14 schemes**, each carrying its official source URL and a last-verified date. **6 are state-specific** — 4 Karnataka (Udyogini, KMDC, two KMVSTDCL), 1 Tamil Nadu (NEEDS), 1 Kerala (Kudumbashree) — each checked against the issuing corporation's own page, not an aggregator |
| **Exact finance structuring** | NSFDC scheme rules implemented exactly, with reducing-balance quarterly EMI computed in integer paise |
| **Hyperlocal opportunity scan** | A business idea scored against live weather, competitor density and demand signals for any Indian place |
| **Guided application** | Profile → scheme → documents → review → consent → submission, synced under the citizen's own identity with row-level security |

### Slide 4 — Solution: the Daily Business Brief

One question for any shop, stall, farm or dairy in Kalaburagi district: **should I push, run a normal day, or protect tomorrow?**

- **9 public data sources, no API keys**: weather forecast, 10-year ERA5 climate, CAMS air quality, GloFAS river flow, elevation, OpenStreetMap features, geocoding, a built-in Kalaburagi calendar, and a pulse of the city's own news channels.
- **200 measurements** in 13 dimensions, each shown with its unit, source and method.
- **A transparent verdict**: 12 drivers, each a signal from −1 to 1, multiplied by a written-down sensitivity for the business's type (**21 types**). `index = 50 + 50 · tanh(Σ w·s / 2)`; push at 65+, protect below 35.
- **Honest about gaps**: a driver with no data is dropped rather than counted as zero, and confidence falls. With no forecast there is no call at all.
- **Local calendar done properly**: DoPT holiday orders, Karnataka holidays, the Urs of Khwaja Bande Nawaz and the Sharanabasaveshwar jatra, with Islamic dates computed on India's observed calendar and labelled as computed.

### Slide 5 — Impact and scalability

**Who it is for.** Rural micro-entrepreneurs, especially applicants to NSFDC and similar livelihood schemes. The built-in reference case is an SC woman in Dinka village, Mandya, Karnataka, starting a dairy unit with ₹1,00,000 of margin money.

**Why it can reach them.**

- **No key, no cost, no account** for the core experience. The scheme assistant and the brief run in the browser on free public data; no variable is required to start the app.
- **Their own language.** Interface in English and Kannada; voice in English, Kannada and Hindi.
- **Works when the network does not.** Every live lookup times out and falls back to an honest "unavailable"; assessments survive a backend outage via a local snapshot; if voice fails, text keeps working.

**How it scales.**

- **More schemes:** the catalog is one typed dataset. Adding a scheme is a data change, not code — the ranking engine is scheme-agnostic.
- **More states:** the pattern is proven across three southern states already (Karnataka, Tamil Nadu, Kerala).
- **More districts for the brief:** 8 of the 9 sources are global and keyless. Extending beyond Kalaburagi needs a district's calendar and its local news channels; the rest already works anywhere.

[ADD SOURCE] — size of the addressable population (rural micro-entrepreneurs in Karnataka or India).
[ADD SOURCE] — value of unclaimed scheme benefits, if a credible figure exists.

**Current maturity: a hackathon prototype, not production-ready.** `docs/HONESTY_LEDGER.md` records what is live, what is built but not connected, and what is demo-only. Known gaps are stated in the README: the officer dashboard is a same-browser demo with demo login, `/jobs` runs on labelled sample listings, live government statistics are wired but not configured, and documents are tracked as metadata with no file upload.

### Slide 6 — Team and implementation

| Member | Contribution (from this repository's commit history) |
|---|---|
| **Md. Mujtaba Kashif** | Original voice assistant foundation and early scheme assistant, including the optional Supabase backend and live official-source retrieval layer; built the Ishaara voice assistant and the Jobs employment-matching feature |
| **Jordan Varghese** | Gemini Live voice integration, backend reliability engineering (caching, rate-limiting, failure handling), scheme data verification and sourcing, Supabase integration, testing discipline across the codebase; built the Kalaburagi Daily Business Brief |
| **Prerana Prakash** | The FastAPI persistence and auth layer for the scan flow: skeleton and health check, schema and migrations, user and assessment endpoints with NSFDC checks, demo login and history; also the first citizen application and admin review flows |

**Stack.** React 19, TypeScript, Vite 8, Tailwind CSS 4 · FastAPI with SQLAlchemy and Alembic · Supabase Postgres with row-level security, anonymous auth and three Edge Functions · Gemini Live for voice · OpenStreetMap and Open-Meteo for live data.

**Engineering discipline — verifiable in the repo:**

- **1,330 tests passing**, 29 skipped, 0 failing, across 137 files (run 2026-10-27). Type-check, lint and production build all clean; the backend suite adds 18 passing tests.
- **A full gate before every commit**: `vitest`, `tsc -b`, `lint`, `build`.
- **Row-level security proven, not assumed** — tested with two real separate identities to confirm one citizen cannot read or forge another's records.
- **No secret in the browser bundle**, confirmed by scanning the built output.
- **An honesty ledger** that every demo claim must be traceable to.

### Slide 7 — AI disclosure

Full detail: `docs/AI_DISCLOSURE.md`.

| Tool | Used for |
|---|---|
| **ChatGPT**, **Claude Code**, **Cursor** | Code generation and refactoring during development |
| **Gemini Live** | **Inside the product**, not a build tool: the voice assistant the citizen talks to |

**Estimated AI share of the work: about 70%** — the team's own estimate, not a measurement. AI did most of the hands-on building; the team directed, verified and integrated.

**What the team did itself:** chose the problem and the users; researched and verified all 14 schemes against the issuing bodies' own pages rather than aggregators, recording conflicts where two official sources disagreed; hand-sourced the DoPT and Kalaburagi calendar data with citations; made the product and honesty decisions, including the rule that a failed source must show as unavailable; and ran the testing and integration.

**No model computes a score, an eligibility result or any number shown to a user.** Scheme eligibility and the brief's engine are deterministic rules; the AI layer only explains results it is given, and every reply is validated against the evidence before it is shown.

Released under the **MIT License**.

---

## Part B — Registration form answers

**Project title**

> Ishaara

**One-line summary** (pick to fit the field's length)

> A hyperlocal business advisor and government-scheme assistant that helps rural micro-entrepreneurs decide what to start, find the schemes they qualify for, and know whether to push or protect tomorrow.

> *Shorter:* A voice-first advisor that matches rural micro-entrepreneurs to government schemes they qualify for, and tells them what tomorrow looks like for their business.

**Problem**

> Rural enterprise failure is rarely just "no loan" — more often it is the wrong activity, the wrong timing, or the wrong loan structure. A micro-entrepreneur has to work out what to start in their own village, which of dozens of central and state schemes they actually qualify for, and how to structure the finance. Scheme rules sit in ministry PDFs and state corporation pages; eligibility checklists stop at yes or no; and generic chatbots will state a loan figure they cannot back up, which is worse than no answer for someone deciding whether to borrow. Nothing helps with the daily decision either: how much to prepare tomorrow, and whether the weather, a festival or a local event will make or break the day.
>
> [ADD SOURCE] — a statistic on rural micro-enterprise failure or scheme under-claiming, if you want one here.

**Solution**

> Ishaara answers the whole question before money moves, in the citizen's own language, with every number traceable to a source.
>
> A citizen describes their situation by voice or text — in English, Kannada or Hindi. Deterministic rules extract their profile (never guessing a fact that was not stated), and a deterministic engine ranks 14 government schemes, each carrying its official source URL and a last-verified date. Six are state-specific, across Karnataka, Tamil Nadu and Kerala, each verified against the issuing corporation's own page rather than an aggregator. An exact NSFDC finance engine structures the loan in integer paise, and a guided application flow carries the citizen through documents, review and consent under row-level-security-protected storage.
>
> The Daily Business Brief answers tomorrow's question for any business in Kalaburagi district: push, run a normal day, or protect. It reads 9 public data sources with no API keys — weather, ten years of climate, air quality, river flow, elevation, OpenStreetMap, the district's own calendar and a pulse of the city's news channels — and produces 200 traceable measurements and one transparent verdict.
>
> The design rule throughout: no language model writes a number, an eligibility result or a rule. A failed data source is shown as unavailable rather than filled in.

**Theme**

> Rural Development & Livelihoods

**SDGs**

Our mapping, each tied to something the product actually does:

> - **SDG 1 — No Poverty:** routes rural micro-entrepreneurs to the concessional credit and subsidy schemes they qualify for, including NSFDC, NBCFDC and state corporation schemes aimed at marginalised communities.
> - **SDG 8 — Decent Work and Economic Growth:** supports starting and running a viable micro-enterprise, with finance structured to real scheme rules.
> - **SDG 10 — Reduced Inequalities:** the scheme catalog is built around SC, ST, OBC, minority and women-specific schemes, and the interface works in Kannada and Hindi, not only English.
> - **SDG 5 — Gender Equality:** several catalogued schemes are women-specific (Udyogini, Kudumbashree, KMVSTDCL's women's scheme, Stand-Up India's women's track).
>
> *Optional, if the form allows more:* **SDG 2 — Zero Hunger**, via the crop, dairy and poultry guidance in the Daily Business Brief, which defers any product or dose decision to the Krishi Vigyan Kendra or a vet.

**Impact**

> Ishaara is free to use for the citizen: the scheme assistant and the Daily Business Brief run in the browser on free public data, and no API key or account is needed for the core experience. It works in English, Kannada and Hindi by voice, and degrades honestly on a poor connection — every live lookup times out into an "unavailable" state rather than a fabricated value, and the text assistant keeps working when voice fails.
>
> It scales by data rather than by code: adding a scheme is a dataset change, and the pattern already covers three southern states. Eight of the brief's nine sources are global and keyless, so extending it to another district needs that district's calendar and local news channels, not a rewrite.
>
> The project is explicit about its current maturity. It is a hackathon prototype, and `docs/HONESTY_LEDGER.md` records exactly what is live, what is built but not connected, and what is a demo — including that the officer dashboard is a browser-only demo, the jobs listings are labelled sample data, and live government statistics are wired but not yet configured.
>
> [ADD SOURCE] — reach or beneficiary numbers, if you have a pilot or a target population figure.

---

## Checklist before submitting

- [ ] Replace or delete every **[ADD SOURCE]** marker. Do not submit one unfilled.
- [ ] Confirm the registered team name (this repository does not record one).
- [ ] Confirm whether a live demo URL exists. There is none in the repo — `netlify.toml` and `vercel.json` are build configs only, with no deployed site.
- [ ] Re-run the test numbers if you submit later than 2026-10-27; they are a point-in-time measurement.
- [ ] Name the uploads as the portal requires, for example `Karnataka_Ishaara_Deck.pdf`.
