import { cultureQuizQuestions } from "./cultureQuizData.js";

export const DAILY_CHALLENGE_ID = "defi-du-jour";
export const DAILY_COMPLETION_XP = 20;
export const DAILY_QUESTION_COUNT = 5;

export const DAILY_CATEGORIES = Object.freeze([
  "Maroc",
  "Français",
  "Sciences",
  "Histoire",
  "Monde",
]);

const QUESTION_IDS_BY_CATEGORY = Object.freeze({
  Maroc: Object.freeze(["culture-01", "culture-02", "culture-03", "culture-04"]),
  Français: Object.freeze(["culture-05", "culture-09"]),
  Sciences: Object.freeze(["culture-06", "culture-07"]),
  Histoire: Object.freeze(["culture-10", "culture-11"]),
  Monde: Object.freeze(["culture-08", "culture-12"]),
});

const questionsById = new Map(
  cultureQuizQuestions.map((question) => [question.id, question]),
);

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function partsForMoroccoDate(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Une date valide est requise pour préparer le défi du jour.");
  }

  const parts = new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return { year: part("year"), month: part("month"), day: part("day") };
}

export function getMoroccoDateKey(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const { year, month, day } = partsForMoroccoDate(value);
  return `${year}-${month}-${day}`;
}

function dayNumberFromKey(dateKey) {
  const timestamp = Date.parse(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError("La clé de date du défi est invalide.");
  }
  return Math.floor(timestamp / 86_400_000);
}

export function getDailyChallenge(value = new Date()) {
  const dateKey = getMoroccoDateKey(value);
  const dayNumber = dayNumberFromKey(dateKey);
  const featuredIndex = ((dayNumber % DAILY_CATEGORIES.length) + DAILY_CATEGORIES.length)
    % DAILY_CATEGORIES.length;
  const orderedCategories = DAILY_CATEGORIES.map(
    (_, index) => DAILY_CATEGORIES[(featuredIndex + index) % DAILY_CATEGORIES.length],
  );
  const questions = orderedCategories.map((category) => {
    const ids = QUESTION_IDS_BY_CATEGORY[category];
    const questionId = ids[hashString(`${dateKey}:${category}`) % ids.length];
    const question = questionsById.get(questionId);
    return Object.freeze({
      ...question,
      dailyCategory: category,
      theme: `Défi du jour · ${category}`,
    });
  });

  return Object.freeze({
    id: DAILY_CHALLENGE_ID,
    dateKey,
    category: orderedCategories[0],
    categories: Object.freeze([...orderedCategories]),
    questions: Object.freeze(questions),
    questionCount: questions.length,
    completionXp: DAILY_COMPLETION_XP,
    attemptId: `${DAILY_CHALLENGE_ID}:${dateKey}`,
    awardNamespace: `${DAILY_CHALLENGE_ID}:${dateKey}`,
  });
}

export function getDailyChallengeHistory(attempts = [], userId = null) {
  if (!Array.isArray(attempts)) return [];
  return attempts
    .filter(
      (attempt) =>
        attempt?.quizId === DAILY_CHALLENGE_ID &&
        (!userId || attempt.userId === userId) &&
        typeof attempt.dailyKey === "string",
    )
    .sort((left, right) => String(right.dailyKey).localeCompare(String(left.dailyKey)));
}

export function getCompletedDailyChallenge(attempts, userId, value = new Date()) {
  const dateKey = getMoroccoDateKey(value);
  return getDailyChallengeHistory(attempts, userId).find(
    (attempt) => attempt.dailyKey === dateKey,
  ) || null;
}
