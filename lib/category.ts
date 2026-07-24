// Google Places types → 표시용 카테고리 매핑 (docs/07 §5)
// 이 category 는 "표시용"이며, 사용자 분류(테마)와는 별개다.

export const CATEGORIES = [
  "카페",
  "식당",
  "공방·체험",
  "문화",
  "운동",
  "기타",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Google primaryType / types → 우리 카테고리
const TYPE_TO_CATEGORY: Record<string, Category> = {
  cafe: "카페",
  coffee_shop: "카페",
  restaurant: "식당",
  meal_takeaway: "식당",
  meal_delivery: "식당",
  bakery: "식당",
  art_studio: "공방·체험",
  pottery_studio: "공방·체험",
  museum: "문화",
  art_gallery: "문화",
  performing_arts_theater: "문화",
  cultural_center: "문화",
  gym: "운동",
  fitness_center: "운동",
  yoga_studio: "운동",
  sports_club: "운동",
};

/**
 * Google 장소 유형을 표시 카테고리로 변환.
 * primaryType → types[] 순으로 매칭, 실패 시 fallbackLabel(primaryTypeDisplayName)로.
 */
export function mapGoogleTypesToCategory(
  primaryType: string | null | undefined,
  types: string[] | null | undefined,
  fallbackLabel?: string | null,
): string {
  if (primaryType && TYPE_TO_CATEGORY[primaryType]) {
    return TYPE_TO_CATEGORY[primaryType];
  }
  for (const t of types ?? []) {
    if (TYPE_TO_CATEGORY[t]) return TYPE_TO_CATEGORY[t];
  }
  return fallbackLabel?.trim() || "기타";
}
