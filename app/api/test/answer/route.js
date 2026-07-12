import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../lib/serverSupabase";
import { getUserApiKey, callClaude } from "../../../../lib/ai";
import {
  TEST_LENGTH,
  taskSystem,
  taskPrompt,
  gradeSystem,
  finalSystem,
} from "../../../../lib/testPrompts";

export const runtime = "nodejs";
export const maxDuration = 60;

function extractJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

// POST { testId, solution, timeSec }
// → { done:false, index, total, task_md }  или  { done:true, score, total, grade_md }
export async function POST(request) {
  const { sb, user, error } = await getUserFromRequest(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { testId, solution, timeSec } = body;
  if (!testId || !solution) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: test } = await sb
    .from("tests")
    .select("*")
    .eq("id", testId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!test || test.status !== "in_progress") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const apiKey = await getUserApiKey(sb, user.id);
  if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 409 });

  const idx = test.current_index;
  const currentTask = test.tasks[idx];
  const langName = test.language === "ru" ? "Russian" : "English";

  // 1. Проверить ответ
  let verdict = { correct: false, note: "" };
  try {
    const raw = await callClaude(apiKey, {
      system: gradeSystem(),
      prompt: `Problem:\n${currentTask.task_md}\n\nStudent's solution:\n${solution}\n\nReturn JSON only.`,
      maxTokens: 300,
    });
    verdict = extractJson(raw) || verdict;
  } catch (e) {
    return NextResponse.json(
      { error: "ai_failed", detail: String(e.message).slice(0, 200) },
      { status: 502 }
    );
  }

  const answers = [
    ...test.answers,
    {
      solution: String(solution).slice(0, 4000),
      correct: !!verdict.correct,
      note: verdict.note || "",
      time_sec: timeSec ? Number(timeSec) : null,
    },
  ];

  // 2а. Есть следующее задание — сгенерировать
  if (idx + 1 < TEST_LENGTH) {
    let nextTask;
    try {
      nextTask = await callClaude(apiKey, {
        system: taskSystem(langName),
        prompt: taskPrompt({
          subjectName: test.subject_name,
          topicPath: test.topic_path,
          difficulty: test.difficulties[idx + 1],
          previous: test.tasks.map((t) => t.task_md),
        }),
        maxTokens: 1200,
      });
    } catch (e) {
      return NextResponse.json(
        { error: "ai_failed", detail: String(e.message).slice(0, 200) },
        { status: 502 }
      );
    }

    const tasks = [
      ...test.tasks,
      { task_md: nextTask.trim(), difficulty: test.difficulties[idx + 1] },
    ];
    await sb
      .from("tests")
      .update({ answers, tasks, current_index: idx + 1 })
      .eq("id", testId);

    return NextResponse.json({
      done: false,
      index: idx + 1,
      total: TEST_LENGTH,
      task_md: nextTask.trim(),
    });
  }

  // 2б. Тест завершён — итоговая оценка
  const score = answers.filter((a) => a.correct).length;
  const summary = answers
    .map(
      (a, i) =>
        `Q${i + 1} (difficulty ${test.difficulties[i]}/10): ${
          a.correct ? "correct" : "incorrect"
        }${a.note ? ` — ${a.note}` : ""}`
    )
    .join("\n");

  let gradeMd;
  try {
    gradeMd = await callClaude(apiKey, {
      system: finalSystem(langName),
      prompt: `Subject: ${test.subject_name}
Topic: ${test.topic_path}
Score: ${score}/${TEST_LENGTH}
Results:
${summary}

Write the final evaluation.`,
      maxTokens: 2000,
    });
  } catch (e) {
    gradeMd = `**${score}/${TEST_LENGTH}**`;
  }

  await sb
    .from("tests")
    .update({
      answers,
      current_index: idx + 1,
      status: "completed",
      score,
      grade_md: gradeMd,
      finished_at: new Date().toISOString(),
    })
    .eq("id", testId);

  return NextResponse.json({
    done: true,
    score,
    total: TEST_LENGTH,
    grade_md: gradeMd,
  });
}
