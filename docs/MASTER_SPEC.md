> **Historical planning document — superseded by [`docs/TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md). Not verified against the current codebase.**

# MASTER SPEC v2 — LokPulse (SIH26091), targeting the actual Cursor build

**This supersedes the earlier draft I wrote for a different repo.** That draft assumed the FastAPI/Postgres/Python-ML stack described in Jordan's and Prerna's handoffs (`services/advisory-llm`, ESS scoring, etc.). You've clarified that's a *separate* build — the one you want completed is **LokPulse**, a Vite/React/TypeScript client-side app at `C:\Users\Kashif\OneDrive\Desktop\sih2026`. Everything below is written against that codebase, from the handoff you gave me. I have not inspected the repo directly — where I say "verify," that's a real instruction to Cursor, not filler.

**How to use this file:** save it as `docs/MASTER_SPEC.md` in the LokPulse repo, commit it, then open Cursor with:

> Read `docs/MASTER_SPEC.md` in full. Then read `src/lib/finance.ts`, `src/lib/lokScore.ts`, `src/lib/feasibility.ts`, `src/lib/multisig.ts`, `src/data/villages.ts`, `src/i18n/index.ts`, `src/state/AppContext.tsx`, `package.json`, and the router setup. Report: (a) your understanding of the current architecture, (b) which items in PART 4 (Phase 0) are already true vs. missing, (c) anything in this spec that doesn't match what's actually in the repo. Do not write any code yet.

Then work one phase at a time and stop for review between phases. This is a "solid prototype, little to no flaws" ask — that comes from depth per phase, not breadth in one shot.

---

## PART 0 — THE PROBLEM STATEMENT (unchanged, this is ground truth regardless of which build you use)

**SIH26091** — AI-Driven Hyper-Local Business Advisory and Financial Structuring Assistant for Rural Micro-Entrepreneurs. Ministry of Social Justice and Empowerment. Theme: Agriculture, FoodTech & Rural Development.

Government schemes give concessional credit to marginalized communities: beneficiary contributes **10% margin money**, a **Channelizing Agency** (NSFDC in your framing) funds the remaining **90%** as a loan.

| | Micro Finance Scheme | Term Loan Scheme |
|---|---|---|
| Project cost | up to ₹1.40 lakh | ₹1.40 lakh – ₹50.00 lakh |
| Funding | up to 90%, **max ₹1.25 lakh** | up to 90%, **max ₹45 lakh** |
| Interest | 6.5% p.a. | 8% p.a. |
| Tenure | 3 years | 7 years |
| Moratorium | 3 months | 6 months |

Beneficiaries pick businesses on anecdote, not data. The system must take **Location, Available Margin Capital, Proposed Business Category** and produce:

- **Module 1 (Feasibility):** market reach in a 5–10 km radius, opportunity analysis, SWOT, threats, competitor mapping, product market value/pricing.
- **Module 2 (Financial Calculator):** project cost (margin ÷ 10%), max loan (90%), auto-scheme-selection, EMI + moratorium schedule, **working capital needs**.

Multilingual beyond Hindi/English is explicit in the PS.

---

## PART 1 — LOKPULSE: THE PRODUCT AS YOU'VE BUILT IT

**Positioning, and this matters — do not let Cursor drift toward a generic chatbot UI.** LokPulse is pitched as a **Temporal Opportunity OS**, not an advisory chatbot: village × business × margin capital → live signals → feasibility → exact NSFDC finance → **LokScore** → adaptive multi-signature sanction → escrow release. The differentiator is that it behaves like a live operations cockpit with a real cryptographic sanction step, not a Q&A interface.

**Stack:** Vite, React 19, TypeScript, Tailwind 4, react-router, i18next (EN/KN), framer-motion, recharts, react-leaflet, ethers v6.

**Run:** `npm install && npm run dev` → `http://127.0.0.1:5173`. **Build:** `npm run build` (currently passes).

**Routes:**
| Route | Purpose |
|---|---|
| `/` | Landing |
| `/scan` | Onboarding — collects the three PS inputs (location, margin capital, business category) plus SC/women flags |
| `/pulse` | Live cockpit — signals dashboard |
| `/report` | Feasibility report |
| `/finance` | NSFDC scheme router / calculator |
| `/sanction` | Multi-sig sanction board |

Language toggle (EN ↔ KN) lives in the header. Global state in `src/state/AppContext.tsx`.

**Core logic modules (all client-side TypeScript, no backend today):**

- `src/data/villages.ts` — 5 hardcoded Karnataka villages (Dinka, Kabbenur, Sulebhavi, Kunigal, Sakleshpur) with lat/lng, population, competitor density, purchasing-power index, mandi reference.
- `src/data/festivals.ts` — jatras/local events as upcoming relative demand windows, with recommended actions, EN/KN.
- `src/lib/finance.ts` — the PS's own ladder: project cost = margin ÷ 10%, loan = 90%, ≤₹1.40L → Micro (6.5%/3y/3mo), else ≤₹50L → Term (8%/7y/6mo), **quarterly** repayment schedule with moratorium.
- `src/lib/lokScore.ts` — LokScore = demand 25% + competition-gap 20% + weather 15% + finance 25% + eligibility 15% (SC status, income ≤₹5L, women bonus). Adaptive quorum: score ≥80 → 2-of-3 signers; ≥60 → 3-of-5; below 60 → 4-of-5 plus a mandatory mentor sign-off.
- `src/lib/weather.ts` — **live** Open-Meteo call.
- `src/lib/mandi.ts` — structured/seeded price quotes (explicitly not live Agmarknet — you don't have that key; this honesty is already correct, keep it).
- `src/lib/feasibility.ts` — SWOT, pricing, channels, threats.
- `src/lib/multisig.ts` — **real ECDSA**: ethers `Wallet` signs and verifies an attestation hash; the `/sanction` page drives this UI.
- `contracts/AdaptiveSanction.sol` — a Solidity sketch. Not stated as deployed.

**i18n:** `src/i18n/index.ts` — full EN/KN strings for every screen.

**Demo path:** Scan (defaults: SC woman, dairy, Dinka, ₹1L margin) → Pulse → Report → Finance (₹10L project cost / ₹9L Term Loan) → Sanction (verifiers sign until quorum, escrow "releases").

**Explicit invariants you gave me — treat these as hard constraints on every phase below, not suggestions:**

1. NSFDC numbers (the table above) must never be altered.
2. Adaptive quorum stays tied to LokScore — the 80/60 thresholds and 2-of-3 / 3-of-5 / 4-of-5+mentor structure are load-bearing, not decoration.
3. EN/KN parity is preserved at every step; no new string ships English-only.
4. Signatures stay real (ethers ECDSA sign/verify) — never regress to a fake "I approve" checkbox that only looks like a signature.
5. Positioning stays non-chatbot / opportunity-radar. No feature should be built as "ask the assistant a question" when it could instead be a live signal on the cockpit.

---

## PART 2 — WHAT I DON'T KNOW AND CURSOR MUST VERIFY FIRST

I'm working from your handoff summary, not the file contents. Before Cursor changes anything, it should confirm or correct each of these (report back, don't assume):

- Is there **any test suite** today (Vitest, Jest, RTL)? The handoff mentions none. If true, that's the single biggest risk to "little to no flaws" — pure-function modules like `finance.ts` and `lokScore.ts` are trivially testable and currently have zero coverage as far as I know.
- Does `finance.ts` compute **working capital** anywhere? The PS requires it explicitly; the handoff's description of `finance.ts` doesn't mention it.
- Does `feasibility.ts` (or the `/report` page) state an explicit **market-reach radius** (5–10 km) and **opportunity analysis** (underserved niches), or does it stop at SWOT/pricing/channels/threats? The PS names six Module-1 deliverables; the handoff only confirms four.
- Is competitor **mapping** actually rendered on the `react-leaflet` map anywhere, or is `react-leaflet` imported but only used for something else (e.g., just showing the village pin)?
- Are the `/scan` inputs genuinely free-text/geocoded for **Location**, or is location constrained to a dropdown of the 5 seeded villages? This is the single most important thing to confirm — see Phase 1.1 below.
- What does "escrow release" on `/sanction` actually do today — is it a local state transition only, or does it call the Solidity contract / a testnet? The handoff says the contract is a "sketch," implying no deployment, but confirm.
- Are the verifier wallets on `/sanction` ephemeral demo wallets generated in-browser, or hardcoded fixture keys committed to the repo? If keys are committed, confirm they hold no real value and are clearly demo-only (this is fine for a hackathon demo; just needs to be true and labeled).
- Is TypeScript in `strict` mode? Is ESLint configured and passing?
- Does `finance.ts` use native JS numbers (floats) for money math, or a fixed-point approach already?

---

## PART 3 — ENGINEERING RULES FOR THIS CODEBASE

1. **Money math must be exact.** JS floats have the same binary-fraction problem as any other language. Either work in **integer paise** throughout (multiply to paise on input, do all arithmetic in integers, divide by 100 only at render time) or use a fixed-point library (`decimal.js` or `big.js`) for the compounding EMI calculation, converting to integer paise for storage/display. Pick one convention and use it everywhere in `finance.ts` and any new working-capital module — don't mix.
2. **State the moratorium convention explicitly, on screen.** Interest during the moratorium either accrues and capitalises into principal at the start of repayment, or is separately tracked and shown; pick one, name it in a constant, and show the assumption text next to the schedule. This is exactly the kind of thing a judge will ask about, and "I don't know, that's just what the code does" is a bad answer to have.
3. **The final instalment absorbs the rounding residue.** After N−1 quarters at the computed EMI, the last quarter's payment is `remaining_balance + that quarter's interest`, not another rounded EMI — so the schedule closes to exactly ₹0.00. Assert this in a test.
4. **Never silently fabricate hyperlocal data for a location you don't have real signals for.** If `weather.ts`'s Open-Meteo call fails, or a location has no seeded competitor/mandi data, say so on screen — don't fall back to a plausible-looking number with no source. This is the same discipline `mandi.ts` already applies (labeling itself as not-live); extend it everywhere, especially once you generalize beyond the 5 seed villages (Phase 1.1).
5. **LokScore stays a transparent weighted sum, not a black box.** Every component (demand, competition-gap, weather, finance, eligibility) should be independently inspectable — return the breakdown, not just the final number, from wherever `lokScore.ts` is computed, and render it (a bar chart per component is a natural `recharts` use).
6. **Signatures stay real.** Any new "approval" UI must go through `multisig.ts`'s actual sign/verify path. If you add new signer roles, they get real keypairs (even if ephemeral/demo), never a boolean toggle styled to look like a signature.
7. **Escrow claims must match what actually happens.** If release is a local state transition (no chain), the UI must say "simulated release" or equivalent — not imply funds moved. If you later deploy to a testnet (see Part 9, Decision D2), only then can the UI claim an on-chain release, and it should show the real tx hash/explorer link.
8. **i18n parity is a CI gate, not a discipline.** Add a script/test that asserts the EN and KN key trees in `src/i18n/index.ts` are identical in shape. Any new user-facing string lands in both languages in the same commit — no exceptions, including error messages and toast/alert text.
9. **Don't regress the demo path.** Scan (SC woman, dairy, Dinka, ₹1L margin) → Pulse → Report → Finance (₹10L / ₹9L Term Loan) → Sanction must keep working, unmodified in its numbers, after every phase. Add this exact sequence as an E2E test (Playwright) once Phase 0 sets up tooling.
10. **Config over magic numbers.** The 25/20/15/25/15 LokScore weights, the 80/60 quorum thresholds, the 5–10 km radius bounds, the wc-cycle-by-category multipliers you're about to add — all named constants in one place, documented, not scattered magic numbers in component files.
11. **Verify by running it.** Every phase ends with `npm run build`, `npm run lint`, `npm test`, and a manual click-through of the exact demo path — not "the diff looks right."

---

## PART 4 — PHASE 0: BASELINE TOOLING AND STABILIZATION

Nothing below is safe to build on top of until this exists.

- [x] Confirm/add **Vitest** + unit tests for pure functions in `finance.ts`, `lokScore.ts`, `feasibility.ts`, `mandi.ts`, and sign/verify in `multisig.ts`
- [x] TypeScript `strict: true` in `tsconfig.app.json` / `tsconfig.node.json`
- [x] Lint clean with zero warnings on `src/` (**oxlint** `--deny-warnings`; repo uses oxlint not ESLint)
- [x] i18n key-parity test for EN/KN (`src/i18n/parity.test.ts`) — Hindi deferred
- [x] Playwright E2E demo path (`e2e/demo-path.spec.ts`)
- [x] `npm run build && npm run lint && npm test` (+ `npm run test:e2e`) green

**Acceptance:** you can break something and a test will tell you before a judge does.

---

## PART 5 — PHASE 1: PROBLEM-STATEMENT COMPLIANCE (highest priority)

### 1.1 — Generalize beyond the 5 seeded villages ⚠️ CRITICAL

The PS says the user inputs **Location** — not "picks one of five pre-loaded Karnataka villages." If `/scan` today only offers those five, that is the single biggest compliance gap in the whole build, bigger than anything else in this document, because it means the system doesn't actually do what the PS asks for the general case.

Required:

- `/scan` accepts free-text location entry (village/town/district name, or lat/lng, or "use my location").
- Geocode it (a free/no-key option like Nominatim, or reuse whatever the other team's build used — OpenStreetMap Nominatim for forward geocoding is the standard free choice).
- For competitor density and demand signals at that new location, use a live query (OpenStreetMap Overpass API for nearby POIs of the relevant business category, within the 5–10 km radius) rather than inventing numbers. This mirrors what your teammates' FastAPI build already did for "any location beyond the two seed towns" — same idea, implemented client-side here.
- **Keep the 5 seeded villages as a fast, curated "rich demo" path** (they can carry hand-tuned festival/mandi context that a live lookup can't), but make it explicit in the UI which mode is active: "Curated local data for Dinka" vs. "Live lookup for <new location>" — the same honest data-provenance badge pattern already used correctly by `mandi.ts`.
- If Overpass/Nominatim is unreachable or returns nothing, say so on screen. Do not fall back to copying one of the 5 seed villages' numbers for a different place.

### 1.2 — Financial calculator: verify correctness, then add tests

You likely already have the ladder right (project = margin ÷ 10%; loan = 90%; ≤₹1.40L → Micro; else ≤₹50L → Term). Where the real risk is:

- **Boundary correctness**, tested explicitly:
  - Project cost exactly ₹1,40,000 and ₹1,40,001 (scheme flips here).
  - Project cost exactly ₹1,38,888.89 (this is where 90% of project cost first exceeds the Micro scheme's ₹1.25L absolute cap — below it, 90% governs; above it, the ₹1.25L cap governs. Get this `min()` logic right and test both sides).
  - Project cost exactly ₹50,00,000 (max Term Loan case: 90% of ₹50L = exactly ₹45L, so the absolute cap and the 90% rule coincide here — verify no floating-point drift pushes the computed loan a paise over ₹45,00,000).
  - Project cost ₹50,00,001 and above (out of PS scope — the UI should say so plainly, with the max supported margin capital, ₹5,00,000, rather than silently clamping or crashing).
  - Margin capital of ₹0 or empty — reject with a clear message, don't divide by zero or show a project cost of ₹0.
- **Quarterly schedule correctness**, since the repayment cadence here is quarterly (not monthly): quarterly rate `r = annual_rate / 4 / 100`; number of repayment quarters `n = tenure_years × 4 − moratorium_quarters` (moratorium_quarters = moratorium_months / 3, which divides cleanly for both schemes: 3mo→1 quarter, 6mo→2 quarters); EMI on the standard reducing-balance annuity formula; final quarter absorbs the rounding residue (Rule 3 above).
- **Fix the money-math convention** per Rule 1 — audit whether `finance.ts` currently uses raw floats, and migrate to integer-paise or `decimal.js` if so.
- Document the moratorium interest convention on screen per Rule 2.

### 1.3 — Add working capital (likely missing entirely)

The PS explicitly requires "working capital needs" as a Module-2 output. Add `src/lib/workingCapital.ts`:

```
working_capital = monthly_operating_cost × wc_cycle_months[business_category]
```

with a per-category cycle-length config table (dairy/food-processing short cycles, handicrafts/textiles longer), operating cost broken into visible line items (raw material, labour, utilities, transport/rent), the arithmetic shown on screen, and the category-cycle assumption stated explicitly. Surface it on `/finance` alongside the loan/EMI numbers — it's currently the most concretely-missing PS requirement based on the handoff.

### 1.4 — Module 1 audit against the six named PS deliverables

Confirm each of these exists on `/report`, and build whichever are missing:

- **Market reach, 5–10 km radius** — make the radius an explicit, visible, adjustable number (default ~7 km), not an implicit constant baked into a village's static competitor-density field.
- **Opportunity analysis** — which business types are under-represented near this location relative to population/demand, not just "here are the competitors."
- **SWOT** — confirmed present.
- **Threats** — confirmed present.
- **Competitor mapping** — render actual nearby competitors as markers on the `react-leaflet` map (you already have the dependency; confirm it's actually doing this and not just showing a single village pin). Competitor count within the radius, and density per km², communicates saturation far better than a list.
- **Product market value / pricing** — confirmed present; make sure it's wired to the calculator so a recommended price band is checked against "can this margin actually service the EMI/working-capital numbers on `/finance`" — that connection is a real differentiator worth making explicit in the UI, not just computing both numbers separately.

### 1.5 — Multilingual: Hindi is the critical gap ⚠️

EN/KN exists. The PS explicitly asks for languages **beyond Hindi/English**, which presupposes Hindi is already covered. A MoSJE rural-entrepreneur tool with no Hindi at all is the kind of gap a judge notices immediately.

- Add **Hindi (hi)** as a full third locale with complete key parity (enforced by the Phase 0 parity test).
- If time allows after Hindi, add more (Tamil, Telugu, Marathi, Bengali, Odia) — but Hindi is not optional, the others are stretch.
- **Financial terms need a human review pass per language** — EMI, moratorium, project cost, margin money, working capital, escrow, quorum. Raw machine translation gets these wrong in ways that actively mislead a beneficiary. Keep a small `docs/financial-glossary.md` tracking the approved term per language and review status.
- Any locale that's machine-translated-but-unreviewed should say so quietly in the UI rather than presenting as finished (e.g., a small "translation pending review" note), matching the honesty discipline already used for mandi prices.

### 1.6 — Consolidated, exportable feasibility + finance report

The PS asks for a feasibility study usable *before applying for funding*. `/report` and `/finance` exist separately; give the user one document to carry to NSFDC:

- Client-side PDF export (a library like `jspdf` + `html2canvas`, or a print stylesheet triggered via `window.print()` — the latter is simpler and has no new heavy dependency) combining: location + inputs, feasibility (radius, SWOT, competitors, pricing), finance (project cost, loan, scheme, quarterly schedule, working capital), LokScore breakdown, and a document checklist for the selected scheme.
- Generated in the user's selected language.
- Includes a generation timestamp and a data-provenance note (which numbers are curated seed data vs. live lookups vs. user input) — same honesty pattern as Rule 4.

**Acceptance for Phase 1:** any real location works, not just the 5 seed villages; the finance numbers are boundary-tested and quarter-cadence-correct; working capital is a real, shown number; all six Module-1 deliverables are genuinely present; Hindi exists; the whole thing exports as one document.

---

## PART 6 — PHASE 2: LOKSCORE RIGOR

LokScore is your ESS-equivalent, and its structure (5 weighted, named components) is inherently more explainable than a black-box model — keep it that way rather than "upgrading" it into something opaque.

- Confirm the weights (25/20/15/25/15) live in one named config object, not scattered literals.
- Return and render the **per-component breakdown**, not just the final number — a `recharts` radar or bar chart is a natural fit here (you already depend on `recharts`).
- For each component below 100%, show a one-line, plain-language reason it's not higher (e.g., "Competition gap: 3 similar businesses within 5 km" or "Eligibility: income marginally above the ₹5L cap for the bonus tier") — this is the same spirit as the FastAPI build's "improvement tips," implemented as a simple rule-based sentence per component, not ML.
- **Never frame the eligibility component as "how to change who you are to score higher."** If a bonus depends on SC status or being a woman applicant, the explanation states the rule, never a suggestion to change identity to qualify — informational only.
- Test the exact quorum boundary values: LokScore of exactly 60, exactly 60.01, exactly 80, exactly 80.01 — confirm each maps to the correct signer requirement (4-of-5+mentor / 3-of-5 / 3-of-5 / 2-of-3).

---

## PART 7 — PHASE 3: ADAPTIVE MULTI-SIG SANCTION — HARDEN THE DIFFERENTIATOR

This is LokPulse's most distinctive feature versus a typical SIH submission. Treat it with proportionate care.

- Confirm exactly how verifier identities work today (ephemeral in-browser wallets vs. fixture keys) and document it plainly in the UI: something like "Demo verifier identities — not linked to real government accounts" so nobody mistakes this for production auth.
- Confirm the attestation hash actually commits to the material facts being sanctioned (applicant, project cost, scheme, loan amount, LokScore at time of sanction) — signing an under-specified or generic hash would be a real (if subtle) correctness bug: a signature is only meaningful if it's over the right content.
- Verify signature checking is real: write a test that a signature from the wrong key, or over tampered data, is correctly rejected — not just that a valid signature is correctly accepted. The negative case is the one that actually proves the crypto is doing something.
- Decide honestly what "release escrow" means today (see Part 9, Decision D2) and make the UI copy match reality exactly — this is a place where overclaiming is easy and costly if a technical judge asks "so where are the funds right now?"
- If you keep `AdaptiveSanction.sol` as a sketch rather than deploying it, say so directly in the UI/docs rather than letting the presence of a `contracts/` folder imply a live chain underneath everything.

---

## PART 8 — PHASE 4: PRE-DISBURSEMENT PIPELINE POLISH

This is the whole current product (Scan → Pulse → Report → Finance → Sanction). Before adding anything new, make what exists bulletproof:

- Loading, error, and empty states on every route, including a clear message when the live `weather.ts` Open-Meteo call or a Phase-1.1 geocode/Overpass call fails — never a blank panel or an uncaught exception.
- Mobile viewport (360px) check on all five routes — a rural-facing product that only looks good on a laptop is a real gap.
- Keyboard navigation and basic screen-reader labeling on `/scan`'s form and `/sanction`'s signing flow, given the target users skew toward limited literacy and possibly older feature-phone-adjacent devices.
- `framer-motion` transitions should degrade gracefully (respect `prefers-reduced-motion`) rather than being purely decorative with no accessibility fallback.
- Re-run the Phase 0 Playwright demo-path test after every change in this phase — it's cheap insurance against regressions in the exact sequence you'll actually present.

---

## PART 9 — PHASE 5 (OPTIONAL / ROADMAP): POST-DISBURSEMENT EXTENSION

**This phase is explicitly optional and should not be started until Phases 0–4 are solid.** LokPulse today is a coherent, complete pre-disbursement product ending at sanction/escrow. Your teammates' separate FastAPI build has post-disbursement concepts (monthly monitoring, an ESS-style digital twin, an early-warning engine, an officer command center, a scheme-aware intervention router for beneficiaries who fall behind). Whether LokPulse should grow into that territory is a product decision, not an engineering default — see Decision D1 below.

If you do decide to extend:

- Post-disbursement monitoring needs **some persistence** — LokPulse is 100% client-side today. The smallest honest step is a lightweight backend (a single small Node/Express service, or a serverless function set) plus a database (SQLite is enough for a hackathon demo; Postgres if you want parity with the other build). Don't try to fake multi-user monitoring in `localStorage` — it won't survive a real demo question about "what happens across many beneficiaries."
- If you add this, reuse the LokScore breakdown as the basis for expected-vs-actual drift detection, rather than inventing a parallel scoring system — one explainable score, tracked over time, is a stronger story than two different scores for two phases of the same beneficiary's journey.
- A minimal officer view (who are the Amber/Red cases, why, what's the smallest suggested corrective action) is the single highest-value piece of this phase if you only have time for one.

---

## PART 10 — CROSS-CUTTING REQUIREMENTS

- **`docs/ps-traceability.md`** — one table mapping every sentence of the PS to the exact route/component/function/test that satisfies it. Build this during Phase 1; it's both a completeness check and the most persuasive single artifact you can hand a judge.
- **`docs/honesty-ledger.md`** — every number on screen, its source (PS-fixed constant / seeded data / live API / computed / user input), and its verification status. Specifically: the 5 seed villages vs. any newly-geocoded location, the live weather call, the (not-live) mandi quotes, and the escrow release's real vs. simulated status.
- Keep this spec current: update `docs/MASTER_SPEC.md`'s status notes as phases complete, so anyone opening the repo cold (including a future Cursor session) knows what's actually done.
- `npm run build`, `npm run lint`, `npm test`, and the Playwright demo-path test all green before considering any phase finished.

---

## PART 11 — DECISIONS ONLY YOU CAN MAKE

**D1 — Does LokPulse absorb the other build's post-disbursement ideas, or stay a focused pre-disbursement product?** Both are legitimate submissions. A tight, fully-correct Scan→Sanction flow with real cryptography is arguably a stronger, more defensible demo than a half-built superset trying to cover both products. Recommendation: finish Phases 0–4 first, then decide — don't start Phase 5 speculatively.

**D2 — Escrow: stays simulated, or gets a real testnet deployment?** A real Sepolia (or similar) deployment gives you a genuine on-chain tx to show a judge, which is a strong moment — but it adds a live network dependency to your demo (bad wifi = broken demo) and gas/faucet logistics. Recommendation: keep escrow release as an honestly-labeled simulated state transition for the live demo, and mention the deployed contract as architecture-ready-for-production in the docs/pitch, unless you have time to test the testnet path thoroughly and have a backup plan if the network is flaky on demo day.

**D3 — Language scope beyond Hindi.** Hindi is mandatory (Part 5, 1.5). Beyond that: which of Tamil/Telugu/Marathi/Bengali/Odia, if any, given your remaining time? Fewer fully-reviewed languages beats more machine-translated-and-unlabeled ones.

**D4 — Location generalization scope (Part 5, 1.1).** Full Overpass/Nominatim live lookup for arbitrary India-wide locations is the correct long-term answer, but it's real engineering effort. If time is short, a smaller honest version — e.g., generalize within Karnataka only, or add 10–15 more hand-seeded villages across a couple of states while being explicit that arbitrary-location support is architecture-ready but not yet wired — is a legitimate scoped-down choice, as long as the UI never implies full coverage it doesn't have.

**D5 — Verifier identity model for `/sanction`.** Ephemeral in-browser demo wallets are fine and honest for a hackathon. If you want to strengthen the story, consider a short "how this maps to real officer authentication in production" note in the docs rather than trying to build real auth under time pressure — that's real work that doesn't change what the judges see in the demo.

---

## PART 12 — DEFINITION OF DONE (apply per phase)

- [ ] `npm run build` succeeds with no new warnings.
- [ ] `npm run lint` clean.
- [ ] `npm test` (Vitest) green, including new tests for anything touched this phase.
- [ ] The Playwright demo-path test (Part 4) still passes unmodified.
- [ ] i18n parity test passes across EN/KN(/HI once added).
- [ ] Every number touched this phase is traceable to a PS constant, seeded data, a live API call, a user input, or a documented assumption — recorded in `docs/honesty-ledger.md`.
- [ ] Anything simulated, seeded, or demo-only is labeled as such in the UI, not only in a code comment.
- [ ] Verified by actually running the app and clicking through, with screenshots/notes in the PR — not by reading the diff.
- [ ] `docs/ps-traceability.md` updated if the phase touched a PS requirement.

### Priority order if time is short

Phase 0 (tests/tooling) → Phase 1.1 (real location) → Phase 1.2 (finance correctness) → Phase 1.3 (working capital) → Phase 1.5 (Hindi) → Phase 1.4 (Module 1 audit) → Phase 1.6 (PDF export) → Phase 2 (LokScore breakdown UI) → Phase 3 (multi-sig hardening) → Phase 4 (polish) → Phase 5 (only if time remains and D1 says yes).

Rationale: Phase 0 protects everything after it. Phase 1.1 and 1.2 are the two places where the current build most risks failing to actually satisfy the problem statement for a general case or under a boundary-value question. Everything else deepens an already-coherent product.

---

## STATUS NOTES (Cursor-maintained)

- Spec saved: 2026-09-12
- **Phase 0: COMPLETE** (2026-09-12) — Vitest (22 tests), oxlint `--deny-warnings` clean, `strict: true`, EN/KN parity test, Playwright demo-path E2E green. Hindi explicitly deferred per product owner.
- Phase 1–5: not started
- Note: lint tool is **oxlint** (not ESLint); scripts: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`
