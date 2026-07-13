"use client";

import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";

// Профиль: возраст студента — ИИ адаптирует объяснения и задания
export default function ProfileModal({ lang, session, onClose }) {
  const [age, setAge] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("age")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data?.age) setAge(String(data.age));
    })();
  }, [session.user.id]);

  async function save() {
    const n = parseInt(age, 10);
    setBusy(true);
    await supabase.from("user_settings").upsert({
      user_id: session.user.id,
      age: n >= 5 && n <= 99 ? n : null,
    });
    setBusy(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6 animate-pop">
        <h2 className="text-lg font-semibold mb-2">{t(lang, "profile")}</h2>
        <p className="text-sm opacity-70 mb-4">{t(lang, "ageHint")}</p>

        <label className="block text-sm opacity-70 mb-1">
          {t(lang, "ageLbl")}
        </label>
        <input
          type="number"
          min={5}
          max={99}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder={t(lang, "agePh")}
          className="w-full border border-black/20 rounded-lg px-3 py-2 mb-4 bg-white"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg hover:bg-black/5"
          >
            {t(lang, "cancel")}
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-accent text-white disabled:opacity-50"
          >
            {busy ? t(lang, "saving") : t(lang, "save")}
          </button>
        </div>
      </div>
    </div>
  );
}
