// AI 추천(승인 전 변경안) repository (docs/06, D9~D13)
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import {
  aiRecommendations,
  type AiRecommendation,
  type ProposedChange,
} from "@/db/schema";

export type RecommendationInput = {
  type: string;
  summary?: string | null;
  rationale?: string | null;
  inputContext?: unknown;
  proposedChanges: ProposedChange[];
};

export async function createRecommendation(
  db: Database,
  userId: string,
  input: RecommendationInput,
): Promise<AiRecommendation> {
  const [row] = await db
    .insert(aiRecommendations)
    .values({
      userId,
      type: input.type,
      summary: input.summary ?? null,
      rationale: input.rationale ?? null,
      inputContext: input.inputContext ?? null,
      proposedChanges: input.proposedChanges,
    })
    .returning();
  return row;
}

export async function getRecommendation(
  db: Database,
  userId: string,
  id: string,
): Promise<AiRecommendation | undefined> {
  const [row] = await db
    .select()
    .from(aiRecommendations)
    .where(and(eq(aiRecommendations.id, id), eq(aiRecommendations.userId, userId)));
  return row;
}

export function listRecommendations(
  db: Database,
  userId: string,
): Promise<AiRecommendation[]> {
  return db
    .select()
    .from(aiRecommendations)
    .where(eq(aiRecommendations.userId, userId))
    .orderBy(desc(aiRecommendations.createdAt));
}

export async function setRecommendationStatus(
  db: Database,
  userId: string,
  id: string,
  status: "approved" | "rejected" | "partial",
): Promise<void> {
  const now = Date.now();
  await db
    .update(aiRecommendations)
    .set({
      status,
      approvedAt: status === "rejected" ? null : now,
      rejectedAt: status === "rejected" ? now : null,
    })
    .where(and(eq(aiRecommendations.id, id), eq(aiRecommendations.userId, userId)));
}
