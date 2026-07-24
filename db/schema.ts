// 내 바운더리 — Drizzle 스키마 (Cloudflare D1 / SQLite)
// 설계: docs/02-데이터모델.md, docs/01-결정사항.md (D1~D18)
//
// 규칙
// - PK: text UUID (crypto.randomUUID, Workers 전역)
// - 타임스탬프: integer epoch(ms)
// - 좌표: real (위도/경도)
// - JSON 필드: text({ mode: "json" }) + $type<>()
// - 모든 사용자 데이터는 userId 스코프 (docs/10-인증계정)

import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const uuid = () => crypto.randomUUID();
const now = () => Date.now();

// ─────────────────────────────────────────────────────────────
// user
// ─────────────────────────────────────────────────────────────
export const users = sqliteTable(
  "user",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    googleAccountId: text("google_account_id").notNull(), // Google OAuth sub
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("user_google_account_id_unq").on(t.googleAccountId)],
);

// ─────────────────────────────────────────────────────────────
// boundary — 단일 지도 위 다중 바운더리 오버레이 (D1)
// ─────────────────────────────────────────────────────────────
export const boundaries = sqliteTable(
  "boundary",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    radiusM: integer("radius_m").notNull(),
    color: text("color").notNull().default("#587462"),
    icon: text("icon").notNull().default("⌖"),
    description: text("description"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("boundary_user_idx").on(t.userId)],
);

// ─────────────────────────────────────────────────────────────
// theme — 테마(= 폴더 역할), 장소당 1개 연결 (D5)
// ─────────────────────────────────────────────────────────────
export const themes = sqliteTable(
  "theme",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("✦"),
    color: text("color").notNull().default("#587462"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("theme_user_idx").on(t.userId)],
);

// ─────────────────────────────────────────────────────────────
// place — 장소 마스터 (중복 없음, Google Place ID 기준) (D14)
// ─────────────────────────────────────────────────────────────
export const places = sqliteTable(
  "place",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    googlePlaceId: text("google_place_id"), // nullable: 직접 추가
    name: text("name").notNull(),
    address: text("address"),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    category: text("category"), // 표시용 (테마와 별개)
    googleMapsUrl: text("google_maps_url"),
    source: text("source", { enum: ["ai", "manual", "google-import"] })
      .notNull()
      .default("manual"),
    lastVerifiedAt: integer("last_verified_at"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [
    // NULL 은 SQLite 에서 unique 여러 개 허용 → 직접 추가 장소 공존 가능
    uniqueIndex("place_google_place_id_unq").on(t.googlePlaceId),
  ],
);

// ─────────────────────────────────────────────────────────────
// bookmark — 사용자-장소 저장 관계 + 상태/별점/저장이유 (D14)
// ─────────────────────────────────────────────────────────────
export const bookmarks = sqliteTable(
  "bookmark",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    boundaryId: text("boundary_id").references(() => boundaries.id, {
      onDelete: "set null",
    }),
    themeId: text("theme_id").references(() => themes.id, {
      onDelete: "set null",
    }),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    saveReason: text("save_reason"),
    status: text("status", { enum: ["saved", "planned", "visited"] })
      .notNull()
      .default("saved"),
    rating: integer("rating").notNull().default(0), // 0 = 미평가, 1~5
    revisitIntent: text("revisit_intent", {
      enum: ["revisit", "not_recommended"],
    }),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now).$onUpdateFn(now),
  },
  (t) => [
    // 사용자별 장소 1회 저장
    uniqueIndex("bookmark_user_place_unq").on(t.userId, t.placeId),
    index("bookmark_user_idx").on(t.userId),
    index("bookmark_boundary_idx").on(t.boundaryId),
    index("bookmark_theme_idx").on(t.themeId),
  ],
);

// ─────────────────────────────────────────────────────────────
// note — 장소별 다중 주제 메모 (D6/D15, 원문 보존)
// ─────────────────────────────────────────────────────────────
export const notes = sqliteTable(
  "note",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookmarkId: text("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    topic: text("topic"), // 가격/일정/후기/… (null = 대표 메모)
    title: text("title"),
    originalContent: text("original_content").notNull().default(""), // 사용자 원문
    aiOrganizedContent: text("ai_organized_content"), // AI 정리(별도)
    author: text("author", { enum: ["user", "ai"] }).notNull().default("user"),
    aiStatus: text("ai_status", {
      enum: ["none", "suggested", "approved"],
    })
      .notNull()
      .default("none"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now).$onUpdateFn(now),
  },
  (t) => [
    index("note_bookmark_idx").on(t.bookmarkId),
    index("note_user_idx").on(t.userId),
  ],
);

// ─────────────────────────────────────────────────────────────
// map_note — 지도 전체(또는 바운더리별) 노트 + 체크리스트
// ─────────────────────────────────────────────────────────────
export type ChecklistItem = { id: string; text: string; done: boolean };

export const mapNotes = sqliteTable(
  "map_note",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    boundaryId: text("boundary_id").references(() => boundaries.id, {
      onDelete: "cascade",
    }), // null = 전체 지도 노트
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    callout: text("callout").notNull().default(""),
    checklist: text("checklist", { mode: "json" })
      .$type<ChecklistItem[]>()
      .notNull()
      .default(sql`'[]'`),
    updatedAt: integer("updated_at").notNull().$defaultFn(now).$onUpdateFn(now),
  },
  (t) => [index("map_note_user_idx").on(t.userId)],
);

// ─────────────────────────────────────────────────────────────
// visit_plan — 방문 계획 (4단계, D16)
// ─────────────────────────────────────────────────────────────
export type VisitStop = {
  bookmarkId: string;
  order: number;
  stayMinutes: number;
  arriveAt?: string;
};

export const visitPlans = sqliteTable(
  "visit_plan",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    startLocation: text("start_location", { mode: "json" }).$type<{
      lat: number;
      lng: number;
      label: string;
    } | null>(),
    plannedDate: text("planned_date"),
    stops: text("stops", { mode: "json" }).$type<VisitStop[]>().notNull().default(sql`'[]'`),
    totalDurationMin: integer("total_duration_min"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("visit_plan_user_idx").on(t.userId)],
);

// ─────────────────────────────────────────────────────────────
// preference_profile — 취향 요약 (근거·신뢰도 포함, D18)
// ─────────────────────────────────────────────────────────────
export type PreferenceTrait = {
  trait: string;
  evidence: string;
  confidence: number;
};

export const preferenceProfiles = sqliteTable(
  "preference_profile",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    traits: text("traits", { mode: "json" })
      .$type<PreferenceTrait[]>()
      .notNull()
      .default(sql`'[]'`),
    updatedAt: integer("updated_at").notNull().$defaultFn(now).$onUpdateFn(now),
  },
  (t) => [uniqueIndex("preference_profile_user_unq").on(t.userId)],
);

// ─────────────────────────────────────────────────────────────
// ai_recommendation — 승인 전 변경안 (D9~D13, docs/06)
// ─────────────────────────────────────────────────────────────
export type ProposedChange = {
  op: "add" | "update" | "delete" | "merge";
  target: { kind: string; id?: string };
  before?: unknown;
  after?: unknown;
  confidence?: number;
};

export const aiRecommendations = sqliteTable(
  "ai_recommendation",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // place-search | folder-suggest | note-organize | dedup | visit-plan | ...
    summary: text("summary"),
    rationale: text("rationale"),
    inputContext: text("input_context", { mode: "json" }).$type<unknown>(),
    proposedChanges: text("proposed_changes", { mode: "json" })
      .$type<ProposedChange[]>()
      .notNull()
      .default(sql`'[]'`),
    status: text("status", {
      enum: ["pending", "approved", "rejected", "partial"],
    })
      .notNull()
      .default("pending"),
    approvedAt: integer("approved_at"),
    rejectedAt: integer("rejected_at"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("ai_recommendation_user_idx").on(t.userId)],
);

// ─────────────────────────────────────────────────────────────
// approval_history — 감사 이력, 되돌리기 (D13)
// ─────────────────────────────────────────────────────────────
export const approvalHistories = sqliteTable(
  "approval_history",
  {
    id: text("id").primaryKey().$defaultFn(uuid),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recommendationId: text("recommendation_id").references(
      () => aiRecommendations.id,
      { onDelete: "set null" },
    ),
    requestSummary: text("request_summary"),
    proposedChange: text("proposed_change", { mode: "json" }).$type<unknown>(),
    appliedChange: text("applied_change", { mode: "json" }).$type<unknown>(),
    approved: integer("approved", { mode: "boolean" }).notNull().default(true),
    reversible: integer("reversible", { mode: "boolean" }).notNull().default(true),
    revertedAt: integer("reverted_at"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("approval_history_user_idx").on(t.userId)],
);

// ─────────────────────────────────────────────────────────────
// relations
// ─────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  boundaries: many(boundaries),
  themes: many(themes),
  bookmarks: many(bookmarks),
  notes: many(notes),
}));

export const boundariesRelations = relations(boundaries, ({ one, many }) => ({
  user: one(users, { fields: [boundaries.userId], references: [users.id] }),
  bookmarks: many(bookmarks),
}));

export const themesRelations = relations(themes, ({ one, many }) => ({
  user: one(users, { fields: [themes.userId], references: [users.id] }),
  bookmarks: many(bookmarks),
}));

export const placesRelations = relations(places, ({ many }) => ({
  bookmarks: many(bookmarks),
}));

export const bookmarksRelations = relations(bookmarks, ({ one, many }) => ({
  user: one(users, { fields: [bookmarks.userId], references: [users.id] }),
  place: one(places, { fields: [bookmarks.placeId], references: [places.id] }),
  boundary: one(boundaries, {
    fields: [bookmarks.boundaryId],
    references: [boundaries.id],
  }),
  theme: one(themes, { fields: [bookmarks.themeId], references: [themes.id] }),
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  user: one(users, { fields: [notes.userId], references: [users.id] }),
  bookmark: one(bookmarks, {
    fields: [notes.bookmarkId],
    references: [bookmarks.id],
  }),
}));

// ─────────────────────────────────────────────────────────────
// 타입 export (앱 코드에서 사용)
// ─────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Boundary = typeof boundaries.$inferSelect;
export type NewBoundary = typeof boundaries.$inferInsert;
export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type MapNote = typeof mapNotes.$inferSelect;
export type NewMapNote = typeof mapNotes.$inferInsert;
export type VisitPlan = typeof visitPlans.$inferSelect;
export type NewVisitPlan = typeof visitPlans.$inferInsert;
export type PreferenceProfile = typeof preferenceProfiles.$inferSelect;
export type AiRecommendation = typeof aiRecommendations.$inferSelect;
export type NewAiRecommendation = typeof aiRecommendations.$inferInsert;
export type ApprovalHistory = typeof approvalHistories.$inferSelect;
