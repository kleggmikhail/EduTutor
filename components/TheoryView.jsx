"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mdWithMath } from "../lib/markdownMath";
import "katex/dist/katex.min.css";
import { t, SPEECH_LOCALES } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data?.session?.access_token}`,
  };
}

export default function TheoryView({ lang, subjectName, topicName }) {
  const [status, setStatus] = useState("loading"); // loading | generating | ready | nokey | error
  const [content, setContent] = useState("");
  const [errDetail, setErrDetail] = useState("");
  const ref = useRef(null);

  // Диалог по теме
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, asking]);

  async function ask() {
    const q = question.trim();
    if (!q || asking) return;
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setAsking(true);
    try {
      const res = await fetch("/api/theory/ask", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          subjectName,
          topicName,
          lang,
          question: q,
          history,
          theory: content.slice(0, 8000),
        }),
      });
      if (res.ok) {
        const j = await res.json();
        setMessages((m) => [...m, { role: "assistant", text: j.answer }]);
      } else {
        const j = await res.json().catch(() => ({}));
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text:
              j.error === "limit_reached"
                ? t(lang, "limitReached")
                : t(lang, "errorGeneric"),
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: t(lang, "errorGeneric") },
      ]);
    }
    setAsking(false);
  }

  // Голосовой ввод (Web Speech API)
  function toggleVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert(t(lang, "voiceUnsupported"));
      return;
    }
    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      return;
    }
    const rec = new SR();
    rec.lang = SPEECH_LOCALES[lang] || "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const txt = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (txt) setQuestion((prev) => (prev.trim() ? prev + " " + txt : txt));
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    recRef.current = rec;
    rec.start();
    setRecording(true);
  }

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
      {messages.length > 0 && (
        <div className="mt-6 space-y-3">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="bg-accent/10 rounded-2xl px-4 py-2 max-w-[85%] whitespace-pre-wrap">
                  {m.text}
                </div>
              </div>
            ) : (
              <div
                key={i}
                className="theory-content bg-white border border-black/10 rounded-2xl px-4 py-2"
                dangerouslySetInnerHTML={{ __html: mdWithMath(m.text) }}
              />
            )
          )}
          {asking && (
            <div className="opacity-60 text-sm animate-pulse">
              {t(lang, "asking")}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Парящая строка вопроса */}
      <div className="sticky bottom-2 mt-6 z-10">
        <div className="flex items-end gap-1.5 bg-white border border-black/15 rounded-2xl shadow-lg px-3 py-2">
          <textarea
            rows={1}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder={t(lang, "askPlaceholder")}
            className="flex-1 resize-none bg-transparent px-1 py-1.5 max-h-32 !shadow-none"
            style={{ boxShadow: "none", outline: "none" }}
          />
          <button
            type="button"
            onClick={toggleVoice}
            title="🎤"
            className={`px-2 py-1.5 rounded-xl text-lg ${
              recording
                ? "bg-red-100 text-red-700 animate-pulse"
                : "hover:bg-black/5"
            }`}
          >
            🎤
          </button>
          <button
            type="button"
            onClick={ask}
            disabled={!question.trim() || asking}
            className="px-3 py-1.5 rounded-xl bg-accent text-white disabled:opacity-40"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
