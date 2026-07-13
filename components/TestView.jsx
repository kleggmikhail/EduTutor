"use client";

import { useEffect, useRef, useState } from "react";
import { mdWithMath } from "../lib/markdownMath";
import "katex/dist/katex.min.css";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";
import MathToolbar from "./MathToolbar";
import { TEST_TIME_LIMIT_SEC } from "../lib/testPrompts";

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
  const [review, setReview] = useState(null); // {tasks, answers, difficulties}
  const [expl, setExpl] = useState({}); // index → текст разбора
  const [explLoading, setExplLoading] = useState(null);
  const [errDetail, setErrDetail] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [usedSec, setUsedSec] = useState(0); // время прошлых сессий теста
  const [timedOut, setTimedOut] = useState(false);
  const startRef = useRef(0);
  const qStartRef = useRef(0);
  const boxRef = useRef(null);
  const taRef = useRef(null);
  const finishingRef = useRef(false);

  const remaining = Math.max(0, TEST_TIME_LIMIT_SEC - usedSec - elapsed);

  // Предупреждение при закрытии вкладки во время теста
  useEffect(() => {
    if (phase !== "solving" && phase !== "checking") return;
    const h = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [phase]);

  // После завершения — загрузить задания и ответы для разбора
  useEffect(() => {
    if (phase !== "done" || !testId) return;
    (async () => {
      const { data } = await supabase
        .from("tests")
        .select("tasks, answers, difficulties")
        .eq("id", testId)
        .maybeSingle();
      if (data) {
        setReview(data);
        const saved = {};
        (data.answers || []).forEach((a, i) => {
          if (a.explanation) saved[i] = a.explanation;
        });
        setExpl(saved);
      }
    })();
  }, [phase, testId]);

  async function loadExplanation(i) {
    if (expl[i] || explLoading !== null) return;
    setExplLoading(i);
    try {
      const res = await fetch("/api/test/review", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ testId, index: i }),
      });
      if (res.ok) {
        const j = await res.json();
        setExpl((e) => ({ ...e, [i]: j.explanation }));
      }
    } catch {}
    setExplLoading(null);
  }

  // Секундомер
  useEffect(() => {
    if (phase !== "solving" && phase !== "checking") return;
    const id = setInterval(
      () => setElapsed(Math.round((Date.now() - startRef.current) / 1000)),
      1000
    );
    return () => clearInterval(id);
  }, [phase]);

  // Время вышло — завершить тест автоматически
  useEffect(() => {
    if (remaining > 0 || phase !== "solving" || finishingRef.current) return;
    finishingRef.current = true;
    (async () => {
      setTimedOut(true);
      setPhase("checking");
      try {
        const res = await fetch("/api/test/answer", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ testId, finish: true }),
        });
        if (res.ok) {
          const json = await res.json();
          setResult(json);
          setPhase("done");
        } else {
          setPhase("error");
        }
      } catch {
        setPhase("error");
      }
      finishingRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase, testId]);

  async function start() {
    setPhase("starting");
    try {
      const res = await fetch("/api/test/start", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ subjectName, topicPath, topicId, lang }),
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
      setTestId(json.testId);
      setIndex(json.index);
      setTotal(json.total);
      setTask(json.task_md);
      setSolution("");
      setUsedSec(json.usedSec || 0);
      setElapsed(0);
      setTimedOut(false);
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

  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(
    remaining % 60
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
        {timedOut && (
          <div className="mb-3 px-4 py-2 rounded-lg bg-red-50 border border-red-300 text-sm">
            {t(lang, "timeOver")}
          </div>
        )}
        <div className="text-3xl font-semibold mb-4">
          {t(lang, "score")}: {result.score}/{result.total}
        </div>
        <div
          className="theory-content bg-white rounded-xl border border-black/10 p-5 mb-6"
          dangerouslySetInnerHTML={{
            __html: mdWithMath(result.grade_md || ""),
          }}
        />

        {/* Разбор заданий */}
        {review && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">
              {t(lang, "testReview")}
            </h2>
            <div className="space-y-2">
              {review.tasks.map((task, i) => {
                const a = review.answers[i] || {};
                return (
                  <details
                    key={i}
                    className="bg-white rounded-xl border border-black/10 px-4 py-2"
                  >
                    <summary className="cursor-pointer py-1 select-none">
                      <span className={a.correct ? "text-green-700" : "text-red-700"}>
                        {a.correct ? "✓" : "✗"}
                      </span>{" "}
                      {t(lang, "questionOf")} {i + 1} ·{" "}
                      {review.difficulties[i]}/10
                    </summary>
                    <div
                      className="theory-content mt-2"
                      dangerouslySetInnerHTML={{
                        __html: mdWithMath(task.task_md),
                      }}
                    />
                    <div className="mt-3 text-sm">
                      <span className="opacity-60">
                        {t(lang, "yourAnswer")}:
                      </span>{" "}
                      <span className="whitespace-pre-wrap">
                        {a.solution || "—"}
                      </span>
                      {a.note && (
                        <div className="opacity-60 mt-1">{a.note}</div>
                      )}
                    </div>
                    {expl[i] ? (
                      <div
                        className="theory-content mt-3 bg-green-50 border border-green-300 rounded-xl p-3"
                        dangerouslySetInnerHTML={{
                          __html: mdWithMath(expl[i]),
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => loadExplanation(i)}
                        disabled={explLoading !== null}
                        className="mt-3 mb-2 text-sm px-3 py-1.5 rounded-lg bg-black/5 hover:bg-black/10 disabled:opacity-50"
                      >
                        {explLoading === i
                          ? t(lang, "checking")
                          : t(lang, "showSolution")}
                      </button>
                    )}
                  </details>
                );
              })}
            </div>
          </div>
        )}

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
      <div className="flex justify-between text-sm mb-3">
        <span className="opacity-60">
          {t(lang, "questionOf")} {index + 1}/{total}
        </span>
        <span
          className={
            remaining < 300 ? "text-red-700 font-semibold" : "opacity-60"
          }
        >
          ⏱ {mmss}
        </span>
      </div>

      {/* Прогресс-бар */}
      <div className="h-1.5 bg-black/10 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${(index / total) * 100}%` }}
        />
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
