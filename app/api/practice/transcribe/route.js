import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../lib/serverSupabase";
import {
  getUserApiKey,
  callClaudeLogged,
  underDailyLimit,
} from "../../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST { imageBase64, imageMediaType, lang } → { text }
export async function POST(request) {
  const { sb, user, error } = await getUserFromRequest(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { imageBase64, imageMediaType, lang } = body;
  if (!imageBase64) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const apiKey = await getUserApiKey(sb, user.id);
  if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 409 });
  if (!(await underDailyLimit(sb, user.id))) {
    return NextResponse.json({ error: "limit_reached" }, { status: 429 });
  }

  const langName = lang === "ru" ? "Russian" : "English";
  const system = `You transcribe a student's handwritten or typed solution from an image into plain text.
Output ONLY the transcription, nothing else — no comments, no grading, no corrections (keep the student's mistakes as written).
Use simple math notation: ^ for powers, √() for roots, × ÷ for multiplication/division, a/b for fractions.
Keep the student's language (likely ${langName}). Preserve the step-by-step structure with line breaks.
If the image contains no readable solution, output exactly: [empty]`;

  try {
    const text = await callClaudeLogged(sb, user.id, "transcribe", apiKey, {
      system,
      prompt: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: imageMediaType || "image/png",
            data: imageBase64,
          },
        },
        { type: "text", text: "Transcribe the solution from this image." },
      ],
      maxTokens: 2000,
    });
    const clean = text.trim() === "[empty]" ? "" : text.trim();
    return NextResponse.json({ text: clean });
  } catch (e) {
    return NextResponse.json(
      { error: "ai_failed", detail: String(e.message).slice(0, 200) },
      { status: 502 }
    );
  }
}
