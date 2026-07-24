// Google Geocoding — 바운더리 주소 → 좌표 (docs/04 §1, docs/10 온보딩)
import { requireEnv } from "@/lib/env";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export type GeocodeResult = {
  address: string;
  latitude: number;
  longitude: number;
};

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    address,
    language: "ko",
    key: requireEnv("GOOGLE_MAPS_API_KEY"),
  });
  const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`지오코딩 실패: ${res.status}`);
  const data = (await res.json()) as {
    status: string;
    results?: {
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }[];
  };
  const first = data.results?.[0];
  if (!first) return null;
  return {
    address: first.formatted_address,
    latitude: first.geometry.location.lat,
    longitude: first.geometry.location.lng,
  };
}
