export const CLASS_CHALLENGE_QUESTION_COUNT = 5;
export const CLASS_CHALLENGE_XP_PER_CORRECT = 10;

export const CLASS_CHALLENGE_DURATIONS = Object.freeze([
  Object.freeze({ hours: 24, label: "24 heures" }),
  Object.freeze({ hours: 72, label: "3 jours" }),
  Object.freeze({ hours: 168, label: "7 jours" }),
]);

export const SAFE_CLASS_PSEUDONYMS = Object.freeze([
  "Plume Indigo",
  "Étoile Safran",
  "Nuage Menthe",
  "Comète Corail",
  "Soleil Azur",
  "Atlas Doré",
  "Lune Zellige",
  "Rose des vents",
  "Perle Océane",
  "Fennec Turquoise",
  "Palmier Pourpre",
  "Hirondelle Ivoire",
]);

const asDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const asText = (value) => String(value ?? "").trim();

export function isSafeClassPseudonym(value) {
  return SAFE_CLASS_PSEUDONYMS.includes(asText(value));
}

export function getClassChallengeStatus(challenge, now = new Date()) {
  if (!challenge || typeof challenge !== "object") return "termine";
  if (challenge.status === "termine") return "termine";
  const endAt = asDate(challenge.endAt);
  const current = asDate(now);
  if (!endAt || !current || current >= endAt) return "termine";
  return "en_cours";
}

export function getChallengeTimeLabel(challenge, now = new Date()) {
  if (getClassChallengeStatus(challenge, now) === "termine") return "Terminé";
  const endAt = asDate(challenge.endAt);
  const current = asDate(now);
  const remainingMs = Math.max(0, endAt.getTime() - current.getTime());
  const hours = Math.ceil(remainingMs / 3_600_000);
  if (hours <= 24) return `${hours} h restantes`;
  return `${Math.ceil(hours / 24)} jours restants`;
}

export function calculateClassChallengeScore(correctCount, questionCount) {
  const total = Math.max(0, Number(questionCount) || 0);
  const correct = Math.max(0, Math.min(total, Number(correctCount) || 0));
  return Object.freeze({
    correctCount: correct,
    questionCount: total,
    score: correct * 100,
    scorePercent: total ? Math.round((correct / total) * 100) : 0,
  });
}

export function rankClassChallengeResults(results = []) {
  const completed = (Array.isArray(results) ? results : [])
    .filter((item) => item?.status === "termine")
    .map((item) => ({ ...item, score: Math.max(0, Number(item.score) || 0) }))
    .sort((a, b) => b.score - a.score || asText(a.pseudonym).localeCompare(asText(b.pseudonym), "fr"));

  const scoreCounts = completed.reduce((counts, item) => {
    counts.set(item.score, (counts.get(item.score) || 0) + 1);
    return counts;
  }, new Map());

  let previousScore = null;
  let previousRank = 0;
  return completed.map((item, index) => {
    const rank = item.score === previousScore ? previousRank : index + 1;
    previousScore = item.score;
    previousRank = rank;
    return Object.freeze({
      ...item,
      rank,
      tied: (scoreCounts.get(item.score) || 0) > 1,
    });
  });
}

/**
 * Retourne uniquement les champs autorisés à l'écran. Les identifiants de compte,
 * noms, courriels et autres données personnelles sont volontairement ignorés.
 */
export function buildSafeClassLeaderboard(challenge, results = [], viewerParticipantId = null) {
  if (!challenge) return [];
  const scoped = (Array.isArray(results) ? results : []).filter(
    (item) => item?.challengeId === challenge.id && item?.classId === challenge.classId,
  );
  const ranked = rankClassChallengeResults(scoped);
  const completedIds = new Set(ranked.map((item) => item.participantId));
  const safeCompleted = ranked.map((item) => Object.freeze({
    rank: item.rank,
    tied: item.tied,
    pseudonym: isSafeClassPseudonym(item.pseudonym) ? item.pseudonym : "Pseudonyme protégé",
    score: item.score,
    correctCount: Math.max(0, Number(item.correctCount) || 0),
    questionCount: Math.max(0, Number(item.questionCount) || 0),
    progressPercent: 100,
    status: "termine",
    isViewer: Boolean(viewerParticipantId && item.participantId === viewerParticipantId),
  }));

  const inProgress = scoped
    .filter((item) => item?.status !== "termine" && !completedIds.has(item.participantId))
    .sort((a, b) => (Number(b.progressPercent) || 0) - (Number(a.progressPercent) || 0))
    .map((item) => Object.freeze({
      rank: null,
      tied: false,
      pseudonym: isSafeClassPseudonym(item.pseudonym) ? item.pseudonym : "Pseudonyme protégé",
      score: Math.max(0, Number(item.score) || 0),
      correctCount: Math.max(0, Number(item.correctCount) || 0),
      questionCount: Math.max(0, Number(item.questionCount) || CLASS_CHALLENGE_QUESTION_COUNT),
      progressPercent: Math.max(0, Math.min(99, Number(item.progressPercent) || 0)),
      status: "en_cours",
      isViewer: Boolean(viewerParticipantId && item.participantId === viewerParticipantId),
    }));

  return Object.freeze([...safeCompleted, ...inProgress]);
}

export function validateClassChallengeDraft(draft = {}, publishedBanks = []) {
  const fieldErrors = {};
  const title = asText(draft.title);
  const classId = asText(draft.classId);
  const classLabel = asText(draft.classLabel);
  const level = asText(draft.level);
  const theme = asText(draft.theme);
  const bankId = asText(draft.bankId);
  const durationHours = Number(draft.durationHours);
  const bank = publishedBanks.find((item) => item.id === bankId && item.status === "publie");

  if (title.length < 5 || title.length > 80) fieldErrors.title = "Choisissez un titre de 5 à 80 caractères.";
  if (!classId || !classLabel) fieldErrors.classId = "Choisissez une classe.";
  if (!level) fieldErrors.level = "Choisissez un niveau.";
  if (!theme) fieldErrors.theme = "Choisissez un thème.";
  if (!CLASS_CHALLENGE_DURATIONS.some((item) => item.hours === durationHours)) {
    fieldErrors.durationHours = "Choisissez une durée proposée.";
  }
  if (!bank) fieldErrors.bankId = "Choisissez une banque publiée.";
  if (bank && bank.questionIds.length < CLASS_CHALLENGE_QUESTION_COUNT) {
    fieldErrors.bankId = `Cette banque doit contenir au moins ${CLASS_CHALLENGE_QUESTION_COUNT} questions publiées.`;
  }

  if (Object.keys(fieldErrors).length) return { ok: false, error: "validation_failed", fieldErrors };
  return {
    ok: true,
    value: Object.freeze({
      title,
      classId,
      classLabel,
      level,
      theme,
      bankId,
      bankLabel: bank.label,
      bankStatus: "publie",
      durationHours,
      questionIds: Object.freeze(bank.questionIds.slice(0, CLASS_CHALLENGE_QUESTION_COUNT)),
    }),
  };
}

export function canParticipateInClassChallenge(challenge, results = [], participantId, now = new Date()) {
  if (!challenge || !participantId) return false;
  if (getClassChallengeStatus(challenge, now) !== "en_cours") return false;
  return !(Array.isArray(results) ? results : []).some(
    (item) => item.challengeId === challenge.id && item.participantId === participantId && item.status === "termine",
  );
}
