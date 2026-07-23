import { getDb } from "@/db";
import { exchangeCode, fetchUserInfo } from "@/lib/google-oauth";
import { createSessionToken, parseCookie, sessionCookie } from "@/lib/session";
import { upsertByGoogle } from "@/lib/repositories/users";

const STATE_COOKIE = "mb_oauth_state";

// GET /api/auth/callback?code=&state= → 토큰 교환·사용자 upsert·세션 발급
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = parseCookie(request.headers.get("cookie"), STATE_COOKIE);

  if (!code || !state || !cookieState || state !== cookieState) {
    return Response.json({ error: "잘못된 인증 요청입니다." }, { status: 400 });
  }

  try {
    const { access_token } = await exchangeCode(code);
    const profile = await fetchUserInfo(access_token);
    const db = getDb();
    const user = await upsertByGoogle(db, {
      googleAccountId: profile.sub,
      email: profile.email,
      displayName: profile.name,
    });

    const token = await createSessionToken(user.id);
    const headers = new Headers({ Location: "/" });
    headers.append("Set-Cookie", sessionCookie(token));
    // state 쿠키 제거
    headers.append(
      "Set-Cookie",
      `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    );
    return new Response(null, { status: 302, headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : "인증 처리 중 오류";
    return Response.json({ error: message }, { status: 500 });
  }
}
