// 지도 노트 repository — 전체/바운더리별 노트 + 체크리스트 (docs/02, docs/03)
import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { mapNotes, type ChecklistItem, type MapNote } from "@/db/schema";

export type MapNotePatch = {
  title?: string;
  body?: string;
  callout?: string;
  checklist?: ChecklistItem[];
};

/** 바운더리별(또는 전체: boundaryId=null) 지도 노트 조회 */
export async function getMapNote(
  db: Database,
  userId: string,
  boundaryId: string | null,
): Promise<MapNote | undefined> {
  const [row] = await db
    .select()
    .from(mapNotes)
    .where(
      and(
        eq(mapNotes.userId, userId),
        boundaryId === null
          ? isNull(mapNotes.boundaryId)
          : eq(mapNotes.boundaryId, boundaryId),
      ),
    );
  return row;
}

/** 없으면 생성, 있으면 갱신 (지도 노트는 스코프당 1개) */
export async function upsertMapNote(
  db: Database,
  userId: string,
  boundaryId: string | null,
  patch: MapNotePatch,
): Promise<MapNote> {
  const existing = await getMapNote(db, userId, boundaryId);
  if (existing) {
    const [row] = await db
      .update(mapNotes)
      .set(patch)
      .where(eq(mapNotes.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(mapNotes)
    .values({ userId, boundaryId, ...patch })
    .returning();
  return row;
}
