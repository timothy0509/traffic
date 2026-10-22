# HK Smart Lamppost Traffic

Live web app for Transport Department traffic data from detectors installed at smart lampposts (DATA.GOV.HK). Shows speed, volume and road occupancy across Kwun Tong, Yau Tsim Mong and Wan Chai.

Data: https://data.gov.hk/en-data/dataset/hk-td-tis_33-traffic-data-traffic-detectors-installed-at-smart-lampposts

## Stack

- TypeScript + Bun (API proxy + static server in `server.ts`)
- Vite + React + Tailwind CSS v4
- Leaflet (dark basemap, speed-coded detector markers) + lucide-react icons

## How it works

- `GET /api/live` proxies `rawSpeedVol_SLP-all.xml` (30s server cache), parses 30-second periods to JSON
- `GET /api/detectors` proxies the detector location CSV (1h cache) to JSON
- Frontend polls `/api/live` every 30s, merges with locations, colors markers by avg speed / occupancy, keeps a per-session speed history for sparklines

## Run

```sh
bun install
bun server.ts &        # API on :3000 (serves dist/ if built)
bunx vite              # dev frontend on :5173, proxies /api to :3000
```

Production:

```sh
bun run build
bun server.ts          # serves dist + API on :3000
```

## Status logic

- smooth: avg ≥ 30 km/h, max occupancy < 30%
- slow: avg 15–30 km/h or occupancy 30–60%
- congested: avg < 15 km/h or occupancy ≥ 60%
- no data: no lanes reporting
