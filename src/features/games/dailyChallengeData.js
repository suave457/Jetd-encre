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

const DAILY_CATEGORY_SOURCES = Object.freeze({
  Maroc: Object.freeze({ primary: Object.freeze(["Culture marocaine"]) }),
  Français: Object.freeze({
    primary: Object.freeze(["Langue française", "Vie quotidienne"]),
  }),
  Sciences: Object.freeze({ primary: Object.freeze(["Sciences"]) }),
  Histoire: Object.freeze({
    primary: Object.freeze(["Histoire"]),
    fallback: Object.freeze(["Arts et littérature"]),
  }),
  Monde: Object.freeze({
    primary: Object.freeze(["Géographie", "Monde francophone"]),
  }),
});

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

export function getDailyChallenge(
  value = new Date(),
  questionSource = cultureQuizQuestions,
) {
  const dateKey = getMoroccoDateKey(value);
  const dayNumber = dayNumberFromKey(dateKey);
  const uniqueQuestions = [...new Map(
    (Array.isArray(questionSource) ? questionSource : [])
      .filter((question) => question?.id && Array.isArray(question.choices))
      .map((question) => [question.id, question]),
  ).values()];
  const candidatesByCategory = new Map(DAILY_CATEGORIES.map((category) => {
    const definition = DAILY_CATEGORY_SOURCES[category];
    const primary = uniqueQuestions.filter((question) =>
      definition.primary.includes(question.sourceCategory || question.theme));
    const fallback = primary.length || !definition.fallback
      ? []
      : uniqueQuestions.filter((question) =>
        definition.fallback.includes(question.sourceCategory || question.theme));
    return [category, primary.length ? primary : fallback];
  }));
  const featuredIndex = ((dayNumber % DAILY_CATEGORIES.length) + DAILY_CATEGORIES.length)
    % DAILY_CATEGORIES.length;
  const rotatedCategories = DAILY_CATEGORIES.map(
    (_, index) => DAILY_CATEGORIES[(featuredIndex + index) % DAILY_CATEGORIES.length],
  );
  const selectedIds = new Set();
  const questions = rotatedCategories.flatMap((category) => {
    const candidates = candidatesByCategory.get(category);
    if (!candidates?.length) return [];
    const question = candidates[hashString(`${dateKey}:${category}`) % candidates.length];
    selectedIds.add(question.id);
    return [Object.freeze({
      ...question,
      dailyCategory: category,
      theme: `Défi du jour · ${category}`,
    })];
  });
  if (questions.length < DAILY_QUESTION_COUNT) {
    const remaining = uniqueQuestions
      .filter((question) => !selectedIds.has(question.id))
      .sort((left, right) =>
        hashString(`${dateKey}:${left.id}`) - hashString(`${dateKey}:${right.id}`));
    remaining.slice(0, DAILY_QUESTION_COUNT - questions.length).forEach((question) => {
      const category = question.sourceCategory || question.theme || "Culture générale";
      questions.push(Object.freeze({
        ...question,
        dailyCategory: category,
        theme: `Défi du jour · ${category}`,
      }));
    });
  }
  const orderedCategories = questions.map((question) => question.dailyCategory);

  return Object.freeze({
    id: DAILY_CHALLENGE_ID,
    dateKey,
    category: orderedCategories[0] || "Culture générale",
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
