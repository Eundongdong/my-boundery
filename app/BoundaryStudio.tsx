"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type PlaceResult } from "@/lib/api-client";
import { useSession } from "@/lib/useSession";
import { loadRemoteState, remote } from "@/lib/store/remote";
import type {
  Boundary,
  MapNote,
  MapProviderId,
  PersistedState,
  Place,
  Theme,
} from "@/lib/store/types";

type AiCandidate = Place & { selected: boolean };

type AiSuggestionSession = {
  query: string;
  summary: string;
  candidates: AiCandidate[];
};

type MappedPlace = Place & { distance: number };

type MapOverlayInput = {
  boundary: Boundary;
  places: MappedPlace[];
  candidates: AiCandidate[];
  selectedPlaceId: string | null;
  themeById: Map<string, Theme>;
  onPlaceClick: (placeId: string) => void;
};

type RuntimeMapEngine = {
  flyTo: (center: [number, number], zoom: number) => void;
  render: (input: MapOverlayInput) => void;
  destroy: () => void;
};

const STORAGE_KEY = "my-boundary-studio-v1";

// 바운더리가 하나도 없을 때(로그인 직후 온보딩 전)의 안전 폴백 — 렌더 크래시 방지
const FALLBACK_BOUNDARY: Boundary = {
  id: "",
  name: "",
  area: "",
  center: [37.5665, 126.978],
  radius: 1000,
  color: "#587462",
  icon: "⌖",
};

const MAP_PROVIDERS: { id: MapProviderId; vendor: string; name: string; tone: string }[] = [
  { id: "openfreemap-positron", vendor: "OpenFreeMap", name: "Positron", tone: "#dce1df" },
  { id: "openfreemap-bright", vendor: "OpenFreeMap", name: "Bright", tone: "#f2cf72" },
];

const DEFAULT_BOUNDARIES: Boundary[] = [
  {
    id: "home",
    name: "집",
    area: "성수",
    center: [37.54455, 127.05565],
    radius: 1000,
    color: "#587462",
    icon: "⌂",
  },
  {
    id: "work",
    name: "직장",
    area: "을지로",
    center: [37.56615, 126.99128],
    radius: 800,
    color: "#9c6e4a",
    icon: "▦",
  },
];

const DEFAULT_THEMES: Theme[] = [
  { id: "cafe", name: "조용한 카페", icon: "☕", color: "#587462" },
  { id: "lunch", name: "점심 맛집", icon: "♨", color: "#c66c4e" },
  { id: "exercise", name: "운동", icon: "●", color: "#526f91" },
  { id: "walk", name: "산책", icon: "♧", color: "#9a7b39" },
];

const DEFAULT_PLACES: Place[] = [
  {
    id: "seongsu-paper-cup",
    name: "페이퍼컵 성수",
    coordinates: [37.5464, 127.0582],
    area: "성수동2가 · 샘플 위치",
    themeId: "cafe",
    tags: ["조용함", "콘센트", "창가"],
    reason: "평일 오전에 집중하기 좋은 창가 자리가 있어 저장했어요.",
    status: "visited",
    rating: 4,
    note: "오전 10시 전에 가면 큰 테이블을 쓰기 좋음. 드립커피 산미는 약한 편.",
  },
  {
    id: "forest-kitchen",
    name: "포레스트 키친",
    coordinates: [37.5422, 127.0522],
    area: "성수동1가 · 샘플 위치",
    themeId: "lunch",
    tags: ["혼밥", "채식", "빠른 식사"],
    reason: "점심시간에도 회전이 빠르고 가벼운 메뉴가 많아요.",
    status: "planned",
    rating: 0,
    note: "다음 주 화요일 점심 후보. 버섯 덮밥 확인하기.",
  },
  {
    id: "seongsu-riverside",
    name: "서울숲 강변 루프",
    coordinates: [37.5411, 127.0476],
    area: "서울숲 남쪽 · 샘플 위치",
    themeId: "walk",
    tags: ["저녁", "30분", "나무 그늘"],
    reason: "퇴근 후 30분 정도 걷기 좋은 짧은 루프예요.",
    status: "visited",
    rating: 5,
    note: "노을 보기에는 18시 30분 전후가 좋았음.",
  },
  {
    id: "slow-stretch",
    name: "슬로우 스트레치 룸",
    coordinates: [37.548, 127.0517],
    area: "뚝섬역 인근 · 샘플 위치",
    themeId: "exercise",
    tags: ["예약제", "소규모", "저녁"],
    reason: "집에서 걸어갈 수 있는 소규모 저녁 클래스예요.",
    status: "saved",
    rating: 0,
    note: "목요일 19:30 체험 수업 문의 예정.",
  },
  {
    id: "eulji-desk",
    name: "을지 데스크 커피",
    coordinates: [37.5669, 126.9898],
    area: "을지로3가 · 샘플 위치",
    themeId: "cafe",
    tags: ["테이블", "콘센트", "평일"],
    reason: "회사에서 가깝고 노트북 작업용 테이블이 넓어요.",
    status: "visited",
    rating: 4,
    note: "오후 2시 이후는 붐빔. 오전 외부 미팅 전에 들르기.",
  },
  {
    id: "noon-table",
    name: "정오의 식탁",
    coordinates: [37.5648, 126.9941],
    area: "충무로 인근 · 샘플 위치",
    themeId: "lunch",
    tags: ["한식", "예약", "4인"],
    reason: "팀 점심으로 예약하기 좋은 조용한 한식집이에요.",
    status: "saved",
    rating: 0,
    note: "4명 이상이면 전날 예약 필요. 회의 있는 날 후보.",
  },
];

const DEFAULT_MAP_NOTE: MapNote = {
  title: "이번 달의 생활권 탐색",
  body: "멀리 가기보다, 자주 지나는 길에서 오래 머물고 싶은 장소를 모아보자. 평일 오전에는 집중할 카페를, 퇴근 후에는 30분 산책 루트를 우선한다.",
  callout: "이번 달 기준: 걸어서 15분 안, 다시 가고 싶은 이유가 한 가지 이상인 곳",
  checklist: [
    { id: "check-1", text: "새 카페에서 오전 집중 시간 보내기", done: true },
    { id: "check-2", text: "팀 점심 장소 한 곳 직접 확인하기", done: false },
    { id: "check-3", text: "저녁 산책 루프 기록 남기기", done: false },
  ],
};

const AI_POOLS: Record<string, Place[]> = {
  home: [
    {
      id: "ai-moss-coffee",
      name: "모스 커피룸",
      coordinates: [37.5456, 127.0529],
      area: "성수동1가 · 샘플 위치",
      themeId: "cafe",
      tags: ["조용함", "콘센트", "1인석"],
      reason: "집에서 도보 약 7분, 대화 소리가 적은 1인석이 있어요.",
      status: "saved",
      rating: 0,
      note: "AI 메모: 평일 오전 집중 작업 후보. 창가 왼쪽에 콘센트가 있어요.",
    },
    {
      id: "ai-still-morning",
      name: "스틸 모닝",
      coordinates: [37.5481, 127.0581],
      area: "성수동2가 · 샘플 위치",
      themeId: "cafe",
      tags: ["작업", "디카페인", "넓은 테이블"],
      reason: "집에서 도보 약 9분, 오래 앉기 편한 공동 테이블이 있어요.",
      status: "saved",
      rating: 0,
      note: "AI 메모: 디카페인 선택 가능. 화요일 오전에 먼저 방문해보기.",
    },
    {
      id: "ai-letter-room",
      name: "레터룸 커피",
      coordinates: [37.5428, 127.0572],
      area: "연무장길 인근 · 샘플 위치",
      themeId: "cafe",
      tags: ["차분함", "필터커피", "바 좌석"],
      reason: "집에서 도보 약 8분, 바 좌석은 비교적 조용하다는 조건과 맞아요.",
      status: "saved",
      rating: 0,
      note: "AI 메모: 90분 집중 세션에 적합. 주말 혼잡도는 확인 필요.",
    },
  ],
  work: [
    {
      id: "ai-eulji-noodle",
      name: "을지 온면상회",
      coordinates: [37.5679, 126.9936],
      area: "을지로3가 · 샘플 위치",
      themeId: "lunch",
      tags: ["빠른 식사", "한식", "혼밥"],
      reason: "회사에서 도보 약 6분, 40분 안에 다녀오기 좋아요.",
      status: "saved",
      rating: 0,
      note: "AI 메모: 11시 40분 이전 방문 추천. 맑은 온면이 대표 메뉴예요.",
    },
    {
      id: "ai-corner-bowl",
      name: "코너 보울",
      coordinates: [37.5637, 126.9901],
      area: "충무로 인근 · 샘플 위치",
      themeId: "lunch",
      tags: ["덮밥", "2인", "예약 없음"],
      reason: "회사에서 도보 약 7분, 두 명이 빠르게 먹기 좋은 곳이에요.",
      status: "saved",
      rating: 0,
      note: "AI 메모: 수요일 점심 후보. 매운 소스는 따로 요청하기.",
    },
    {
      id: "ai-season-tray",
      name: "계절 한상",
      coordinates: [37.5653, 126.9879],
      area: "을지로4가 인근 · 샘플 위치",
      themeId: "lunch",
      tags: ["제철 메뉴", "팀 점심", "40분"],
      reason: "회사에서 도보 약 8분, 40분 안에 식사를 마치기 좋은 한식집이에요.",
      status: "saved",
      rating: 0,
      note: "AI 메모: 목요일 팀 점심 후보. 4명 이상은 미리 자리 확인하기.",
    },
    {
      id: "ai-print-garden",
      name: "인쇄골목 정원",
      coordinates: [37.569, 126.9878],
      area: "을지로4가 · 샘플 위치",
      themeId: "walk",
      tags: ["산책", "15분", "골목"],
      reason: "점심 후 15분 정도 걷고 돌아오기 좋은 짧은 골목 루프예요.",
      status: "saved",
      rating: 0,
      note: "AI 메모: 식사 후 산책용. 비 오는 날에는 실내 구간으로 변경하기.",
    },
  ],
};

const STATUS_LABELS: Record<Place["status"], string> = {
  saved: "저장",
  planned: "방문 예정",
  visited: "다녀옴",
};

function haversineMeters(a: [number, number], b: [number, number]) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = radians(b[0] - a[0]);
  const dLng = radians(b[1] - a[1]);
  const lat1 = radians(a[0]);
  const lat2 = radians(b[0]);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function createBoundaryCircle(center: [number, number], radius: number) {
  const [latitude, longitude] = center;
  const coordinates: [number, number][] = [];
  for (let index = 0; index <= 72; index += 1) {
    const angle = (index / 72) * Math.PI * 2;
    const latOffset = (Math.sin(angle) * radius) / 110540;
    const lngOffset = (Math.cos(angle) * radius) / (111320 * Math.cos((latitude * Math.PI) / 180));
    coordinates.push([longitude + lngOffset, latitude + latOffset]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coordinates] },
  };
}

function createBoundaryMarker(boundary: Boundary) {
  const element = document.createElement("div");
  element.className = "boundary-center";
  element.style.setProperty("--pin-color", boundary.color);
  element.textContent = boundary.icon;
  element.setAttribute("aria-label", `${boundary.name} 중심`);
  return element;
}

function createPlaceMarker(
  theme: Theme | undefined,
  options: { selected?: boolean; preview?: boolean; label: string; onClick?: () => void },
) {
  const shell = document.createElement("div");
  shell.className = "map-pin-shell";
  const pin = document.createElement(options.preview ? "div" : "button");
  pin.className = `place-pin${options.selected ? " is-selected" : ""}${options.preview ? " is-preview" : ""}`;
  pin.style.setProperty("--pin-color", theme?.color ?? "#587462");
  pin.setAttribute("aria-label", options.label);
  const icon = document.createElement("span");
  icon.textContent = theme?.icon ?? (options.preview ? "+" : "•");
  pin.append(icon);
  if (options.onClick) pin.addEventListener("click", options.onClick);
  shell.append(pin);
  return shell;
}

function createVectorMapEngine(
  map: import("maplibre-gl").Map,
  Marker: typeof import("maplibre-gl").Marker,
): RuntimeMapEngine {
  let markers: import("maplibre-gl").Marker[] = [];
  const sourceId = "my-boundary-radius";
  const fillId = "my-boundary-radius-fill";
  const lineId = "my-boundary-radius-line";

  const clear = () => {
    markers.forEach((marker) => marker.remove());
    markers = [];
    if (map.getLayer(lineId)) map.removeLayer(lineId);
    if (map.getLayer(fillId)) map.removeLayer(fillId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  };

  return {
    flyTo(center, zoom) {
      map.flyTo({ center: [center[1], center[0]], zoom, duration: 650 });
    },
    render(input) {
      clear();
      map.addSource(sourceId, {
        type: "geojson",
        data: createBoundaryCircle(input.boundary.center, input.boundary.radius),
      });
      const fillLayer: Record<string, unknown> = {
        id: fillId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": input.boundary.color,
          "fill-opacity": 0.09,
        },
      };
      const lineLayer: Record<string, unknown> = {
        id: lineId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": input.boundary.color,
          "line-width": 2,
          "line-opacity": 0.75,
          "line-dasharray": [3, 3],
        },
      };
      map.addLayer(fillLayer);
      map.addLayer(lineLayer);

      markers.push(
        new Marker({ element: createBoundaryMarker(input.boundary), anchor: "center" })
          .setLngLat([input.boundary.center[1], input.boundary.center[0]])
          .addTo(map),
      );

      input.places.forEach((place) => {
        const markerElement = createPlaceMarker(input.themeById.get(place.themeId), {
          selected: place.id === input.selectedPlaceId,
          label: place.name,
          onClick: () => input.onPlaceClick(place.id),
        });
        markers.push(
          new Marker({ element: markerElement, anchor: "bottom" })
            .setLngLat([place.coordinates[1], place.coordinates[0]])
            .addTo(map),
        );
      });

      input.candidates.filter((candidate) => candidate.selected).forEach((candidate) => {
        const markerElement = createPlaceMarker(input.themeById.get(candidate.themeId), {
          preview: true,
          label: `${candidate.name} AI 후보`,
        });
        markers.push(
          new Marker({ element: markerElement, anchor: "bottom" })
            .setLngLat([candidate.coordinates[1], candidate.coordinates[0]])
            .addTo(map),
        );
      });
    },
    destroy() {
      clear();
      map.remove();
    },
  };
}

function cloneDefaults(): PersistedState {
  return {
    boundaries: DEFAULT_BOUNDARIES.map((item) => ({ ...item })),
    themes: DEFAULT_THEMES.map((item) => ({ ...item })),
    places: DEFAULT_PLACES.map((item) => ({ ...item, tags: [...item.tags] })),
    mapNote: {
      ...DEFAULT_MAP_NOTE,
      checklist: DEFAULT_MAP_NOTE.checklist.map((item) => ({ ...item })),
    },
  };
}

export function BoundaryStudio() {
  const defaults = useMemo(() => cloneDefaults(), []);
  const [boundaries, setBoundaries] = useState(defaults.boundaries);
  const [themes, setThemes] = useState(defaults.themes);
  const [places, setPlaces] = useState(defaults.places);
  const [mapNote, setMapNote] = useState(defaults.mapNote);
  const [activeBoundaryId, setActiveBoundaryId] = useState<Boundary["id"]>("home");
  const [activeThemeIds, setActiveThemeIds] = useState<string[]>(
    defaults.themes.map((theme) => theme.id),
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "saved" | "visited">("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    defaults.places[0]?.id ?? null,
  );
  const [activePanel, setActivePanel] = useState<"places" | "notes">("places");
  const [mobileView, setMobileView] = useState<"map" | "places" | "notes">("map");
  const [aiQuery, setAiQuery] = useState(
    "집 1km 안에서 조용하고 콘센트 있는 카페 3곳 추가해줘",
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSession, setAiSession] = useState<AiSuggestionSession | null>(null);
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [showThemeCreator, setShowThemeCreator] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [resetArmed, setResetArmed] = useState(false);
  // 바운더리 생성 폼 (로그인 전용: 주소 지오코딩 필요)
  const [showBoundaryForm, setShowBoundaryForm] = useState(false);
  const [boundaryName, setBoundaryName] = useState("");
  const [boundaryAddress, setBoundaryAddress] = useState("");
  const [boundaryRadiusKm, setBoundaryRadiusKm] = useState(1);
  const [creatingBoundary, setCreatingBoundary] = useState(false);
  // 장소 검색(Kakao) — 직접 추가
  const [showPlaceSearch, setShowPlaceSearch] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState("");
  const [mapProvider, setMapProvider] = useState<MapProviderId>("openfreemap-positron");
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState("");
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapEngineRef = useRef<RuntimeMapEngine | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // 로그인 세션 (미로그인 = 데모 모드, docs/10 / 결정 B안)
  const { user, loading: sessionLoading } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const mapNoteSaveTimer = useRef<number | null>(null);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await api.signout();
      window.location.reload();
    } catch {
      setSigningOut(false);
      setToast("로그아웃에 실패했어요");
    }
  }

  const activeBoundary =
    boundaries.find((boundary) => boundary.id === activeBoundaryId) ??
    boundaries[0] ??
    FALLBACK_BOUNDARY;

  const themeById = useMemo(
    () => new Map(themes.map((theme) => [theme.id, theme])),
    [themes],
  );

  const placesWithDistance = useMemo(
    () =>
      places.map((place) => ({
        ...place,
        distance: haversineMeters(activeBoundary.center, place.coordinates),
      })),
    [activeBoundary.center, places],
  );

  const visiblePlaces = useMemo(
    () =>
      placesWithDistance
        .filter((place) => place.distance <= activeBoundary.radius)
        .filter((place) => activeThemeIds.includes(place.themeId))
        .filter((place) => {
          if (statusFilter === "all") return true;
          if (statusFilter === "visited") return place.status === "visited";
          return place.status !== "visited";
        })
        .sort((a, b) => a.distance - b.distance),
    [activeBoundary.radius, activeThemeIds, placesWithDistance, statusFilter],
  );

  const selectedPlace = placesWithDistance.find((place) => place.id === selectedPlaceId);

  // 세션이 정해지면 하이드레이션: 로그인=API, 미로그인=localStorage 데모 (결정 B안)
  useEffect(() => {
    if (sessionLoading) return;
    let active = true;

    async function hydrateRemote() {
      try {
        const state = await loadRemoteState();
        if (!active) return;
        setBoundaries(state.boundaries);
        setThemes(state.themes);
        setPlaces(state.places);
        setMapNote(state.mapNote);
        setActiveThemeIds(state.themes.map((theme) => theme.id));
        setActiveBoundaryId(state.boundaries[0]?.id ?? "");
        setSelectedPlaceId(state.places[0]?.id ?? null);
      } catch {
        if (active) setToast("내 데이터를 불러오지 못했어요");
      } finally {
        if (active) setHydrated(true);
      }
    }

    function hydrateLocal() {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as PersistedState;
          setBoundaries(parsed.boundaries);
          setThemes(parsed.themes);
          setPlaces(parsed.places);
          setMapNote(parsed.mapNote);
          if (parsed.mapProvider && MAP_PROVIDERS.some((p) => p.id === parsed.mapProvider)) {
            setMapProvider(parsed.mapProvider);
          }
          setActiveThemeIds(parsed.themes.map((theme) => theme.id));
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    }

    if (user) void hydrateRemote();
    else hydrateLocal();

    return () => {
      active = false;
    };
  }, [sessionLoading, user]);

  // 데모 모드에서만 localStorage 로 저장. 로그인 모드는 각 뮤테이션이 API 로 write-through.
  useEffect(() => {
    if (!hydrated || user) return;
    const state: PersistedState = { boundaries, themes, places, mapNote, mapProvider };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [boundaries, hydrated, user, mapNote, mapProvider, places, themes]);

  // 로그인 모드: 지도 노트는 디바운스 저장(입력마다 호출 방지)
  useEffect(() => {
    if (!hydrated || !user) return;
    if (mapNoteSaveTimer.current) window.clearTimeout(mapNoteSaveTimer.current);
    mapNoteSaveTimer.current = window.setTimeout(() => {
      remote.saveMapNote(mapNote).catch(() => undefined);
    }, 800);
    return () => {
      if (mapNoteSaveTimer.current) window.clearTimeout(mapNoteSaveTimer.current);
    };
  }, [mapNote, hydrated, user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!mapHostRef.current) return;
    let disposed = false;
    const host = mapHostRef.current;
    mapEngineRef.current?.destroy();
    mapEngineRef.current = null;
    host.replaceChildren();
    setMapReady(false);
    setMapError("");
    setMapLoading(true);

    const center: [number, number] = activeBoundary.center;
    const initialize = async () => {
      const maplibreModule = await import("maplibre-gl");
      const maplibregl = maplibreModule.default;
      const style = mapProvider === "openfreemap-positron"
        ? "https://tiles.openfreemap.org/styles/positron"
        : "https://tiles.openfreemap.org/styles/bright";
      const map = new maplibregl.Map({
        container: host,
        style,
        center: [center[1], center[0]],
        zoom: 14.8,
        pitch: 0,
        bearing: 0,
        attributionControl: true,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      await new Promise<void>((resolve, reject) => {
        map.once("load", () => resolve());
        map.once("error", (event) => reject(new Error(event.error?.message ?? "OpenFreeMap 지도 로드 실패")));
      });
      if (disposed) {
        map.remove();
        return;
      }
      mapEngineRef.current = createVectorMapEngine(map, maplibregl.Marker);
      if (!disposed) {
        setMapLoading(false);
        setMapReady(true);
      }
    };

    initialize().catch((error: unknown) => {
      if (disposed) return;
      const message = error instanceof Error ? error.message : "지도를 불러오지 못했어요";
      setMapError(message);
      setMapLoading(false);
    });

    return () => {
      disposed = true;
      mapEngineRef.current?.destroy();
      mapEngineRef.current = null;
    };
  }, [activeBoundary.center, mapProvider]);

  useEffect(() => {
    if (!mapReady || !mapEngineRef.current) return;
    const zoom = activeBoundary.radius <= 700 ? 16 : activeBoundary.radius <= 1200 ? 15 : 14;
    mapEngineRef.current.flyTo(activeBoundary.center, zoom);
  }, [activeBoundary.center, activeBoundary.radius, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapEngineRef.current) return;
    mapEngineRef.current.render({
      boundary: activeBoundary,
      places: visiblePlaces,
      candidates: aiSession?.candidates ?? [],
      selectedPlaceId,
      themeById,
      onPlaceClick: (placeId) => {
        setSelectedPlaceId(placeId);
        setActivePanel("places");
        setMobileView("places");
      },
    });
  }, [activeBoundary, aiSession, mapReady, selectedPlaceId, themeById, visiblePlaces]);

  function updateRadius(value: number) {
    setBoundaries((current) =>
      current.map((boundary) =>
        boundary.id === activeBoundaryId ? { ...boundary, radius: value } : boundary,
      ),
    );
  }

  // 슬라이더를 놓을 때만 서버에 반영(로그인 모드) — onChange 마다 호출 방지
  function persistRadius() {
    if (user && activeBoundary.id) {
      remote
        .updateBoundary(activeBoundary.id, { radius: activeBoundary.radius })
        .catch(() => setToast("반경 저장에 실패했어요"));
    }
  }

  function toggleTheme(themeId: string) {
    setActiveThemeIds((current) =>
      current.includes(themeId)
        ? current.filter((id) => id !== themeId)
        : [...current, themeId],
    );
  }

  async function addTheme() {
    const name = newThemeName.trim();
    if (!name) return;
    let nextTheme: Theme = { id: `custom-${Date.now()}`, name, icon: "✦", color: "#7c657e" };
    if (user) {
      try {
        nextTheme = await remote.createTheme({ name, icon: "✦", color: "#7c657e" });
      } catch {
        setToast("테마 저장에 실패했어요");
        return;
      }
    }
    setThemes((current) => [...current, nextTheme]);
    setActiveThemeIds((current) => [...current, nextTheme.id]);
    setNewThemeName("");
    setShowThemeCreator(false);
    setToast(`‘${name}’ 테마를 만들었어요`);
  }

  // 바운더리 추가: 주소를 지오코딩해서 생성 (로그인 전용)
  async function createBoundaryFromForm() {
    if (!user) {
      setToast("로그인하면 바운더리를 추가할 수 있어요");
      return;
    }
    const name = boundaryName.trim();
    const address = boundaryAddress.trim();
    if (!name || !address) {
      setToast("이름과 주소를 입력해주세요");
      return;
    }
    setCreatingBoundary(true);
    try {
      const geo = await api.places.geocode(address);
      if (!geo) {
        setToast("주소를 찾지 못했어요");
        return;
      }
      const created = await remote.createBoundary({
        name,
        area: geo.address,
        center: [geo.latitude, geo.longitude],
        radius: Math.round(boundaryRadiusKm * 1000),
        color: "#587462",
        icon: "⌖",
      });
      setBoundaries((current) => [...current, created]);
      setActiveBoundaryId(created.id);
      setShowBoundaryForm(false);
      setBoundaryName("");
      setBoundaryAddress("");
      setBoundaryRadiusKm(1);
      setToast(`‘${name}’ 바운더리를 만들었어요`);
    } catch (e) {
      // 서버가 준 실제 사유를 노출 (예: Kakao 키 문제)
      setToast(e instanceof ApiError ? e.message : "바운더리 생성에 실패했어요");
    } finally {
      setCreatingBoundary(false);
    }
  }

  async function removeBoundary(id: string) {
    if (!user) return;
    const rest = boundaries.filter((boundary) => boundary.id !== id);
    try {
      await remote.deleteBoundary(id);
      setBoundaries(rest);
      if (activeBoundaryId === id) setActiveBoundaryId(rest[0]?.id ?? "");
      setToast("바운더리를 삭제했어요");
    } catch {
      setToast("삭제에 실패했어요");
    }
  }

  // 장소 검색(Kakao) — 활성 바운더리 중심으로 편향
  async function runPlaceSearch() {
    const query = placeQuery.trim();
    if (!query) return;
    if (!user) {
      setToast("로그인하면 장소를 검색해 추가할 수 있어요");
      return;
    }
    setSearchingPlaces(true);
    setPlaceSearchError("");
    try {
      const bias = activeBoundary.id
        ? {
            latitude: activeBoundary.center[0],
            longitude: activeBoundary.center[1],
            radiusM: activeBoundary.radius,
          }
        : undefined;
      const results = await api.places.search(query, bias);
      setPlaceResults(results);
      if (!results.length) setPlaceSearchError("검색 결과가 없어요. 다른 키워드로 시도해보세요.");
    } catch (e) {
      setPlaceSearchError(e instanceof ApiError ? e.message : "장소 검색에 실패했어요");
      setPlaceResults([]);
    } finally {
      setSearchingPlaces(false);
    }
  }

  // 검색 결과를 내 지도에 추가 (로그인 모드: 서버 저장)
  async function addSearchResult(result: PlaceResult) {
    if (places.some((place) => place.googlePlaceId === result.externalPlaceId)) {
      setToast("이미 저장한 장소예요");
      return;
    }
    const newPlace: Place = {
      id: `kakao-${result.externalPlaceId}`,
      name: result.name,
      coordinates: [result.latitude, result.longitude],
      area: result.address ?? result.category,
      themeId: activeThemeIds[0] ?? themes[0]?.id ?? "",
      tags: [],
      reason: "",
      status: "saved",
      rating: 0,
      note: "",
      googlePlaceId: result.externalPlaceId,
    };
    try {
      if (user) {
        const id = await remote.addPlace(newPlace, activeBoundary.id || null);
        newPlace.id = id;
      }
      setPlaces((current) => [...current, newPlace]);
      setSelectedPlaceId(newPlace.id);
      setShowPlaceSearch(false);
      setPlaceQuery("");
      setPlaceResults([]);
      setToast(`‘${result.name}’ 을 추가했어요`);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "장소 추가에 실패했어요");
    }
  }

  function focusPlace(placeId: string) {
    const place = places.find((item) => item.id === placeId);
    if (!place) return;
    setSelectedPlaceId(placeId);
    setActivePanel("places");
    setMobileView("places");
    mapEngineRef.current?.flyTo(place.coordinates, 17);
  }

  function runAi() {
    const query = aiQuery.trim();
    const supported = /카페|커피|점심|맛집|식사|산책|운동|추가|찾아|추천/.test(query);
    if (!query || !supported) {
      setAiError("장소 종류나 상황을 조금 더 알려주세요. 아래 예시를 눌러 시작할 수 있어요.");
      setAiSession(null);
      return;
    }
    const requestedBoundaryId: string = /직장|회사/.test(query)
      ? "work"
      : /집/.test(query)
        ? "home"
        : activeBoundaryId;
    const requestedThemeId = /카페|커피/.test(query)
      ? "cafe"
      : /산책/.test(query)
        ? "walk"
        : /운동/.test(query)
          ? "exercise"
          : "lunch";
    const availablePool = (AI_POOLS[requestedBoundaryId] ?? []).filter(
      (candidate) => candidate.themeId === requestedThemeId,
    );
    if (!availablePool.length) {
      setAiError("이 시연에서는 ‘집 근처 조용한 카페’ 또는 ‘회사 근처 점심 맛집·산책’을 먼저 체험해보세요.");
      setAiSession(null);
      return;
    }
    const targetBoundary = boundaries.find((boundary) => boundary.id === requestedBoundaryId) ?? activeBoundary;
    setActiveBoundaryId(requestedBoundaryId);
    setAiLoading(true);
    setAiError("");
    setAiSession(null);
    window.setTimeout(() => {
      const requestedCount = Math.min(Number(query.match(/[1-5]/)?.[0] ?? 3), 3);
      const candidates = availablePool
        .slice(0, requestedCount)
        .map((candidate) => ({
          ...candidate,
          selected: true,
        }));
      setAiSession({
        query,
        summary: `${targetBoundary.name} 반경 ${targetBoundary.radius >= 1000 ? `${targetBoundary.radius / 1000}km` : `${targetBoundary.radius}m`} · ${candidates.length}곳을 찾았어요`,
        candidates,
      });
      setAiLoading(false);
      setActivePanel("places");
      setMobileView("places");
    }, 1050);
  }

  function updateCandidate(candidateId: string, patch: Partial<AiCandidate>) {
    setAiSession((session) =>
      session
        ? {
            ...session,
            candidates: session.candidates.map((candidate) =>
              candidate.id === candidateId ? { ...candidate, ...patch } : candidate,
            ),
          }
        : session,
    );
  }

  async function commitSuggestions(addAll = false) {
    if (!aiSession) return;
    const chosen = aiSession.candidates.filter((candidate) => addAll || candidate.selected);
    const existingNames = new Set(places.map((place) => place.name));
    const additions = chosen
      .filter((candidate) => !existingNames.has(candidate.name))
      .map(({ selected, ...place }) => {
        void selected;
        return place;
      });
    if (!additions.length) {
      setToast("이미 저장된 장소이거나 선택한 후보가 없어요");
      return;
    }
    let toAdd = additions;
    if (user) {
      // 로그인 모드: 서버에 저장하고 서버가 발급한 id(=bookmark.id)로 교체
      try {
        toAdd = await Promise.all(
          additions.map(async (place) => {
            const id = await remote.addPlace(place, activeBoundary.id || null);
            return { ...place, id };
          }),
        );
      } catch {
        setToast("장소 저장에 실패했어요");
        return;
      }
    }
    setPlaces((current) => [...current, ...toAdd]);
    setSelectedPlaceId(toAdd[toAdd.length - 1].id);
    setAiSession(null);
    setToast(`${toAdd.length}곳을 내 지도에 추가했어요`);
  }

  function updatePlace(placeId: string, patch: Partial<Place>) {
    setPlaces((current) =>
      current.map((place) => (place.id === placeId ? { ...place, ...patch } : place)),
    );
    if (user) {
      remote.updatePlace(placeId, patch).catch(() => setToast("저장에 실패했어요"));
    }
  }

  function resetData() {
    if (user) return; // 샘플 초기화는 데모 모드 전용
    if (!resetArmed) {
      setResetArmed(true);
      window.setTimeout(() => setResetArmed(false), 3500);
      return;
    }
    const next = cloneDefaults();
    setBoundaries(next.boundaries);
    setThemes(next.themes);
    setPlaces(next.places);
    setMapNote(next.mapNote);
    setActiveBoundaryId("home");
    setActiveThemeIds(next.themes.map((theme) => theme.id));
    setSelectedPlaceId(next.places[0]?.id ?? null);
    setAiSession(null);
    setResetArmed(false);
    window.localStorage.removeItem(STORAGE_KEY);
    setToast("샘플 지도를 처음 상태로 되돌렸어요");
  }

  const selectedCount = aiSession?.candidates.filter((candidate) => candidate.selected).length ?? 0;
  const activeMapProvider = MAP_PROVIDERS.find((provider) => provider.id === mapProvider) ?? MAP_PROVIDERS[0];
  // 로그인했는데 바운더리가 하나도 없으면 온보딩
  const needsOnboarding = !sessionLoading && !!user && hydrated && boundaries.length === 0;

  const boundaryForm = (
    <form
      className="boundary-form"
      onSubmit={(event) => {
        event.preventDefault();
        void createBoundaryFromForm();
      }}
    >
      <input
        aria-label="바운더리 이름"
        onChange={(event) => setBoundaryName(event.target.value)}
        placeholder="이름 (예: 집, 직장)"
        value={boundaryName}
      />
      <input
        aria-label="기준 주소"
        onChange={(event) => setBoundaryAddress(event.target.value)}
        placeholder="기준 주소 (예: 서울 성동구 성수동)"
        value={boundaryAddress}
      />
      <label className="boundary-form-radius">
        반경
        <select
          onChange={(event) => setBoundaryRadiusKm(Number(event.target.value))}
          value={boundaryRadiusKm}
        >
          <option value={0.5}>500m</option>
          <option value={1}>1km</option>
          <option value={1.5}>1.5km</option>
          <option value={2}>2km</option>
        </select>
      </label>
      <button className="primary-action" disabled={creatingBoundary} type="submit">
        {creatingBoundary ? "만드는 중…" : "바운더리 만들기"}
      </button>
    </form>
  );

  if (needsOnboarding) {
    return (
      <div className="studio-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">⌖</span>
            <span>내 바운더리</span>
          </div>
          <div className="topbar-actions">
            <button className="quiet-button" onClick={handleSignOut} disabled={signingOut} type="button">
              로그아웃
            </button>
          </div>
        </header>
        <div className="onboarding">
          <div className="onboarding-card">
            <span className="onboarding-mark">⌖</span>
            <h1>첫 바운더리를 만들어요</h1>
            <p>집·직장 등 자주 다니는 곳의 주소와 반경을 정하면, 그 안의 장소를 모을 수 있어요.</p>
            {boundaryForm}
          </div>
        </div>
        {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
      </div>
    );
  }

  return (
    <div className="studio-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⌖</span>
          <span>내 바운더리</span>
        </div>
        <div className="topbar-center">
          <span className="save-dot" />
          모든 변경사항 저장됨
        </div>
        <div className="topbar-actions">
          {sessionLoading ? null : user ? (
            <>
              <button
                className="quiet-button"
                onClick={handleSignOut}
                disabled={signingOut}
                type="button"
              >
                로그아웃
              </button>
              <span className="avatar" aria-label={`${user.displayName} 프로필`} title={user.email}>
                {user.displayName.trim().charAt(0) || "나"}
              </span>
            </>
          ) : (
            <>
              <span className="prototype-badge">데모 모드 · 샘플 장소</span>
              <button className="quiet-button" onClick={resetData} type="button">
                {resetArmed ? "한 번 더 눌러 초기화" : "샘플 초기화"}
              </button>
              <a className="login-button" href="/api/auth/google">
                Google로 로그인
              </a>
            </>
          )}
        </div>
      </header>

      <nav className="mobile-tabs" aria-label="모바일 보기 전환">
        {(["map", "places", "notes"] as const).map((view) => (
          <button
            className={mobileView === view ? "is-active" : ""}
            key={view}
            onClick={() => {
              setMobileView(view);
              if (view !== "map") setActivePanel(view === "places" ? "places" : "notes");
            }}
            type="button"
          >
            {view === "map" ? "지도" : view === "places" ? "목록" : "노트"}
          </button>
        ))}
      </nav>

      <main className="workspace">
        <aside className="sidebar">
          <section className="sidebar-section boundary-section">
            <div className="section-label-row">
              <p className="section-label">내 바운더리</p>
              <button
                className="circle-button"
                aria-label="바운더리 추가"
                onClick={() => {
                  if (!user) {
                    setToast("로그인하면 바운더리를 추가할 수 있어요");
                    return;
                  }
                  setShowBoundaryForm((current) => !current);
                }}
                type="button"
              >
                +
              </button>
            </div>
            <div className="boundary-list">
              {boundaries.map((boundary) => (
                <div className={`boundary-row ${boundary.id === activeBoundaryId ? "is-active" : ""}`} key={boundary.id}>
                  <button
                    className="boundary-card"
                    onClick={() => setActiveBoundaryId(boundary.id)}
                    type="button"
                  >
                    <span className="boundary-icon" style={{ background: `${boundary.color}18`, color: boundary.color }}>
                      {boundary.icon}
                    </span>
                    <span className="boundary-copy">
                      <strong>{boundary.name}</strong>
                      <small>{boundary.area} · {boundary.radius >= 1000 ? `${boundary.radius / 1000}km` : `${boundary.radius}m`}</small>
                    </span>
                    <span className="boundary-count">
                      {places.filter((place) => haversineMeters(boundary.center, place.coordinates) <= boundary.radius).length}
                    </span>
                  </button>
                  {user && (
                    <button
                      className="boundary-delete"
                      aria-label={`${boundary.name} 삭제`}
                      onClick={() => void removeBoundary(boundary.id)}
                      type="button"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {showBoundaryForm && user && boundaryForm}
            <div className="radius-control">
              <div>
                <span>반경</span>
                <strong>{activeBoundary.radius >= 1000 ? `${activeBoundary.radius / 1000}km` : `${activeBoundary.radius}m`}</strong>
              </div>
              <input
                aria-label="바운더리 반경"
                max="2000"
                min="500"
                onChange={(event) => updateRadius(Number(event.target.value))}
                onPointerUp={persistRadius}
                onKeyUp={persistRadius}
                step="100"
                type="range"
                value={activeBoundary.radius}
              />
              <div className="range-labels"><span>500m</span><span>2km</span></div>
            </div>
          </section>

          <section className="sidebar-section">
            <div className="section-label-row">
              <p className="section-label">테마</p>
              <button
                className="text-button"
                onClick={() => setShowThemeCreator((current) => !current)}
                type="button"
              >
                + 새 테마
              </button>
            </div>
            {showThemeCreator && (
              <form
                className="theme-creator"
                onSubmit={(event) => {
                  event.preventDefault();
                  addTheme();
                }}
              >
                <input
                  autoFocus
                  onChange={(event) => setNewThemeName(event.target.value)}
                  placeholder="예: 데이트 코스"
                  value={newThemeName}
                />
                <button type="submit">추가</button>
              </form>
            )}
            <div className="theme-list">
              {themes.map((theme) => {
                const active = activeThemeIds.includes(theme.id);
                const count = places.filter(
                  (place) =>
                    place.themeId === theme.id &&
                    haversineMeters(activeBoundary.center, place.coordinates) <= activeBoundary.radius,
                ).length;
                return (
                  <button
                    className={`theme-row ${active ? "is-active" : ""}`}
                    key={theme.id}
                    onClick={() => toggleTheme(theme.id)}
                    type="button"
                  >
                    <span className="theme-dot" style={{ background: theme.color }} />
                    <span className="theme-icon">{theme.icon}</span>
                    <span>{theme.name}</span>
                    <small>{count}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="sidebar-section filter-section">
            <p className="section-label">상태</p>
            <div className="segmented vertical">
              {([
                ["all", "전체"],
                ["saved", "가보고 싶은 곳"],
                ["visited", "다녀온 곳"],
              ] as const).map(([value, label]) => (
                <button
                  className={statusFilter === value ? "is-active" : ""}
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  type="button"
                >
                  <span>{label}</span>
                  {statusFilter === value && <span>✓</span>}
                </button>
              ))}
            </div>
          </section>

          <div className="sidebar-tip">
            <span>✦</span>
            <p><strong>바운더리 팁</strong>반경을 줄이면 정말 자주 갈 수 있는 장소만 남아요.</p>
          </div>
        </aside>

        <section className={`map-stage ${mobileView !== "map" ? "mobile-hidden" : ""}`}>
          <div ref={mapHostRef} className="map-canvas" aria-label="내 장소 지도" />
          <div className="map-style-switcher" role="group" aria-label="실제 지도 스타일 비교">
            <div className="map-style-label">
              <small>LIVE MAP</small>
              <strong>지도 스타일</strong>
            </div>
            <div className="map-style-options">
              {MAP_PROVIDERS.map((provider) => {
                return (
                  <button
                    aria-pressed={mapProvider === provider.id}
                    className={mapProvider === provider.id ? "map-style-option active" : "map-style-option"}
                    key={provider.id}
                    onClick={() => setMapProvider(provider.id)}
                    type="button"
                  >
                    <span className="map-style-swatch" style={{ backgroundColor: provider.tone }} />
                    <span className="map-style-copy">
                      <small>{provider.vendor}</small>
                      <strong>{provider.name}</strong>
                    </span>
                    <span className="map-key-state connected">NO KEY</span>
                  </button>
                );
              })}
            </div>
          </div>
          {(mapLoading || mapError) && (
            <div className={mapError ? "map-api-status error" : "map-api-status"} role="status">
              {mapLoading ? <span className="map-loading-spinner" aria-hidden="true" /> : <span className="map-error-mark">!</span>}
              <div>
                <small>{activeMapProvider.vendor} · {activeMapProvider.name}</small>
                <strong>{mapLoading ? "실제 지도를 불러오는 중" : mapError}</strong>
                {mapError && <p>네트워크 상태를 확인한 뒤 다른 스타일로 전환해보세요.</p>}
              </div>
            </div>
          )}
          <div className="map-heading">
            <span>{activeBoundary.icon}</span>
            <div>
              <small>{activeBoundary.name} 바운더리</small>
              <strong>{activeBoundary.area} · {visiblePlaces.length}곳</strong>
            </div>
          </div>
          <div className="map-legend">
            <span className="legend-preview" /> AI 후보
            <span className="legend-saved" /> 저장한 장소
          </div>

          <div className="ai-composer">
            <div className="ai-spark">✦</div>
            <div className="ai-input-wrap">
              <label htmlFor="ai-query">AI에게 장소를 부탁해보세요</label>
              <input
                id="ai-query"
                onChange={(event) => setAiQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") runAi();
                }}
                placeholder="예: 회사 근처 40분 안에 먹을 점심 맛집 3곳"
                value={aiQuery}
              />
            </div>
            <button className="ai-submit" disabled={aiLoading} onClick={runAi} type="button">
              {aiLoading ? <span className="loading-dots"><i /><i /><i /></span> : "찾아보기  →"}
            </button>
            {aiError && (
              <div className="ai-error">
                <span>{aiError}</span>
                <button onClick={() => { setAiQuery("회사 근처 40분 안에 먹을 점심 맛집 3곳"); setAiError(""); }} type="button">
                  점심 맛집 예시 넣기
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className={`inspector ${mobileView === "map" ? "mobile-hidden" : ""}`}>
          <div className="inspector-tabs">
            <button
              className={activePanel === "places" ? "is-active" : ""}
              onClick={() => setActivePanel("places")}
              type="button"
            >
              장소 <span>{visiblePlaces.length}</span>
            </button>
            <button
              className={activePanel === "notes" ? "is-active" : ""}
              onClick={() => setActivePanel("notes")}
              type="button"
            >
              지도 노트
            </button>
          </div>

          {activePanel === "places" && (
            <div className="inspector-body places-panel">
              {aiSession ? (
                <section className="ai-preview-panel">
                  <div className="preview-heading">
                    <span className="ai-spark small">✦</span>
                    <div>
                      <small>AI가 조건을 정리했어요</small>
                      <h2>{aiSession.summary}</h2>
                    </div>
                    <button aria-label="AI 후보 닫기" onClick={() => setAiSession(null)} type="button">×</button>
                  </div>
                  <div className="query-quote">“{aiSession.query}”</div>
                  <p className="preview-guide">점선 핀은 아직 저장되지 않은 후보예요. 메모와 테마를 다듬은 뒤 추가하세요.</p>
                  <div className="candidate-list">
                    {aiSession.candidates.map((candidate) => {
                      const theme = themeById.get(candidate.themeId);
                      return (
                        <article className={`candidate-card ${candidate.selected ? "is-selected" : ""}`} key={candidate.id}>
                          <div className="candidate-topline">
                            <button
                              aria-label={`${candidate.name} 선택`}
                              className="check-button"
                              onClick={() => updateCandidate(candidate.id, { selected: !candidate.selected })}
                              type="button"
                            >
                              {candidate.selected ? "✓" : ""}
                            </button>
                            <div>
                              <h3>{candidate.name}</h3>
                              <p>{candidate.area}</p>
                            </div>
                            <span className="distance-chip">{formatDistance(haversineMeters(activeBoundary.center, candidate.coordinates))}</span>
                          </div>
                          <div className="tag-row">
                            {candidate.tags.map((tag) => <span key={tag}>#{tag}</span>)}
                          </div>
                          <p className="match-reason"><span>조건 일치</span>{candidate.reason}</p>
                          <label className="candidate-note">
                            <span>AI 메모 초안</span>
                            <textarea
                              onChange={(event) => updateCandidate(candidate.id, { note: event.target.value })}
                              rows={2}
                              value={candidate.note}
                            />
                          </label>
                          <select
                            aria-label="후보 테마"
                            onChange={(event) => updateCandidate(candidate.id, { themeId: event.target.value })}
                            value={candidate.themeId}
                          >
                            {themes.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                          </select>
                          <span className="candidate-color" style={{ background: theme?.color }} />
                        </article>
                      );
                    })}
                  </div>
                  <div className="preview-actions">
                    <button className="secondary-action" onClick={() => commitSuggestions(true)} type="button">모두 추가</button>
                    <button className="primary-action" disabled={!selectedCount} onClick={() => commitSuggestions(false)} type="button">
                      선택한 {selectedCount}곳 추가
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <div className="list-heading">
                    <div>
                      <small>{activeBoundary.name} · {activeBoundary.area}</small>
                      <h1>내가 모은 장소</h1>
                    </div>
                    <button
                      aria-label="장소 검색해 추가"
                      className="add-place-button"
                      onClick={() => {
                        if (!user) {
                          setToast("로그인하면 장소를 검색해 추가할 수 있어요");
                          return;
                        }
                        setShowPlaceSearch((current) => !current);
                      }}
                      type="button"
                    >
                      +
                    </button>
                  </div>

                  {showPlaceSearch && user && (
                    <section className="place-search">
                      <form
                        className="place-search-bar"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void runPlaceSearch();
                        }}
                      >
                        <input
                          aria-label="장소 검색"
                          autoFocus
                          onChange={(event) => setPlaceQuery(event.target.value)}
                          placeholder="장소 이름·키워드 (예: 성수 도자기 공방)"
                          value={placeQuery}
                        />
                        <button className="primary-action" disabled={searchingPlaces} type="submit">
                          {searchingPlaces ? "검색 중…" : "검색"}
                        </button>
                      </form>
                      {placeSearchError && <p className="place-search-error">{placeSearchError}</p>}
                      <div className="place-search-results">
                        {placeResults.map((result) => (
                          <div className="search-result" key={result.externalPlaceId}>
                            <div className="search-result-copy">
                              <strong>{result.name}</strong>
                              <small>{result.category} · {result.address ?? "주소 미상"}</small>
                            </div>
                            <button
                              className="search-result-add"
                              onClick={() => void addSearchResult(result)}
                              type="button"
                            >
                              추가
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="list-subhead">
                    <span>거리순</span>
                    <span>{visiblePlaces.length}개의 장소</span>
                  </div>
                  <div className="place-list">
                    {visiblePlaces.length ? visiblePlaces.map((place) => {
                      const theme = themeById.get(place.themeId);
                      return (
                        <button
                          className={`place-card ${place.id === selectedPlaceId ? "is-active" : ""}`}
                          key={place.id}
                          onClick={() => focusPlace(place.id)}
                          type="button"
                        >
                          <span className="place-card-icon" style={{ background: `${theme?.color}1c`, color: theme?.color }}>
                            {theme?.icon}
                          </span>
                          <span className="place-card-copy">
                            <span className="place-card-title"><strong>{place.name}</strong><small>{formatDistance(place.distance)}</small></span>
                            <span className="place-meta">{theme?.name} · {STATUS_LABELS[place.status]}</span>
                            <span className="place-reason">{place.reason}</span>
                          </span>
                        </button>
                      );
                    }) : (
                      <div className="empty-state">
                        <span>⌖</span>
                        <h3>조건에 맞는 장소가 없어요</h3>
                        <p>반경을 넓히거나 다른 테마를 켜보세요.</p>
                      </div>
                    )}
                  </div>

                  {selectedPlace && (
                    <section className="place-detail">
                      <div className="detail-handle" />
                      <div className="detail-heading">
                        <div>
                          <span className="eyebrow">{themeById.get(selectedPlace.themeId)?.name}</span>
                          <h2>{selectedPlace.name}</h2>
                          <p>{selectedPlace.area} · {formatDistance(selectedPlace.distance)}</p>
                        </div>
                        <button aria-label="상세 닫기" onClick={() => setSelectedPlaceId(null)} type="button">×</button>
                      </div>
                      <div className="tag-row detail-tags">
                        {selectedPlace.tags.map((tag) => <span key={tag}>#{tag}</span>)}
                      </div>
                      <p className="saved-reason"><span>저장한 이유</span>{selectedPlace.reason}</p>
                      <div className="detail-controls">
                        <label>
                          <span>방문 상태</span>
                          <select
                            onChange={(event) => updatePlace(selectedPlace.id, { status: event.target.value as Place["status"] })}
                            value={selectedPlace.status}
                          >
                            <option value="saved">저장</option>
                            <option value="planned">방문 예정</option>
                            <option value="visited">다녀옴</option>
                          </select>
                        </label>
                        <div className="rating-control">
                          <span>내 별점</span>
                          <div>
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <button
                                aria-label={`${rating}점`}
                                className={rating <= selectedPlace.rating ? "is-active" : ""}
                                key={rating}
                                onClick={() => updatePlace(selectedPlace.id, { rating })}
                                type="button"
                              >★</button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <label className="place-note-editor">
                        <span>나만의 메모 <small>자동 저장</small></span>
                        <textarea
                          onChange={(event) => updatePlace(selectedPlace.id, { note: event.target.value })}
                          placeholder="다시 기억하고 싶은 내용을 적어두세요."
                          rows={4}
                          value={selectedPlace.note}
                        />
                      </label>
                    </section>
                  )}
                </>
              )}
            </div>
          )}

          {activePanel === "notes" && (
            <div className="inspector-body notes-panel">
              <div className="note-heading">
                <span className="eyebrow">MAP NOTE · 자동 저장</span>
                <input
                  aria-label="지도 노트 제목"
                  onChange={(event) => setMapNote((current) => ({ ...current, title: event.target.value }))}
                  value={mapNote.title}
                />
                <p>{activeBoundary.name} 바운더리를 위한 생각과 계획</p>
              </div>
              <div className="editor-toolbar" aria-label="메모 서식 도구">
                <button type="button"><strong>B</strong></button>
                <button type="button"><em>I</em></button>
                <button type="button">H₂</button>
                <span />
                <button type="button">☷</button>
                <button type="button">☑</button>
                <button type="button">@ 장소</button>
              </div>
              <textarea
                className="note-body-editor"
                aria-label="지도 노트 본문"
                onChange={(event) => setMapNote((current) => ({ ...current, body: event.target.value }))}
                rows={7}
                value={mapNote.body}
              />
              <label className="callout-editor">
                <span>✦ 이번 달 기준</span>
                <textarea
                  onChange={(event) => setMapNote((current) => ({ ...current, callout: event.target.value }))}
                  rows={2}
                  value={mapNote.callout}
                />
              </label>
              <section className="checklist-block">
                <div className="block-heading">
                  <h3>이번 달 해볼 일</h3>
                  <small>{mapNote.checklist.filter((item) => item.done).length}/{mapNote.checklist.length}</small>
                </div>
                {mapNote.checklist.map((item) => (
                  <label className={item.done ? "is-done" : ""} key={item.id}>
                    <input
                      checked={item.done}
                      onChange={() =>
                        setMapNote((current) => ({
                          ...current,
                          checklist: current.checklist.map((check) =>
                            check.id === item.id ? { ...check, done: !check.done } : check,
                          ),
                        }))
                      }
                      type="checkbox"
                    />
                    <input
                      aria-label="체크리스트 항목"
                      onChange={(event) =>
                        setMapNote((current) => ({
                          ...current,
                          checklist: current.checklist.map((check) =>
                            check.id === item.id ? { ...check, text: event.target.value } : check,
                          ),
                        }))
                      }
                      value={item.text}
                    />
                  </label>
                ))}
              </section>
              <section className="mentions-block">
                <h3>@ 장소 멘션</h3>
                <p>노트에서 장소를 바로 찾아갈 수 있어요.</p>
                <div>
                  {placesWithDistance.slice(0, 4).map((place) => (
                    <button key={place.id} onClick={() => focusPlace(place.id)} type="button">
                      <span style={{ color: themeById.get(place.themeId)?.color }}>{themeById.get(place.themeId)?.icon}</span>
                      {place.name}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </aside>
      </main>
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </div>
  );
}
