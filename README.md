# Dawa.ae — frontend

Drug repurposing web platform. Enter a drug, a disease, a compound or a SMILES string; get ranked candidates with the pathway evidence and source citations behind each one.

College of Computing and Informatics, University of Sharjah — Ryan Taha, Andreh Tabbah, Fahad Qutaiba, Omar Afaneh. Supervisor: Dr. Manar Abu Talib.

## Stack

- **React 19** + **React Router 7** — UI and routing
- **Plain CSS** with custom properties — no preprocessor, no utility framework
- **Hand-written SVG** for every chart and diagram; HTML5 Canvas only for the decorative hero backdrop
- **Vite 8** — dev server and build

That is the whole dependency list (see `package.json`). Fonts (Instrument Serif, Inter, JetBrains Mono) are loaded from Google Fonts with system fallbacks.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
```

## Mock API vs the Flask backend

Until the backend is up, every request is answered by an in-browser mock (`src/api/mock/`) that ships a curated subset of the knowledge graph (50 drugs and compounds, 62 diseases, 186 genes, 49 pathways, 156 PPI edges, 81 curated repurposing pairs) and a deterministic scoring engine, so the UI behaves like the real thing.

To point the UI at the real API:

```bash
cp .env.example .env.local
# then set
VITE_USE_MOCK=false
VITE_API_BASE=/api        # Vite proxies /api -> http://localhost:5000 (see vite.config.js)
```

The endpoint contract the frontend expects is in `src/api/index.js` and documented on the in-app **Docs** page (`/docs`). The mock handlers in `src/api/mock/handlers.js` return exactly the JSON shapes the Flask routes should return.

Demo account in mock mode: `demo@dawa.ae` / `demo1234`.

## Where things are

```
src/
  App.jsx              routes
  api/index.js         the API surface pages use (search, predict, explain, sources, model, stats, auth)
  api/client.js        fetch wrapper + mock switch
  api/mock/            in-browser stand-in for the backend (data, engine, handlers)
  components/          Nav, Footer, SearchBar (autocomplete + SMILES detection), ConfidenceMeter, …
  pages/               Home, Results, Explain, Database, Model, History, Docs, SignIn, NotFound
  styles/              tokens.css (design tokens), base.css, components.css
  hooks/               useApi, useDebounce, useQueryHistory (localStorage)
  utils/               detectInput (SMILES heuristics + validation), format
scripts/
  check.mjs            per-file syntax/import check:  node scripts/check.mjs src/pages/Results.jsx
  mock-smoke.mjs       prints sample predictions from the mock engine
```

`DESIGN.md` is the design and engineering guide — read it before adding UI.

## Routes

| Route | Page |
| --- | --- |
| `/` | Search + overview |
| `/results?q=&type=&id=&k=&t=` | Ranked predictions for a drug / compound / SMILES (→ diseases) or a disease (→ drugs) |
| `/explain/:drugId/:diseaseId` | Full explanation of one pair |
| `/database` | Sources, knowledge-graph statistics, standardised tables |
| `/model` | Model card: architecture, training, metrics, calibration |
| `/history` | Local query history |
| `/docs` | API reference for the backend contract |
| `/signin`, `/signup` | Account |

## Notes for the backend team

- Responses are plain JSON; errors use `{ "message": "...", "code": "..." }` with an HTTP status.
- `POST /api/predict` takes `{ query, type, id?, top_k, threshold }` and returns the entity it resolved plus ranked predictions; see `/docs` for the full schema.
- Auth is `Authorization: Bearer <token>`; the frontend stores the token in `localStorage` under `dawa.token`.
- Query history is client-side for now; a `GET/POST /api/history` pair can replace it later without UI changes.
