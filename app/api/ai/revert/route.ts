import { error, json, readJson, withAuth } from "@/lib/http";
import { getApproval, markReverted } from "@/lib/repositories/approvalHistory";
import { deleteBookmark } from "@/lib/repositories/bookmarks";

// POST /api/ai/revert { approvalHistoryId } → 승인으로 생성된 북마크 되돌리기 (D13)
export const POST = withAuth(async ({ db, userId }, request) => {
  const { approvalHistoryId } = await readJson<{ approvalHistoryId?: string }>(request);
  if (!approvalHistoryId) return error("approvalHistoryId 는 필수입니다.");

  const approval = await getApproval(db, userId, approvalHistoryId);
  if (!approval) return error("승인 이력을 찾을 수 없습니다.", 404);
  if (approval.revertedAt) return json({ ok: true, removedBookmarkIds: [] });

  const applied = approval.appliedChange as { bookmarkIds?: string[] } | null;
  const ids = applied?.bookmarkIds ?? [];
  for (const id of ids) await deleteBookmark(db, userId, id);
  await markReverted(db, userId, approvalHistoryId);

  return json({ ok: true, removedBookmarkIds: ids });
});
