// 클라이언트용 타입드 API 래퍼 (docs/05 1단계 클라이언트)
// 쿠키 세션을 쓰므로 same-origin fetch. 실패 시 에러 throw.
import type {
  Bookmark,
  Boundary,
  MapNote,
  Note,
  Theme,
} from "@/db/schema";
import type { BookmarkWithPlace } from "@/lib/repositories/bookmarks";
import type { GeocodeResult, PlaceResult } from "@/lib/kakao";
import type { PlaceCandidate } from "@/lib/ai";

export type SessionUser = { id: string; email: string; displayName: string };

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `요청 실패 (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

const body = (data: unknown) => JSON.stringify(data);

export const api = {
  // 세션
  async me(): Promise<SessionUser | null> {
    try {
      const { user } = await req<{ user: SessionUser | null }>("/api/me");
      return user;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  signout: () => req<{ ok: true }>("/api/auth/signout", { method: "POST" }),

  // 바운더리
  boundaries: {
    list: () => req<{ boundaries: Boundary[] }>("/api/boundaries").then((r) => r.boundaries),
    create: (input: Record<string, unknown>) =>
      req<{ boundary: Boundary }>("/api/boundaries", { method: "POST", body: body(input) }).then((r) => r.boundary),
    update: (id: string, patch: Record<string, unknown>) =>
      req<{ boundary: Boundary }>(`/api/boundaries/${id}`, { method: "PATCH", body: body(patch) }).then((r) => r.boundary),
    remove: (id: string) => req<{ ok: true }>(`/api/boundaries/${id}`, { method: "DELETE" }),
  },

  // 테마
  themes: {
    list: () => req<{ themes: Theme[] }>("/api/themes").then((r) => r.themes),
    create: (input: Record<string, unknown>) =>
      req<{ theme: Theme }>("/api/themes", { method: "POST", body: body(input) }).then((r) => r.theme),
    update: (id: string, patch: Record<string, unknown>) =>
      req<{ theme: Theme }>(`/api/themes/${id}`, { method: "PATCH", body: body(patch) }).then((r) => r.theme),
    remove: (id: string) => req<{ ok: true }>(`/api/themes/${id}`, { method: "DELETE" }),
  },

  // 북마크
  bookmarks: {
    list: () => req<{ bookmarks: BookmarkWithPlace[] }>("/api/bookmarks").then((r) => r.bookmarks),
    create: (input: Record<string, unknown>) =>
      req<{ bookmark: Bookmark; created: boolean }>("/api/bookmarks", { method: "POST", body: body(input) }),
    update: (id: string, patch: Record<string, unknown>) =>
      req<{ bookmark: unknown }>(`/api/bookmarks/${id}`, { method: "PATCH", body: body(patch) }),
    remove: (id: string) => req<{ ok: true }>(`/api/bookmarks/${id}`, { method: "DELETE" }),
    setNote: (id: string, content: string) =>
      req<{ note: Note }>(`/api/bookmarks/${id}/note`, { method: "PUT", body: body({ content }) }).then((r) => r.note),
  },

  // 메모
  notes: {
    list: (bookmarkId: string) =>
      req<{ notes: Note[] }>(`/api/notes?bookmarkId=${encodeURIComponent(bookmarkId)}`).then((r) => r.notes),
    create: (input: Record<string, unknown>) =>
      req<{ note: Note }>("/api/notes", { method: "POST", body: body(input) }).then((r) => r.note),
    update: (id: string, patch: Record<string, unknown>) =>
      req<{ note: Note }>(`/api/notes/${id}`, { method: "PATCH", body: body(patch) }).then((r) => r.note),
    remove: (id: string) => req<{ ok: true }>(`/api/notes/${id}`, { method: "DELETE" }),
  },

  // 지도 노트
  mapNotes: {
    get: (boundaryId: string | null) =>
      req<{ mapNote: MapNote | null }>(
        `/api/map-notes?boundaryId=${boundaryId ?? "null"}`,
      ).then((r) => r.mapNote),
    put: (input: Record<string, unknown>) =>
      req<{ mapNote: MapNote }>("/api/map-notes", { method: "PUT", body: body(input) }).then((r) => r.mapNote),
  },

  // 장소 검색 (Kakao Local 프록시)
  places: {
    search: (query: string, bias?: { latitude: number; longitude: number; radiusM: number }) =>
      req<{ results: PlaceResult[] }>("/api/places/search", { method: "POST", body: body({ query, bias }) }).then((r) => r.results),
    geocode: (address: string) =>
      req<{ result: GeocodeResult | null }>(
        `/api/places/geocode?address=${encodeURIComponent(address)}`,
      ).then((r) => r.result),
  },

  // AI 추천 → 승인 → 되돌리기 (docs/06)
  ai: {
    recommend: (query: string, boundaryId?: string | null) =>
      req<{
        recommendationId: string;
        summary: string | null;
        rationale: string | null;
        candidates: PlaceCandidate[];
      }>("/api/ai/recommend", { method: "POST", body: body({ query, boundaryId }) }),
    approve: (recommendationId: string, placeIds: string[], boundaryId?: string | null) =>
      req<{ places: unknown[]; approvalHistoryId: string }>("/api/ai/approve", {
        method: "POST",
        body: body({ recommendationId, placeIds, boundaryId }),
      }),
    revert: (approvalHistoryId: string) =>
      req<{ ok: true; removedBookmarkIds: string[] }>("/api/ai/revert", {
        method: "POST",
        body: body({ approvalHistoryId }),
      }),
  },
};

export type { PlaceResult, GeocodeResult } from "@/lib/kakao";
export type { PlaceCandidate } from "@/lib/ai";
