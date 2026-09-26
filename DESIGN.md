# Dawa frontend — design & engineering guide

This document is the contract every page and component follows. Read it before adding UI.

## 1. Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| UI | React 19 (function components + hooks) | No class components, no state library. |
| Routing | React Router 7 (`react-router-dom`) | `BrowserRouter`, routes in `src/App.jsx`. |
| Styling | Plain CSS with custom properties | No preprocessor, no utility framework, no CSS-in-JS. |
| Charts | Hand-written inline SVG | No chart library. Canvas only for the decorative hero backdrop. |
| Build | Vite 8 | `npm run dev`, `npm run build`, `npm run preview`. |
| Fonts | Google Fonts: Instrument Serif, Inter, JetBrains Mono | Loaded in `index.html`, always with system fallbacks. |

Nothing else. If you think you need a package, ask first.

## 2. Files

```
src/
  main.jsx                 entry; imports tokens.css, base.css, components.css
  App.jsx                  routes + AuthProvider
  styles/
    tokens.css             design tokens (colours, type scale, spacing, radii)
    base.css               reset + shared classes (buttons, inputs, tables, meters, …)
    components.css         nav, footer, logo, search bar, stat, error state
  components/              shared components (Nav, Footer, SearchBar, ConfidenceMeter, TypeBadge, Icons, …)
  pages/                   one folder-less file per route + an optional `<page>.css` next to it
  api/
    index.js               the ONLY thing pages import for data: `api.search`, `api.predict`, `api.explain`, …
    client.js              fetch wrapper; mock switch (VITE_USE_MOCK)
    mock/                  in-browser stand-in for the Flask API (data + engine + handlers)
  hooks/                   useApi, useDebounce, useQueryHistory
  context/                 AuthContext (useAuth)
  utils/                   detectInput (SMILES heuristics), format (numbers, dates, cx)
```

Pages never import from `api/mock/*` directly. Everything goes through `api` so the backend can replace the mock without touching UI.

## 3. Visual language

**Palette** — warm paper, near-black ink, one accent (the burgundy of the logo). Nothing else.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f7f4ee` | page background |
| `--paper-2` / `--paper-3` | `#efeae1` / `#e6e0d4` | section shifts, hover fills, bento cells |
| `--white` | `#fffdf9` | inputs, popovers |
| `--ink` / `--ink-2` / `--ink-3` / `--ink-4` | `#1a1715` … `#aaa299` | text hierarchy |
| `--line` / `--line-strong` | `#e4ded3` / `#cfc7b9` | the only border colours |
| `--accent` / `--accent-hover` / `--accent-deep` | `#6e1b22` / `#86252e` / `#4a1016` | primary emphasis, confidence ≥ threshold |
| `--accent-tint` / `--accent-soft` / `--accent-text` | `#f4e5e3` / `#e3c3c0` / `#7d1f27` | tints, highlights, accent text on paper |

Rules:
- No gradients, no glows, no orbs, no purple. No green/red traffic-light colouring — confidence uses accent (above threshold) vs grey (below).
- Separate content with whitespace, type scale and background shifts (`.section--paper-2`, `.section--ink`). Borders only for table rows and the rare 1px rule.
- Do not wrap everything in cards. A bento cell (`.bento__cell`) or a `.notice` is the most "boxed" a block gets, and only when it is genuinely a distinct unit.
- No redundant sub-headings ("Features", "Our results") above content whose meaning is obvious.
- Asymmetric layouts: 5/7 or 4/7 grids, bento spans 7/5, editorial text columns. Avoid symmetrical 3-card rows.

**Type**
- Display / headings: `var(--font-display)` (Instrument Serif) via `.display`, `.h1`, `.h2`, `.h3`. Italic `<em>` inside a heading is the accent colour.
- Body / UI: `var(--font-body)` (Inter). `.h4` is the bold sans sub-heading.
- Identifiers, SMILES, numbers in tables: `var(--font-mono)` via `.mono` or `.tag--mono`.
- Small caps labels: `.eyebrow` (and `.eyebrow--accent`).
- Numbers that line up: `.num` (tabular figures).

**Spacing** — use `--s-1` … `--s-10`. Sections use `.section` (6rem vertical) or `.section--tight`.

## 4. Component classes you should reuse

| Purpose | Class / component |
| --- | --- |
| Page container | `.container`, `.container--narrow` |
| Page header | `.page-head` + `.eyebrow` + `.h1` + `.lede` |
| Buttons | `.btn` + `.btn--primary` / `--accent` / `--ghost` / `--quiet`, sizes `--sm` / `--lg` |
| Text links | `.link`, `.link--quiet`, `.arrow-link` |
| Inputs | `.field` / `.field__label` / `.input` / `.select` / `.textarea` / `.range` |
| Segmented control | `.segmented` + `.segmented__btn[aria-pressed]` |
| Chips / tags / badges | `.chip`, `.tag` (`--accent`, `--ink`, `--mono`), `<TypeBadge kind="drug|compound|disease|smiles" />` |
| Confidence bar | `<ConfidenceMeter value threshold />` |
| Tables | `.table-wrap > table.table.table--hover`, `.num` for numeric cells |
| Label/value pairs | `dl.dl` |
| Notices | `.notice`, `.notice--accent`, `.notice--ink` |
| Loading | `.skeleton` on any element, `.spinner` |
| Drawer | `.drawer-backdrop` + `.drawer` |
| Big number | `.stat` / `.stat__value` / `.stat__label` (`.stat--accent`) |
| Errors / empty | `<ErrorState title text onRetry backTo />` |
| Icons | `import { Icon } from '../components/Icons.jsx'` → `<Icon.ArrowRight size={16} />` |
| Search | `<SearchBar size="lg|md" initialQuery initialType onSubmit />` |

## 5. Data access

```js
import { api } from '../api/index.js'
import { useApi } from '../hooks/useApi.js'

const { data, error, loading, reload } = useApi((signal) => api.predict({ query, type, signal }), [query, type])
```

Endpoints (mirrored by the mock and documented on the Docs page):

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| GET | `/api/search?q=&limit=` | | `{ results: [{ id, name, kind, subtitle, matchedOn }] }` |
| GET | `/api/entities/:id` | | drug / compound / disease payload |
| POST | `/api/predict` | `{ query, type, id?, top_k, threshold }` | `{ direction, entity, threshold, topK, model, summary, predictions[] }` |
| GET | `/api/explain?drug=&disease=` | | explanation payload (pathways, genes, contributions, evidence, neighbours …) |
| GET | `/api/sources` | | `{ sources[], tables[], preprocessing[] }` |
| GET | `/api/model` | | `{ model }` (metrics, hyper-parameters, curves, calibration) |
| GET | `/api/stats` | | entity and edge counts |
| POST | `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`; GET `/api/auth/me` | | `{ token, user }` / `{ user }` |

Set `VITE_USE_MOCK=false` in `.env.local` to hit the Flask server (proxied from `/api` to `http://localhost:5000`).

## 6. Behaviour conventions

- Every page handles three states: loading (`.skeleton`), error (`<ErrorState>`), and empty.
- Confidence: show the numeric value to 2 decimals; colour by threshold; the F1-optimal default threshold is 0.79 and the user can change it.
- Ids are shown in mono (`DB00331`, `D003924`, gene symbols).
- Query history is local (`useQueryHistory`) until accounts exist server-side.
- Accessibility: real buttons and links, labelled inputs, `aria-*` on custom widgets, visible focus (`:focus-visible`), reduced-motion respected.
- Responsive: everything works at 400px wide. Tables scroll horizontally inside `.table-wrap`; grids collapse under 860px.
- Copy: British spelling in prose except product terms that already exist in the deck ("Analyze" button). Keep tone plain and clinical.
