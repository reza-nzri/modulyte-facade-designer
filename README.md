# Modulyte Facade Designer

Interactive facade configurator for **modulyte GmbH**. Homeowners open a building project supplied as JSON, style each facade with the available materials and colours (for a whole wall or for any group of modules), see the price update live, compare design variants in 2D and 3D, and hand the final design back to Modulyte as a printable summary and a versioned JSON export.

> Customer-facing UI language: **German** (MVP). Code, docs, identifiers and commits: **English**.

![2D editor](docs/screenshots/editor-2d.png)

| 3D house                                  | Variant comparison                                 | Customer summary (print/PDF)                      |
| ----------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| ![3D view](docs/screenshots/house-3d.png) | ![Variants](docs/screenshots/variants-compare.png) | ![Summary](docs/screenshots/customer-summary.png) |

Example print output: [`docs/screenshots/customer-summary-example.pdf`](docs/screenshots/customer-summary-example.pdf).

---

<details>
  <summary><h2>Features</h2></summary>

**Core**

- **Accurate 2D elevations** of all walls from the JSON (SVG, millimetre user units, no distortion). Windows and doors are drawn at their coordinates, standard modules and made-to-measure modules ("Passstücke") are distinguishable, overall and chain dimensions are shown.
- **Material & colour** library built only from `surfaces` in the project data. One click applies material + colour to the current target: the **selected modules**, or – when nothing is selected – the **whole wall**. The panel always states the target ("Änderungen gelten für …").
- **Region selection**: click, Shift/Ctrl‑click, rectangle selection, keyboard (arrows + Enter), and one-click presets for homeowners: _Sockelzone, Obere Abschlussreihe, Rund um Fenster & Türen, Alle Passstücke, Linke/Rechte Hauskante, Ganze Wand_.
- **Drag & drop**: drag a colour swatch onto a module, onto the current selection, onto empty wall area (whole wall) or onto a facade card in the sidebar.
- **Live pricing**: per wall, per material line and in total; every change shows a price delta (“+56,63 €”); hovering a swatch previews the price difference _before_ applying it; "Was ist im Preis enthalten?" explains scope.

---

- **3D house** (three.js) assembled from the four walls, with textures matching the 2D materials, orbit controls, camera presets per facade, auto-rotate, and two-way synchronised selection (click a module in 3D → it is selected in 2D and the inspector opens).
- **Module inspector**: id, type, size, area, position, finish (own or inherited) and its price share.
- **Variants**: save named variants, rename, load, export, delete, and compare any number of them against the current design (thumbnails per wall, materials, wall prices, totals, differences, cheapest option).
- **Customer summary**: A4 print layout ("Drucken / Als PDF speichern") with project reference, material overview, per-wall elevation and breakdown, and calculation assumptions.

---

- Undo/redo (Ctrl+Z / Ctrl+Shift+Z), autosave of project + design in the browser, onboarding guide and glossary in plain German, keyboard shortcuts, versioned JSON export with full audit data, import validation with understandable German errors, window-wide file drop, "copy diagnostics" for support.
  
</details>

---

<details>
  <summary><h2>Quick start</h2></summary>

Requirements: Node.js **22.12+**.

```bash
npm install
npm run dev          # http://localhost:5173
```

The app opens the supplied example house (`static/projects/fassadendesigner_house.json`) automatically. Use **Öffnen → Datei öffnen …** (or drag a `.json` file onto the window) to load another project or a previously exported design.

| Command                 | Purpose                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Development server with hot reload                                                                    |
| `npm run build`         | Static production build in `build/` (SPA, deployable to any static host)                              |
| `npm run preview`       | Serve the production build locally                                                                    |
| `npm run check`         | `svelte-check` with strict TypeScript, warnings fail                                                  |
| `npm run lint`          | Prettier check + ESLint (incl. Svelte rules)                                                          |
| `npm run format`        | Format all files with Prettier                                                                        |
| `npm run test:unit`     | Vitest unit/integration tests                                                                         |
| `npm run test:coverage` | Unit tests with V8 coverage report                                                                    |
| `npm run test:e2e`      | Playwright end-to-end tests (builds and serves the app; first run: `npx playwright install chromium`) |
| `npm run verify`        | check + lint + unit tests + build (what CI's first job runs)                                          |

</details>

<details>
  <summary><h2>Technology stack</h2></summary>

| Concern       | Choice                                                       | Why                                                                                   |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| App framework | **SvelteKit 2** (static adapter, SPA), **Svelte 5** runes    | Preferred by Modulyte (job ad + assignment), small runtime, fine-grained reactivity   |
| Language      | **TypeScript (strict)** incl. `noUncheckedIndexedAccess`     | Catch data errors at compile time                                                     |
| 2D rendering  | **SVG** in millimetre user units                             | Exact geometry, crisp at every zoom, accessible, printable                            |
| 3D rendering  | **three.js**                                                 | Bonus requirement; geometry built from the same domain data                           |
| Validation    | **Zod 4**                                                    | Runtime validation of untrusted JSON + inferred TypeScript types + JSON Schema export |
| Tests         | **Vitest** (unit/integration), **Playwright** (E2E)          | Fast domain tests, real-browser workflows                                             |
| Quality       | ESLint (typescript-eslint, eslint-plugin-svelte), Prettier   | Consistent code, Svelte-specific best practices                                       |
| Styling       | Plain CSS with design tokens (`src/app.css`) + scoped styles | No extra dependency; tokens make a later design system easy                           |

SvelteKit 2.70 was chosen over the brand-new SvelteKit 3 (released two weeks before this work) to avoid early-adopter risk. Python/FastAPI, PostgreSQL, C#/.NET or Unity (also mentioned in the job ad) are **not** used: the MVP has no server-side requirement. See _How to extend_.
</details>

<details>
  <summary><h2>Architecture</h2></summary>

```
src/
├── lib/
│   ├── domain/            # Framework-free core (no Svelte, no DOM) – reusable by API/mobile/workers
│   │   ├── project.ts     #   input contract (Zod) + types
│   │   ├── geometry.ts    #   exact areas (union of rectangles), wall statistics
│   │   ├── claddingArea.ts#   priced area per module (never double counted)
│   │   ├── validation.ts  #   semantic checks with German messages
│   │   ├── design.ts      #   immutable design model: wall finishes + module overrides
│   │   ├── pricing.ts     #   price calculation (integer cents)
│   │   ├── money.ts       #   rounding + formatting
│   │   └── selection.ts   #   region presets, rectangle selection
│   ├── io/                # Versioned export document, import (project or design), schemas
│   ├── persistence/       # Key-value store abstraction, variant & workspace repositories
│   ├── observability/     # Structured logger, clock
│   ├── features/          # UI, one folder per feature
│   │   ├── editor/        #   EditorStore (Svelte 5 runes) = application state + intents
│   │   ├── canvas/        #   2D SVG workspace, WallElevation renderer, viewport math
│   │   ├── materials/     #   material library, drag payload
│   │   ├── selection/     #   region presets, module inspector
│   │   ├── pricing/       #   price breakdown panel
│   │   ├── walls/         #   facade list with thumbnails
│   │   ├── house3d/       #   three.js scene (layout math is pure + tested)
│   │   ├── variants/      #   save/compare variants (comparison logic is pure + tested)
│   │   ├── summary/       #   printable customer summary
│   │   ├── help/          #   onboarding, glossary, shortcuts, diagnostics
│   │   └── ui/            #   Dialog, Icon, Toasts
│   └── testing/           # Test fixtures (node only)
└── routes/+page.svelte    # Composition root: wiring, global shortcuts, file drop
```

**Rules that keep it maintainable**

1. **Domain first.** Geometry, pricing, validation and design operations are pure functions in `src/lib/domain` (ESLint forbids importing Svelte/three.js there). The price is _never_ computed in a component.
2. **One state owner.** `EditorStore` holds project, design, selection and view state and exposes intent methods (`applyFinish`, `selectPreset`, `undo` …). Components read state and call intents.
3. **Immutable design.** Every edit produces a new `FacadeDesign` object → undo/redo, variants, autosave and export are trivial and safe.
4. **Ports for I/O.** Storage goes through `KeyValueStore`/repositories with async APIs, so a REST backend + database can replace `localStorage` without touching UI code.
5. **Versioned contracts.** Input and export are validated with Zod and published as JSON Schema in `docs/schemas` (a test fails if they drift).

More: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
</details>

<details>
  <summary><h2>Data contracts (JSON import/export)</h2></summary>

- **Input** – the original Modulyte project format (`project`, `walls[]`, `surfaces[]`), accepted unchanged. Unknown extra fields are preserved. Schema: [`docs/schemas/source-project.v1.schema.json`](docs/schemas/source-project.v1.schema.json).
- **Export** – `format: "modulyte.facade-design"`, `formatVersion: 1`, containing the **unchanged source project**, the **design** (`wallFinishes`, `moduleOverrides`) and a derived **summary** for Modulyte (per-wall areas and prices, material lines, every module's assignment, assumptions). Schema: [`docs/schemas/facade-design.v1.schema.json`](docs/schemas/facade-design.v1.schema.json).
- **Import** accepts both. For design documents only `source` + `design` are trusted; prices are recomputed and a warning is shown if a stored total differs. Invalid references (unknown modules, colours not offered) are dropped with a notice.

Details and examples: [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md).
</details>


<details>
  <summary><h2>Pricing methodology</h2></summary>

```
price(wall) = Σ over modules  claddingArea(module) × eur_per_m2(surface assigned to the module)
claddingArea(module) = module ∩ wall − openings − area already counted for earlier modules
```

- The basis is the **module area** that physically receives cladding. For the supplied house this equals the **net wall area** (gross − openings) exactly, because the layout plan covers it without gaps: 168.30 m² in total.
- Colours do not change the price (the data has one rate per surface).
- Money is computed in **integer cents**; rounding (half up) happens once per wall × material line; wall totals and the project total are exact sums of those lines, so the breakdown always adds up.
- **Not included** (no data in the project file, therefore not invented): insulation modules, substructure, reveals, waste, installation, transport, VAT. The UI and the summary say so explicitly.

Reference numbers (also used as golden tests): clinker everywhere **15,988.50 €**, Rockpanel **11,781.00 €**, rhombus battens **13,464.00 €**. More: [docs/PRICING.md](docs/PRICING.md).
</details>

<details>
  <summary><h2>Geometry and coordinate system</h2></summary>



- Units: **millimetres** (integers in the data). Origin: **bottom-left corner of each wall**, x to the right, y upwards – as seen from outside.
- SVG has its origin top-left with y downwards; the flip `y_svg = H − (y + h)` happens **only** in `WallElevation.svelte`. Pointer coordinates are converted back with `getScreenCTM().inverse()`.
- 3D: walls with the ids `south/east/north/west` form a rectangular footprint (9.80 × 8.50 m for the example); each wall's x axis runs left→right as seen from outside. A unit test verifies that the four walls close the footprint. Projects with other ids are shown as a row of walls.
- Module depth in 3D: 210 mm (≈ 21 cm system thickness published by Modulyte) – visual only.
</details>

<details>
  <summary><h2>UX decisions and terminology</h2></summary>

- Target group: homeowners, not professionals. Three-step model shown in the onboarding and in the panels: **① Bereich wählen (optional) → ② Material & Farbe wählen**, price always visible.
- "**Sondermodul**" is shown as "**Passstück (Sondermodul)**": _"Auf Maß gefertigtes Modul für Stellen, an denen kein Standardmodul passt – an Fenstern, Türen und Hauskanten."_ Marked with an orange corner in the plan view.
- Material names from the data are presented in German (`Clinker bricks` → _Klinkerriemchen_, `Rockpanel` → _Rockpanel-Platten_, `Rhombus battens` → _Rhombusleisten (Holz)_), colour ids get German labels and display colours. Unknown materials/colours from other projects fall back to the data name and a deterministic colour, and the texture is guessed from the name.
- Applying a material to a whole wall **keeps** individually styled regions (e.g. a clinker plinth survives a colour change of the wall). "Bereiche zurücksetzen" removes them.
- Technical overlays (module borders, Passstück marks, dimensions, module numbers) can be toggled for a cleaner "photo" view.
</details>

<details>
  <summary><h2>Testing</h2></summary>

- **Unit/integration (Vitest)**: schema + semantic validation, exact areas, overlap handling, pricing golden numbers and invariants (lines = walls = total), design operations, selection presets, import/export round trip, tampered price detection, repositories, viewport math, 3D footprint closure, variant comparison, JSON-schema drift. ≈ 92 % statement coverage of the domain/io/persistence layers.
- **End-to-end (Playwright, Chromium)**: loading, wall styling with exact prices, plinth region, click/shift/frame selection + inspector, undo/redo, wall switching, autosave after reload, export → re-import round trip, invalid file error, original project import, 3D click-to-select, variants save/compare/load, print layout.
</details>

<details>
  <summary><h2>Assumptions and known limitations</h2></summary>

- The supplied JSON is the source of truth. The shortened example inside the assignment text differs from the file (e.g. 9400 × 5600 wall, 1250 × 625 modules); the app reads all sizes from the data and never hard-codes them.
- Prices are **assignment data**, not real Modulyte prices; VAT status is unknown and therefore not shown as "inkl./zzgl.".
- Geometry is never edited: modules are fixed by Modulyte's layout plan (computing a new plan is Test Project 2). Users style modules; they cannot move or resize them.
- Display colours/textures for material ids are UI assumptions (`src/lib/features/appearance/appearance.ts`).
- The 3D roof is a neutral placeholder (no roof data); window frames/reveals are simplified.
- Variants and autosave live in the browser (`localStorage`); clearing browser data deletes them – export files are the durable hand-over format. If storage is blocked, the app says so.
- Desktop-first layout; on tablets/phones the panels stack vertically and core functions remain usable, but precise selection is best with a mouse.
</details>

<details>
  <summary><h3>How to extend</h3></summary>

- **Add a material**: add an entry to `surfaces` in the project JSON – nothing else is required. Optional: add a German label/texture in `SURFACES` and display colours in `COLORS` (`src/lib/features/appearance/appearance.ts`).
- **Change pricing** (e.g. add VAT, waste factor, labour per m²): extend `priceWall`/`priceProject` in `src/lib/domain/pricing.ts` and add golden tests in `pricing.test.ts`; UI and export pick it up automatically.
- **New region preset**: add an id + German label to `SELECTION_PRESETS` and a case in `selectPreset` (`src/lib/domain/selection.ts`).
- **Backend persistence**: implement `VariantRepository`/`WorkspaceRepository` against an API and pass them to `EditorStore` in `src/routes/+page.svelte`.
- **Verlegeplaner (Test Project 2)**: implement `layout(wall, moduleSystem, params) → modules[]` in `src/lib/domain/layout/` (pure, tested), then feed its output into the existing `walls[].modules` – the whole designer, pricing, 3D and export work unchanged. See [docs/VERLEGEPLANER_INTEGRATION.md](docs/VERLEGEPLANER_INTEGRATION.md).
</details>

<details>
  <summary><h3>With more time</h3></summary>

- Real material photos/PBR textures and a material catalogue from an API; colour codes (RAL/NCS) in the data.
- Full cost model (modules, substructure, reveals, labour, VAT) once Modulyte provides rates; quote request flow.
- Accounts + server persistence (FastAPI + PostgreSQL), shareable design links, PDF generation on the server.
- Gable walls/polygons, reveals and plinth geometry from the scan model; photo overlay of the real house.
- Visual regression tests, accessibility audit with screen-reader users, i18n (English UI).
</details>

---

Assessment data ([`static/projects/fassadendesigner_house.json`](https://github.com/reza-nzri/modulyte-facade-designer/blob/main/static/projects/fassadendesigner_house.json)) © [Modulyte GmbH](https://www.modulyte.de/), used for this assignment only.

