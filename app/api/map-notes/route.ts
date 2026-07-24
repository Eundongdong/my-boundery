import { json, readJson, withAuth } from "@/lib/http";
import { getMapNote, upsertMapNote, type MapNotePatch } from "@/lib/repositories/mapNotes";

// GET /api/map-notes?boundaryId=<id|null(전체)>
export const GET = withAuth(async ({ db, userId }, request) => {
  const raw = new URL(request.url).searchParams.get("boundaryId");
  const boundaryId = raw && raw !== "null" ? raw : null;
  const mapNote = await getMapNote(db, userId, boundaryId);
  return json({ mapNote: mapNote ?? null });
});

// PUT /api/map-notes  { boundaryId?: string|null, title?, body?, callout?, checklist? }
export const PUT = withAuth(async ({ db, userId }, request) => {
  const body = await readJson<MapNotePatch & { boundaryId?: string | null }>(request);
  const { boundaryId = null, ...patch } = body;
  const mapNote = await upsertMapNote(db, userId, boundaryId, patch);
  return json({ mapNote });
});
