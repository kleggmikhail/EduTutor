"use client";

import { useState } from "react";
import { t } from "../lib/i18n";

export default function NameModal({ lang, placeholderKey, onCreate, onClose }) {
  const [name, setName] = useState("");

  function submit(e) {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    onCreate(v);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={submit}
        className="bg-surface rounded-2xl shadow-xl w-full max-w-sm p-6 animate-pop"
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t(lang, placeholderKey)}
          className="w-full border border-black/20 rounded-lg px-3 py-2 mb-4 bg-white"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg hover:bg-black/5"
          >
            {t(lang, "cancel")}
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-accent text-white"
          >
            {t(lang, "create")}
          </button>
        </div>
      </form>
    </div>
  );
}
