export const QUESTION_DURATION_SECONDS = 10;
export const XP_PER_CORRECT = 10;

function assertValidQuestion(question) {
  if (!question || typeof question !== "object") {
    throw new TypeError("Une question valide est requise.");
  }

  if (typeof question.id !== "string" || question.id.length === 0) {
    throw new TypeError("Chaque question doit avoir un identifiant.");
  }

  if (!Array.isArray(question.choices) || question.choices.length !== 4) {
    throw new RangeError("Chaque question doit proposer exactement quatre choix.");
  }

  if (question.choices.some((choice) => typeof choice !== "string" || !choice.trim())) {
    throw new TypeError("Chaque choix doit être un texte non vide.");
  }

  if (
    !Number.isInteger(question.correctIndex) ||
    question.correctIndex < 0 ||
    question.correctIndex >= question.choices.length
  ) {
    throw new RangeError("L’indice de la bonne réponse est invalide.");
  }
}

/**
 * Évalue un indice de réponse sans modifier la question.
 * Un indice absent ou invalide correspond à une réponse non donnée et rapporte 0 XP.
 */
export function evaluateAnswer(question, selectedIndex) {
  assertValidQuestion(question);

  const hasValidSelection =
    Number.isInteger(selectedIndex) &&
    selectedIndex >= 0 &&
    selectedIndex < question.choices.length;
  const isCorrect = hasValidSelection && selectedIndex === question.correctIndex;

  return Object.freeze({
    isCorrect,
    xp: isCorrect ? XP_PER_CORRECT : 0,
  });
}

/**
 * `answers` est un tableau d'indices aligné sur `questions` :
 * answers[0] répond à questions[0]. Utiliser null ou undefined pour un délai
 * dépassé ou une question sans réponse.
 */
export function calculateQuizSummary(questions, answers = []) {
  if (!Array.isArray(questions)) {
    throw new TypeError("La liste de questions doit être un tableau.");
  }
  if (!Array.isArray(answers)) {
    throw new TypeError("Les réponses doivent être un tableau d’indices.");
  }

  let correctCount = 0;
  let bestStreak = 0;
  let currentStreak = 0;

  questions.forEach((question, index) => {
    const { isCorrect } = evaluateAnswer(question, answers[index]);

    if (isCorrect) {
      correctCount += 1;
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });

  return Object.freeze({
    correctCount,
    xpEarned: correctCount * XP_PER_CORRECT,
    bestStreak,
    scorePercent: questions.length === 0
      ? 0
      : Math.round((correctCount / questions.length) * 100),
  });
}

/**
 * Calcule le nombre de secondes entières à afficher. Les deux horodatages sont
 * fournis par l'appelant afin que le calcul reste déterministe et testable.
 */
export function getRemainingSeconds(
  startedAtMs,
  currentTimeMs,
  durationSeconds = QUESTION_DURATION_SECONDS,
) {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(currentTimeMs)) {
    throw new TypeError("Les horodatages doivent être des nombres finis.");
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new RangeError("La durée doit être un nombre positif ou nul.");
  }

  const elapsedMs = Math.max(0, currentTimeMs - startedAtMs);
  return Math.max(0, Math.ceil(durationSeconds - elapsedMs / 1000));
}

export function isTimeExpired(
  startedAtMs,
  currentTimeMs,
  durationSeconds = QUESTION_DURATION_SECONDS,
) {
  return getRemainingSeconds(startedAtMs, currentTimeMs, durationSeconds) === 0;
}
