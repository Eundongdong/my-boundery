// 지리 유틸 — 거리 계산·바운딩박스 (docs/04, docs/07)
// 렌더는 MapLibre, 거리 계산은 앱 레벨 haversine (PostGIS 미사용, D8)

const EARTH_RADIUS_M = 6371000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** 두 좌표 [위도, 경도] 사이 거리(미터) */
export function haversineMeters(a: [number, number], b: [number, number]): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** 거리 표시 문자열 (예: 320m, 1.2km) */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export type BoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

/**
 * 중심 좌표 기준 반경(미터)을 감싸는 위경도 바운딩박스.
 * D1에서 반경 쿼리를 못 하므로, 박스로 후보를 좁힌 뒤 haversine으로 정밀 필터한다.
 */
export function boundingBox(lat: number, lng: number, radiusM: number): BoundingBox {
  const latDelta = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngDelta =
    (radiusM / (EARTH_RADIUS_M * Math.cos(toRad(lat)))) * (180 / Math.PI);
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}
