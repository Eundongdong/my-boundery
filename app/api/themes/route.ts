import { error, json, readJson, withAuth } from "@/lib/http";
import { createTheme, listThemes, type ThemeInput } from "@/lib/repositories/themes";

export const GET = withAuth(async ({ db, userId }) => {
  return json({ themes: await listThemes(db, userId) });
});

export const POST = withAuth(async ({ db, userId }, request) => {
  const body = await readJson<Partial<ThemeInput>>(request);
  if (!body.name?.trim()) return error("name 은 필수입니다.");
  const theme = await createTheme(db, userId, {
    name: body.name.trim(),
    icon: body.icon,
    color: body.color,
  });
  return json({ theme }, { status: 201 });
});
