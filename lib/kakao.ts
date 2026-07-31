// Kakao Local API — 주소 지오코딩 + 키워드 장소 검색 (결정 D7 개정: 무료·한국 특화)
// REST 키는 서버 전용. 카드/결제 불필요. 지도 렌더는 MapLibre, 열기는 Google Maps URL 유지.
import { requireEnv } from "@/lib/env";

const BASE = "https://dapi.kakao.com/v2/local";

function authHeader() {
  return { Authorization: `KakaoAK ${requireEnv("KAKAO_REST_API_KEY")}` };
}

// ── 주소 → 좌표 (지오코딩) ─────────────────────────────────
export type GeocodeResult = {
  address: string;
  latitude: number;
  longitude: number;
};

export async function searchAddress(query: string): Promise<GeocodeResult | null> {
  const url = `${BASE}/search/address.json?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: authHeader() });
  if (!res.ok) throw new Error(`주소 검색 실패: ${res.status}`);
  const data = (await res.json()) as {
    documents?: {
      address_name: string;
      x: string; // 경도(lng)
      y: string; // 위도(lat)
      road_address?: { address_name: string } | null;
    }[];
  };
  const first = data.documents?.[0];
  if (!first) return null;
  return {
    address: first.road_address?.address_name ?? first.address_name,
    latitude: Number(first.y),
    longitude: Number(first.x),
  };
}

// ── 키워드 장소 검색 ───────────────────────────────────────
export type LocationBias = { latitude: number; longitude: number; radiusM: number };

export type PlaceResult = {
  externalPlaceId: string; // Kakao place id (place.google_place_id 컬럼에 저장)
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string;
  placeUrl: string | null;
};

type KakaoPlace = {
  id: string;
  place_name: string;
  category_name?: string;
  category_group_code?: string;
  address_name?: string;
  road_address_name?: string;
  x: string;
  y: string;
  place_url?: string;
};

// Kakao category_group_code → 표시 카테고리, 폴백은 category_name 키워드
const GROUP_TO_CATEGORY: Record<string, string> = {
  CE7: "카페",
  FD6: "식당",
  CT1: "문화",
  AT4: "문화",
};

function mapKakaoCategory(code?: string, name?: string): string {
  if (code && GROUP_TO_CATEGORY[code]) return GROUP_TO_CATEGORY[code];
  const n = name ?? "";
  if (/카페|커피/.test(n)) return "카페";
  if (/음식|식당|맛집|한식|양식|일식|중식/.test(n)) return "식당";
  if (/공방|체험|클래스|공예|도자/.test(n)) return "공방·체험";
  if (/문화|전시|미술|박물|공연|극장/.test(n)) return "문화";
  if (/운동|헬스|요가|필라테스|스포츠|클라이밍/.test(n)) return "운동";
  // category_name 마지막 세그먼트 폴백
  const last = n.split(">").pop()?.trim();
  return last || "기타";
}

function toResult(p: KakaoPlace): PlaceResult {
  return {
    externalPlaceId: p.id,
    name: p.place_name,
    address: p.road_address_name || p.address_name || null,
    latitude: Number(p.y),
    longitude: Number(p.x),
    category: mapKakaoCategory(p.category_group_code, p.category_name),
    placeUrl: p.place_url ?? null,
  };
}

export async function searchPlaces(
  query: string,
  bias?: LocationBias,
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ query, size: "15" });
  if (bias) {
    params.set("x", String(bias.longitude));
    params.set("y", String(bias.latitude));
    params.set("radius", String(Math.min(bias.radiusM, 20000))); // Kakao 최대 20km
    params.set("sort", "distance");
  }
  const res = await fetch(`${BASE}/search/keyword.json?${params.toString()}`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(`장소 검색 실패: ${res.status}`);
  const data = (await res.json()) as { documents?: KakaoPlace[] };
  return (data.documents ?? []).map(toResult);
}

/** 키 없이 구성하는 Google Maps 열기 URL (렌더/데이터와 무관하게 유지) */
export function googleMapsUrl(name: string, lat: number, lng: number): string {
  const q = encodeURIComponent(`${name} ${lat},${lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
