import { NextResponse } from "next/server";
import { LANGUAGE_NAMES } from "../../../../lib/i18n";
import { getUserFromRequest } from "../../../../lib/serverSupabase";
import { getUserAI, callAILogged, underDailyLimit } from "../../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST { subjectName, topicName, lang, question, history, theory } → { answer }
export async function POST(request) {
  const { sb, user, error } = await getUserFromRequest(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { subjectName, topicName, lang, question, history, theory } = body;
  if (!subjectName || !topicName || !lang || !question) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const ai = await getUserAI(sb, user.id);
  if (!ai) return NextResponse.json({ error: "no_api_key" }, { status: 409 });
  if (!(await underDailyLimit(sb, user.id))) {
    return NextResponse.json({ error: "limit_reached" }, { status: 429 });
  }

  const langName = LANGUAGE_NAMES[lang] || "English";
  const system = `You are a friendly, patient tutor inside a learning app.
The student is reading the theory page (provided below) and asks questions about it.
Answer in ${langName}, clearly and concisely (usually under 250 words), in Markdown.
Math in LaTeX: inline $...$, display $$...$$. Explain step by step where helpful.
Stay on the study topic; if the question is unrelated to learning, gently steer back.`;

  const dialog = (Array.isArray(history) ? history.slice(-6) : [])
    .map(
      (m) =>
        `${m.role === "user" ? "Student" : "Tutor"}: ${String(m.text).slice(
          0,
          1500
        )}`
    )
    .join("\n");

  const prompt = `Subject: ${subjectName}
Topic: ${topicName}

Theory page (context):
${String(theory || "").slice(0, 8000)}

${dialog ? `Conversation so far:\n${dialog}\n` : ""}
Student's question: ${String(question).slice(0, 2000)}

Answer the question.`;

  try {
    const answer = await callAILogged(sb, user.id, "theory_qa", ai, {
      system,
      prompt,
      maxTokens: 1500,
    });
    return NextResponse.json({ answer: answer.trim() });
  } catch (e) {
    return NextResponse.json(
      { error: "ai_failed", detail: String(e.message).slice(0, 200) },
      { status: 502 }
    );
  }
}
