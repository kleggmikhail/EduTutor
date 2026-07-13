"use client";

import { t, LANGS } from "../lib/i18n";

export default function LanguageModal({ lang, onPick, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6 animate-pop">
        <h2 className="text-lg font-semibold mb-4">{t(lang, "language")}</h2>

        <div className="space-y-1 mb-4">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                onPick(l.code);
                onClose();
              }}
              className={`w-full text-left px-4 py-2.5 rounded-xl border transition ${
                lang === l.code
                  ? "border-accent bg-accent/10"
                  : "border-black/10 hover:bg-black/5"
              }`}
            >
              <span className="mr-2">{l.flag}</span>
              {l.label}
              {lang === l.code && (
                <span className="float-right text-accent">✓</span>
              )}
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
