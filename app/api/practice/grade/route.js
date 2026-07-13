import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../lib/serverSupabase";
import { getUserAI, callAILogged, underDailyLimit } from "../../../../lib/ai";

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

// POST { taskMd, difficulty, solutionText, imageBase64, imageMediaType,
//        timeSec, topicId, topicPath, subjectName, lang }
// → { correct, feedback_md, nextDifficulty }
export async function POST(request) {
  const { sb, user, error } = await getUserFromRequest(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const {
    taskMd,
    difficulty,
    solutionText,
    imageBase64,
    imageMediaType,
    timeSec,
    topicId,
    topicPath,
    subjectName,
    lang,
  } = body;

  if (!taskMd || !difficulty || !lang || (!solutionText && !imageBase64)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const ai = await getUserAI(sb, user.id);
  if (!ai) return NextResponse.json({ error: "no_api_key" }, { status: 409 });
  if (!(await underDailyLimit(sb, user.id))) {
    return NextResponse.json({ error: "limit_reached" }, { status: 429 });
  }

  const langName = lang === "ru" ? "Russian" : "English";
  const system = `You grade a student's solution to a practice problem in a learning app.
The student MUST show the solution steps (the chain of work: transformations, calculations).
A verbal explanation of WHY each step is done is welcome but NOT required — never penalize its absence.
A bare final answer with no intermediate steps is unacceptable.
Respond in ${langName}.
Return ONLY valid JSON, no other text:
{"correct": true|false, "feedback": "markdown string"}
Rules for feedback:
- If correct: short praise + note anything that could be cleaner.
- If incorrect: point out exactly WHERE the mistake is and explain the misunderstood concept. Do NOT give the full correct solution — guide the student to retry.
- If only a bare answer with no steps: mark correct=false and ask to show the solution steps.
Math in LaTeX ($...$, $$...$$). Escape the JSON string properly.`;

  const textPart = `Problem:
${taskMd}

Student's solution${imageBase64 ? " (see attached image; typed text, if any, is below)" : ""}:
${solutionText || "(solution is in the attached image)"}

Time spent: ${timeSec || "?"} seconds. Grade it now, return JSON only.`;

  const content = imageBase64
    ? [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: imageMediaType || "image/png",
            data: imageBase64,
          },
        },
        { type: "text", text: textPart },
      ]
    : textPart;

  let raw;
  try {
    raw = await callAILogged(sb, user.id, "practice_grade", ai, {
      system,
      prompt: content,
      maxTokens: 2000,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "ai_failed", detail: String(e.message).slice(0, 200) },
      { status: 502 }
    );
  }

  const parsed = extractJson(raw) || {
    correct: false,
    feedback: raw.slice(0, 1500),
  };
  const correct = !!parsed.correct;
  const nextDifficulty = correct
    ? Math.min(10, Number(difficulty) + 1)
    : Number(difficulty);

  // Сохранить попытку в историю обучения
  await sb.from("practice_attempts").insert({
    user_id: user.id,
    topic_id: topicId || null,
    topic_path: topicPath || "",
    subject_name: subjectName || "",
    language: lang,
    difficulty: Number(difficulty),
    task_md: taskMd,
    solution_text: solutionText || null,
    used_image: !!imageBase64,
    correct,
    feedback_md: parsed.feedback || "",
    time_sec: timeSec ? Number(timeSec) : null,
  });

  return NextResponse.json({
    correct,
    feedback_md: parsed.feedback || "",
    nextDifficulty,
  });
}
