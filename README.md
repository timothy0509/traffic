# HK Smart Lamppost Traffic

Live web app for Transport Department traffic data from detectors installed at smart lampposts (DATA.GOV.HK). Speed, volume and road occupancy across Kwun Tong, Yau Tsim Mong and Wan Chai.

Data: https://data.gov.hk/en-data/dataset/hk-td-tis_33-traffic-data-traffic-detectors-installed-at-smart-lampposts

## Stack

- TypeScript + Bun (toolchain) + Vite + React + Tailwind CSS v4
- Leaflet with OpenStreetMap tiles (no API key) + lucide-react icons
- No backend. The browser fetches both upstream feeds directly, both send `Access-Control-Allow-Origin: *`

## How it works

- Live readings: `rawSpeedVol_SLP-all.xml` fetched every 60s, parsed in `src/lib/api.ts`
- Detector locations: location CSV fetched daily, bundled copy in `src/lib/fallbackDetectors.ts` as offline fallback
- Last good live reading is kept in `localStorage` so reloads render instantly

## Run

```sh
bun install
bun run dev      # http://localhost:5173
bun run build    # outputs dist/
```

## Deploy (Vercel)

Static only. `vercel.json` rewrites everything to `index.html`. Import the repo, framework preset Vite, no env vars needed.

## Status logic

- smooth: avg ≥ 30 km/h, max occupancy < 30%
- slow: avg 15–30 km/h or occupancy 30–60%
- congested: avg < 15 km/h or occupancy ≥ 60%
- no data: no lanes reporting
