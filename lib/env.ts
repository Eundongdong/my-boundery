// 환경 바인딩 타입 접근 (docs/04 §5, docs/10 §5)
// cloudflare:workers 의 env 를 앱에서 쓰는 타입으로 노출.
// 시크릿은 배포 환경/시크릿 매니저로 주입하며 리포에 커밋하지 않는다.
import { env } from "cloudflare:workers";

export type AppEnv = {
  DB: unknown; // D1Database (db/index.ts 에서 사용)
  AUTH_SECRET?: string; // 세션 서명
  GOOGLE_OAUTH_CLIENT_ID?: string; // 로그인 전용
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  KAKAO_REST_API_KEY?: string; // Kakao Local — 지오코딩·장소검색 (서버 전용, D7 개정)
  APP_URL?: string; // 예: https://my-boundary.example.com
};

export const appEnv = env as unknown as AppEnv;

export function requireEnv<K extends keyof AppEnv>(key: K): NonNullable<AppEnv[K]> {
  const value = appEnv[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`환경변수 ${String(key)} 가 설정되지 않았습니다.`);
  }
  return value as NonNullable<AppEnv[K]>;
}
