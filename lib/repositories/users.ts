// 사용자 repository — Google 계정 기준 upsert (docs/02, docs/10 §2)
import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { users, type User } from "@/db/schema";

export async function findByGoogleAccountId(
  db: Database,
  googleAccountId: string,
): Promise<User | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.googleAccountId, googleAccountId));
  return row;
}

export async function findById(db: Database, id: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row;
}

/** Google sub 기준 사용자 조회/생성. 이메일·이름은 최신값으로 갱신. */
export async function upsertByGoogle(
  db: Database,
  input: { googleAccountId: string; email: string; displayName: string },
): Promise<User> {
  const existing = await findByGoogleAccountId(db, input.googleAccountId);
  if (existing) {
    if (existing.email !== input.email || existing.displayName !== input.displayName) {
      const [row] = await db
        .update(users)
        .set({ email: input.email, displayName: input.displayName })
        .where(eq(users.id, existing.id))
        .returning();
      return row;
    }
    return existing;
  }
  const [row] = await db.insert(users).values(input).returning();
  return row;
}
