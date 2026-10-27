# AI disclosure

How AI was used to build Ishaara, and what the team did itself.

## AI tools used

| Tool | Used for |
|---|---|
| **ChatGPT** (OpenAI) | Code generation and refactoring during development |
| **Claude Code** (Anthropic) | Code generation and refactoring during development, and writing documentation |
| **Cursor** | Code generation and refactoring during development. Two planning documents in this repository, [`MASTER_SPEC.md`](MASTER_SPEC.md) and [`PRERNA_HANDOFF.md`](PRERNA_HANDOFF.md), are written as briefs addressed to it |
| **Gemini Live** (Google) | **Runs inside the product**, not a build tool. It is the voice assistant a citizen talks to: native-audio conversation in English, Kannada and Hindi. See [`TECHNICAL_DESIGN.md`](TECHNICAL_DESIGN.md) |

**Estimated AI share of the work: about 70%.** AI did most of the hands-on building; the team directed, verified and integrated it. This is the team's own estimate, not a measurement.

One commit in this repository's history is authored by `Claude <noreply@anthropic.com>`. Most AI-assisted work was committed under the team members' own names, so commit authorship does not measure the split.

## What the team did

- **Chose the problem** and the users: rural micro-entrepreneurs applying for government livelihood schemes, and small businesses in Kalaburagi district.
- **Researched and verified the scheme data against primary sources.** Every one of the 14 schemes in `src/assistant/data/schemes.ts` was checked against the issuing body's own page or order — NSFDC, KVIC, MUDRA, the Ministry of MSME, the Department of Fisheries, KSWDC, the Tamil Nadu MSME Department, KMDC and KMVSTDCL — not against aggregator sites. Each entry carries its source URL and a last-verified date. Where two official sources disagreed, the conflict is recorded in the entry rather than resolved silently.
- **Sourced the calendar data by hand**: DoPT holiday orders for 2026 and 2027, Karnataka state holidays, and Kalaburagi's own events, each with a citation. Dates that are inferred or computed are labelled as such.
- **Made the product decisions**: what to build, which claims are allowed, and that a failed data source must show as unavailable rather than be filled in. [`HONESTY_LEDGER.md`](HONESTY_LEDGER.md) is the record of what may be claimed.
- **Tested and integrated**: running the full gate (tests, type check, lint, build) before commits, reviewing changes in pull requests, manual testing of real-microphone voice, and the live source checks recorded in [`DAILY_BRIEF.md`](DAILY_BRIEF.md).

No AI model computes a score, an eligibility result or a number shown to a user. Scheme eligibility (`src/assistant/eligibility.ts`) and the Daily Business Brief (`src/brief/engine.ts`) are deterministic rules. The assistant's AI layer only explains results it is given, and every reply is validated against the evidence before it is shown (`src/assistant/ai/responseGuard.ts`).

## Third-party data

| Source | Licence / terms |
|---|---|
| OpenStreetMap (Nominatim, Overpass, map tiles) | Data © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright); attributed in the map UI |
| Open-Meteo (forecast, ERA5 archive, CAMS air quality, GloFAS flood, Copernicus DEM elevation) | Free for non-commercial use; data CC-BY-4.0, derived from Copernicus services |
| DoPT holiday orders 2026 and 2027; Government of Karnataka holiday list | Government of India / Government of Karnataka public orders |
| Kalaburagi YouTube and Instagram news channels | Public posts, **not relicensed**. The app stores post metadata and links to each original; it does not republish the media |
| Gemini Live, Google Maps and Places, Apify (all optional) | Used under each provider's own terms, with the user's own API key |

## Third-party libraries

All direct dependencies, by declared licence (34 packages):

- **MIT** (29): React, React DOM, React Router, Vite, Vitest, TypeScript tooling, Tailwind CSS, `@supabase/supabase-js`, ethers, i18next, react-i18next, framer-motion, recharts, date-fns, clsx, jsdom, oxlint, the Supabase CLI, `@vis.gl/react-google-maps` and the `@types/*` packages.
- **Apache-2.0** (2): TypeScript, `@playwright/test`.
- **BSD-2-Clause** (1): Leaflet.
- **ISC** (1): lucide-react.
- **OFL-1.1** (1): `@fontsource-variable/inter` (the Inter typeface).
- **Hippocratic-2.1** (1): `react-leaflet`. Worth noting: this is an ethical-source licence, **not OSI-approved**, and it adds use restrictions that plain MIT does not. Anyone reusing this project commercially should read it.

Backend (`server/requirements.txt`): FastAPI, SQLAlchemy, Alembic, Pydantic, pydantic-settings and pytest are MIT; Uvicorn and httpx are BSD-3-Clause.

Ishaara itself is released under the [MIT License](../LICENSE).
