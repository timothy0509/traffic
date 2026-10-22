export interface LaneReading {
  lane_id: string;
  speed: number; // km/h
  occupancy: number; // %
  volume: number; // vehicles in period
  valid: boolean;
}

export interface DetectorReading {
  id: string;
  direction: string;
  lanes: LaneReading[];
}

export interface TrafficPeriod {
  from: string;
  to: string;
  detectors: DetectorReading[];
}

export interface LiveResponse {
  date: string;
  fetchedAt: string;
  periods: TrafficPeriod[];
}

export interface DetectorMeta {
  id: string;
  district: string;
  road_en: string;
  road_tc: string;
  lat: number;
  lng: number;
  direction: string;
  rotation: number;
}

export interface EnrichedDetector extends DetectorMeta {
  reading: DetectorReading | null;
  avgSpeed: number | null;
  totalVolume: number;
  maxOccupancy: number;
  status: "smooth" | "slow" | "congested" | "nodata";
}

export function classify(avgSpeed: number | null, maxOcc: number, volume: number): EnrichedDetector["status"] {
  if (avgSpeed === null) return "nodata";
  if (volume === 0 && maxOcc === 0) return "nodata";
  if (avgSpeed < 15 || maxOcc >= 60) return "congested";
  if (avgSpeed < 30 || maxOcc >= 30) return "slow";
  return "smooth";
}
