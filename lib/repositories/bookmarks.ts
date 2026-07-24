// 북마크 repository — 사용자-장소 저장 관계 (docs/02, D14)
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import {
  bookmarks,
  notes,
  places,
  themes,
  type Bookmark,
  type Place,
  type Theme,
} from "@/db/schema";

export type BookmarkWithPlace = Bookmark & {
  place: Place;
  theme: Theme | null;
  // 대표 메모(topic=null) 원문. 목록 화면의 단일 메모 표시용 (docs/08)
  representativeNote: string;
};

export type BookmarkInput = {
  placeId: string;
  boundaryId?: string | null;
  themeId?: string | null;
  tags?: string[];
  saveReason?: string | null;
  status?: "saved" | "planned" | "visited";
  rating?: number;
  revisitIntent?: "revisit" | "not_recommended" | null;
};

/** 사용자의 북마크 목록 (장소·테마 조인) */
export async function listBookmarks(
  db: Database,
  userId: string,
): Promise<BookmarkWithPlace[]> {
  const rows = await db
    .select({ bookmark: bookmarks, place: places, theme: themes })
    .from(bookmarks)
    .innerJoin(places, eq(bookmarks.placeId, places.id))
    .leftJoin(themes, eq(bookmarks.themeId, themes.id))
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt));

  // 대표 메모(topic=null)를 한 번의 쿼리로 모아 붙인다 (N+1 회피)
  const bookmarkIds = rows.map((r) => r.bookmark.id);
  const repNotes = bookmarkIds.length
    ? await db
        .select({ bookmarkId: notes.bookmarkId, content: notes.originalContent })
        .from(notes)
        .where(and(inArray(notes.bookmarkId, bookmarkIds), isNull(notes.topic)))
    : [];
  const noteByBookmark = new Map<string, string>();
  for (const n of repNotes) {
    if (!noteByBookmark.has(n.bookmarkId)) noteByBookmark.set(n.bookmarkId, n.content);
  }

  return rows.map((r) => ({
    ...r.bookmark,
    place: r.place,
    theme: r.theme,
    representativeNote: noteByBookmark.get(r.bookmark.id) ?? "",
  }));
}

export async function findBookmarkByPlace(
  db: Database,
  userId: string,
  placeId: string,
): Promise<Bookmark | undefined> {
  const [row] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.placeId, placeId)));
  return row;
}

/**
 * 북마크 생성. 이미 이 사용자가 같은 장소를 저장했으면 새로 만들지 않고 기존을 반환
 * (docs/07 규칙 ①: "기존 북마크로 이동"). 반환값의 created 로 신규 여부를 알린다.
 */
export async function createBookmark(
  db: Database,
  userId: string,
  input: BookmarkInput,
): Promise<{ bookmark: Bookmark; created: boolean }> {
  const existing = await findBookmarkByPlace(db, userId, input.placeId);
  if (existing) return { bookmark: existing, created: false };

  const [row] = await db
    .insert(bookmarks)
    .values({
      userId,
      placeId: input.placeId,
      boundaryId: input.boundaryId ?? null,
      themeId: input.themeId ?? null,
      tags: input.tags ?? [],
      saveReason: input.saveReason ?? null,
      status: input.status ?? "saved",
      rating: input.rating ?? 0,
      revisitIntent: input.revisitIntent ?? null,
    })
    .returning();
  return { bookmark: row, created: true };
}

export async function updateBookmark(
  db: Database,
  userId: string,
  id: string,
  patch: Partial<Omit<BookmarkInput, "placeId">>,
): Promise<Bookmark | undefined> {
  const [row] = await db
    .update(bookmarks)
    .set(patch)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning();
  return row;
}

export async function deleteBookmark(
  db: Database,
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id });
  return rows.length > 0;
}
