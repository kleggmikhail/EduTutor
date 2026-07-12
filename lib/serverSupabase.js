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
