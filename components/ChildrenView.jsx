"use client";

import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";
import ProgressView from "./ProgressView";

// Экран родителя: список привязанных детей и их прогресс (только чтение)
export default function ChildrenView({ lang }) {
  const [children, setChildren] = useState(null);
  const [active, setActive] = useState(null); // student_id

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("parent_links")
        .select("student_id, student_email")
        .order("created_at");
      // Уникальные дети (на случай нескольких связей)
      const seen = new Set();
      const list = (data || []).filter((l) => {
        if (seen.has(l.student_id)) return false;
        seen.add(l.student_id);
        return true;
      });
      setChildren(list);
      if (list.length) setActive(list[0].student_id);
    })();
  }, []);

  if (children === null) {
    return (
      <div className="py-16 text-center opacity-70 animate-pulse">
        {t(lang, "loading")}
      </div>
    );
  }

  if (!children.length) {
    return <p className="opacity-70 max-w-lg">{t(lang, "noChildren")}</p>;
  }

  return (
    <div>
      {/* Переключатель детей */}
      <div className="flex flex-wrap gap-2 mb-6">
        {children.map((c) => (
          <button
            key={c.student_id}
            onClick={() => setActive(c.student_id)}
            className={`px-4 py-2 rounded-lg text-sm ${
              active === c.student_id
                ? "bg-accent text-white"
                : "bg-black/5 hover:bg-black/10"
            }`}
          >
            {c.student_email}
          </button>
        ))}
      </div>

      {active && <ProgressView key={active} lang={lang} userId={active} />}
    </div>
  );
}
