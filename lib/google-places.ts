// Google Places API (New) 프록시 (docs/07) — 키는 서버 전용
import { requireEnv } from "@/lib/env";
import { mapGoogleTypesToCategory } from "@/lib/category";

const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";

const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.googleMapsUri",
].join(",");

export type LocationBias = { latitude: number; longitude: number; radiusM: number };

export type PlaceResult = {
  googlePlaceId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string;
  googleMapsUrl: string | null;
};

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  googleMapsUri?: string;
};

function toResult(p: GooglePlace): PlaceResult {
  return {
    googlePlaceId: p.id,
    name: p.displayName?.text ?? "(이름 없음)",
    address: p.formattedAddress ?? null,
    latitude: p.location?.latitude ?? 0,
    longitude: p.location?.longitude ?? 0,
    category: mapGoogleTypesToCategory(
      p.primaryType,
      p.types,
      p.primaryTypeDisplayName?.text,
    ),
    googleMapsUrl: p.googleMapsUri ?? null,
  };
}

function circleBias(bias?: LocationBias) {
  if (!bias) return undefined;
  return {
    circle: {
      center: { latitude: bias.latitude, longitude: bias.longitude },
      radius: bias.radiusM,
    },
  };
}

/** 텍스트 검색 (AI 자연어·자유 검색) */
export async function searchText(
  query: string,
  bias?: LocationBias,
): Promise<PlaceResult[]> {
  const res = await fetch(SEARCH_TEXT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": requireEnv("GOOGLE_MAPS_API_KEY"),
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "ko",
      locationBias: circleBias(bias),
    }),
  });
  if (!res.ok) throw new Error(`Places 검색 실패: ${res.status}`);
  const data = (await res.json()) as { places?: GooglePlace[] };
  return (data.places ?? []).map(toResult);
}

export type AutocompleteSuggestion = { placeId: string; text: string };

/** 자동완성 (검색창 타이핑, sessionToken 으로 과금 묶음) */
export async function autocomplete(
  input: string,
  sessionToken?: string,
  bias?: LocationBias,
): Promise<AutocompleteSuggestion[]> {
  const res = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": requireEnv("GOOGLE_MAPS_API_KEY"),
    },
    body: JSON.stringify({
      input,
      languageCode: "ko",
      sessionToken,
      locationBias: circleBias(bias),
    }),
  });
  if (!res.ok) throw new Error(`Places 자동완성 실패: ${res.status}`);
  const data = (await res.json()) as {
    suggestions?: { placePrediction?: { placeId: string; text?: { text: string } } }[];
  };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is { placeId: string; text?: { text: string } } => Boolean(p))
    .map((p) => ({ placeId: p.placeId, text: p.text?.text ?? "" }));
}
