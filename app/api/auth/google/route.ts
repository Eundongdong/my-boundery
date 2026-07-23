import { buildAuthUrl, isConfigured } from "@/lib/google-oauth";

const STATE_COOKIE = "mb_oauth_state";

// GET /api/auth/google → Google 동의 화면으로 리다이렉트 (CSRF state 쿠키 발급)
export async function GET(): Promise<Response> {
  if (!isConfigured()) {
    return Response.json(
      { error: "Google OAuth 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }
  const state = crypto.randomUUID();
  const url = buildAuthUrl(state);
  const headers = new Headers({ Location: url });
  headers.append(
    "Set-Cookie",
    `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  );
  return new Response(null, { status: 302, headers });
}

export { STATE_COOKIE };
