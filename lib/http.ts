// API 라우트 공통 헬퍼 (docs/04 §3)
import { getDb, type Database } from "@/db";
import { getSessionUserId } from "@/lib/session";

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function error(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

/** 인증된 사용자 컨텍스트 (userId + db). 미인증이면 null. */
export type AuthContext = { userId: string; db: Database };

export async function getAuth(request: Request): Promise<AuthContext | null> {
  const userId = await getSessionUserId(request);
  if (!userId) return null;
  return { userId, db: getDb() };
}

/**
 * 인증 필수 라우트 래퍼. 미인증이면 401, 예외는 500 으로 변환.
 * 사용: export const GET = withAuth(async ({ userId, db }, req) => { ... })
 */
export function withAuth(
  handler: (ctx: AuthContext, request: Request, params: Record<string, string>) => Promise<Response>,
) {
  return async (
    request: Request,
    context?: { params?: Promise<Record<string, string>> },
  ): Promise<Response> => {
    try {
      const ctx = await getAuth(request);
      if (!ctx) return error("로그인이 필요합니다.", 401);
      const params = (await context?.params) ?? {};
      return await handler(ctx, request, params);
    } catch (e) {
      const message = e instanceof Error ? e.message : "예상치 못한 오류";
      return error(message, 500);
    }
  };
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
