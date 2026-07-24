import { error, json, readJson, withAuth } from "@/lib/http";
import {
  deleteBookmark,
  updateBookmark,
  type BookmarkInput,
} from "@/lib/repositories/bookmarks";

export const PATCH = withAuth(async ({ db, userId }, request, params) => {
  const patch = await readJson<Partial<Omit<BookmarkInput, "placeId">>>(request);
  const bookmark = await updateBookmark(db, userId, params.id, patch);
  if (!bookmark) return error("북마크를 찾을 수 없습니다.", 404);
  return json({ bookmark });
});

export const DELETE = withAuth(async ({ db, userId }, _request, params) => {
  const ok = await deleteBookmark(db, userId, params.id);
  if (!ok) return error("북마크를 찾을 수 없습니다.", 404);
  return json({ ok: true });
});
