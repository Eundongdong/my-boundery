// 바운더리 repository (docs/02, D1)
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { boundaries, type Boundary } from "@/db/schema";

export type BoundaryInput = {
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  radiusM: number;
  color?: string;
  icon?: string;
  description?: string | null;
  isDefault?: boolean;
};

export function listBoundaries(db: Database, userId: string): Promise<Boundary[]> {
  return db.select().from(boundaries).where(eq(boundaries.userId, userId));
}

export async function getBoundary(
  db: Database,
  userId: string,
  id: string,
): Promise<Boundary | undefined> {
  const [row] = await db
    .select()
    .from(boundaries)
    .where(and(eq(boundaries.id, id), eq(boundaries.userId, userId)));
  return row;
}

export async function createBoundary(
  db: Database,
  userId: string,
  input: BoundaryInput,
): Promise<Boundary> {
  if (input.isDefault) await clearDefault(db, userId);
  const [row] = await db
    .insert(boundaries)
    .values({ ...input, userId })
    .returning();
  return row;
}

export async function updateBoundary(
  db: Database,
  userId: string,
  id: string,
  patch: Partial<BoundaryInput>,
): Promise<Boundary | undefined> {
  if (patch.isDefault) await clearDefault(db, userId);
  const [row] = await db
    .update(boundaries)
    .set(patch)
    .where(and(eq(boundaries.id, id), eq(boundaries.userId, userId)))
    .returning();
  return row;
}

export async function deleteBoundary(
  db: Database,
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(boundaries)
    .where(and(eq(boundaries.id, id), eq(boundaries.userId, userId)))
    .returning({ id: boundaries.id });
  return rows.length > 0;
}

/** 기존 기본 바운더리 해제 (기본은 사용자당 1개) */
async function clearDefault(db: Database, userId: string): Promise<void> {
  await db
    .update(boundaries)
    .set({ isDefault: false })
    .where(and(eq(boundaries.userId, userId), eq(boundaries.isDefault, true)));
}
