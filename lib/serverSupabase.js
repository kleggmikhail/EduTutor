import { createClient } from "@supabase/supabase-js";

// Серверный клиент, действующий от имени пользователя (его JWT).
// RLS-политики Supabase гарантируют доступ только к своим данным.
export function supabaseForToken(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export function tokenFromRequest(request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

// Авторизованный пользователь из запроса: { sb, user } или { error }
export async function getUserFromRequest(request) {
  const token = tokenFromRequest(request);
  if (!token) return { error: "unauthorized" };
  const sb = supabaseForToken(token);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return { error: "unauthorized" };
  return { sb, user: data.user };
}
