import { error, json, readJson, withAuth } from "@/lib/http";
import {
  createBookmark,
  listBookmarks,
  type BookmarkInput,
} from "@/lib/repositories/bookmarks";
import {
  createPlace,
  resolveGooglePlace,
  type PlaceInput,
} from "@/lib/repositories/places";

type CreateBody = Partial<BookmarkInput> & {
  // placeId 를 직접 주거나, place 정보를 주면 마스터를 해소(중복 없이)한다.
  place?: PlaceInput;
};

export const GET = withAuth(async ({ db, userId }) => {
  return json({ bookmarks: await listBookmarks(db, userId) });
});

export const POST = withAuth(async ({ db, userId }, request) => {
  const body = await readJson<CreateBody>(request);

  // 1) 장소 마스터 해소 (docs/07 규칙 ①: 동일 Place ID 재사용)
  let placeId = body.placeId;
  if (!placeId) {
    if (!body.place?.name || typeof body.place.latitude !== "number") {
      return error("placeId 또는 유효한 place 정보가 필요합니다.");
    }
    const place = body.place.googlePlaceId
      ? await resolveGooglePlace(db, {
          ...body.place,
          googlePlaceId: body.place.googlePlaceId,
        })
      : await createPlace(db, body.place);
    placeId = place.id;
  }

  // 2) 북마크 생성 (이미 저장한 장소면 기존 반환)
  const { bookmark, created } = await createBookmark(db, userId, {
    placeId,
    boundaryId: body.boundaryId ?? null,
    themeId: body.themeId ?? null,
    tags: body.tags ?? [],
    saveReason: body.saveReason ?? null,
    status: body.status ?? "saved",
    rating: body.rating ?? 0,
    revisitIntent: body.revisitIntent ?? null,
  });
  return json({ bookmark, created }, { status: created ? 201 : 200 });
});
