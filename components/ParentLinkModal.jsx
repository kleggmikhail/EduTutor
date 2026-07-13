"use client";

import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";

// Окно ребёнка: поделиться прогрессом с родителем по email
export default function ParentLinkModal({ lang, session, onClose }) {
  const [links, setLinks] = useState(null);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const { data } = await supabase
      .from("parent_links")
      .select("id, parent_email")
      .eq("student_id", session.user.id)
      .order("created_at");
    setLinks(data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em || !em.includes("@")) return;
    setErr("");
    const { error } = await supabase.from("parent_links").insert({
      student_id: session.user.id,
      student_email: (session.user.email || "").toLowerCase(),
      parent_email: em,
    });
    if (error) setErr(t(lang, "errorGeneric"));
    setEmail("");
    load();
  }

  async function remove(id) {
    await supabase.from("parent_links").delete().eq("id", id);
    load();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6 animate-pop">
        <h2 className="text-lg font-semibold mb-2">{t(lang, "parentTitle")}</h2>
        <p className="text-sm opacity-70 mb-4">{t(lang, "parentHint")}</p>

        {links === null ? (
          <p className="text-sm opacity-60 mb-4">{t(lang, "loading")}</p>
        ) : links.length > 0 ? (
          <div className="mb-4 space-y-1">
            {links.map((l) => (
              <div
                key={l.id}
                className="flex justify-between items-center px-3 py-2 rounded-lg bg-black/5 text-sm"
              >
                <span>{l.parent_email}</span>
                <button
                  onClick={() => remove(l.id)}
                  className="text-red-700 hover:underline"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <form onSubmit={add} className="flex gap-2 mb-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t(lang, "parentEmailPh")}
            className="flex-1 border border-black/20 rounded-lg px-3 py-2 bg-white"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-accent text-white"
          >
            {t(lang, "addBtn")}
          </button>
        </form>

        {err && <p className="text-sm text-red-700 mb-3">{err}</p>}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg hover:bg-black/5"
          >
            {t(lang, "close")}
          </button>
        </div>
      </div>
    </div>
  );
}
