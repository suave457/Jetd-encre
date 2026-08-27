import assert from "node:assert/strict";
import test from "node:test";

import {
  MISSION_ZELLIGE_COMPLETION_XP,
  MISSION_ZELLIGE_ID,
  MISSION_ZELLIGE_MISSIONS,
  getCompletedMissionZellige,
  getDailyMissionZellige,
  getMissionZelligeHistory,
  validateMissionZellige,
} from "../src/features/games/mission-zellige/missionZelligeData.js";
import {
  buildMissionZelligeSummary,
  evaluateMissionHotspot,
  evaluateMissionSentence,
  moveSentencePiece,
} from "../src/features/games/mission-zellige/missionZelligeEngine.js";
import { DEMO_ACCOUNTS, createDemoStore, createMemoryStorage } from "../src/demoStoreCore.js";
import { parseRoute, resolveAppAccess } from "../src/routeCore.js";

const fixedClock = () => new Date("2026-08-27T10:00:00.000Z");

test("les quatre situations illustrées sont complètes et pédagogiquement jouables", () => {
  assert.equal(MISSION_ZELLIGE_MISSIONS.length, 4);
  assert.equal(new Set(MISSION_ZELLIGE_MISSIONS.map((mission) => mission.imageSrc)).size, 4);
  assert.ok(MISSION_ZELLIGE_MISSIONS.every(validateMissionZellige));
  assert.ok(MISSION_ZELLIGE_MISSIONS.every((mission) => mission.hotspots.length === 3));
  assert.ok(MISSION_ZELLIGE_MISSIONS.every((mission) => mission.pieces.length === 3));
  assert.ok(MISSION_ZELLIGE_MISSIONS.every((mission) => mission.imageAlt.length > 30));
  assert.ok(MISSION_ZELLIGE_MISSIONS.every((mission) => mission.sentenceHint.length > 20));
  assert.ok(MISSION_ZELLIGE_MISSIONS.every((mission) => mission.transferPrompt.length > 20));
  assert.ok(MISSION_ZELLIGE_MISSIONS.every((mission) => mission.fragmentLabel.length > 3));
  assert.equal(new Set(MISSION_ZELLIGE_MISSIONS.map((mission) => mission.sentenceHint)).size, 4);
  assert.equal(new Set(MISSION_ZELLIGE_MISSIONS.map((mission) => mission.transferPrompt)).size, 4);
});

test("la bibliothèque est située à droite du café dans tout le contrat pédagogique", () => {
  const mission = MISSION_ZELLIGE_MISSIONS.find(({ id }) => id === "retrouver-la-bibliotheque");
  const pedagogicalContract = [
    mission.clue,
    mission.sentenceHint,
    mission.answer,
    mission.success,
    ...mission.pieces.map(({ text }) => text),
  ].join(" ").toLocaleLowerCase("fr");

  assert.match(pedagogicalContract, /à droite du café/);
  assert.doesNotMatch(pedagogicalContract, /à gauche du café/);
  assert.ok(mission.pieces.some(({ id }) => id === "right"));
  assert.ok(!mission.pieces.some(({ id }) => id === "left"));
  assert.deepEqual(mission.correctOrder, ["library", "is", "right"]);
});

test("la commande du marché conserve le pain rond jusqu’à la réponse", () => {
  const mission = MISSION_ZELLIGE_MISSIONS.find(({ id }) => id === "aider-au-marche");
  const orderPiece = mission.pieces.find(({ id }) => id === "order");

  assert.match(orderPiece.text, /pain rond/);
  assert.match(mission.answer, /pain rond/);
  assert.match(mission.hotspots.find(({ correct }) => correct).label, /pain rond/);
});

test("la mission du jour est stable et la rotation couvre les quatre scènes", () => {
  const first = getDailyMissionZellige("2026-08-27");
  const sameDay = getDailyMissionZellige(new Date("2026-08-27T17:00:00.000Z"));
  assert.equal(first.id, MISSION_ZELLIGE_ID);
  assert.equal(first.mission.id, sameDay.mission.id);
  assert.equal(first.completionXp, MISSION_ZELLIGE_COMPLETION_XP);
  assert.equal(first.attemptId, `${MISSION_ZELLIGE_ID}:2026-08-27`);

  const rotation = [27, 28, 29, 30].map((day) => getDailyMissionZellige(`2026-08-${day}`).mission.id);
  assert.equal(new Set(rotation).size, 4);
});

test("la journée Mission Zellige bascule à minuit au Maroc", () => {
  assert.equal(getDailyMissionZellige(new Date("2026-08-27T22:30:00.000Z")).dateKey, "2026-08-27");
  assert.equal(getDailyMissionZellige(new Date("2026-08-27T23:30:00.000Z")).dateKey, "2026-08-28");
});

test("le moteur corrige le repère et la phrase sans pénalité", () => {
  const mission = MISSION_ZELLIGE_MISSIONS[0];
  const wrongHotspot = mission.hotspots.find((hotspot) => !hotspot.correct);
  const correctHotspot = mission.hotspots.find((hotspot) => hotspot.correct);

  assert.equal(evaluateMissionHotspot(mission, wrongHotspot.id).correct, false);
  assert.equal(evaluateMissionHotspot(mission, correctHotspot.id).correct, true);
  assert.equal(evaluateMissionSentence(mission, [...mission.correctOrder].reverse()).correct, false);
  assert.equal(evaluateMissionSentence(mission, mission.correctOrder).correct, true);
  assert.deepEqual(moveSentencePiece(["a", "b", "c"], 1, "left"), ["b", "a", "c"]);
  assert.deepEqual(moveSentencePiece(["a", "b", "c"], 0, "left"), ["a", "b", "c"]);
});

test("le résumé conserve 20 XP même après un essai accompagné", () => {
  const daily = getDailyMissionZellige("2026-08-27");
  const summary = buildMissionZelligeSummary({
    daily,
    mission: daily.mission,
    locationFirstTry: false,
    sentenceFirstTry: true,
    awardXp: true,
  });
  assert.equal(summary.correctCount, 1);
  assert.equal(summary.scorePercent, 50);
  assert.equal(summary.xpEarned, MISSION_ZELLIGE_COMPLETION_XP);
  assert.equal(summary.questionCount, 2);
  assert.equal(summary.experienceType, "guided-mission");
  assert.equal(summary.fragmentId, `zellige-${daily.mission.id}`);
  assert.equal(summary.fragmentLabel, daily.mission.fragmentLabel);
  assert.equal(summary.assistanceLevel, "light");
  assert.equal(summary.masteryLabel, "Réussite avec un indice");
});

test("la maîtrise reste indépendante des XP et reflète l’assistance des deux essais", () => {
  const daily = getDailyMissionZellige("2026-08-27");
  const build = (locationFirstTry, sentenceFirstTry, awardXp = true) => buildMissionZelligeSummary({
    daily,
    mission: daily.mission,
    locationFirstTry,
    sentenceFirstTry,
    awardXp,
  });

  assert.deepEqual(
    [build(true, true).assistanceLevel, build(true, true).masteryLabel],
    ["none", "Réussite autonome"],
  );
  assert.deepEqual(
    [build(false, true).assistanceLevel, build(false, true).masteryLabel],
    ["light", "Réussite avec un indice"],
  );
  const guidedWithoutXp = build(false, false, false);
  assert.equal(guidedWithoutXp.assistanceLevel, "guided");
  assert.equal(guidedWithoutXp.masteryLabel, "Réussite accompagnée");
  assert.equal(guidedWithoutXp.xpEarned, 0);
  assert.equal(guidedWithoutXp.scorePercent, 0);
});

test("la récompense et la tentative quotidienne restent idempotentes après réhydratation", () => {
  const storage = createMemoryStorage();
  const store = createDemoStore({ storage, now: fixedClock });
  store.actions.signIn("eleve");
  const userId = DEMO_ACCOUNTS.eleve.userId;
  const daily = getDailyMissionZellige("2026-08-27");
  const summary = buildMissionZelligeSummary({
    daily,
    mission: daily.mission,
    locationFirstTry: true,
    sentenceFirstTry: true,
  });
  const beforeXp = store.getState().users.find((user) => user.id === userId).xp;

  assert.equal(store.actions.awardStudentXp({
    amount: MISSION_ZELLIGE_COMPLETION_XP,
    eventId: daily.awardId,
    attemptId: daily.attemptId,
    source: MISSION_ZELLIGE_ID,
    userId,
  }).awarded, true);
  assert.equal(store.actions.recordQuizAttempt({ ...summary, userId }).recorded, true);
  assert.equal(store.actions.awardStudentXp({
    amount: MISSION_ZELLIGE_COMPLETION_XP,
    eventId: daily.awardId,
    userId,
  }).awarded, false);
  assert.equal(store.actions.recordQuizAttempt({
    ...summary,
    attemptId: "mission-zellige:duplicate",
    userId,
  }).recorded, false);
  assert.equal(store.getState().users.find((user) => user.id === userId).xp, beforeXp + 20);

  const restored = createDemoStore({ storage, now: fixedClock });
  const history = getMissionZelligeHistory(restored.getState().quizAttempts, userId);
  assert.equal(history.length, 1);
  assert.equal(getCompletedMissionZellige(history, userId, daily.dateKey)?.id, daily.attemptId);
});

test("la route dédiée est valide et protégée comme l’espace Élève", () => {
  const route = parseRoute("/eleve/jeux/mission-zellige");
  assert.equal(route.kind, "app");
  assert.equal(route.role, "eleve");
  assert.equal(route.page, "jeux");
  assert.equal(route.detail, "mission-zellige");
  assert.equal(resolveAppAccess(route, { authenticated: false }).redirectTo, "/connexion/eleve");
  assert.equal(resolveAppAccess(route, { authenticated: true, role: "eleve" }).allowed, true);
});
