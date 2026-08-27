import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAchievementProfile,
  getDailyCompletionProofs,
  getRecentDailyCalendar,
  shiftDateKey,
} from "../src/features/achievements/achievementEngine.js";
import { DAILY_CHALLENGE_ID } from "../src/features/games/dailyChallengeData.js";
import {
  createDemoStore,
  createMemoryStorage,
} from "../src/demoStoreCore.js";

const USER_ID = "user-eleve-lina";

function daily(dateKey, options = {}) {
  const correctCount = options.correctCount ?? 3;
  const questionCount = options.questionCount ?? 5;
  return {
    id: options.id || `${DAILY_CHALLENGE_ID}:${dateKey}`,
    userId: options.userId || USER_ID,
    quizId: DAILY_CHALLENGE_ID,
    dailyKey: dateKey,
    category: options.category || "Maroc",
    correctCount,
    questionCount,
    scorePercent: Math.round((correctCount / questionCount) * 100),
    completedAt: `${dateKey}T18:00:00.000Z`,
  };
}

test("les séries quotidiennes utilisent des dates uniques et conservent le meilleur record", () => {
  const attempts = [
    daily("2026-08-20"),
    daily("2026-08-21"),
    daily("2026-08-22"),
    daily("2026-08-24"),
    daily("2026-08-25"),
    daily("2026-08-26"),
    daily("2026-08-26", { id: "doublon" }),
  ];

  const profile = buildAchievementProfile(attempts, USER_ID, "2026-08-26");
  assert.equal(getDailyCompletionProofs(attempts, USER_ID).length, 6);
  assert.equal(profile.dailyCompletedCount, 6);
  assert.equal(profile.currentStreak, 3);
  assert.equal(profile.bestStreak, 3);
  assert.equal(profile.badges.find((badge) => badge.id === "serie-3").unlocked, true);
  assert.equal(profile.badges.find((badge) => badge.id === "serie-5").unlocked, false);
});

test("les jalons de 3, 5 et 7 jours se déverrouillent seulement avec des preuves consécutives", () => {
  const attempts = Array.from({ length: 7 }, (_, index) =>
    daily(shiftDateKey("2026-08-20", index)),
  );
  const profile = buildAchievementProfile(attempts, USER_ID, "2026-08-26");

  assert.equal(profile.currentStreak, 7);
  assert.equal(profile.bestStreak, 7);
  assert.equal(profile.badges.find((badge) => badge.id === "serie-3").unlockedAt, "2026-08-22");
  assert.equal(profile.badges.find((badge) => badge.id === "serie-5").unlockedAt, "2026-08-24");
  assert.equal(profile.badges.find((badge) => badge.id === "serie-7").unlockedAt, "2026-08-26");
});

test("une série interrompue revient à zéro sans effacer le meilleur record", () => {
  const attempts = Array.from({ length: 5 }, (_, index) =>
    daily(shiftDateKey("2026-08-21", index)),
  );
  const profile = buildAchievementProfile(attempts, USER_ID, "2026-08-30");

  assert.equal(profile.currentStreak, 0);
  assert.equal(profile.bestStreak, 5);
  assert.equal(profile.badges.find((badge) => badge.id === "serie-5").unlocked, true);
});

test("les badges de quiz parfait et de catégories reposent sur les tentatives persistées", () => {
  const categories = ["Maroc", "Français", "Sciences", "Histoire", "Monde"];
  const attempts = categories.map((category, index) =>
    daily(shiftDateKey("2026-08-22", index), {
      category,
      correctCount: index === 2 ? 5 : 4,
    }),
  );
  attempts.push({
    id: "quiz-parfait-autre-eleve",
    userId: "autre-eleve",
    quizId: "culture-generale",
    correctCount: 10,
    questionCount: 10,
    completedAt: "2026-08-26T12:00:00.000Z",
  });

  const profile = buildAchievementProfile(attempts, USER_ID, "2026-08-26");
  assert.equal(profile.perfectQuizCount, 1);
  assert.equal(profile.categoryCount, 5);
  assert.equal(profile.badges.find((badge) => badge.id === "quiz-parfait").unlocked, true);
  assert.equal(profile.badges.find((badge) => badge.id === "tour-du-savoir").unlocked, true);
});

test("une mission guidée autonome ne compte pas comme un quiz parfait", () => {
  const profile = buildAchievementProfile([{
    id: "mission-zellige:2026-08-26",
    userId: USER_ID,
    quizId: "mission-zellige",
    experienceType: "guided-mission",
    dailyKey: "2026-08-26",
    category: "La bibliothèque",
    correctCount: 2,
    questionCount: 2,
    scorePercent: 100,
    completedAt: "2026-08-26T12:00:00.000Z",
  }], USER_ID, "2026-08-26");

  assert.equal(profile.perfectQuizCount, 0);
  assert.equal(profile.badges.find((badge) => badge.id === "quiz-parfait").unlocked, false);
});

test("une preuve datée dans le futur ne débloque pas de badge quotidien", () => {
  const profile = buildAchievementProfile(
    [daily("2026-08-26"), daily("2026-08-27")],
    USER_ID,
    "2026-08-26",
  );

  assert.equal(profile.dailyCompletedCount, 1);
  assert.equal(profile.currentStreak, 1);
  assert.equal(profile.todayCompleted, true);
});

test("le calendrier récent indique les jours réellement terminés", () => {
  const calendar = getRecentDailyCalendar(
    [daily("2026-08-24"), daily("2026-08-26")],
    USER_ID,
    "2026-08-26",
    4,
  );

  assert.deepEqual(calendar.map((day) => day.dateKey), [
    "2026-08-23",
    "2026-08-24",
    "2026-08-25",
    "2026-08-26",
  ]);
  assert.deepEqual(calendar.map((day) => day.completed), [false, true, false, true]);
  assert.equal(calendar.at(-1).isToday, true);
});

test("les badges sont reconstruits après hydratation sans ajouter d’XP", () => {
  const storage = createMemoryStorage();
  const clock = () => new Date("2026-08-26T12:00:00.000Z");
  const store = createDemoStore({ storage, now: clock });
  store.actions.signIn("eleve");
  const xpBefore = store.getState().users.find((user) => user.id === USER_ID).xp;

  ["2026-08-24", "2026-08-25", "2026-08-26"].forEach((dateKey) => {
    const result = store.actions.recordQuizAttempt({
      attemptId: `${DAILY_CHALLENGE_ID}:${dateKey}`,
      quizId: DAILY_CHALLENGE_ID,
      dailyKey: dateKey,
      category: "Maroc",
      userId: USER_ID,
      correctCount: 3,
      questionCount: 5,
      xpEarned: 0,
    });
    assert.equal(result.recorded, true);
  });

  const restored = createDemoStore({ storage, now: clock });
  const profile = buildAchievementProfile(restored.getState().quizAttempts, USER_ID, clock());
  const xpAfter = restored.getState().users.find((user) => user.id === USER_ID).xp;

  assert.equal(profile.currentStreak, 3);
  assert.equal(profile.badges.find((badge) => badge.id === "serie-3").unlocked, true);
  assert.equal(xpAfter, xpBefore);
});
