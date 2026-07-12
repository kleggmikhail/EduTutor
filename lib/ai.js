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
export async function callClaude(apiKey, opts) {
  const { text } = await callClaudeFull(apiKey, opts);
  return text;
}

export async function callClaudeFull(
  apiKey,
  { system, prompt, maxTokens = 6000 }
) {
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
  const text = (json.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, usage: json.usage || null };
}

// Вызов с записью расхода токенов в журнал ai_usage
export async function callClaudeLogged(sb, userId, purpose, apiKey, opts) {
  const { text, usage } = await callClaudeFull(apiKey, opts);
  try {
    await sb.from("ai_usage").insert({
      user_id: userId,
      purpose,
      model: AI_MODEL,
      input_tokens: usage?.input_tokens || 0,
      output_tokens: usage?.output_tokens || 0,
    });
  } catch {}
  return text;
}

// Дневной лимит обращений к ИИ (защита от случайного расхода баланса)
export async function underDailyLimit(sb, userId) {
  const limit = Number(process.env.DAILY_AI_LIMIT || 300);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await sb
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  return (count || 0) < limit;
}
