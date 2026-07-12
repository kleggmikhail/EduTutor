// Геймификация: серия дней, уровень, значки, повторение пройденного

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

// Сводная статистика из попыток и тестов
export function computeStats(attempts, tests) {
  const dates = new Set();
  let solved = 0,
    total = 0,
    time = 0,
    maxDiff = 0;
  const topicsTouched = new Set();

  for (const a of attempts) {
    total += 1;
    time += a.time_sec || 0;
    if (a.created_at) dates.add(dayKey(a.created_at));
    if (a.topic_id) topicsTouched.add(a.topic_id);
    if (a.correct) {
      solved += 1;
      maxDiff = Math.max(maxDiff, a.difficulty || 0);
    }
  }

  let testsDone = 0,
    bestScore = 0,
    perfect = false,
    testScoreSum = 0;
  for (const ts of tests) {
    if (ts.started_at) dates.add(dayKey(ts.started_at));
    if (ts.finished_at) dates.add(dayKey(ts.finished_at));
    if (ts.topic_id) topicsTouched.add(ts.topic_id);
    time += (ts.answers || []).reduce((s, x) => s + (x.time_sec || 0), 0);
    if (ts.status === "completed") {
      testsDone += 1;
      testScoreSum += ts.score || 0;
      bestScore = Math.max(bestScore, ts.score || 0);
      if ((ts.score || 0) >= 20) perfect = true;
    }
  }

  const xp = solved * 10 + testScoreSum * 5;
  const level = 1 + Math.floor(xp / 200);

  return {
    solved,
    total,
    time,
    maxDiff,
    testsDone,
    bestScore,
    perfect,
    topicsTouched: topicsTouched.size,
    dates,
    xp,
    level,
  };
}

// Серия дней подряд (streak): считаем от сегодня либо от вчера
export function computeStreak(dates) {
  if (!dates.size) return 0;
  const day = 24 * 3600 * 1000;
  let cursor = new Date();
  if (!dates.has(dayKey(cursor))) {
    cursor = new Date(cursor.getTime() - day);
    if (!dates.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (dates.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - day);
  }
  return streak;
}

// Значки
export const BADGES = [
  { id: "first_task", icon: "🎯", ru: "Первая задача", en: "First task", cond: (s) => s.solved >= 1 },
  { id: "tasks10", icon: "✏️", ru: "10 задач", en: "10 tasks", cond: (s) => s.solved >= 10 },
  { id: "tasks50", icon: "📚", ru: "50 задач", en: "50 tasks", cond: (s) => s.solved >= 50 },
  { id: "tasks100", icon: "🏆", ru: "100 задач", en: "100 tasks", cond: (s) => s.solved >= 100 },
  { id: "first_test", icon: "📝", ru: "Первый тест", en: "First test", cond: (s) => s.testsDone >= 1 },
  { id: "test15", icon: "🥈", ru: "Тест 15+", en: "Test 15+", cond: (s) => s.bestScore >= 15 },
  { id: "test20", icon: "🥇", ru: "Идеальный тест", en: "Perfect test", cond: (s) => s.perfect },
  { id: "streak3", icon: "🔥", ru: "3 дня подряд", en: "3-day streak", cond: (s, st) => st >= 3 },
  { id: "streak7", icon: "⚡", ru: "7 дней подряд", en: "7-day streak", cond: (s, st) => st >= 7 },
  { id: "streak30", icon: "🌟", ru: "30 дней подряд", en: "30-day streak", cond: (s, st) => st >= 30 },
  { id: "level10", icon: "🎓", ru: "Уровень 10/10", en: "Level 10/10", cond: (s) => s.maxDiff >= 10 },
  { id: "explorer", icon: "🗺️", ru: "5 тем начато", en: "5 topics started", cond: (s) => s.topicsTouched >= 5 },
];

// Повторение пройденного: темы с последней активностью 3–60 дней назад.
// Интервалы 3/7/30 дней: тема попадает в список, когда прошло ≥3, ≥7 или ≥30
// дней с последнего занятия по ней.
export function computeReviews(byTopicLastActivity) {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const out = [];
  for (const [topicId, last] of Object.entries(byTopicLastActivity)) {
    const daysAgo = Math.floor((now - last) / day);
    if (daysAgo >= 3 && daysAgo <= 60) {
      out.push({ topicId, daysAgo });
    }
  }
  return out.sort((a, b) => b.daysAgo - a.daysAgo).slice(0, 5);
}
