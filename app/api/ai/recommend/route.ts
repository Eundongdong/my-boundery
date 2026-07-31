import { error, json, readJson, withAuth } from "@/lib/http";
import { recommendPlaces } from "@/lib/ai";
import { getBoundary } from "@/lib/repositories/boundaries";
import { listThemes } from "@/lib/repositories/themes";

// POST /api/ai/recommend { query, boundaryId? } → 장소 추천(승인 전 후보)
export const POST = withAuth(async ({ db, userId }, request) => {
  const { query, boundaryId } = await readJson<{ query?: string; boundaryId?: string }>(request);
  if (!query?.trim()) return error("query 는 필수입니다.");

  const boundary = boundaryId ? await getBoundary(db, userId, boundaryId) : undefined;
  const themes = await listThemes(db, userId);

  const { recommendation, candidates } = await recommendPlaces(db, userId, {
    query: query.trim(),
    boundary: boundary
      ? {
          id: boundary.id,
          name: boundary.name,
          center: [boundary.latitude, boundary.longitude],
          radiusM: boundary.radiusM,
        }
      : null,
    themes: themes.map((t) => ({ id: t.id, name: t.name })),
  });

  return json({
    recommendationId: recommendation.id,
    summary: recommendation.summary,
    rationale: recommendation.rationale,
    candidates,
  });
});
