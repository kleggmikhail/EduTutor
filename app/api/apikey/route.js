import { NextResponse } from "next/server";
import { encrypt } from "../../../lib/crypto";
import { PROVIDERS, verifyProviderKey } from "../../../lib/providers";
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

// GET → { hasKey: boolean, provider: string }
export async function GET(request) {
  const { sb, user, error } = await getUser(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const { data } = await sb
    .from("user_settings")
    .select("api_key_encrypted, provider")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    hasKey: !!data?.api_key_encrypted,
    provider: data?.provider || "anthropic",
  });
}

// POST { apiKey, provider } → проверить у провайдера и сохранить зашифрованным
export async function POST(request) {
  const { sb, user, error } = await getUser(request);
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const apiKey = (body.apiKey || "").trim();
  const provider = PROVIDERS[body.provider] ? body.provider : "anthropic";
  if (!apiKey) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  const valid = await verifyProviderKey(provider, apiKey);
  if (!valid) {
    return NextResponse.json({ error: "invalid_key" }, { status: 422 });
  }

  const { error: dbError } = await sb.from("user_settings").upsert({
    user_id: user.id,
    provider,
    api_key_encrypted: encrypt(apiKey),
    updated_at: new Date().toISOString(),
  });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
