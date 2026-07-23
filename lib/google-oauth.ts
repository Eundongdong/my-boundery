// Google OAuth 2.0 (docs/10) — 최소 스코프 openid/email/profile
import { appEnv, requireEnv } from "@/lib/env";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export function redirectUri(): string {
  return `${requireEnv("APP_URL")}/api/auth/callback`;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(
  code: string,
): Promise<{ access_token: string; id_token?: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`토큰 교환 실패: ${res.status}`);
  return (await res.json()) as { access_token: string; id_token?: string };
}

export type GoogleUser = { sub: string; email: string; name: string };

export async function fetchUserInfo(accessToken: string): Promise<GoogleUser> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`사용자 정보 조회 실패: ${res.status}`);
  const data = (await res.json()) as {
    sub: string;
    email?: string;
    name?: string;
  };
  return { sub: data.sub, email: data.email ?? "", name: data.name ?? data.email ?? "사용자" };
}

export function isConfigured(): boolean {
  return Boolean(
    appEnv.GOOGLE_OAUTH_CLIENT_ID &&
      appEnv.GOOGLE_OAUTH_CLIENT_SECRET &&
      appEnv.APP_URL,
  );
}
