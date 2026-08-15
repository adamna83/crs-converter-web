# CRS Converter Web App

Interactive coordinate reference system (CRS) converter with a map viewer. Pick any of 5,876 EPSG projected CRS, transform a single point or a CSV batch, choose between alternative datum transformations, and see the result plotted on a live map.

## Features

- **CRS search** — autocomplete over all 5,876 EPSG projected + geographic 2D CRS (name or code).
- **Single-point conversion** — convert X/Y between any two CRS, with an optional datum-transformation picker when the pair is available (shows `towgs84` parameters per step).
- **Batch CSV conversion** — upload a CSV (auto-detects ID / X / Y columns, with manual overrides), get a summary, a downloadable result CSV, and a map scatter of the transformed points.
- **Map viewer** — MapLibre GL with an OpenStreetMap basemap; source and target points are plotted via WGS84 reprojection.

## Architecture

```
coord_web/
├── backend/          # FastAPI + pyproj
│   ├── main.py              # app, routes, CORS
│   ├── crs_service.py       # EPSG index (5,876 CRS) + search/lookup
│   ├── transform_service.py # TransformerGroup datum ops + single-point transform
│   ├── batch_service.py     # CSV batch transform (column auto-detection)
│   └── requirements.txt
└── frontend/         # Vite + MapLibre GL
    ├── index.html
    ├── vite.config.js       # dev proxy: /api → http://localhost:8000
    └── src/
        ├── main.js          # entry: tabs, backend health check
        ├── api.js           # REST wrappers
        ├── map.js           # MapLibre init + markers + batch layer
        ├── crsPicker.js     # CRS autocomplete component
        ├── convert.js       # single-point form + datum-op picker
        ├── batch.js         # CSV upload, summary, download, scatter
        ├── ui.js            # toast + status
        └── style.css
```

## Prerequisites

- Python 3.10–3.12 (64-bit)
- Node.js 20+

## Setup

### Backend

```powershell
cd coord_web
python -m venv .venv
.venv\Scripts\Activate.ps1          # macOS/Linux: source .venv/bin/activate
pip install -r backend\requirements.txt
python -m uvicorn backend.main:app --port 8000
```

### Frontend

In a second terminal:

```powershell
cd coord_web\frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` requests to the backend on port 8000.

## API

| Method | Endpoint                 | Description                                   |
| ------ | ------------------------ | --------------------------------------------- |
| GET    | `/api/health`            | Health check                                  |
| GET    | `/api/crs/search?q=`     | Search EPSG CRS by name or code               |
| GET    | `/api/crs/{code}`        | CRS detail (name, area of use, proj4)         |
| GET    | `/api/operations?source=&target=` | Available datum transformations       |
| POST   | `/api/transform?source=&target=&x=&y=` | Transform a single point          |
| POST   | `/api/transform/batch`   | Multipart CSV batch transform                 |

## Notes

- The OSM basemap requires internet access; the converter itself works offline.
- Batch scatter plots only successfully transformed rows; failures are listed in the downloaded CSV.
- Backend CORS allows localhost:5173/4173; the frontend normally talks to the API via the Vite proxy.
