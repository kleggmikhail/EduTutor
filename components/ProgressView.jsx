"use client";

import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";
import {
  computeStats,
  computeStreak,
  computeReviews,
  BADGES,
} from "../lib/gamification";

// Уровень усвоения по максимальной верно решённой сложности
function levelLabel(lang, maxCorrectDifficulty) {
  if (!maxCorrectDifficulty) return "—";
  const ru = {
    2: "Начальный",
    4: "Средние классы",
    6: "Старшие классы",
    8: "Продвинутый",
    10: "Университет",
  };
  const en = {
    2: "Beginner",
    4: "Middle school",
    6: "High school",
    8: "Advanced",
    10: "University",
  };
  const map = lang === "ru" ? ru : en;
  for (const cap of [2, 4, 6, 8, 10]) {
    if (maxCorrectDifficulty <= cap)
      return `${map[cap]} (${maxCorrectDifficulty}/10)`;
  }
  return "—";
}

function fmtTime(lang, sec) {
  if (!sec) return "—";
  const m = Math.round(sec / 60);
  if (m < 1) return lang === "ru" ? "<1 мин" : "<1 min";
  if (m < 60) return `${m} ${lang === "ru" ? "мин" : "min"}`;
  return `${Math.floor(m / 60)} ${lang === "ru" ? "ч" : "h"} ${m % 60} ${
    lang === "ru" ? "мин" : "min"
  }`;
}

export default function ProgressView({ lang, userId, onSelectTopic }) {
  const [data, setData] = useState(null); // {subjects, topics, attempts, tests}

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [s, tp, a, ts] = await Promise.all([
        supabase
          .from("subjects")
          .select("id, name")
          .eq("user_id", userId)
          .order("position")
          .order("created_at"),
        supabase
          .from("topics")
          .select("id, subject_id, parent_id, name")
          .eq("user_id", userId)
          .order("position")
          .order("created_at"),
        supabase
          .from("practice_attempts")
          .select("topic_id, difficulty, correct, time_sec, created_at")
          .eq("user_id", userId),
        supabase
          .from("tests")
          .select("topic_id, status, score, answers, started_at, finished_at")
          .eq("user_id", userId),
      ]);
      setData({
        subjects: s.data || [],
        topics: tp.data || [],
        attempts: a.data || [],
        tests: ts.data || [],
      });
    })();
  }, [userId]);

  if (!data) {
    return (
      <div className="py-16 text-center opacity-70 animate-pulse">
        {t(lang, "loading")}
      </div>
    );
  }

  const { subjects, topics, attempts, tests } = data;

  // Геймификация
  const stats = computeStats(attempts, tests);
  const streak = computeStreak(stats.dates);
  const earned = BADGES.filter((b) => b.cond(stats, streak));

  // Агрегация по темам + последняя активность
  const byTopic = {};
  const lastActivity = {};
  const touch = (topicId, ts) => {
    if (!topicId || !ts) return;
    const ms = new Date(ts).getTime();
    lastActivity[topicId] = Math.max(lastActivity[topicId] || 0, ms);
  };

  for (const a of attempts) {
    if (!a.topic_id) continue;
    const s = (byTopic[a.topic_id] ||= {
      time: 0,
      total: 0,
      correct: 0,
      maxDiff: 0,
      bestTest: null,
      testsDone: 0,
    });
    s.time += a.time_sec || 0;
    s.total += 1;
    if (a.correct) {
      s.correct += 1;
      s.maxDiff = Math.max(s.maxDiff, a.difficulty);
    }
    touch(a.topic_id, a.created_at);
  }
  for (const ts of tests) {
    if (!ts.topic_id) continue;
    const s = (byTopic[ts.topic_id] ||= {
      time: 0,
      total: 0,
      correct: 0,
      maxDiff: 0,
      bestTest: null,
      testsDone: 0,
    });
    s.time += (ts.answers || []).reduce((sum, x) => sum + (x.time_sec || 0), 0);
    if (ts.status === "completed") {
      s.testsDone += 1;
      if (s.bestTest === null || ts.score > s.bestTest) s.bestTest = ts.score;
    }
    touch(ts.topic_id, ts.finished_at || ts.started_at);
  }

  // Повторение пройденного
  const reviews = computeReviews(lastActivity)
    .map((r) => ({
      ...r,
      topic: topics.find((x) => x.id === r.topicId),
    }))
    .filter((r) => r.topic);

  function statusOf(s) {
    if (!s) return { label: t(lang, "statusNotStarted"), cls: "bg-black/5" };
    if (s.bestTest !== null)
      return {
        label: `${t(lang, "statusTestPassed")} ${s.bestTest}/20`,
        cls: "bg-green-100 text-green-800",
      };
    if (s.total > 0)
      return {
        label: t(lang, "statusPractice"),
        cls: "bg-amber-100 text-amber-800",
      };
    return { label: t(lang, "statusNotStarted"), cls: "bg-black/5" };
  }

  return (
    <div>
      {/* Геймификация */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-black/10 p-4 text-center">
          <div className="text-2xl font-semibold">🔥 {streak}</div>
          <div className="text-sm opacity-60">{t(lang, "streakLbl")}</div>
        </div>
        <div className="bg-white rounded-xl border border-black/10 p-4 text-center">
          <div className="text-2xl font-semibold">⭐ {stats.level}</div>
          <div className="text-sm opacity-60">
            {t(lang, "levelXp")}: {stats.xp}
          </div>
        </div>
      </div>

      {/* Значки */}
      {earned.length > 0 && (
        <div className="bg-white rounded-xl border border-black/10 p-4 mb-4">
          <div className="text-sm opacity-60 mb-2">{t(lang, "badgesLbl")}</div>
          <div className="flex flex-wrap gap-2">
            {earned.map((b) => (
              <span
                key={b.id}
                className="px-3 py-1.5 rounded-full bg-black/5 text-sm"
                title={lang === "ru" ? b.ru : b.en}
              >
                {b.icon} {lang === "ru" ? b.ru : b.en}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Пора повторить */}
      {reviews.length > 0 && (
        <div className="bg-white rounded-xl border border-accent/40 p-4 mb-6">
          <div className="text-sm font-semibold mb-2">
            🔄 {t(lang, "reviewTitle")}
          </div>
          <div className="space-y-1">
            {reviews.map((r) => (
              <button
                key={r.topicId}
                onClick={() => onSelectTopic && onSelectTopic(r.topicId)}
                disabled={!onSelectTopic}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/5 text-sm flex justify-between disabled:cursor-default"
              >
                <span>{r.topic.name}</span>
                <span className="opacity-60">
                  {r.daysAgo} {t(lang, "daysAgo")}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Сводка */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          [t(lang, "totalTime"), fmtTime(lang, stats.time)],
          [t(lang, "tasksSolved"), stats.solved],
          [t(lang, "testsPassed"), stats.testsDone],
        ].map(([label, value]) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-black/10 p-4 text-center"
          >
            <div className="text-2xl font-semibold">{value}</div>
            <div className="text-sm opacity-60">{label}</div>
          </div>
        ))}
      </div>

      {/* По предметам */}
      {subjects.map((subj) => {
        const subjTopics = topics.filter((x) => x.subject_id === subj.id);
        if (!subjTopics.length) return null;
        return (
          <div key={subj.id} className="mb-8">
            <h2 className="text-lg font-semibold mb-3">{subj.name}</h2>
            <div className="bg-white rounded-xl border border-black/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left opacity-60 border-b border-black/10">
                    <th className="px-4 py-2 font-normal">
                      {t(lang, "colTopic")}
                    </th>
                    <th className="px-4 py-2 font-normal">
                      {t(lang, "colStatus")}
                    </th>
                    <th className="px-4 py-2 font-normal">
                      {t(lang, "colTime")}
                    </th>
                    <th className="px-4 py-2 font-normal">
                      {t(lang, "colSolved")}
                    </th>
                    <th className="px-4 py-2 font-normal">
                      {t(lang, "colLevel")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subjTopics.map((topic) => {
                    const s = byTopic[topic.id];
                    const st = statusOf(s);
                    const depth = topic.parent_id ? 1 : 0;
                    return (
                      <tr
                        key={topic.id}
                        className="border-b border-black/5 last:border-0"
                      >
                        <td
                          className="px-4 py-2"
                          style={{ paddingLeft: 16 + depth * 20 }}
                        >
                          {topic.name}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${st.cls}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-2">{fmtTime(lang, s?.time)}</td>
                        <td className="px-4 py-2">
                          {s?.total ? `${s.correct}/${s.total}` : "—"}
                        </td>
                        <td className="px-4 py-2">
                          {levelLabel(lang, s?.maxDiff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {!subjects.length && <p className="opacity-60">{t(lang, "noSubjects")}</p>}
    </div>
  );
}
