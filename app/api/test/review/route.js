import { NextResponse } from "next/server";
import { LANGUAGE_NAMES } from "../../../../lib/i18n";
import { getUserFromRequest } from "../../../../lib/serverSupabase";
import {
  getUserAI,
  callAILogged,
  underDailyLimit,
  ageNote,
} from "../../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST { testId, index } → { explanation }
// Разбор одного задания завершённого теста. Результат сохраняется,
// повторные запросы бесплатны.
export async function POST(request) {
  const { sb, user, error } = await getUserFromRequest(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { testId, index } = body;
  if (!testId || index === undefined) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: test } = await sb
    .from("tests")
    .select("*")
    .eq("id", testId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!test || test.status !== "completed") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const i = Number(index);
  const task = test.tasks[i];
  const answer = test.answers[i];
  if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Уже разбирали — вернуть из сохранённого
  if (answer?.explanation) {
    return NextResponse.json({ explanation: answer.explanation });
  }

  const ai = await getUserAI(sb, user.id);
  if (!ai) return NextResponse.json({ error: "no_api_key" }, { status: 409 });
  if (!(await underDailyLimit(sb, user.id))) {
    return NextResponse.json({ error: "limit_reached" }, { status: 429 });
  }

  const langName = LANGUAGE_NAMES[test.language] || "English";
  const system = `You explain the correct solution of an exam problem to a student, in ${langName}, in Markdown.
Show the full correct solution step by step with brief explanations. Math in LaTeX ($...$, $$...$$).
If the student's answer is provided and wrong, first point out in 1-2 sentences where their mistake was, then give the correct solution. Keep it under 300 words.`;

  let explanation;
  try {
    explanation = await callAILogged(sb, user.id, "test_review", ai, {
      system,
      prompt: `Problem:
${task.task_md}

Student's answer: ${answer?.solution || "(no answer)"}
Verdict: ${answer?.correct ? "correct" : "incorrect"}

Explain the solution.${ageNote(ai)}`,
      maxTokens: 1500,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "ai_failed", detail: String(e.message).slice(0, 200) },
      { status: 502 }
    );
  }

  // Сохранить разбор в тест
  const answers = [...test.answers];
  answers[i] = { ...answers[i], explanation: explanation.trim() };
  await sb.from("tests").update({ answers }).eq("id", testId);

  return NextResponse.json({ explanation: explanation.trim() });
}
