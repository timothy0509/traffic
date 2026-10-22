import type { SourceConfig } from "./feed";
import { FALLBACK_DETECTORS } from "./fallbackDetectors";

export const SLP_SOURCE: SourceConfig = {
  id: "slp",
  label: "Lampposts",
  metaUrl: "https://static.data.gov.hk/td/traffic-data-slp/info/traffic_speed_volume_occ_info-slp.csv",
  liveUrl: "https://resource.data.one.gov.hk/td/traffic-detectors/rawSpeedVol_SLP-all.xml",
  metaTtlMs: 24 * 3600_000,
  liveTtlMs: 45_000,
  storeKey: "hk-traffic:slp-live",
  fallback: FALLBACK_DETECTORS,
};

export const STRATEGIC_SOURCE: SourceConfig = {
  id: "strategic",
  label: "Strategic roads",
  metaUrl: "https://static.data.gov.hk/td/traffic-data-strategic-major-roads/info/traffic_speed_volume_occ_info.csv",
  liveUrl: "https://resource.data.one.gov.hk/td/traffic-detectors/rawSpeedVol-all.xml",
  metaTtlMs: 24 * 3600_000,
  liveTtlMs: 45_000,
  storeKey: "hk-traffic:strategic-live",
};
