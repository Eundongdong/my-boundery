// 테마 repository (docs/02, D5)
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { themes, type Theme } from "@/db/schema";

export type ThemeInput = {
  name: string;
  icon?: string;
  color?: string;
};

export function listThemes(db: Database, userId: string): Promise<Theme[]> {
  return db.select().from(themes).where(eq(themes.userId, userId));
}

export async function createTheme(
  db: Database,
  userId: string,
  input: ThemeInput,
): Promise<Theme> {
  const [row] = await db
    .insert(themes)
    .values({ ...input, userId })
    .returning();
  return row;
}

export async function updateTheme(
  db: Database,
  userId: string,
  id: string,
  patch: Partial<ThemeInput>,
): Promise<Theme | undefined> {
  const [row] = await db
    .update(themes)
    .set(patch)
    .where(and(eq(themes.id, id), eq(themes.userId, userId)))
    .returning();
  return row;
}

export async function deleteTheme(
  db: Database,
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(themes)
    .where(and(eq(themes.id, id), eq(themes.userId, userId)))
    .returning({ id: themes.id });
  return rows.length > 0;
}
