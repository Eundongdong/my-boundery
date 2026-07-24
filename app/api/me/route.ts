import { json, withAuth } from "@/lib/http";
import { findById } from "@/lib/repositories/users";

// GET /api/me → 현재 로그인 사용자 (미인증이면 401)
export const GET = withAuth(async ({ db, userId }) => {
  const user = await findById(db, userId);
  if (!user) return json({ user: null }, { status: 401 });
  return json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  });
});
