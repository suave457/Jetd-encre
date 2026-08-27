import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_CATEGORIES,
  DAILY_CHALLENGE_ID,
  DAILY_COMPLETION_XP,
  getCompletedDailyChallenge,
  getDailyChallenge,
  getDailyChallengeHistory,
  getMoroccoDateKey,
} from "../src/features/games/dailyChallengeData.js";
import {
  DEMO_ACCOUNTS,
  createDemoStore,
  createMemoryStorage,
} from "../src/demoStoreCore.js";

const fixedClock = () => new Date("2026-08-26T10:00:00.000Z");

test("le défi quotidien reste déterministe et contient cinq catégories distinctes", () => {
  const first = getDailyChallenge("2026-08-26");
  const second = getDailyChallenge(new Date("2026-08-26T18:00:00.000Z"));

  assert.equal(first.id, DAILY_CHALLENGE_ID);
  assert.equal(first.questions.length, 5);
  assert.equal(first.completionXp, DAILY_COMPLETION_XP);
  assert.deepEqual(
    first.questions.map((question) => question.id),
    second.questions.map((question) => question.id),
  );
  assert.deepEqual(new Set(first.categories), new Set(DAILY_CATEGORIES));
  assert.equal(new Set(first.questions.map((question) => question.id)).size, 5);
  assert.ok(first.questions.every((question) => question.choices.length === 4));
});

test("la catégorie vedette tourne chaque jour", () => {
  const days = [26, 27, 28, 29, 30].map((day) =>
    getDailyChallenge(`2026-08-${day}`).category,
  );
  assert.equal(new Set(days).size, DAILY_CATEGORIES.length);
  assert.deepEqual(new Set(days), new Set(DAILY_CATEGORIES));
});

test("la clé de journée suit l’heure du Maroc", () => {
  assert.equal(getMoroccoDateKey(new Date("2026-08-26T22:30:00.000Z")), "2026-08-26");
  assert.equal(getMoroccoDateKey(new Date("2026-08-26T23:30:00.000Z")), "2026-08-27");
});

test("la complétion quotidienne et son bonus ne sont enregistrés qu’une fois", () => {
  const storage = createMemoryStorage();
  const store = createDemoStore({ storage, now: fixedClock });
  store.actions.signIn("eleve");
  const userId = DEMO_ACCOUNTS.eleve.userId;
  const challenge = getDailyChallenge("2026-08-26");

  for (const question of challenge.questions) {
    const award = store.actions.awardStudentXp({
      amount: 10,
      eventId: `${challenge.awardNamespace}:${question.id}`,
      attemptId: challenge.attemptId,
      questionId: question.id,
      source: DAILY_CHALLENGE_ID,
      userId,
    });
    assert.equal(award.awarded, true);
  }
  const completionAward = store.actions.awardStudentXp({
    amount: DAILY_COMPLETION_XP,
    eventId: `${challenge.awardNamespace}:completion`,
    attemptId: challenge.attemptId,
    source: DAILY_CHALLENGE_ID,
    userId,
  });
  assert.equal(completionAward.awarded, true);

  const recorded = store.actions.recordQuizAttempt({
    attemptId: challenge.attemptId,
    quizId: DAILY_CHALLENGE_ID,
    dailyKey: challenge.dateKey,
    category: challenge.category,
    userId,
    correctCount: 5,
    questionCount: 5,
    answerXpEarned: 50,
    completionXp: DAILY_COMPLETION_XP,
    xpEarned: 70,
    scorePercent: 100,
    bestStreak: 5,
  });
  assert.equal(recorded.recorded, true);

  assert.equal(store.actions.awardStudentXp({
    amount: DAILY_COMPLETION_XP,
    eventId: `${challenge.awardNamespace}:completion`,
    userId,
  }).awarded, false);
  assert.equal(store.actions.recordQuizAttempt({
    attemptId: "autre-identifiant",
    quizId: DAILY_CHALLENGE_ID,
    dailyKey: challenge.dateKey,
    userId,
  }).recorded, false);
  assert.equal(store.getState().users.find((user) => user.id === userId).xp, 1310);

  const restored = createDemoStore({ storage, now: fixedClock });
  const history = getDailyChallengeHistory(restored.getState().quizAttempts, userId);
  assert.equal(history.length, 1);
  assert.equal(history[0].completionXp, DAILY_COMPLETION_XP);
  assert.equal(getCompletedDailyChallenge(history, userId, challenge.dateKey)?.id, challenge.attemptId);
});

test("une mauvaise réponse ne retire jamais d’XP du profil", () => {
  const store = createDemoStore({ storage: createMemoryStorage(), now: fixedClock });
  store.actions.signIn("eleve");
  const before = store.getState().users.find((user) => user.id === DEMO_ACCOUNTS.eleve.userId).xp;

  store.actions.recordQuizAttempt({
    attemptId: "defi-du-jour:2026-08-27",
    quizId: DAILY_CHALLENGE_ID,
    dailyKey: "2026-08-27",
    userId: DEMO_ACCOUNTS.eleve.userId,
    correctCount: 0,
    questionCount: 5,
    answerXpEarned: 0,
    completionXp: 0,
    xpEarned: 0,
    scorePercent: 0,
  });

  const after = store.getState().users.find((user) => user.id === DEMO_ACCOUNTS.eleve.userId).xp;
  assert.equal(after, before);
});
