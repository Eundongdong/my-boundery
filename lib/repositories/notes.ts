// 메모 repository — 장소별 다중 주제 메모 (docs/02, docs/08, D6/D15)
// 원문 보존: originalContent 는 사용자 원문, aiOrganizedContent 는 AI 정리(별도)
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { notes, type Note } from "@/db/schema";

export type NoteInput = {
  bookmarkId: string;
  topic?: string | null;
  title?: string | null;
  originalContent: string;
  author?: "user" | "ai";
  aiStatus?: "none" | "suggested" | "approved";
  aiOrganizedContent?: string | null;
};

export function listNotes(
  db: Database,
  userId: string,
  bookmarkId: string,
): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.bookmarkId, bookmarkId)))
    .orderBy(asc(notes.createdAt));
}

export async function createNote(
  db: Database,
  userId: string,
  input: NoteInput,
): Promise<Note> {
  const [row] = await db
    .insert(notes)
    .values({
      userId,
      bookmarkId: input.bookmarkId,
      topic: input.topic ?? null,
      title: input.title ?? null,
      originalContent: input.originalContent,
      author: input.author ?? "user",
      aiStatus: input.aiStatus ?? "none",
      aiOrganizedContent: input.aiOrganizedContent ?? null,
    })
    .returning();
  return row;
}

/**
 * 메모 수정. author=user 원문(originalContent)은 사용자만 갱신한다.
 * AI 정리 반영은 aiOrganizedContent / aiStatus 로만 이뤄져 원문을 덮어쓰지 않는다.
 */
export async function updateNote(
  db: Database,
  userId: string,
  id: string,
  patch: Partial<Pick<Note, "topic" | "title" | "originalContent" | "aiOrganizedContent" | "aiStatus">>,
): Promise<Note | undefined> {
  const [row] = await db
    .update(notes)
    .set(patch)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning();
  return row;
}

export async function deleteNote(
  db: Database,
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning({ id: notes.id });
  return rows.length > 0;
}
