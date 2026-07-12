import { NextResponse } from "next/server";
import { encrypt } from "../../../lib/crypto";
import {
  supabaseForToken,
  tokenFromRequest,
} from "../../../lib/serverSupabase";

export const runtime = "nodejs";

async function getUser(request) {
  const token = tokenFromRequest(request);
  if (!token) return { error: "unauthorized" };
  const sb = supabaseForToken(token);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return { error: "unauthorized" };
  return { sb, user: data.user };
}

// Проверка ключа реальным запросом к Anthropic API
async function verifyAnthropicKey(apiKey) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// GET → { hasKey: boolean }
export async function GET(request) {
  const { sb, user, error } = await getUser(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { data } = await sb
    .from("user_settings")
    .select("api_key_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ hasKey: !!data?.api_key_encrypted });
}

// POST { apiKey } → проверить и сохранить в зашифрованном виде
export async function POST(request) {
  const { sb, user, error } = await getUser(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const apiKey = (body.apiKey || "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  const valid = await verifyAnthropicKey(apiKey);
  if (!valid) {
    return NextResponse.json({ error: "invalid_key" }, { status: 422 });
  }

  const { error: dbError } = await sb.from("user_settings").upsert({
    user_id: user.id,
    api_key_encrypted: encrypt(apiKey),
    updated_at: new Date().toISOString(),
  });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
