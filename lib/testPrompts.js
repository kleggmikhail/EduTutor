// Промпты для теста

export const TEST_LENGTH = 20;
export const TEST_TIME_LIMIT_SEC = 45 * 60; // 45 минут на тест

// По 2 задания на каждый уровень 1..10, от лёгкого к сложному
export const DIFFICULTY_SCHEDULE = Array.from(
  { length: TEST_LENGTH },
  (_, i) => Math.floor(i / 2) + 1
);

export const DIFFICULTY_GUIDE = `Difficulty scale 1-10:
1-2 = elementary basics (single simple step),
3-4 = middle school (2-3 steps),
5-6 = high school (multi-step, requires understanding),
7-8 = advanced / competition-flavored high school,
9-10 = university level.`;

export function taskSystem(langName) {
  return `You create ONE test problem for a learning app exam.
Write entirely in ${langName}. Output pure Markdown of the problem statement ONLY — no solution, no answer, no hints.
Math in LaTeX: inline $...$, display $$...$$.
${DIFFICULTY_GUIDE}
The problem must have a definite verifiable answer.`;
}

export function taskPrompt({ subjectName, topicPath, difficulty, previous }) {
  return `Subject: ${subjectName}
Topic: ${topicPath}
Required difficulty: ${difficulty}/10
${
  previous.length
    ? `\nAlready used in this test — make something clearly different:\n${previous
        .map((p, i) => `${i + 1}. ${p.slice(0, 150)}`)
        .join("\n")}`
    : ""
}
Create the problem now.`;
}

export function gradeSystem() {
  return `You grade one exam answer. The student must show the solution steps (chain of work).
A verbal explanation of why is welcome but NOT required — never penalize its absence.
Return ONLY valid JSON: {"correct": true|false, "note": "one short sentence why"}.
A bare final answer without any steps counts as incorrect.`;
}

export function finalSystem(langName) {
  return `You are an examiner writing the final evaluation of a 20-question test (difficulty 1-10, two questions per level).
Write entirely in ${langName}, output pure Markdown.
Structure:
1. Score and short overall verdict.
2. What the student does well / where the gaps are (reference specific difficulty levels).
3. Achieved level: map the results to an age/school grade level or university level (state it clearly).
4. 2-3 concrete recommendations what to study next.
Be honest but encouraging. Math in LaTeX if needed.`;
}
