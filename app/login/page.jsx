"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "../../lib/i18n";
import { supabase } from "../../lib/supabaseClient";
import { applyThemePref, loadThemePref } from "../../lib/theme";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // signin | signup
  const [lang, setLang] = useState("ru");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("edututor_lang");
    if (saved) setLang(saved);
    applyThemePref(loadThemePref());
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) setMsg(error.message);
        else router.replace("/");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) setMsg(error.message);
        else setMsg(t(lang, "signUpDone"));
      }
    } finally {
      setBusy(false);
    }
  }

  function toggleLang() {
    const next = lang === "ru" ? "en" : "ru";
    setLang(next);
    localStorage.setItem("edututor_lang", next);
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="w-full max-w-sm p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">{t(lang, "appName")}</h1>
          <button
            onClick={toggleLang}
            className="text-sm px-3 py-1 rounded-lg hover:bg-black/5"
          >
            {lang.toUpperCase()}
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("signin")}
            className={`flex-1 py-2 rounded-lg text-sm ${
              mode === "signin" ? "bg-accent text-white" : "bg-black/5"
            }`}
          >
            {t(lang, "signIn")}
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 rounded-lg text-sm ${
              mode === "signup" ? "bg-accent text-white" : "bg-black/5"
            }`}
          >
            {t(lang, "signUp")}
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t(lang, "email")}
            className="w-full border border-black/20 rounded-lg px-3 py-2 bg-white"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t(lang, "password")}
            className="w-full border border-black/20 rounded-lg px-3 py-2 bg-white"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 rounded-lg bg-accent text-white disabled:opacity-50"
          >
            {mode === "signin" ? t(lang, "signIn") : t(lang, "signUp")}
          </button>
        </form>

        {msg && <p className="mt-4 text-sm opacity-80">{msg}</p>}
      </div>
    </div>
  );
}
