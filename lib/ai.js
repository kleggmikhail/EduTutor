import { decrypt } from "./crypto";
import { callAIFull, PROVIDERS } from "./providers";

// Провайдер и расшифрованный ключ пользователя (или null)
export async function getUserAI(sb, userId) {
  const { data } = await sb
    .from("user_settings")
    .select("api_key_encrypted, provider, age")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.api_key_encrypted) return null;
  try {
    return {
      provider: PROVIDERS[data.provider] ? data.provider : "anthropic",
      apiKey: decrypt(data.api_key_encrypted),
      age: data.age || null,
    };
  } catch {
    return null;
  }
}

// Строка для промптов: адаптация под возраст студента
export function ageNote(ai) {
  return ai?.age
    ? `\nStudent age: ${ai.age} years old — adapt wording, depth and examples to this age.`
    : "";
}

// Вызов ИИ с записью расхода токенов в журнал ai_usage.
// ai = { provider, apiKey }; opts = { system, prompt, maxTokens }
export async function callAILogged(sb, userId, purpose, ai, opts) {
  const { text, usage, model } = await callAIFull(ai.provider, ai.apiKey, opts);
  try {
    await sb.from("ai_usage").insert({
      user_id: userId,
      purpose,
      model: `${ai.provider}:${model}`,
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
