import type { DetectorMeta } from "./types";

// Bundled copy of the detector location CSV so the map renders even when
// the Bun proxy is not running (static preview) or upstream is down.
// Source: https://static.data.gov.hk/td/traffic-data-slp/info/traffic_speed_volume_occ_info-slp.csv
export const FALLBACK_DETECTORS: DetectorMeta[] = [
  { id: "AID20011", district: "Kwun Tong", road_en: "Mut Wah Street near Fu Yan Street - Eastbound [AID20011]", road_tc: "物華街近輔仁街 - 東行 [AID20011]", lat: 22.31503, lng: 114.2244, direction: "East", rotation: 105 },
  { id: "AID20012", district: "Kwun Tong", road_en: "Mut Wah Street near Hip Wo Street - Westbound [AID20012]", road_tc: "物華街近協和街 - 西行 [AID20011]", lat: 22.31508, lng: 114.2254, direction: "West", rotation: 255 },
  { id: "AID20021", district: "Yau Tsim Mong", road_en: "Salisbury Road near Middle Road - Eastbound [AID20021]", road_tc: "梳士巴利道近中間道 - 東行[AID20021]", lat: 22.29497, lng: 114.1736, direction: "East", rotation: 90 },
  { id: "AID20022", district: "Yau Tsim Mong", road_en: "Salisbury Road near Kowloon Park Drive - Eastbound [AID20022]", road_tc: "梳士巴利道近九龍公園徑 - 東行[AID20022]", lat: 22.29475, lng: 114.1705, direction: "East", rotation: 90 },
  { id: "AID20023", district: "Yau Tsim Mong", road_en: "Salisbury Road near Middle Road - Westbound [AID20023]", road_tc: "梳士巴利道近中間道 - 西行[AID20023]", lat: 22.29468, lng: 114.174, direction: "West", rotation: 270 },
  { id: "AID20024", district: "Yau Tsim Mong", road_en: "Salisbury Road near Kowloon Park Drive - Westbound [AID20024]", road_tc: "梳士巴利道近九龍公園徑 - 西行[AID20024]", lat: 22.29451, lng: 114.171, direction: "West", rotation: 270 },
  { id: "AID20030", district: "Kwun Tong", road_en: "Hip Wo Street near Tung Yan Street - Northbound [AID20030]", road_tc: "協和街近同仁街 - 北行 [AID20030]", lat: 22.31405, lng: 114.2258, direction: "North", rotation: 345 },
  { id: "AID20031", district: "Kwun Tong", road_en: "Hip Wo Street near Mut Wah Street - Southbound [AID20031]", road_tc: "協和街近物華街 - 南行 [AID20031]", lat: 22.3145, lng: 114.2259, direction: "South", rotation: 165 },
  { id: "AID20032", district: "Kwun Tong", road_en: "Hong Ning Road near Mut Wah Street - Northbound [AID20032]", road_tc: "康寧道近物華街 - 北行 [AID20032]", lat: 22.31478, lng: 114.2236, direction: "North", rotation: 90 },
  { id: "AID20033", district: "Kwun Tong", road_en: "Hong Ning Road near Ming Chi Street - Southbound [AID20033]", road_tc: "康寧道近明智街 - 南行 [AID20033]", lat: 22.31655, lng: 114.2234, direction: "South", rotation: 165 },
  { id: "AID20051", district: "Wan Chai", road_en: "Harbour Road near Tonnochy Road - Westbound [AID20051]", road_tc: "港灣道近杜老誌道 - 西行 [AID20051]", lat: 22.28079, lng: 114.1769, direction: "West", rotation: 270 },
  { id: "AID20052", district: "Wan Chai", road_en: "Harbour Road near Fleming Road - Eastbound [AID20052]", road_tc: "港灣道近菲林明道 - 東行 [AID20052]", lat: 22.28082, lng: 114.1754, direction: "East", rotation: 90 },
  { id: "AID20053", district: "Wan Chai", road_en: "Harbour Road near Kong Wan Fire Station - Eastbound [AID20053]", road_tc: "港灣道近港灣消防局 - 東行 [AID20053]", lat: 22.28061, lng: 114.1726, direction: "East", rotation: 90 },
  { id: "AID20054", district: "Wan Chai", road_en: "Harbour Road near Kong Wan Fire Station - Westbound [AID20054]", road_tc: "港灣道近港灣消防局 - 西行 [AID20054]", lat: 22.28047809, lng: 114.1726631, direction: "West", rotation: 270 },
  { id: "AID20055", district: "Yau Tsim Mong", road_en: "Nathan Road near Salisbury Road - Northbound [AID20055]", road_tc: "彌敦道近梳士巴利道 - 北行 [AID20055]", lat: 22.29498127, lng: 114.1722551, direction: "North", rotation: 0 },
  { id: "AID20056", district: "Yau Tsim Mong", road_en: "Nathan Road near Carnarvon Road - Southbound [AID20056]", road_tc: "彌敦道近加拿分道 - 南行 [AID20056]", lat: 22.29735632, lng: 114.1721871, direction: "South", rotation: 180 },
  { id: "AID20057", district: "Yau Tsim Mong", road_en: "Nathan Road near Hillwood Road - Northbound [AID20057]", road_tc: "彌敦道近山林道 - 北行 [AID20057]", lat: 22.30122142, lng: 114.1719055, direction: "North", rotation: 0 },
  { id: "AID20058", district: "Yau Tsim Mong", road_en: "Nathan Road near Hillwood Road - Southbound [AID20058]", road_tc: "彌敦道近山林道 - 南行 [AID20058]", lat: 22.30194386, lng: 114.171857, direction: "South", rotation: 180 },
  { id: "AID20059", district: "Yau Tsim Mong", road_en: "Kowloon Park Drive near Middle Road - Southbound [AID20059]", road_tc: "九龍公園徑近中間道-南行 [AID20059]", lat: 22.29541468, lng: 114.1704889, direction: "South", rotation: 165 },
  { id: "AID20060", district: "Yau Tsim Mong", road_en: "Kowloon Park Drive near Salisbury Road - Northbound [AID20060]", road_tc: "九龍公園徑近梳士巴利道-北行 [AID20060]", lat: 22.29581202, lng: 114.1703822, direction: "North", rotation: 345 },
];
