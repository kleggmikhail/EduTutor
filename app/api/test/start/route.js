import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../lib/serverSupabase";
import { getUserAI, callAILogged, underDailyLimit } from "../../../../lib/ai";
import {
  DIFFICULTY_SCHEDULE,
  TEST_LENGTH,
  taskSystem,
  taskPrompt,
} from "../../../../lib/testPrompts";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST { subjectName, topicPath, topicId, lang }
// → { testId, index, total, task_md } (новый тест или продолжение)
export async function POST(request) {
  const { sb, user, error } = await getUserFromRequest(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { subjectName, topicPath, topicId, lang } = body;
  if (!subjectName || !topicPath || !lang) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Есть ли незавершённый тест по теме — продолжить
  const { data: existing } = await sb
    .from("tests")
    .select("id, current_index, tasks")
    .eq("user_id", user.id)
    .eq("topic_path", topicPath)
    .eq("language", lang)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && existing.tasks.length > existing.current_index) {
    return NextResponse.json({
      testId: existing.id,
      index: existing.current_index,
      total: TEST_LENGTH,
      task_md: existing.tasks[existing.current_index].task_md,
      resumed: true,
    });
  }

  const ai = await getUserAI(sb, user.id);
  if (!ai) return NextResponse.json({ error: "no_api_key" }, { status: 409 });
  if (!(await underDailyLimit(sb, user.id))) {
    return NextResponse.json({ error: "limit_reached" }, { status: 429 });
  }

  // Первое задание
  const langName = lang === "ru" ? "Russian" : "English";
  let task;
  try {
    task = await callAILogged(sb, user.id, "test_task", ai, {
      system: taskSystem(langName),
      prompt: taskPrompt({
        subjectName,
        topicPath,
        difficulty: DIFFICULTY_SCHEDULE[0],
        previous: [],
      }),
      maxTokens: 1200,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "ai_failed", detail: String(e.message).slice(0, 200) },
      { status: 502 }
    );
  }

  const { data: created, error: dbError } = await sb
    .from("tests")
    .insert({
      user_id: user.id,
      topic_id: topicId || null,
      topic_path: topicPath,
      subject_name: subjectName,
      language: lang,
      difficulties: DIFFICULTY_SCHEDULE,
      tasks: [{ task_md: task.trim(), difficulty: DIFFICULTY_SCHEDULE[0] }],
    })
    .select("id")
    .single();

  if (dbError || !created) {
    return NextResponse.json({ error: "db_failed" }, { status: 500 });
  }

  return NextResponse.json({
    testId: created.id,
    index: 0,
    total: TEST_LENGTH,
    task_md: task.trim(),
    resumed: false,
  });
}
