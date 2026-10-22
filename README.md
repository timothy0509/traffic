# Lamppost Traffic Bulletin

Live Hong Kong transport from DATA.GOV.HK — every API-available dataset in the Transportation category. No backend to manage: the browser fetches open feeds directly, and a tiny Vercel relay (`api/relay.ts`) serves the handful of hosts without CORS headers.

## Sections

- Boards — smart lamppost detectors (20) and strategic-road detectors (~800), same 1-minute feed shape
- Journey — TDAS route planner (predicted speed, journey time, harbour-crossing alternates)
- Buses — KMB/LWB, Citybus, green minibuses, New Lantao Bus, plus a CTB/NLB stop board
- Rail·Sea — MTR next train, Light Rail, MTR bus, HKKF and Sun Ferry ETAs
- Parking — 587-site directory (static info), Kowloon East live vacancies (relay), West Kowloon (relay)
- Taxis — live positions of 3 fleets every 30s, vacant-only map
- CCTV·Works — 1000+ traffic cameras, journey-time corridors, speed panels, roadworks, blacksite/RLC lists
- Places — generic browser for all 86 CSDI spatial layers (bridges, piers, typhoon shelters, speed cameras…)
- Stats — census tables, HKIA flights, customs throughput, port TEU (relay)

Deliberately omitted: yearly Traffic Flow Census (static, not live), Fortune/Water Taxi (operator blocks automated access), HKSTP carparks (empty responses), NLB v1 stops/ETA (deprecated, v2 covers it).

## Stack

- TypeScript + Bun (toolchain) + Vite + React + Tailwind CSS v4, code-split per section
- Leaflet + OpenStreetMap tiles, lucide-react icons
- `src/lib/http.ts` — TTL cache + relay helper; `src/lib/feed.ts` — detector parsers; `src/lib/feeds/` — one client module per family

## Language

EN / 繁 toggle in the header, persisted in `localStorage` (defaults to Traditional Chinese when the browser language is Chinese). UI chrome is fully translated; data follows each feed's own localization: KMB/GMB/Citybus/NLB names and remarks, MTR bus (`zh`), Light Rail (`_ch`), HKKF/Sun Ferry, roadworks, census tables, HKIA (English-only upstream — noted in-app), port/customs CSVs, camera index, and speed panels all switch; a few sources have no Chinese variant (MTR line codes, blacksites) and stay as published.

## Run

```sh
bun install
bun run dev      # http://localhost:5173
bun run build    # outputs dist/
```

## Deploy (Vercel)

Static + one serverless function. `vercel.json` rewrites to `index.html`; `/api/relay` is served by `api/relay.ts` with an allowlisted host list. Framework preset Vite, no env vars. On plain static hosts without the relay, relay-backed panels show a note instead of data.
