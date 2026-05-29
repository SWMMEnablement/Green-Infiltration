# Green-Infiltration

An interactive web app for exploring **Green–Ampt** (and related) **infiltration** models used in hydrology and stormwater engineering. Tune soil parameters, drive the model with a rainfall event, and visualize **infiltration rate** and **cumulative infiltration** over time — with a collapsible **method reference** built into the UI.

**Live app:** [replit.com/@robertdickinson/Green-Infiltration](https://replit.com/@robertdickinson/Green-Infiltration)

---

## What it does

Infiltration governs how much rainfall becomes runoff. The **Green–Ampt** model is one of the most widely used physics-based infiltration formulations in hydrology and is built into SWMM5, ICM InfoWorks, HEC-HMS, and most other rainfall–runoff tools.

Green-Infiltration lets you:

- Set the key Green–Ampt soil parameters (suction head, hydraulic conductivity, initial moisture deficit).
- Apply a rainfall input.
- Watch the **infiltration rate** decay and the **cumulative infiltration** accumulate over time.
- Read up on the method right inside the app via a **collapsible method-reference section**.

It's a teaching / intuition tool: dial parameters in, see what the curves do, then take those numbers into a full hydraulic model.

---

## Features

- **Interactive Green–Ampt simulation** — live recompute as you adjust inputs.
- **Rainfall input** — drive the model with rainfall data.
- **Infiltration-rate & cumulative charts** — with rate-capping for readability so charts stay legible during ponding.
- **Collapsible method reference** — in-app explainer for the equations and assumptions.
- **Responsive UI** — desktop & mobile friendly.
- **TypeScript end-to-end** — shared types between client and server.

---

## Tech stack

| Layer       | Technology |
|-------------|------------|
| Frontend    | React + Vite + TypeScript |
| Charts      | Recharts / Plotly (via the chart component layer) |
| UI          | Tailwind CSS + component registry (`components.json`) |
| Backend     | Node.js + Express (`server/`) |
| Database    | Drizzle ORM (`drizzle.config.ts`) for any persistence |
| Shared code | `shared/` types & schema |
| Scripts     | `script/` for utility / data prep |
| Hosting     | Replit (`.replit` config) |

---

## Repository structure

```text
Green-Infiltration/
├── client/              # React + Vite frontend (calculator UI, charts, method ref)
├── server/              # Express API
├── shared/              # Shared types & schema
├── script/              # Utility scripts (data prep, batch runs)
├── attached_assets/     # Reference images / visuals
├── drizzle.config.ts    # Drizzle ORM configuration
├── components.json      # UI component registry
├── package.json         # Scripts and dependencies
└── .replit              # Replit run/deploy configuration
```

---

## Green–Ampt at a glance

The Green–Ampt equation models the infiltration rate `f(t)` as a function of:

- `K_s` — saturated hydraulic conductivity
- `Ψ` — wetting-front suction head
- `Δθ` — initial moisture deficit (saturated minus initial water content)
- `F(t)` — cumulative infiltration up to time `t`

```
f(t) = K_s * ( 1 + Ψ * Δθ / F(t) )
```

During ponding the actual infiltration is `min(rainfall_intensity, f(t))`, which is why the in-app chart caps the rate — unbounded `f` at very small `F` makes the early time step visually drown the rest of the curve.

---

## Getting started

### Prerequisites

- Node.js 18+
- npm (or pnpm / yarn)

### Clone the repo

```bash
git clone https://github.com/SWMMEnablement/Green-Infiltration.git
cd Green-Infiltration
```

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run dev
```

The Express server serves the API and the Vite-built client; open the printed local URL.

### Build for production

```bash
npm run build
npm start
```

---

## Usage

1. Open the app.
2. Enter Green–Ampt soil parameters (`K_s`, `Ψ`, `Δθ`).
3. Provide a rainfall input (constant rate, hyetograph, or design storm).
4. Inspect the **infiltration-rate** and **cumulative-infiltration** charts.
5. Expand the **method reference** for equation details and assumptions.
6. Iterate on parameters until the response matches your expected soil behavior.

---

## Roadmap / ideas

- **Soil-type presets** — USDA texture-class defaults (sand, loam, clay loam, etc.).
- **Compare two soils** — side-by-side infiltration curves.
- **Design-storm library** — SCS Type II / III, Chicago, NRCS, user-defined hyetographs.
- **Other methods** — add Horton, SCS-CN, modified Green–Ampt with redistribution.
- **Export** — CSV download of the simulated time series.
- **Units toggle** — SI ↔ US customary.
- **SWMM5 / ICM bridge** — export parameters in formats ready to paste into model input files.

---

## About

Part of the **SWMMEnablement** organization — a set of small, focused tools for working with SWMM5 hydraulic models and the physics that underpins them. Companion to:

- [SWMM5InpReader](https://github.com/SWMMEnablement/SWMM5InpReader) — inspect SWMM5 input files.
- [SWMM5ReportReader](https://github.com/SWMMEnablement/SWMM5ReportReader) — analyze SWMM5 report (`.RPT`) output.

Built by **Robert Dickinson**.

## License

MIT
