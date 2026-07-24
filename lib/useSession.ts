"use client";

// 현재 로그인 사용자 조회 훅 (docs/10). 미로그인이면 user=null → 데모 모드.
import { useEffect, useState } from "react";
import { api, type SessionUser } from "@/lib/api-client";

export type SessionState = {
  user: SessionUser | null;
  loading: boolean;
};

export function useSession(): SessionState {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((u) => {
        if (active) setUser(u);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { user, loading };
}
