// AI 추천 로직 (docs/06, docs/11) — 자연어 → Kakao 검색 → 큐레이션 → 승인 전 변경안
// AI 는 확정하지 않는다. 여기서는 "제안(proposedChanges)"만 만든다.
import type { Database } from "@/db";
import type { AiRecommendation, ProposedChange } from "@/db/schema";
import { completeJson } from "@/lib/groq";
import { searchPlaces, type PlaceResult } from "@/lib/kakao";
import { createRecommendation } from "@/lib/repositories/aiRecommendations";

export type PlaceCandidate = {
  externalPlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  category: string;
  placeUrl: string | null;
  themeId: string | null;
  reason: string;
};

type ThemeLite = { id: string; name: string };
type BoundaryLite = { id: string; name: string; center: [number, number]; radiusM: number };

// 1) 자연어 → 검색 키워드 (실패 시 원문 사용)
async function extractKeywords(query: string): Promise<string> {
  try {
    const out = await completeJson<{ keywords?: string }>([
      {
        role: "system",
        content:
          "너는 지도 장소 검색 도우미다. 사용자의 한국어 요청에서 지도 키워드 검색에 쓸 핵심 키워드만 뽑아라. " +
          '반드시 JSON 으로만 답한다: {"keywords":"..."}. 장소 종류/활동 위주로 짧게.',
      },
      { role: "user", content: query },
    ]);
    return out.keywords?.trim() || query;
  } catch {
    return query;
  }
}

// 3) 검색 결과 큐레이션 (실패 시 상위 결과 그대로, 테마 미지정)
async function curate(
  query: string,
  results: PlaceResult[],
  themes: ThemeLite[],
): Promise<Map<string, { themeId: string | null; reason: string }>> {
  const map = new Map<string, { themeId: string | null; reason: string }>();
  try {
    const compact = results.slice(0, 10).map((r) => ({
      id: r.externalPlaceId,
      name: r.name,
      category: r.category,
      address: r.address,
    }));
    const out = await completeJson<{
      picks?: { id: string; themeId?: string | null; reason?: string }[];
    }>([
      {
        role: "system",
        content:
          "너는 개인 지도 큐레이터다. 사용자 요청과 후보 장소 목록, 사용자의 테마 목록이 주어진다. " +
          "요청에 가장 잘 맞는 장소를 최대 5개 고르고, 각 장소에 가장 어울리는 기존 테마 id 를 배정(없으면 null)하라. " +
          "reason 은 한국어 한 문장으로 왜 맞는지 근거를 적어라. 반드시 제공된 id/themeId 만 사용. " +
          '반드시 JSON: {"picks":[{"id":"장소id","themeId":"테마id 또는 null","reason":"..."}]}',
      },
      {
        role: "user",
        content: JSON.stringify({ request: query, places: compact, themes }),
      },
    ]);
    const validThemeIds = new Set(themes.map((t) => t.id));
    for (const p of out.picks ?? []) {
      if (!p.id) continue;
      const themeId = p.themeId && validThemeIds.has(p.themeId) ? p.themeId : null;
      map.set(p.id, { themeId, reason: p.reason?.trim() || "요청 조건과 맞아요." });
    }
  } catch {
    // 폴백: 상위 6개 유지, 테마 미지정
    for (const r of results.slice(0, 6)) {
      map.set(r.externalPlaceId, { themeId: null, reason: "요청과 관련 있는 장소예요." });
    }
  }
  return map;
}

export type RecommendResult = {
  recommendation: AiRecommendation;
  candidates: PlaceCandidate[];
};

/** 장소 추천: 검색 → 큐레이션 → ai_recommendation(pending) 저장 */
export async function recommendPlaces(
  db: Database,
  userId: string,
  input: { query: string; boundary: BoundaryLite | null; themes: ThemeLite[] },
): Promise<RecommendResult> {
  const keywords = await extractKeywords(input.query);
  const bias = input.boundary
    ? {
        latitude: input.boundary.center[0],
        longitude: input.boundary.center[1],
        radiusM: input.boundary.radiusM,
      }
    : undefined;
  const results = await searchPlaces(keywords, bias);
  const picks = await curate(input.query, results, input.themes);

  // 큐레이션이 고른 것 우선, 없으면 상위 결과
  const chosen = results.filter((r) => picks.has(r.externalPlaceId));
  const finalResults = chosen.length ? chosen : results.slice(0, 6);

  const candidates: PlaceCandidate[] = finalResults.map((r) => {
    const pick = picks.get(r.externalPlaceId);
    return {
      externalPlaceId: r.externalPlaceId,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      address: r.address,
      category: r.category,
      placeUrl: r.placeUrl,
      themeId: pick?.themeId ?? null,
      reason: pick?.reason ?? "요청과 관련 있는 장소예요.",
    };
  });

  const proposedChanges: ProposedChange[] = candidates.map((c) => ({
    op: "add",
    target: { kind: "bookmark" },
    after: c,
  }));

  const where = input.boundary ? `${input.boundary.name} 주변 · ` : "";
  const summary = candidates.length
    ? `${where}${candidates.length}곳을 찾았어요`
    : "조건에 맞는 장소를 찾지 못했어요";

  const recommendation = await createRecommendation(db, userId, {
    type: "place-search",
    summary,
    rationale: `요청 "${input.query}" → 검색 키워드 "${keywords}"`,
    inputContext: { query: input.query, keywords, boundaryId: input.boundary?.id ?? null },
    proposedChanges,
  });

  return { recommendation, candidates };
}

/** proposedChanges 에서 PlaceCandidate 복원 (승인 시 사용) */
export function candidatesFromChanges(changes: ProposedChange[]): PlaceCandidate[] {
  return changes
    .filter((c) => c.op === "add")
    .map((c) => c.after as PlaceCandidate)
    .filter((c): c is PlaceCandidate => Boolean(c && c.externalPlaceId));
}
