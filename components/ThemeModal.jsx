"use client";

import { useState } from "react";
import { t } from "../lib/i18n";
import { loadThemePref, saveThemePref } from "../lib/theme";

const OPTIONS = [
  { id: "light", icon: "☀️" },
  { id: "dark", icon: "🌙" },
  { id: "system", icon: "💻" },
];

export default function ThemeModal({ lang, onClose }) {
  const [pref, setPref] = useState(loadThemePref());

  function choose(id) {
    setPref(id);
    saveThemePref(id); // применяется мгновенно
  }

  const label = {
    light: t(lang, "themeLight"),
    dark: t(lang, "themeDark"),
    system: t(lang, "themeSystem"),
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-4">{t(lang, "theme")}</h2>

        <div className="space-y-2 mb-4">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => choose(o.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                pref === o.id
                  ? "border-accent bg-accent/10"
                  : "border-black/10 hover:bg-black/5"
              }`}
            >
              <span className="mr-2">{o.icon}</span>
              {label[o.id]}
              {pref === o.id && <span className="float-right text-accent">✓</span>}
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-accent text-white"
          >
            {t(lang, "close")}
          </button>
        </div>
      </div>
    </div>
  );
}
