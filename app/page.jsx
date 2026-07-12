"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import ApiKeyModal from "../components/ApiKeyModal";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = загрузка
  const [lang, setLang] = useState("ru");
  const [showApiKey, setShowApiKey] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("edututor_lang");
    if (saved) setLang(saved);

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) router.replace("/login");
  }, [session, router]);

  async function toggleLang() {
    const next = lang === "ru" ? "en" : "ru";
    setLang(next);
    localStorage.setItem("edututor_lang", next);
    // Сохраняем и в профиле пользователя
    if (session?.user) {
      await supabase
        .from("user_settings")
        .upsert({ user_id: session.user.id, language: next });
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function comingSoon() {
    setToast(t(lang, "comingSoon"));
    setTimeout(() => setToast(""), 2000);
  }

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center opacity-50">
        …
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        lang={lang}
        userEmail={session.user.email}
        onToggleLang={toggleLang}
        onOpenApiKey={() => setShowApiKey(true)}
        onLogout={logout}
        onComingSoon={comingSoon}
      />

      {/* Правая рабочая область */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold mb-3">
            {t(lang, "welcomeTitle")}
          </h1>
          <p className="opacity-70">{t(lang, "welcomeText")}</p>
        </div>
      </main>

      {showApiKey && (
        <ApiKeyModal lang={lang} onClose={() => setShowApiKey(false)} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white text-sm px-4 py-2 rounded-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
