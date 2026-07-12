import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../lib/serverSupabase";
import {
  getUserApiKey,
  callClaudeLogged,
  underDailyLimit,
} from "../../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const DIFFICULTY_GUIDE = `Difficulty scale 1-10:
1-2 = elementary basics (single simple step),
3-4 = middle school (2-3 steps),
5-6 = high school (multi-step, requires understanding),
7-8 = advanced / competition-flavored high school,
9-10 = university level.`;

// POST { subjectName, topicPath, topicId, lang, difficulty } → { task_md }
export async function POST(request) {
  const { sb, user, error } = await getUserFromRequest(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { subjectName, topicPath, topicId, lang, difficulty } = body;
  if (!subjectName || !topicPath || !lang || !difficulty) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const apiKey = await getUserApiKey(sb, user.id);
  if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 409 });
  if (!(await underDailyLimit(sb, user.id))) {
    return NextResponse.json({ error: "limit_reached" }, { status: 429 });
  }

  // Антиповторы: последние задания студента по этой теме
  let recent = [];
  if (topicId) {
    const { data } = await sb
      .from("practice_attempts")
      .select("task_md")
      .eq("user_id", user.id)
      .eq("topic_id", topicId)
      .order("created_at", { ascending: false })
      .limit(8);
    recent = (data || []).map((r) => r.task_md.slice(0, 200));
  }

  const langName = lang === "ru" ? "Russian" : "English";
  const system = `You create ONE practice problem for a self-study learning app.
Write entirely in ${langName}. Output pure Markdown of the problem statement ONLY — no solution, no answer, no hints, no preamble.
Math in LaTeX: inline $...$, display $$...$$.
${DIFFICULTY_GUIDE}
The problem must be solvable with pen and paper and have a definite verifiable answer.`;

  const prompt = `Subject: ${subjectName}
Topic: ${topicPath}
Required difficulty: ${difficulty}/10
${
  recent.length
    ? `\nThe student already saw these problems — create something CLEARLY DIFFERENT (different numbers, structure and angle):\n${recent
        .map((r, i) => `${i + 1}. ${r}`)
        .join("\n")}`
    : ""
}
Create the problem now.`;

  try {
    const task = await callClaudeLogged(sb, user.id, "practice_task", apiKey, {
      system,
      prompt,
      maxTokens: 1500,
    });
    return NextResponse.json({ task_md: task.trim() });
  } catch (e) {
    return NextResponse.json(
      { error: "ai_failed", detail: String(e.message).slice(0, 200) },
      { status: 502 }
    );
  }
}
