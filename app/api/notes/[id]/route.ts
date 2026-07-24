import { error, json, readJson, withAuth } from "@/lib/http";
import { deleteNote, updateNote } from "@/lib/repositories/notes";
import type { Note } from "@/db/schema";

type NotePatch = Partial<
  Pick<Note, "topic" | "title" | "originalContent" | "aiOrganizedContent" | "aiStatus">
>;

export const PATCH = withAuth(async ({ db, userId }, request, params) => {
  const patch = await readJson<NotePatch>(request);
  const note = await updateNote(db, userId, params.id, patch);
  if (!note) return error("메모를 찾을 수 없습니다.", 404);
  return json({ note });
});

export const DELETE = withAuth(async ({ db, userId }, _request, params) => {
  const ok = await deleteNote(db, userId, params.id);
  if (!ok) return error("메모를 찾을 수 없습니다.", 404);
  return json({ ok: true });
});
