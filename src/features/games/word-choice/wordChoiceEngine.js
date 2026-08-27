import {
  WORD_CHOICE_CATEGORIES,
  WORD_CHOICE_LEVELS,
} from "./wordChoiceData.js";

export const WORD_CHOICE_DURATION_SECONDS = 10;
export const WORD_CHOICE_XP_PER_CORRECT = 10;
export const WORD_CHOICE_DEFAULT_QUESTION_COUNT = 10;

export function validateWordChoiceItem(item) {
  if (!item || typeof item !== "object") {
    throw new TypeError("Un item du Mot juste est requis.");
  }
  if (typeof item.id !== "string" || !item.id.trim()) {
    throw new TypeError("Chaque item doit avoir un identifiant.");
  }
  if (!WORD_CHOICE_LEVELS.includes(item.level)) {
    throw new RangeError(`Niveau inconnu pour ${item.id}.`);
  }
  if (!WORD_CHOICE_CATEGORIES.includes(item.category)) {
    throw new RangeError(`Catégorie inconnue pour ${item.id}.`);
  }
  if (typeof item.prompt !== "string" || item.prompt.split("___").length !== 2) {
    throw new RangeError(`La phrase ${item.id} doit contenir exactement un blanc « ___ ».`);
  }
  if (!Array.isArray(item.choices) || item.choices.length !== 4) {
    throw new RangeError(`L’item ${item.id} doit proposer exactement quatre choix.`);
  }
  if (item.choices.some((choice) => typeof choice !== "string" || !choice.trim())) {
    throw new TypeError(`Les choix de ${item.id} doivent être des textes non vides.`);
  }
  if (new Set(item.choices.map((choice) => choice.trim().toLocaleLowerCase("fr"))).size !== 4) {
    throw new RangeError(`Les quatre choix de ${item.id} doivent être distincts.`);
  }
  if (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex > 3) {
    throw new RangeError(`L’indice de réponse de ${item.id} est invalide.`);
  }
  if (typeof item.explanation !== "string" || item.explanation.trim().length < 20) {
    throw new RangeError(`L’explication de ${item.id} est trop courte.`);
  }
  if (typeof item.learningGoal !== "string" || item.learningGoal.trim().length < 12) {
    throw new RangeError(`L’objectif d’apprentissage de ${item.id} est trop court.`);
  }
  return true;
}

export function evaluateWordChoiceAnswer(item, selectedIndex) {
  validateWordChoiceItem(item);
  const hasSelection = Number.isInteger(selectedIndex)
    && selectedIndex >= 0
    && selectedIndex < item.choices.length;
  const isCorrect = hasSelection && selectedIndex === item.correctIndex;
  return Object.freeze({
    isCorrect,
    xp: isCorrect ? WORD_CHOICE_XP_PER_CORRECT : 0,
  });
}

export function calculateWordChoiceSummary(items, answers = []) {
  if (!Array.isArray(items) || !Array.isArray(answers)) {
    throw new TypeError("Les items et les réponses doivent être des tableaux.");
  }

  let correctCount = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  const categoryResults = Object.fromEntries(
    WORD_CHOICE_CATEGORIES.map((category) => [category, { correct: 0, total: 0 }]),
  );

  items.forEach((item, index) => {
    const result = evaluateWordChoiceAnswer(item, answers[index]);
    categoryResults[item.category].total += 1;
    if (result.isCorrect) {
      correctCount += 1;
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
      categoryResults[item.category].correct += 1;
    } else {
      currentStreak = 0;
    }
  });

  const frozenCategoryResults = Object.freeze(Object.fromEntries(
    Object.entries(categoryResults).map(([category, result]) => [
      category,
      Object.freeze({ ...result }),
    ]),
  ));

  return Object.freeze({
    correctCount,
    questionCount: items.length,
    xpEarned: correctCount * WORD_CHOICE_XP_PER_CORRECT,
    bestStreak,
    scorePercent: items.length ? Math.round((correctCount / items.length) * 100) : 0,
    categoryResults: frozenCategoryResults,
  });
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Sélection stable : pratique pour rejouer le même parcours en classe. */
export function createWordChoiceSession(items, {
  level = "Tous",
  category = "Toutes",
  limit = WORD_CHOICE_DEFAULT_QUESTION_COUNT,
  seed = "jet-encre-mot-juste",
} = {}) {
  if (!Array.isArray(items)) throw new TypeError("La banque d’items doit être un tableau.");
  items.forEach(validateWordChoiceItem);
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
  const filtered = items.filter((item) =>
    (level === "Tous" || item.level === level)
    && (category === "Toutes" || item.category === category));

  return Object.freeze(
    [...filtered]
      .sort((left, right) => {
        const leftHash = hashSeed(`${seed}:${left.id}`);
        const rightHash = hashSeed(`${seed}:${right.id}`);
        return leftHash - rightHash || left.id.localeCompare(right.id);
      })
      .slice(0, safeLimit),
  );
}

export function getWordChoiceRemainingSeconds(
  startedAtMs,
  nowMs,
  durationSeconds = WORD_CHOICE_DURATION_SECONDS,
) {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) {
    throw new TypeError("Les horodatages doivent être des nombres finis.");
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new RangeError("La durée doit être positive ou nulle.");
  }
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  return Math.max(0, Math.ceil(durationSeconds - elapsedMs / 1000));
}

export function isWordChoiceTimeExpired(
  startedAtMs,
  nowMs,
  durationSeconds = WORD_CHOICE_DURATION_SECONDS,
) {
  return getWordChoiceRemainingSeconds(startedAtMs, nowMs, durationSeconds) === 0;
}
