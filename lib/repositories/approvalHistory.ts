// 승인 이력 repository — 감사·되돌리기 (docs/06 §5, D13)
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { approvalHistories, type ApprovalHistory } from "@/db/schema";

export type ApprovalInput = {
  recommendationId?: string | null;
  requestSummary?: string | null;
  proposedChange?: unknown;
  appliedChange?: unknown; // 되돌리기에 필요한 정보(예: 생성된 bookmark id 목록)
  reversible?: boolean;
};

export async function createApproval(
  db: Database,
  userId: string,
  input: ApprovalInput,
): Promise<ApprovalHistory> {
  const [row] = await db
    .insert(approvalHistories)
    .values({
      userId,
      recommendationId: input.recommendationId ?? null,
      requestSummary: input.requestSummary ?? null,
      proposedChange: input.proposedChange ?? null,
      appliedChange: input.appliedChange ?? null,
      approved: true,
      reversible: input.reversible ?? true,
    })
    .returning();
  return row;
}

export async function getApproval(
  db: Database,
  userId: string,
  id: string,
): Promise<ApprovalHistory | undefined> {
  const [row] = await db
    .select()
    .from(approvalHistories)
    .where(and(eq(approvalHistories.id, id), eq(approvalHistories.userId, userId)));
  return row;
}

export async function markReverted(
  db: Database,
  userId: string,
  id: string,
): Promise<void> {
  await db
    .update(approvalHistories)
    .set({ revertedAt: Date.now() })
    .where(and(eq(approvalHistories.id, id), eq(approvalHistories.userId, userId)));
}
