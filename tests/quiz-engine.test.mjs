import assert from "node:assert/strict";
import test from "node:test";

import { cultureQuizQuestions } from "../src/features/games/cultureQuizData.js";
import {
  QUESTION_DURATION_SECONDS,
  XP_PER_CORRECT,
  calculateQuizSummary,
  evaluateAnswer,
  getRemainingSeconds,
  isTimeExpired,
  prepareQuizQuestions,
  shuffleQuizQuestions,
} from "../src/features/games/quizEngine.js";
import { QUESTION_STATUSES } from "../src/features/question-bank/questionBankConstants.js";
import { seedQuestionBank } from "../src/features/question-bank/questionBankSeed.js";

test("le quiz reprend exactement les questions publiées de la banque éditoriale", () => {
  const publishedIds = seedQuestionBank
    .filter(({ status }) => status === QUESTION_STATUSES.PUBLISHED)
    .map(({ id }) => id);
  assert.deepEqual(
    cultureQuizQuestions.map(({ id }) => id).sort(),
    publishedIds.sort(),
  );
  assert.equal(new Set(cultureQuizQuestions.map(({ id }) => id)).size, publishedIds.length);

  for (const question of cultureQuizQuestions) {
    assert.equal(typeof question.prompt, "string", question.id);
    assert.equal(question.choices.length, 4, question.id);
    assert.ok(question.choices.every((choice) => typeof choice === "string"), question.id);
    assert.ok(Number.isInteger(question.correctIndex), question.id);
    assert.ok(question.correctIndex >= 0 && question.correctIndex < 4, question.id);
    assert.ok(question.explanation.length > 0, question.id);
    assert.ok(question.theme.length > 0, question.id);
    assert.ok(["facile", "intermédiaire"].includes(question.level), question.id);
    assert.ok(question.targetLevel.endsWith("AEP"), question.id);
    assert.ok(Array.isArray(question.tags), question.id);
  }
});

test("le brassage est déterministe, non destructif et limité", () => {
  const originalIds = cultureQuizQuestions.map(({ id }) => id);
  const first = shuffleQuizQuestions(cultureQuizQuestions, "classe-5a:2026-08-27");
  const replay = shuffleQuizQuestions(cultureQuizQuestions, "classe-5a:2026-08-27");
  const other = shuffleQuizQuestions(cultureQuizQuestions, "classe-5b:2026-08-27");

  assert.deepEqual(first.map(({ id }) => id), replay.map(({ id }) => id));
  assert.notDeepEqual(first.map(({ id }) => id), other.map(({ id }) => id));
  assert.deepEqual(cultureQuizQuestions.map(({ id }) => id), originalIds);
  assert.equal(prepareQuizQuestions(cultureQuizQuestions, { limit: 5, seed: "audit" }).length, 5);
});

test("une bonne réponse rapporte 10 XP", () => {
  const question = cultureQuizQuestions[0];

  assert.equal(XP_PER_CORRECT, 10);
  assert.deepEqual(evaluateAnswer(question, question.correctIndex), {
    isCorrect: true,
    xp: 10,
  });
});

test("une réponse fausse, absente ou invalide ne retire aucun XP", () => {
  const question = cultureQuizQuestions[0];
  const wrongIndex = (question.correctIndex + 1) % question.choices.length;

  assert.deepEqual(evaluateAnswer(question, wrongIndex), {
    isCorrect: false,
    xp: 0,
  });
  assert.equal(evaluateAnswer(question, null).xp, 0);
  assert.equal(evaluateAnswer(question, 99).xp, 0);
});

test("le résumé lit un tableau d’indices aligné sur les questions", () => {
  const questions = cultureQuizQuestions.slice(0, 6);
  const answers = [
    questions[0].correctIndex,
    questions[1].correctIndex,
    (questions[2].correctIndex + 1) % 4,
    questions[3].correctIndex,
    questions[4].correctIndex,
    undefined,
  ];

  assert.deepEqual(calculateQuizSummary(questions, answers), {
    correctCount: 4,
    xpEarned: 40,
    bestStreak: 2,
    scorePercent: 67,
  });
});

test("le résumé vide reste défini et ne crée aucune pénalité", () => {
  assert.deepEqual(calculateQuizSummary([], []), {
    correctCount: 0,
    xpEarned: 0,
    bestStreak: 0,
    scorePercent: 0,
  });
});

test("le compte à rebours dure exactement 10 secondes et ne devient jamais négatif", () => {
  const start = 1_000;

  assert.equal(QUESTION_DURATION_SECONDS, 10);
  assert.equal(getRemainingSeconds(start, start), 10);
  assert.equal(getRemainingSeconds(start, start + 1), 10);
  assert.equal(getRemainingSeconds(start, start + 1_000), 9);
  assert.equal(getRemainingSeconds(start, start + 9_999), 1);
  assert.equal(getRemainingSeconds(start, start + 10_000), 0);
  assert.equal(getRemainingSeconds(start, start + 15_000), 0);
  assert.equal(isTimeExpired(start, start + 9_999), false);
  assert.equal(isTimeExpired(start, start + 10_000), true);
});

test("le moteur refuse une question mal formée", () => {
  assert.throws(
    () => evaluateAnswer({ id: "invalide", choices: [], correctIndex: 0 }, 0),
    /exactement quatre choix/,
  );
});
