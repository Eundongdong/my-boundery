import { error, json, readJson, withAuth } from "@/lib/http";
import {
  deleteBoundary,
  updateBoundary,
  type BoundaryInput,
} from "@/lib/repositories/boundaries";

export const PATCH = withAuth(async ({ db, userId }, request, params) => {
  const patch = await readJson<Partial<BoundaryInput>>(request);
  const boundary = await updateBoundary(db, userId, params.id, patch);
  if (!boundary) return error("바운더리를 찾을 수 없습니다.", 404);
  return json({ boundary });
});

export const DELETE = withAuth(async ({ db, userId }, _request, params) => {
  const ok = await deleteBoundary(db, userId, params.id);
  if (!ok) return error("바운더리를 찾을 수 없습니다.", 404);
  return json({ ok: true });
});
