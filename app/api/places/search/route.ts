import { error, json, readJson, withAuth } from "@/lib/http";
import { searchPlaces, type LocationBias } from "@/lib/kakao";

// POST /api/places/search  { query, bias?: {latitude,longitude,radiusM} }  (Kakao 키워드 검색)
export const POST = withAuth(async (_ctx, request) => {
  const body = await readJson<{ query?: string; bias?: LocationBias }>(request);
  if (!body.query?.trim()) return error("query 는 필수입니다.");
  const results = await searchPlaces(body.query.trim(), body.bias);
  return json({ results });
});
