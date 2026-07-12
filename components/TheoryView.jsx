"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { marked } from "marked";
import renderMathInElement from "katex/contrib/auto-render";
import "katex/dist/katex.min.css";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";

export default function TheoryView({ lang, subjectName, topicName }) {
  const [status, setStatus] = useState("loading"); // loading | generating | ready | nokey | error
  const [content, setContent] = useState("");
  const [errDetail, setErrDetail] = useState("");
  const ref = useRef(null);

  const load = useCallback(
    async (regenerate = false) => {
      setStatus("loading");
      setContent("");
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        const opts = {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subjectName, topicName, lang }),
        };
        if (regenerate) {
          await fetch("/api/theory", { ...opts, method: "DELETE" });
        }
        setStatus("generating");
        const res = await fetch("/api/theory", { ...opts, method: "POST" });
        if (res.status === 409) {
          setStatus("nokey");
          return;
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setErrDetail([j.error, j.detail].filter(Boolean).join(": "));
          setStatus("error");
          return;
        }
        const json = await res.json();
        setContent(json.content_md || "");
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [subjectName, topicName, lang]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Рендер формул после вставки HTML
  useEffect(() => {
    if (status === "ready" && ref.current) {
      try {
        renderMathInElement(ref.current, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      } catch {}
    }
  }, [status, content]);

  if (status === "loading" || status === "generating") {
    return (
      <div className="py-16 text-center opacity-70">
        <div className="animate-pulse text-lg mb-2">⏳</div>
        {t(lang, status === "generating" ? "theoryGenerating" : "loading")}
      </div>
    );
  }

  if (status === "nokey") {
    return <div className="py-16 text-center">{t(lang, "needApiKey")}</div>;
  }

  if (status === "error") {
    return (
      <div className="py-16 text-center">
        <p className="mb-2">{t(lang, "errorGeneric")}</p>
        {errDetail && (
          <p className="mb-4 text-xs opacity-60 break-all max-w-md mx-auto">
            {errDetail}
          </p>
        )}
        <button
          onClick={() => load()}
          className="px-4 py-2 rounded-lg bg-accent text-white"
        >
          {t(lang, "tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={ref}
        className="theory-content"
        dangerouslySetInnerHTML={{ __html: marked.parse(content) }}
      />
      <div className="mt-8 pt-4 border-t border-black/10">
        <button
          onClick={() => {
            if (confirm(t(lang, "confirmRegenerate"))) load(true);
          }}
          className="text-sm opacity-60 hover:opacity-100 underline"
        >
          {t(lang, "reportError")}
        </button>
      </div>
    </div>
  );
}
