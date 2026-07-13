"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mdWithMath } from "../lib/markdownMath";
import "katex/dist/katex.min.css";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";
import MathToolbar from "./MathToolbar";
import AskChat from "./AskChat";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data?.session?.access_token}`,
  };
}

export default function PracticeView({
  lang,
  subjectName,
  topicPath,
  topicId,
}) {
  const [phase, setPhase] = useState("init"); // init | loading | solving | checking | feedback | nokey | error
  const [difficulty, setDifficulty] = useState(1);
  const [task, setTask] = useState("");
  const [solution, setSolution] = useState("");
  const [image, setImage] = useState(null); // {base64, mediaType, name}
  const [verdict, setVerdict] = useState(null); // {correct, feedback_md, nextDifficulty}
  const [errDetail, setErrDetail] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const startRef = useRef(0);
  const boxRef = useRef(null);
  const fileRef = useRef(null);
  const taRef = useRef(null);

  // Стартовая сложность — продолжить с уровня последней попытки
  useEffect(() => {
    (async () => {
      let d = 1;
      if (topicId) {
        const { data } = await supabase
          .from("practice_attempts")
          .select("difficulty, correct")
          .eq("topic_id", topicId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (data?.length) {
          d = data[0].correct
            ? Math.min(10, data[0].difficulty + 1)
            : data[0].difficulty;
        }
      }
      loadTask(d);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, lang]);

  const loadTask = useCallback(
    async (d) => {
      setPhase("loading");
      setTask("");
      setSolution("");
      setImage(null);
      setVerdict(null);
      setDifficulty(d);
      try {
        const res = await fetch("/api/practice/task", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({
            subjectName,
            topicPath,
            topicId,
            lang,
            difficulty: d,
          }),
        });
        if (res.status === 409) return setPhase("nokey");
        if (res.status === 429) {
          setErrDetail(t(lang, "limitReached"));
          return setPhase("error");
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setErrDetail([j.error, j.detail].filter(Boolean).join(": "));
          return setPhase("error");
        }
        const json = await res.json();
        setTask(json.task_md);
        startRef.current = Date.now();
        setPhase("solving");
      } catch {
        setPhase("error");
      }
    },
    [subjectName, topicPath, topicId, lang]
  );

  async function submit() {
    if (!solution.trim() && !image) return;
    setPhase("checking");
    try {
      const res = await fetch("/api/practice/grade", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          taskMd: task,
          difficulty,
          solutionText: solution.trim() || null,
          imageBase64: image?.base64 || null,
          imageMediaType: image?.mediaType || null,
          timeSec: Math.round((Date.now() - startRef.current) / 1000),
          topicId,
          topicPath,
          subjectName,
          lang,
        }),
      });
      if (res.status === 409) return setPhase("nokey");
      if (res.status === 429) {
        setErrDetail(t(lang, "limitReached"));
        return setPhase("error");
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrDetail([j.error, j.detail].filter(Boolean).join(": "));
        return setPhase("error");
      }
      setVerdict(await res.json());
      setPhase("feedback");
    } catch {
      setPhase("error");
    }
  }

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const [meta, data] = String(reader.result).split(",");
      const img = {
        base64: data,
        mediaType: meta.match(/data:(.*?);/)?.[1] || "image/png",
        name: f.name,
      };
      setImage(img);
      // Распознать написанное на скрине и перенести в окно решения
      setTranscribing(true);
      try {
        const res = await fetch("/api/practice/transcribe", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({
            imageBase64: img.base64,
            imageMediaType: img.mediaType,
            lang,
          }),
        });
        if (res.ok) {
          const { text } = await res.json();
          if (text) {
            setSolution((prev) => (prev.trim() ? prev + "\n" + text : text));
          }
        }
      } catch {}
      setTranscribing(false);
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  if (phase === "init" || phase === "loading") {
    return (
      <div className="py-16 text-center opacity-70">
        <div className="animate-pulse text-lg mb-2">⏳</div>
        {t(lang, "taskLoading")}
      </div>
    );
  }

  if (phase === "nokey") {
    return <div className="py-16 text-center">{t(lang, "needApiKey")}</div>;
  }

  if (phase === "error") {
    return (
      <div className="py-16 text-center">
        <p className="mb-2">{t(lang, "errorGeneric")}</p>
        {errDetail && (
          <p className="mb-4 text-xs opacity-60 break-all max-w-md mx-auto">
            {errDetail}
          </p>
        )}
        <button
          onClick={() => loadTask(difficulty)}
          className="px-4 py-2 rounded-lg bg-accent text-white"
        >
          {t(lang, "tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef}>
      <div className="text-sm opacity-60 mb-3">
        {t(lang, "difficultyLbl")}: {difficulty}/10
      </div>

      {/* Задание */}
      <div
        className="theory-content bg-white rounded-xl border border-black/10 p-5 mb-4"
        dangerouslySetInnerHTML={{ __html: mdWithMath(task) }}
      />

      {/* Разбор */}
      {phase === "feedback" && verdict && (
        <div
          className={`rounded-xl border p-5 mb-4 ${
            verdict.correct
              ? "bg-green-50 border-green-300"
              : "bg-red-50 border-red-300"
          }`}
        >
          <div className="font-semibold mb-2">
            {verdict.correct
              ? `✓ ${t(lang, "correctMsg")}`
              : `✗ ${t(lang, "incorrectMsg")}`}
          </div>
          <div
            className="theory-content"
            dangerouslySetInnerHTML={{
              __html: mdWithMath(verdict.feedback_md || ""),
            }}
          />
        </div>
      )}

      {/* Окно решения */}
      {(phase === "solving" || phase === "checking") && (
        <>
          <MathToolbar taRef={taRef} value={solution} setValue={setSolution} />
          <textarea
            ref={taRef}
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder={t(lang, "solutionPh")}
            rows={8}
            className="w-full border border-black/20 rounded-xl px-4 py-3 bg-white mb-2"
          />
          {transcribing && (
            <div className="text-sm opacity-70 mb-2 animate-pulse">
              {t(lang, "transcribing")}
            </div>
          )}
          {image && (
            <div className="text-sm opacity-70 mb-2">
              📎 {t(lang, "attached")} {image.name}{" "}
              <button className="underline" onClick={() => setImage(null)}>
                ✕
              </button>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFile}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={phase === "checking"}
              className="px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 disabled:opacity-50"
            >
              {t(lang, "upload")}
            </button>
            <button
              onClick={submit}
              disabled={
                phase === "checking" ||
                transcribing ||
                (!solution.trim() && !image)
              }
              className="px-4 py-2 rounded-lg bg-accent text-white disabled:opacity-50"
            >
              {phase === "checking" ? t(lang, "checking") : t(lang, "submit")}
            </button>
          </div>
        </>
      )}

      {/* Следующее задание */}
      {phase === "feedback" && verdict && (
        <div className="flex gap-2">
          {!verdict.correct && (
            <button
              onClick={() => {
                setVerdict(null);
                setPhase("solving");
                startRef.current = Date.now();
              }}
              className="px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10"
            >
              {t(lang, "retry")}
            </button>
          )}
          <button
            onClick={() => loadTask(verdict.nextDifficulty)}
            className="px-4 py-2 rounded-lg bg-accent text-white"
          >
            {t(lang, "next")}
          </button>
        </div>
      )}

      {/* Диалог-вопрос по заданию */}
      {task && (
        <AskChat
          lang={lang}
          subjectName={subjectName}
          topicName={topicPath}
          contextText={`Current practice problem:\n${task}\n\nStudent's current solution draft:\n${
            solution || "(empty)"
          }${
            verdict
              ? `\n\nGrading feedback already given:\n${verdict.feedback_md}`
              : ""
          }`}
        />
      )}
    </div>
  );
}
