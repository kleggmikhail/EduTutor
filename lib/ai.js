import { decrypt } from "./crypto";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Получить и расшифровать API-ключ пользователя
export async function getUserApiKey(sb, userId) {
  const { data } = await sb
    .from("user_settings")
    .select("api_key_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.api_key_encrypted) return null;
  try {
    return decrypt(data.api_key_encrypted);
  } catch {
    return null;
  }
}

// Вызов Anthropic Messages API.
// prompt — строка ИЛИ массив контент-блоков (для изображений).
export async function callClaude(apiKey, { system, prompt, maxTokens = 6000 }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`anthropic ${res.status}: ${err.slice(0, 300)}`);
  }
  const json = await res.json();
  return (json.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
