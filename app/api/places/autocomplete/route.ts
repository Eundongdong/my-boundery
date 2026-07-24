import { error, json, withAuth } from "@/lib/http";
import { autocomplete } from "@/lib/google-places";

// GET /api/places/autocomplete?q=&sessionToken=
export const GET = withAuth(async (_ctx, request) => {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  if (!q) return error("q 쿼리가 필요합니다.");
  const sessionToken = params.get("sessionToken") ?? undefined;
  const suggestions = await autocomplete(q, sessionToken);
  return json({ suggestions });
});
