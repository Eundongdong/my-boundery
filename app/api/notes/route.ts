import { error, json, readJson, withAuth } from "@/lib/http";
import { createNote, listNotes, type NoteInput } from "@/lib/repositories/notes";

export const GET = withAuth(async ({ db, userId }, request) => {
  const bookmarkId = new URL(request.url).searchParams.get("bookmarkId");
  if (!bookmarkId) return error("bookmarkId 쿼리가 필요합니다.");
  return json({ notes: await listNotes(db, userId, bookmarkId) });
});

export const POST = withAuth(async ({ db, userId }, request) => {
  const body = await readJson<Partial<NoteInput>>(request);
  if (!body.bookmarkId) return error("bookmarkId 는 필수입니다.");
  const note = await createNote(db, userId, {
    bookmarkId: body.bookmarkId,
    topic: body.topic ?? null,
    title: body.title ?? null,
    originalContent: body.originalContent ?? "",
    author: body.author ?? "user",
    aiStatus: body.aiStatus ?? "none",
    aiOrganizedContent: body.aiOrganizedContent ?? null,
  });
  return json({ note }, { status: 201 });
});
