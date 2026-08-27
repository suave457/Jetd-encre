import {
  DAILY_CATEGORIES,
  DAILY_CHALLENGE_ID,
  getMoroccoDateKey,
} from "../games/dailyChallengeData.js";

const DAY_MS = 86_400_000;

export const ACHIEVEMENT_BADGES = Object.freeze([
  Object.freeze({
    id: "premier-defi",
    title: "Premier éclat",
    shortTitle: "Premier défi",
    description: "Terminer un Défi du jour.",
    kind: "daily-count",
    target: 1,
    artSrc: "/assets/badges/premier-eclat.webp",
  }),
  Object.freeze({
    id: "quiz-parfait",
    title: "Plume parfaite",
    shortTitle: "Quiz parfait",
    description: "Réussir un quiz sans aucune erreur.",
    kind: "perfect-quiz",
    target: 1,
    artSrc: "/assets/badges/plume-parfaite.webp",
  }),
  Object.freeze({
    id: "serie-3",
    title: "Étincelle régulière",
    shortTitle: "Série de 3 jours",
    description: "Terminer le Défi du jour pendant 3 jours consécutifs.",
    kind: "best-streak",
    target: 3,
    artSrc: "/assets/badges/serie-3.webp",
  }),
  Object.freeze({
    id: "trois-horizons",
    title: "Trois horizons",
    shortTitle: "3 catégories",
    description: "Explorer 3 catégories vedettes différentes.",
    kind: "categories",
    target: 3,
    artSrc: "/assets/badges/trois-horizons.webp",
  }),
  Object.freeze({
    id: "serie-5",
    title: "Flamme curieuse",
    shortTitle: "Série de 5 jours",
    description: "Terminer le Défi du jour pendant 5 jours consécutifs.",
    kind: "best-streak",
    target: 5,
    artSrc: "/assets/badges/serie-5.webp",
  }),
  Object.freeze({
    id: "tour-du-savoir",
    title: "Tour du savoir",
    shortTitle: "5 catégories",
    description: "Explorer les 5 catégories du Défi du jour.",
    kind: "categories",
    target: DAILY_CATEGORIES.length,
    artSrc: "/assets/badges/tour-du-savoir.webp",
  }),
  Object.freeze({
    id: "serie-7",
    title: "Constellation d’encre",
    shortTitle: "Série de 7 jours",
    description: "Terminer le Défi du jour pendant 7 jours consécutifs.",
    kind: "best-streak",
    target: 7,
    artSrc: "/assets/badges/serie-7.webp",
  }),
]);

function dateKeyToDayNumber(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return null;
  const timestamp = Date.parse(`${dateKey}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / DAY_MS) : null;
}

export function shiftDateKey(dateKey, offset) {
  const dayNumber = dateKeyToDayNumber(dateKey);
  if (dayNumber === null || !Number.isInteger(offset)) {
    throw new TypeError("Une date et un décalage valides sont requis.");
  }
  return new Date((dayNumber + offset) * DAY_MS).toISOString().slice(0, 10);
}

function normalizedAttempts(attempts, userId) {
  if (!Array.isArray(attempts)) return [];
  return attempts.filter((attempt) =>
    attempt &&
    (!userId || attempt.userId === userId) &&
    Number(attempt.questionCount || 0) > 0,
  );
}

export function getDailyCompletionProofs(attempts = [], userId = null) {
  const byDate = new Map();
  normalizedAttempts(attempts, userId)
    .filter((attempt) =>
      attempt.quizId === DAILY_CHALLENGE_ID &&
      dateKeyToDayNumber(attempt.dailyKey) !== null,
    )
    .forEach((attempt) => {
      const current = byDate.get(attempt.dailyKey);
      const currentTime = Date.parse(current?.completedAt || 0) || 0;
      const candidateTime = Date.parse(attempt.completedAt || 0) || 0;
      if (!current || candidateTime >= currentTime) byDate.set(attempt.dailyKey, attempt);
    });

  return [...byDate.values()].sort((left, right) =>
    String(left.dailyKey).localeCompare(String(right.dailyKey)),
  );
}

function getStreakEvidence(dailyAttempts, todayKey) {
  const dateKeys = dailyAttempts.map((attempt) => attempt.dailyKey);
  let bestStreak = 0;
  let runningStreak = 0;
  let previousDay = null;
  const firstReachedAt = new Map();

  dateKeys.forEach((dateKey) => {
    const dayNumber = dateKeyToDayNumber(dateKey);
    runningStreak = previousDay !== null && dayNumber === previousDay + 1
      ? runningStreak + 1
      : 1;
    previousDay = dayNumber;
    if (runningStreak > bestStreak) bestStreak = runningStreak;
    [3, 5, 7].forEach((milestone) => {
      if (runningStreak >= milestone && !firstReachedAt.has(milestone)) {
        firstReachedAt.set(milestone, dateKey);
      }
    });
  });

  const todayDay = dateKeyToDayNumber(todayKey);
  const eligibleDates = dateKeys.filter((dateKey) => dateKeyToDayNumber(dateKey) <= todayDay);
  const latestKey = eligibleDates.at(-1) || null;
  const latestDay = dateKeyToDayNumber(latestKey);
  let currentStreak = 0;
  if (latestDay !== null && todayDay - latestDay <= 1) {
    currentStreak = 1;
    for (let index = eligibleDates.length - 2; index >= 0; index -= 1) {
      const newerDay = dateKeyToDayNumber(eligibleDates[index + 1]);
      const candidateDay = dateKeyToDayNumber(eligibleDates[index]);
      if (newerDay - candidateDay !== 1) break;
      currentStreak += 1;
    }
  }

  return { bestStreak, currentStreak, firstReachedAt };
}

function getCategoryEvidence(dailyAttempts) {
  const categories = [];
  const unlockedAt = new Map();
  dailyAttempts.forEach((attempt) => {
    const category = String(attempt.category || "").trim();
    if (!category || categories.includes(category)) return;
    categories.push(category);
    unlockedAt.set(categories.length, attempt.dailyKey);
  });
  return { categories, unlockedAt };
}

function proofDate(attempt) {
  return attempt?.dailyKey || attempt?.completedAt || null;
}

function valueForBadge(badge, facts) {
  if (badge.kind === "daily-count") return facts.dailyCompletedCount;
  if (badge.kind === "perfect-quiz") return facts.perfectQuizCount;
  if (badge.kind === "best-streak") return facts.bestStreak;
  if (badge.kind === "categories") return facts.categoryCount;
  return 0;
}

function unlockedAtForBadge(badge, facts) {
  if (badge.kind === "daily-count") return proofDate(facts.dailyAttempts[badge.target - 1]);
  if (badge.kind === "perfect-quiz") return proofDate(facts.perfectAttempts[0]);
  if (badge.kind === "best-streak") return facts.streakEvidence.firstReachedAt.get(badge.target) || null;
  if (badge.kind === "categories") return facts.categoryEvidence.unlockedAt.get(badge.target) || null;
  return null;
}

function badgeProgressLabel(badge, current, unlocked) {
  if (unlocked) return "Débloqué";
  if (badge.kind === "daily-count") return `${Math.min(current, badge.target)}/${badge.target} défi`;
  if (badge.kind === "perfect-quiz") return "Réussis un quiz sans faute";
  if (badge.kind === "best-streak") return `${Math.min(current, badge.target)}/${badge.target} jours`;
  return `${Math.min(current, badge.target)}/${badge.target} catégories`;
}

export function buildAchievementProfile(attempts = [], userId = null, now = new Date()) {
  const todayKey = getMoroccoDateKey(now);
  const userAttempts = normalizedAttempts(attempts, userId);
  const dailyAttempts = getDailyCompletionProofs(userAttempts, userId)
    .filter((attempt) => attempt.dailyKey <= todayKey);
  const perfectAttempts = userAttempts
    .filter((attempt) => attempt.experienceType !== "guided-mission"
      && Number(attempt.questionCount || 0) > 0
      && Number(attempt.correctCount || 0) >= Number(attempt.questionCount || 0))
    .sort((left, right) => String(proofDate(left)).localeCompare(String(proofDate(right))));
  const streakEvidence = getStreakEvidence(dailyAttempts, todayKey);
  const categoryEvidence = getCategoryEvidence(dailyAttempts);
  const facts = {
    dailyAttempts,
    perfectAttempts,
    streakEvidence,
    categoryEvidence,
    dailyCompletedCount: dailyAttempts.length,
    perfectQuizCount: perfectAttempts.length,
    currentStreak: streakEvidence.currentStreak,
    bestStreak: streakEvidence.bestStreak,
    categories: categoryEvidence.categories,
    categoryCount: categoryEvidence.categories.length,
  };

  const badges = ACHIEVEMENT_BADGES.map((definition, order) => {
    const current = valueForBadge(definition, facts);
    const unlocked = current >= definition.target;
    return Object.freeze({
      ...definition,
      order,
      current,
      unlocked,
      unlockedAt: unlocked ? unlockedAtForBadge(definition, facts) : null,
      progressPercent: Math.min(100, Math.round((current / definition.target) * 100)),
      progressLabel: badgeProgressLabel(definition, current, unlocked),
    });
  });
  const unlockedBadges = badges.filter((badge) => badge.unlocked);
  const lockedBadges = badges.filter((badge) => !badge.unlocked);
  const nextBadge = [...lockedBadges].sort((left, right) =>
    right.progressPercent - left.progressPercent || left.order - right.order,
  )[0] || null;
  const latestUnlocked = [...unlockedBadges].sort((left, right) =>
    String(right.unlockedAt || "").localeCompare(String(left.unlockedAt || "")) || right.order - left.order,
  )[0] || null;

  return Object.freeze({
    todayKey,
    todayCompleted: dailyAttempts.some((attempt) => attempt.dailyKey === todayKey),
    dailyCompletedCount: facts.dailyCompletedCount,
    perfectQuizCount: facts.perfectQuizCount,
    currentStreak: facts.currentStreak,
    bestStreak: facts.bestStreak,
    categoriesExplored: Object.freeze([...facts.categories]),
    categoryCount: facts.categoryCount,
    badges: Object.freeze(badges),
    unlockedBadges: Object.freeze(unlockedBadges),
    lockedBadges: Object.freeze(lockedBadges),
    nextBadge,
    latestUnlocked,
  });
}

export function getRecentDailyCalendar(attempts = [], userId = null, now = new Date(), days = 7) {
  const todayKey = getMoroccoDateKey(now);
  const dayCount = Math.max(1, Math.round(Number(days) || 7));
  const completedKeys = new Set(
    getDailyCompletionProofs(attempts, userId)
      .filter((attempt) => attempt.dailyKey <= todayKey)
      .map((attempt) => attempt.dailyKey),
  );
  return Object.freeze(
    Array.from({ length: dayCount }, (_, index) => {
      const dateKey = shiftDateKey(todayKey, index - (dayCount - 1));
      return Object.freeze({ dateKey, completed: completedKeys.has(dateKey), isToday: dateKey === todayKey });
    }),
  );
}
