import { error, json, readJson, withAuth } from "@/lib/http";
import { deleteTheme, updateTheme, type ThemeInput } from "@/lib/repositories/themes";

export const PATCH = withAuth(async ({ db, userId }, request, params) => {
  const patch = await readJson<Partial<ThemeInput>>(request);
  const theme = await updateTheme(db, userId, params.id, patch);
  if (!theme) return error("테마를 찾을 수 없습니다.", 404);
  return json({ theme });
});

export const DELETE = withAuth(async ({ db, userId }, _request, params) => {
  const ok = await deleteTheme(db, userId, params.id);
  if (!ok) return error("테마를 찾을 수 없습니다.", 404);
  return json({ ok: true });
});
