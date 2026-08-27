import {
  MISSION_ZELLIGE_COMPLETION_XP,
  MISSION_ZELLIGE_ID,
  MISSION_ZELLIGE_LEVEL,
  validateMissionZellige,
} from "./missionZelligeData.js";

export function evaluateMissionHotspot(mission, hotspotId) {
  if (!validateMissionZellige(mission)) {
    return { valid: false, correct: false, reason: "mission_invalid" };
  }
  const hotspot = mission.hotspots.find((item) => item.id === hotspotId);
  if (!hotspot) return { valid: false, correct: false, reason: "hotspot_unknown" };
  return {
    valid: true,
    correct: Boolean(hotspot.correct),
    hotspot,
    reason: hotspot.correct ? "correct" : "try_again",
  };
}

export function evaluateMissionSentence(mission, orderedPieceIds = []) {
  if (!validateMissionZellige(mission)) {
    return { valid: false, correct: false, reason: "mission_invalid" };
  }
  if (!Array.isArray(orderedPieceIds) || orderedPieceIds.length !== mission.correctOrder.length) {
    return { valid: false, correct: false, reason: "sentence_incomplete" };
  }
  const knownIds = new Set(mission.pieces.map((piece) => piece.id));
  if (new Set(orderedPieceIds).size !== orderedPieceIds.length
    || orderedPieceIds.some((id) => !knownIds.has(id))) {
    return { valid: false, correct: false, reason: "sentence_invalid" };
  }
  const correct = orderedPieceIds.every((id, index) => id === mission.correctOrder[index]);
  return {
    valid: true,
    correct,
    reason: correct ? "correct" : "try_again",
    sentence: orderedPieceIds
      .map((id) => mission.pieces.find((piece) => piece.id === id)?.text || "")
      .join(" ")
      .replace(/\s+([?.!,])/g, "$1"),
  };
}

export function moveSentencePiece(orderedPieceIds = [], fromIndex, direction) {
  const values = [...orderedPieceIds];
  const targetIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1;
  if (fromIndex < 0 || fromIndex >= values.length || targetIndex < 0 || targetIndex >= values.length) {
    return values;
  }
  [values[fromIndex], values[targetIndex]] = [values[targetIndex], values[fromIndex]];
  return values;
}

export function buildMissionZelligeSummary({
  daily,
  mission,
  locationFirstTry = false,
  sentenceFirstTry = false,
  awardXp = true,
} = {}) {
  if (!daily?.attemptId || !validateMissionZellige(mission)) {
    throw new TypeError("Une mission quotidienne valide est requise pour créer le résumé.");
  }
  const correctCount = Number(Boolean(locationFirstTry)) + Number(Boolean(sentenceFirstTry));
  const xpEarned = awardXp ? MISSION_ZELLIGE_COMPLETION_XP : 0;
  const assistanceLevel = correctCount === 2
    ? "none"
    : correctCount === 1
      ? "light"
      : "guided";
  const masteryLabel = correctCount === 2
    ? "Réussite autonome"
    : correctCount === 1
      ? "Réussite avec un indice"
      : "Réussite accompagnée";
  return Object.freeze({
    quizId: MISSION_ZELLIGE_ID,
    experienceType: "guided-mission",
    attemptId: daily.attemptId,
    dailyKey: daily.dateKey,
    category: mission.shortTitle,
    fragmentId: `zellige-${mission.id}`,
    fragmentLabel: mission.fragmentLabel,
    level: MISSION_ZELLIGE_LEVEL,
    correctCount,
    questionCount: 2,
    answerXpEarned: 0,
    completionXp: xpEarned,
    xpEarned,
    bestStreak: correctCount,
    scorePercent: Math.round((correctCount / 2) * 100),
    assistanceLevel,
    masteryLabel,
  });
}
