import { NextResponse } from "next/server";
import {
  supabaseForToken,
  tokenFromRequest,
} from "../../../lib/serverSupabase";
import { getUserApiKey, callClaude, AI_MODEL } from "../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60; // генерация может занять до минуты

async function getUser(request) {
  const token = tokenFromRequest(request);
  if (!token) return { error: "unauthorized" };
  const sb = supabaseForToken(token);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return { error: "unauthorized" };
  return { sb, user: data.user };
}

function cacheKey(subjectName, topicName, lang) {
  return [
    subjectName.trim().toLowerCase(),
    topicName.trim().toLowerCase(),
    lang,
  ].join("|");
}

function buildPrompt(subjectName, topicName, lang) {
  const langName = lang === "ru" ? "Russian" : "English";
  const system = `You are an expert teacher writing theory pages for a self-study learning app used by school students.
Write entirely in ${langName}.
Output pure Markdown only — no code fence around the document, no preamble.
Math: LaTeX, inline $...$ and display $$...$$.
Where a visual helps, embed 2-3 simple self-contained SVG illustrations directly in the Markdown (<svg viewBox="..." width="100%" style="max-width:480px"> ... </svg>, no scripts, no external references; light colors, readable labels).
Structure strictly:
1. Title (# heading)
2. Intuitive explanation building up from basics to solid understanding
3. Key rules/formulas
4. Common mistakes and pitfalls
5. Section "Examples" (## heading) with exactly 4 fully worked examples, from easy to harder, each solved step by step with explanations.`;
  const prompt = `Subject: ${subjectName}
Topic: ${topicName}

Write the complete theory page for this topic.`;
  return { system, prompt };
}

// POST { subjectName, topicName, lang } → { content_md, cached }
export async function POST(request) {
  const { sb, user, error } = await getUser(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { subjectName, topicName, lang } = body;
  if (!subjectName || !topicName || !lang) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const key = cacheKey(subjectName, topicName, lang);

  // 1. Кэш: если теорию уже генерировали — отдать готовую
  const { data: cached } = await sb
    .from("theory_cache")
    .select("content_md")
    .eq("cache_key", key)
    .maybeSingle();
  if (cached) {
    return NextResponse.json({ content_md: cached.content_md, cached: true });
  }

  // 2. Ключ пользователя
  const apiKey = await getUserApiKey(sb, user.id);
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 409 });
  }

  // 3. Генерация
  const { system, prompt } = buildPrompt(subjectName, topicName, lang);
  let content;
  try {
    content = await callClaude(apiKey, { system, prompt, maxTokens: 6000 });
  } catch (e) {
    return NextResponse.json(
      { error: "ai_failed", detail: String(e.message).slice(0, 200) },
      { status: 502 }
    );
  }

  // 4. Сохранить в общий кэш (при гонке двух студентов — не падать)
  await sb.from("theory_cache").insert({
    cache_key: key,
    subject_name: subjectName,
    topic_name: topicName,
    language: lang,
    content_md: content,
    model: AI_MODEL,
    created_by: user.id,
  });

  return NextResponse.json({ content_md: content, cached: false });
}

// DELETE { subjectName, topicName, lang } → сброс кэша (перегенерация)
export async function DELETE(request) {
  const { sb, error } = await getUser(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { subjectName, topicName, lang } = body;
  if (!subjectName || !topicName || !lang) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await sb
    .from("theory_cache")
    .delete()
    .eq("cache_key", cacheKey(subjectName, topicName, lang));

  return NextResponse.json({ ok: true });
}
