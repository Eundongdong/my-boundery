// 리모트 데이터 어댑터 — 로그인 시 서버(API)와 클라이언트 뷰 모델을 매핑 (결정 B안)
// 서버는 정규화(Place↔Bookmark↔Note), 클라이언트는 denormalized Place. 여기서 변환한다.
import { api } from "@/lib/api-client";
import type {
  Boundary as ServerBoundary,
  Theme as ServerTheme,
} from "@/db/schema";
import type { BookmarkWithPlace } from "@/lib/repositories/bookmarks";
import type {
  Boundary,
  MapNote,
  Place,
  PersistedState,
  Theme,
} from "@/lib/store/types";

const EMPTY_MAP_NOTE: MapNote = { title: "", body: "", callout: "", checklist: [] };

// ── 매핑: 서버 → 클라이언트 ────────────────────────────────
function toClientBoundary(b: ServerBoundary): Boundary {
  return {
    id: b.id,
    name: b.name,
    area: b.address ?? "",
    center: [b.latitude, b.longitude],
    radius: b.radiusM,
    color: b.color,
    icon: b.icon,
  };
}

function toClientTheme(t: ServerTheme): Theme {
  return { id: t.id, name: t.name, icon: t.icon, color: t.color };
}

function toClientPlace(b: BookmarkWithPlace): Place {
  return {
    id: b.id, // bookmark.id
    name: b.place.name,
    coordinates: [b.place.latitude, b.place.longitude],
    area: b.place.address ?? b.place.category ?? "",
    themeId: b.themeId ?? "",
    tags: b.tags ?? [],
    reason: b.saveReason ?? "",
    status: b.status,
    rating: b.rating,
    note: b.representativeNote ?? "",
    googlePlaceId: b.place.googlePlaceId ?? undefined,
  };
}

// ── 로드 ───────────────────────────────────────────────────
export async function loadRemoteState(): Promise<PersistedState> {
  const [boundaries, themes, bookmarks, mapNote] = await Promise.all([
    api.boundaries.list(),
    api.themes.list(),
    api.bookmarks.list(),
    api.mapNotes.get(null),
  ]);
  return {
    boundaries: boundaries.map(toClientBoundary),
    themes: themes.map(toClientTheme),
    places: bookmarks.map(toClientPlace),
    mapNote: mapNote
      ? {
          title: mapNote.title,
          body: mapNote.body,
          callout: mapNote.callout,
          checklist: mapNote.checklist ?? [],
        }
      : EMPTY_MAP_NOTE,
  };
}

// ── 뮤테이션 (write-through) ───────────────────────────────
export const remote = {
  // 바운더리
  async createBoundary(input: Omit<Boundary, "id">): Promise<Boundary> {
    const b = await api.boundaries.create({
      name: input.name,
      address: input.area || null,
      latitude: input.center[0],
      longitude: input.center[1],
      radiusM: input.radius,
      color: input.color,
      icon: input.icon,
    });
    return toClientBoundary(b);
  },
  async updateBoundary(id: string, patch: Partial<Boundary>): Promise<void> {
    const apiPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) apiPatch.name = patch.name;
    if (patch.area !== undefined) apiPatch.address = patch.area;
    if (patch.center !== undefined) {
      apiPatch.latitude = patch.center[0];
      apiPatch.longitude = patch.center[1];
    }
    if (patch.radius !== undefined) apiPatch.radiusM = patch.radius;
    if (patch.color !== undefined) apiPatch.color = patch.color;
    if (patch.icon !== undefined) apiPatch.icon = patch.icon;
    await api.boundaries.update(id, apiPatch);
  },
  deleteBoundary: (id: string) => api.boundaries.remove(id),

  // 테마
  async createTheme(input: Omit<Theme, "id">): Promise<Theme> {
    const t = await api.themes.create(input);
    return toClientTheme(t);
  },

  // 장소(북마크) 추가 — place 정보 + 북마크 필드 → 서버, 이어서 대표 메모 저장
  async addPlace(place: Place, boundaryId: string | null): Promise<string> {
    const { bookmark } = await api.bookmarks.create({
      place: {
        googlePlaceId: place.googlePlaceId ?? null,
        name: place.name,
        address: place.area || null,
        latitude: place.coordinates[0],
        longitude: place.coordinates[1],
        source: place.googlePlaceId ? "ai" : "manual",
      },
      boundaryId,
      themeId: place.themeId || null,
      tags: place.tags,
      saveReason: place.reason || null,
      status: place.status,
      rating: place.rating,
    });
    if (place.note?.trim()) await api.bookmarks.setNote(bookmark.id, place.note);
    return bookmark.id;
  },

  // 장소(북마크) 수정 — 상태/별점/테마/태그 + 대표 메모
  async updatePlace(bookmarkId: string, patch: Partial<Place>): Promise<void> {
    const apiPatch: Record<string, unknown> = {};
    if (patch.status !== undefined) apiPatch.status = patch.status;
    if (patch.rating !== undefined) apiPatch.rating = patch.rating;
    if (patch.themeId !== undefined) apiPatch.themeId = patch.themeId || null;
    if (patch.tags !== undefined) apiPatch.tags = patch.tags;
    if (patch.reason !== undefined) apiPatch.saveReason = patch.reason;
    if (Object.keys(apiPatch).length) await api.bookmarks.update(bookmarkId, apiPatch);
    if (patch.note !== undefined) await api.bookmarks.setNote(bookmarkId, patch.note);
  },
  deletePlace: (bookmarkId: string) => api.bookmarks.remove(bookmarkId),

  // 지도 노트
  async saveMapNote(note: MapNote): Promise<void> {
    await api.mapNotes.put({
      boundaryId: null,
      title: note.title,
      body: note.body,
      callout: note.callout,
      checklist: note.checklist,
    });
  },
};
