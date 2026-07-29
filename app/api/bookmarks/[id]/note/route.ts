import { and, eq } from "drizzle-orm";
import { bookmarks } from "@/db/schema";
import { error, json, readJson, withAuth } from "@/lib/http";
import { upsertRepresentativeNote } from "@/lib/repositories/notes";

// PUT /api/bookmarks/:id/note  { content } → 대표 메모 upsert
export const PUT = withAuth(async ({ db, userId }, request, params) => {
  const body = await readJson<{ content?: string }>(request);
  // 소유권 확인: 해당 북마크가 이 사용자 것인지
  const [owned] = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.id, params.id), eq(bookmarks.userId, userId)));
  if (!owned) return error("북마크를 찾을 수 없습니다.", 404);
  const note = await upsertRepresentativeNote(db, userId, params.id, body.content ?? "");
  return json({ note });
});
