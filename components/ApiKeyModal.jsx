"use client";

import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";

export default function ApiKeyModal({ lang, onClose }) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("loading"); // loading | set | notset | saving | invalid | error
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        const res = await fetch("/api/apikey", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        setStatus(json.hasKey ? "set" : "notset");
        setEditing(!json.hasKey);
      } catch {
        setStatus("notset");
        setEditing(true);
      }
    })();
  }, []);

  async function save() {
    if (!key.trim()) return;
    setStatus("saving");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const res = await fetch("/api/apikey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ apiKey: key.trim() }),
      });
      if (res.ok) {
        onClose(); // сохранено успешно — окно закрывается само
      } else if (res.status === 422) {
        setStatus("invalid");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const showForm = editing || status === "invalid" || status === "error";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">{t(lang, "apiKeyTitle")}</h2>
        <p className="text-sm opacity-70 mb-3">{t(lang, "apiKeyHint")}</p>

        <div className="text-sm mb-3">
          {status === "loading" && (
            <span className="opacity-60">{t(lang, "loading")}</span>
          )}
          {status === "set" && (
            <span className="text-green-700">✓ {t(lang, "apiKeySet")}</span>
          )}
          {status === "notset" && (
            <span className="opacity-60">{t(lang, "apiKeyNotSet")}</span>
          )}
          {status === "invalid" && (
            <span className="text-red-700">{t(lang, "apiKeyInvalid")}</span>
          )}
          {status === "error" && (
            <span className="text-red-700">{t(lang, "errorGeneric")}</span>
          )}
        </div>

        {/* Ключ уже есть: оставить или заменить */}
        {!showForm && status === "set" && (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 rounded-lg hover:bg-black/5"
            >
              {t(lang, "replaceKey")}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-accent text-white"
            >
              {t(lang, "close")}
            </button>
          </div>
        )}

        {/* Ввод нового ключа */}
        {showForm && (
          <>
            <input
              type="password"
              autoFocus
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t(lang, "apiKeyPlaceholder")}
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
                disabled={status === "saving" || !key.trim()}
                className="px-4 py-2 rounded-lg bg-accent text-white disabled:opacity-50"
              >
                {status === "saving" ? t(lang, "saving") : t(lang, "save")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
