"use client";

import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";

export default function ApiKeyModal({ lang, onClose }) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("loading"); // loading | set | notset | saving | invalid | error
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        const res = await fetch("/api/apikey", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        setHasKey(!!json.hasKey);
        setStatus(json.hasKey ? "set" : "notset");
      } catch {
        setStatus("notset");
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
        setHasKey(true);
        setStatus("set");
        setKey("");
      } else if (res.status === 422) {
        setStatus("invalid");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-2">{t(lang, "apiKeyTitle")}</h2>
        <p className="text-sm opacity-70 mb-3">{t(lang, "apiKeyHint")}</p>

        <div className="text-sm mb-3">
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

        <input
          type="password"
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
            disabled={status === "saving"}
            className="px-4 py-2 rounded-lg bg-accent text-white disabled:opacity-50"
          >
            {status === "saving" ? t(lang, "saving") : t(lang, "save")}
          </button>
        </div>
      </div>
    </div>
  );
}
