// 세션 — 무상태 JWT(HS256) httpOnly 쿠키 (docs/10 §3)
// Web Crypto 로 서명·검증하여 Cloudflare Workers 런타임과 호환.
import { appEnv } from "@/lib/env";

const COOKIE_NAME = "mb_session";
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 30; // 30일(초)

type SessionPayload = { uid: string; iat: number; exp: number };

// ── base64url ──────────────────────────────────────────────
function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlEncodeStr(str: string): string {
  return b64urlEncode(new TextEncoder().encode(str));
}
function b64urlDecodeStr(str: string): string {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

// ── 토큰 생성/검증 ─────────────────────────────────────────
export async function createSessionToken(
  userId: string,
  maxAgeSec = DEFAULT_MAX_AGE,
): Promise<string> {
  const secret = appEnv.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET 가 설정되지 않았습니다.");
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { uid: userId, iat: now, exp: now + maxAgeSec };
  const body = b64urlEncodeStr(JSON.stringify(payload));
  const sig = await sign(body, secret);
  return `${body}.${sig}`;
}

export async function verifySessionToken(token: string): Promise<string | null> {
  const secret = appEnv.AUTH_SECRET;
  if (!secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await sign(body, secret);
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(b64urlDecodeStr(body)) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

// ── 쿠키 파싱/발급 ─────────────────────────────────────────
export function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** 요청 쿠키에서 세션 사용자 id 추출 (없거나 무효면 null) */
export async function getSessionUserId(request: Request): Promise<string | null> {
  const token = parseCookie(request.headers.get("cookie"), COOKIE_NAME);
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookie(token: string, maxAgeSec = DEFAULT_MAX_AGE): string {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ].join("; ");
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export { COOKIE_NAME };
