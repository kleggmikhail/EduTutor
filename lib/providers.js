// Поддерживаемые провайдеры ИИ и адаптеры их API.
// Внутренний формат промпта — как у Anthropic: строка или массив блоков
// [{type:"text",text}, {type:"image", source:{type:"base64", media_type, data}}]

export const PROVIDERS = {
  anthropic: {
    label: "Anthropic (Claude)",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    vision: true,
  },
  openai: {
    label: "OpenAI (GPT)",
    base: "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4o",
    vision: true,
  },
  google: {
    label: "Google (Gemini)",
    model: process.env.GOOGLE_MODEL || "gemini-2.5-flash",
    vision: true,
  },
  glm: {
    label: "GLM (Zhipu)",
    base: "https://open.bigmodel.cn/api/paas/v4",
    model: process.env.GLM_MODEL || "glm-4-plus",
    visionModel: process.env.GLM_VISION_MODEL || "glm-4v-plus",
    vision: true,
  },
  deepseek: {
    label: "DeepSeek",
    base: "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    vision: false, // изображения не поддерживаются
  },
};

function hasImages(prompt) {
  return Array.isArray(prompt) && prompt.some((b) => b.type === "image");
}

// Универсальный вызов: → { text, usage:{input_tokens,output_tokens}, model }
export async function callAIFull(provider, apiKey, opts) {
  const cfg = PROVIDERS[provider] || PROVIDERS.anthropic;
  if (hasImages(opts.prompt) && !cfg.vision) {
    throw new Error("provider_no_vision: this provider does not support images");
  }
  if (provider === "google") return googleCall(cfg, apiKey, opts);
  if (cfg.base) return openaiCall(cfg, apiKey, opts);
  return anthropicCall(cfg, apiKey, opts);
}

// --- Anthropic (нативный формат) ---
async function anthropicCall(cfg, apiKey, { system, prompt, maxTokens = 6000 }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
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
  return {
    text,
    usage: {
      input_tokens: json.usage?.input_tokens || 0,
      output_tokens: json.usage?.output_tokens || 0,
    },
    model: cfg.model,
  };
}

// --- OpenAI-совместимые (OpenAI, GLM, DeepSeek) ---
function toOpenAiContent(prompt) {
  if (!Array.isArray(prompt)) return prompt;
  return prompt.map((b) =>
    b.type === "image"
      ? {
          type: "image_url",
          image_url: {
            url: `data:${b.source.media_type};base64,${b.source.data}`,
          },
        }
      : { type: "text", text: b.text }
  );
}

async function openaiCall(cfg, apiKey, { system, prompt, maxTokens = 6000 }) {
  const model =
    hasImages(prompt) && cfg.visionModel ? cfg.visionModel : cfg.model;
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: toOpenAiContent(prompt) },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`${cfg.label} ${res.status}: ${err.slice(0, 300)}`);
  }
  const json = await res.json();
  return {
    text: json.choices?.[0]?.message?.content || "",
    usage: {
      input_tokens: json.usage?.prompt_tokens || 0,
      output_tokens: json.usage?.completion_tokens || 0,
    },
    model,
  };
}

// --- Google Gemini ---
async function googleCall(cfg, apiKey, { system, prompt, maxTokens = 6000 }) {
  const parts = Array.isArray(prompt)
    ? prompt.map((b) =>
        b.type === "image"
          ? {
              inline_data: {
                mime_type: b.source.media_type,
                data: b.source.data,
              },
            }
          : { text: b.text }
      )
    : [{ text: prompt }];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`google ${res.status}: ${err.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = (json.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("");
  return {
    text,
    usage: {
      input_tokens: json.usageMetadata?.promptTokenCount || 0,
      output_tokens: json.usageMetadata?.candidatesTokenCount || 0,
    },
    model: cfg.model,
  };
}

// Проверка ключа реальным запросом
export async function verifyProviderKey(provider, apiKey) {
  try {
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      return r.ok;
    }
    if (provider === "google") {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      return r.ok;
    }
    if (provider === "openai" || provider === "deepseek") {
      const cfg = PROVIDERS[provider];
      const r = await fetch(`${cfg.base}/models`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      return r.ok;
    }
    if (provider === "glm") {
      // Дешёвый пробный запрос (у GLM нет публичного GET /models)
      const cfg = PROVIDERS.glm;
      const r = await fetch(`${cfg.base}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      return r.ok;
    }
    return false;
  } catch {
    return false;
  }
}
