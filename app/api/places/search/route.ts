import { error, json, readJson, withAuth } from "@/lib/http";
import { searchText, type LocationBias } from "@/lib/google-places";

// POST /api/places/search  { query, bias?: {latitude,longitude,radiusM} }
export const POST = withAuth(async (_ctx, request) => {
  const body = await readJson<{ query?: string; bias?: LocationBias }>(request);
  if (!body.query?.trim()) return error("query 는 필수입니다.");
  const results = await searchText(body.query.trim(), body.bias);
  return json({ results });
});
