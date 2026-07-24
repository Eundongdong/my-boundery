// 장소(Place) repository — 마스터, 중복 판정 (docs/02, docs/07 §6, D14)
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import type { Database } from "@/db";
import { places, type Place } from "@/db/schema";
import { boundingBox, haversineMeters } from "@/lib/geo";

export type PlaceInput = {
  googlePlaceId?: string | null;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  category?: string | null;
  googleMapsUrl?: string | null;
  source?: "ai" | "manual" | "google-import";
};

/** 이름 정규화 (유사도 비교용): 공백·특수문자 제거, 소문자화 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s\W_]+/g, "");
}

export async function findByGooglePlaceId(
  db: Database,
  googlePlaceId: string,
): Promise<Place | undefined> {
  const [row] = await db
    .select()
    .from(places)
    .where(eq(places.googlePlaceId, googlePlaceId));
  return row;
}

/**
 * 좌표 근접(기본 30m) + 이름 유사 후보 탐색 (직접 추가 장소 중복 판정용).
 * D1은 반경 쿼리를 못 하므로 바운딩박스로 좁힌 뒤 haversine으로 정밀 판정.
 */
export async function findDuplicateCandidates(
  db: Database,
  input: { name: string; latitude: number; longitude: number },
  radiusM = 30,
): Promise<Place[]> {
  const box = boundingBox(input.latitude, input.longitude, radiusM);
  const rows = await db
    .select()
    .from(places)
    .where(
      and(
        gte(places.latitude, box.minLat),
        lte(places.latitude, box.maxLat),
        gte(places.longitude, box.minLng),
        lte(places.longitude, box.maxLng),
        isNull(places.googlePlaceId), // 직접 추가 장소끼리만
      ),
    );
  const target = normalizeName(input.name);
  return rows.filter((p) => {
    const near =
      haversineMeters(
        [input.latitude, input.longitude],
        [p.latitude, p.longitude],
      ) <= radiusM;
    const nameMatch =
      normalizeName(p.name).includes(target) ||
      target.includes(normalizeName(p.name));
    return near && nameMatch;
  });
}

export async function createPlace(db: Database, input: PlaceInput): Promise<Place> {
  const [row] = await db
    .insert(places)
    .values({
      ...input,
      source: input.source ?? "manual",
      lastVerifiedAt: input.googlePlaceId ? Date.now() : null,
    })
    .returning();
  return row;
}

/**
 * Google Place 를 마스터로 해소(resolve): 있으면 재사용, 없으면 생성.
 * "동일 Google Place ID 는 중복 저장되지 않는다" 보장 (docs/07 규칙 ①).
 */
export async function resolveGooglePlace(
  db: Database,
  input: PlaceInput & { googlePlaceId: string },
): Promise<Place> {
  const existing = await findByGooglePlaceId(db, input.googlePlaceId);
  if (existing) return existing;
  return createPlace(db, { ...input, source: input.source ?? "ai" });
}
