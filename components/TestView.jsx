"use client";

import { useEffect, useRef, useState } from "react";
import { mdWithMath } from "../lib/markdownMath";
import "katex/dist/katex.min.css";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";
import MathToolbar from "./MathToolbar";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data?.session?.access_token}`,
  };
}

export default function TestView({ lang, subjectName, topicPath, topicId }) {
  const [phase, setPhase] = useState("intro"); // intro | starting | solving | checking | done | nokey | error
  const [testId, setTestId] = useState(null);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(20);
  const [task, setTask] = useState("");
  const [solution, setSolution] = useState("");
  const [result, setResult] = useState(null); // {score, total, grade_md}
  const [errDetail, setErrDetail] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const qStartRef = useRef(0);
  const boxRef = useRef(null);
  const taRef = useRef(null);

  // Секундомер
  useEffect(() => {
    if (phase !== "solving" && phase !== "checking") return;
    const id = setInterval(
      () => setElapsed(Math.round((Date.now() - startRef.current) / 1000)),
      1000
    );
    return () => clearInterval(id);
  }, [phase]);

  async function start() {
    setPhase("starting");
    try {
      const res = await fetch("/api/test/start", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ subjectName, topicPath, topicId, lang }),
      });
      if (res.status === 409) return setPhase("nokey");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrDetail([j.error, j.detail].filter(Boolean).join(": "));
        return setPhase("error");
      }
      const json = await res.json();
      setTestId(json.testId);
      setIndex(json.index);
      setTotal(json.total);
      setTask(json.task_md);
      setSolution("");
      startRef.current = Date.now();
      qStartRef.current = Date.now();
      setPhase("solving");
    } catch {
      setPhase("error");
    }
  }

  async function submit(skip = false) {
    if (!skip && !solution.trim()) return;
    setPhase("checking");
    try {
      const res = await fetch("/api/test/answer", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          testId,
          solution: skip ? null : solution.trim(),
          skip,
          timeSec: Math.round((Date.now() - qStartRef.current) / 1000),
        }),
      });
      if (res.status === 409) return setPhase("nokey");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrDetail([j.error, j.detail].filter(Boolean).join(": "));
        return setPhase("error");
      }
      const json = await res.json();
      if (json.done) {
        setResult(json);
        setPhase("done");
      } else {
        setIndex(json.index);
        setTask(json.task_md);
        setSolution("");
        qStartRef.current = Date.now();
        setPhase("solving");
      }
    } catch {
      setPhase("error");
    }
  }

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(
    elapsed % 60
  ).padStart(2, "0")}`;

  if (phase === "intro") {
    return (
      <div className="py-8">
        <p className="opacity-70 mb-6 max-w-lg">{t(lang, "testIntro")}</p>
        <button
          onClick={start}
          className="px-5 py-2.5 rounded-lg bg-accent text-white"
        >
          {t(lang, "startTest")}
        </button>
      </div>
    );
  }

  if (phase === "starting") {
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
          onClick={start}
          className="px-4 py-2 rounded-lg bg-accent text-white"
        >
          {t(lang, "tryAgain")}
        </button>
      </div>
    );
  }

  if (phase === "done" && result) {
    return (
      <div ref={boxRef}>
        <div className="text-3xl font-semibold mb-4">
          {t(lang, "score")}: {result.score}/{result.total}
        </div>
        <div
          className="theory-content bg-white rounded-xl border border-black/10 p-5 mb-6"
          dangerouslySetInnerHTML={{
            __html: mdWithMath(result.grade_md || ""),
          }}
        />
        <button
          onClick={start}
          className="px-4 py-2 rounded-lg bg-accent text-white"
        >
          {t(lang, "retakeTest")}
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef}>
      <div className="flex justify-between text-sm opacity-60 mb-3">
        <span>
          {t(lang, "questionOf")} {index + 1}/{total}
        </span>
        <span>⏱ {mmss}</span>
      </div>

      <div
        className="theory-content bg-white rounded-xl border border-black/10 p-5 mb-4"
        dangerouslySetInnerHTML={{ __html: mdWithMath(task) }}
      />

      <MathToolbar taRef={taRef} value={solution} setValue={setSolution} />
      <textarea
        ref={taRef}
        value={solution}
        onChange={(e) => setSolution(e.target.value)}
        placeholder={t(lang, "solutionPh")}
        rows={8}
        className="w-full border border-black/20 rounded-xl px-4 py-3 bg-white mb-2"
        disabled={phase === "checking"}
      />
      <div className="flex gap-2">
        <button
          onClick={() => submit(false)}
          disabled={phase === "checking" || !solution.trim()}
          className="px-4 py-2 rounded-lg bg-accent text-white disabled:opacity-50"
        >
          {phase === "checking" ? t(lang, "gradingNext") : t(lang, "submit")}
        </button>
        <button
          onClick={() => {
            if (confirm(t(lang, "confirmSkip"))) submit(true);
          }}
          disabled={phase === "checking"}
          className="px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10 disabled:opacity-50"
        >
          {t(lang, "skip")}
        </button>
      </div>
    </div>
  );
}
