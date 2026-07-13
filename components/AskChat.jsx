"use client";

import { useEffect, useRef, useState } from "react";
import { mdWithMath } from "../lib/markdownMath";
import { t, SPEECH_LOCALES } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data?.session?.access_token}`,
  };
}

// Парящая строка вопроса с диалогом и голосовым вводом.
// contextText — контекст для ИИ (текст теории или задание + черновик решения).
export default function AskChat({ lang, subjectName, topicName, contextText }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef(null);
  const chatEndRef = useRef(null);
  const taRef = useRef(null);

  // Автоувеличение высоты поля при наборе (как в Claude)
  function autoGrow() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }

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
          theory: String(contextText || "").slice(0, 8000),
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

  return (
    <>
      {/* Диалог */}
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
        <div className="flex items-end gap-1.5 bg-white border border-black/15 rounded-2xl shadow-lg px-4 py-3">
          <textarea
            ref={taRef}
            rows={2}
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              autoGrow();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder={t(lang, "askPlaceholder")}
            className="flex-1 resize-none bg-transparent px-1 py-1.5"
            style={{
              boxShadow: "none",
              outline: "none",
              minHeight: "56px",
              maxHeight: "200px",
            }}
          />
          <button
            type="button"
            onClick={toggleVoice}
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
    </>
  );
}
