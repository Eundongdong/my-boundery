// BoundaryStudio 클라이언트 뷰 모델 (프로토타입 타입을 공유 모듈로 추출)
// 서버 정규화 모델(docs/02)과 매핑하기 위해 여기로 옮겼다.
// 변경점: Boundary.id 를 string 으로 일반화(집/직장 고정 해제, 결정 D1).

export type MapProviderId = "openfreemap-positron" | "openfreemap-bright";

export type Boundary = {
  id: string;
  name: string;
  area: string;
  center: [number, number];
  radius: number;
  color: string;
  icon: string;
};

export type Theme = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export type Place = {
  id: string; // 로그인 모드에서는 bookmark.id
  name: string;
  coordinates: [number, number];
  area: string;
  themeId: string;
  tags: string[];
  reason: string;
  status: "saved" | "planned" | "visited";
  rating: number;
  note: string;
  googlePlaceId?: string;
};

export type MapNote = {
  title: string;
  body: string;
  callout: string;
  checklist: { id: string; text: string; done: boolean }[];
};

export type PersistedState = {
  boundaries: Boundary[];
  themes: Theme[];
  places: Place[];
  mapNote: MapNote;
  mapProvider?: MapProviderId;
};
