"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mdWithMath } from "../lib/markdownMath";
import "katex/dist/katex.min.css";
import { t, SPEECH_LOCALES } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";
import AskChat from "./AskChat";

export default function TheoryView({ lang, subjectName, topicName }) {
  const [status, setStatus] = useState("loading"); // loading | generating | ready | nokey | error
  const [content, setContent] = useState("");
  const [errDetail, setErrDetail] = useState("");
  const [speaking, setSpeaking] = useState(false);
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
        if (res.status === 429) {
          setErrDetail(t(lang, "limitReached"));
          setStatus("error");
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

  // Остановить озвучку при уходе со страницы
  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {}
    };
  }, []);

  // Озвучка теории (без формул и иллюстраций)
  function toggleSpeak() {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const plain = content
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/\$\$[\s\S]*?\$\$/g, " ")
      .replace(/\$[^$\n]*?\$/g, " ")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#*_`>\[\]|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const u = new SpeechSynthesisUtterance(plain.slice(0, 15000));
    u.lang = SPEECH_LOCALES[lang] || "en-US";
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

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
      {/* Озвучка */}
      <div className="flex justify-end mb-2">
        <button
          onClick={toggleSpeak}
          className={`text-sm px-3 py-1.5 rounded-lg ${
            speaking
              ? "bg-accent/15 text-accent animate-pulse"
              : "bg-black/5 hover:bg-black/10"
          }`}
        >
          {speaking ? `⏹ ${t(lang, "stopListen")}` : `🔊 ${t(lang, "listen")}`}
        </button>
      </div>

      <div
        ref={ref}
        className="theory-content"
        dangerouslySetInnerHTML={{ __html: mdWithMath(content) }}
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

      {/* Диалог по теме */}
      <AskChat
        lang={lang}
        subjectName={subjectName}
        topicName={topicName}
        contextText={content}
      />
    </div>
  );
}
