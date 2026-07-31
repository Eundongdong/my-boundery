// Groq (OpenAI 호환) — AI 추천용 JSON 응답 (D8 확정: 무료 티어)
// 구조화 출력을 위해 response_format=json_object 사용.
import { appEnv, requireEnv } from "@/lib/env";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** JSON 객체를 반환하도록 요청하고 파싱. 실패 시 throw. */
export async function completeJson<T>(messages: ChatMessage[]): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("GROQ_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: appEnv.GROQ_MODEL || DEFAULT_MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI 요청 실패: ${res.status} ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 응답이 비어 있습니다.");
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("AI 응답을 JSON 으로 파싱하지 못했습니다.");
  }
}

export function isGroqConfigured(): boolean {
  return Boolean(appEnv.GROQ_API_KEY);
}
