import { error, json, readJson, withAuth } from "@/lib/http";
import { candidatesFromChanges } from "@/lib/ai";
import {
  getRecommendation,
  setRecommendationStatus,
} from "@/lib/repositories/aiRecommendations";
import { createApproval } from "@/lib/repositories/approvalHistory";
import { resolveGooglePlace } from "@/lib/repositories/places";
import { createBookmark } from "@/lib/repositories/bookmarks";

// POST /api/ai/approve { recommendationId, placeIds?, boundaryId? }
// 선택 항목만 저장하고 승인 이력을 남긴다 (docs/06 승인 흐름).
export const POST = withAuth(async ({ db, userId }, request) => {
  const { recommendationId, placeIds, boundaryId } = await readJson<{
    recommendationId?: string;
    placeIds?: string[];
    boundaryId?: string | null;
  }>(request);
  if (!recommendationId) return error("recommendationId 는 필수입니다.");

  const rec = await getRecommendation(db, userId, recommendationId);
  if (!rec) return error("추천을 찾을 수 없습니다.", 404);

  const candidates = candidatesFromChanges(rec.proposedChanges);
  const selected =
    placeIds && placeIds.length
      ? candidates.filter((c) => placeIds.includes(c.externalPlaceId))
      : candidates;
  if (!selected.length) return error("승인할 항목이 없습니다.");

  const createdBookmarkIds: string[] = [];
  const createdPlaces: unknown[] = [];

  for (const c of selected) {
    const place = await resolveGooglePlace(db, {
      googlePlaceId: c.externalPlaceId,
      name: c.name,
      address: c.address,
      latitude: c.latitude,
      longitude: c.longitude,
      category: c.category,
      googleMapsUrl: c.placeUrl,
      source: "ai",
    });
    const { bookmark, created } = await createBookmark(db, userId, {
      placeId: place.id,
      boundaryId: boundaryId ?? null,
      themeId: c.themeId,
      tags: [],
      saveReason: c.reason,
      status: "saved",
      rating: 0,
    });
    if (!created) continue; // 이미 저장된 장소는 되돌리기 대상에서 제외
    createdBookmarkIds.push(bookmark.id);
    createdPlaces.push({
      id: bookmark.id,
      name: c.name,
      coordinates: [c.latitude, c.longitude],
      area: c.address ?? c.category,
      themeId: c.themeId ?? "",
      tags: [],
      reason: c.reason,
      status: bookmark.status,
      rating: bookmark.rating,
      note: "",
      googlePlaceId: c.externalPlaceId,
    });
  }

  const approval = await createApproval(db, userId, {
    recommendationId,
    requestSummary: rec.summary,
    proposedChange: rec.proposedChanges,
    appliedChange: { bookmarkIds: createdBookmarkIds },
    reversible: true,
  });
  await setRecommendationStatus(
    db,
    userId,
    recommendationId,
    selected.length === candidates.length ? "approved" : "partial",
  );

  return json({ places: createdPlaces, approvalHistoryId: approval.id });
});
