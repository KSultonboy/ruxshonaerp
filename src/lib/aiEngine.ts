// AI Engine — backend /ai/chat endpointiga murojaat qiladi
// Backend Groq API (Llama 3.3 70B) bilan tool-calling orqali javob beradi

import { apiFetch } from "@/services/http";

export type AiResult = {
  text: string;
  table?: { headers: string[]; rows: (string | number)[][] };
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function handleAiQuery(
  message: string,
  history: ChatMessage[] = []
): Promise<AiResult> {
  const data = await apiFetch<{ reply: string }>("/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  return { text: data.reply };
}
