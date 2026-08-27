import assert from "node:assert/strict";
import test from "node:test";

import {
  WORD_CHOICE_CATEGORIES,
  WORD_CHOICE_LEVELS,
  wordChoiceItems,
} from "../src/features/games/word-choice/wordChoiceData.js";
import {
  WORD_CHOICE_DEFAULT_QUESTION_COUNT,
  WORD_CHOICE_DURATION_SECONDS,
  WORD_CHOICE_XP_PER_CORRECT,
  calculateWordChoiceSummary,
  createWordChoiceSession,
  evaluateWordChoiceAnswer,
  getWordChoiceRemainingSeconds,
  isWordChoiceTimeExpired,
  validateWordChoiceItem,
} from "../src/features/games/word-choice/wordChoiceEngine.js";

test("la banque éditoriale contient 20 items cohérents et commercialisables", () => {
  assert.equal(wordChoiceItems.length, 20);
  assert.equal(new Set(wordChoiceItems.map((item) => item.id)).size, 20);

  for (const item of wordChoiceItems) {
    assert.equal(validateWordChoiceItem(item), true, item.id);
    assert.equal(item.prompt.match(/___/g)?.length, 1, item.id);
    assert.equal(item.choices.length, 4, item.id);
    assert.equal(new Set(item.choices).size, 4, item.id);
    assert.ok(item.explanation.length >= 20, item.id);
    assert.ok(item.learningGoal.length >= 12, item.id);
    assert.ok(item.choices[item.correctIndex].trim().length > 0, item.id);
  }
});

test("les niveaux 3e à 6e AEP et les quatre compétences sont réellement couverts", () => {
  assert.deepEqual(new Set(wordChoiceItems.map((item) => item.level)), new Set(WORD_CHOICE_LEVELS));
  assert.deepEqual(new Set(wordChoiceItems.map((item) => item.category)), new Set(WORD_CHOICE_CATEGORIES));

  for (const level of WORD_CHOICE_LEVELS) {
    assert.ok(wordChoiceItems.filter((item) => item.level === level).length >= 4, level);
  }
  for (const category of WORD_CHOICE_CATEGORIES) {
    assert.ok(wordChoiceItems.filter((item) => item.category === category).length >= 5, category);
  }
  assert.deepEqual(new Set(wordChoiceItems.map((item) => item.correctIndex)), new Set([0, 1, 2, 3]));
});

test("une bonne réponse rapporte 10 XP et une erreur ne retire rien", () => {
  const item = wordChoiceItems[0];
  assert.equal(WORD_CHOICE_XP_PER_CORRECT, 10);
  assert.deepEqual(evaluateWordChoiceAnswer(item, item.correctIndex), { isCorrect: true, xp: 10 });
  assert.deepEqual(evaluateWordChoiceAnswer(item, (item.correctIndex + 1) % 4), { isCorrect: false, xp: 0 });
  assert.deepEqual(evaluateWordChoiceAnswer(item, null), { isCorrect: false, xp: 0 });
  assert.deepEqual(evaluateWordChoiceAnswer(item, 99), { isCorrect: false, xp: 0 });
});

test("le résumé calcule score, XP, série et résultats par compétence", () => {
  const items = wordChoiceItems.slice(0, 8);
  const answers = [
    items[0].correctIndex,
    items[1].correctIndex,
    (items[2].correctIndex + 1) % 4,
    items[3].correctIndex,
    items[4].correctIndex,
    items[5].correctIndex,
    null,
    items[7].correctIndex,
  ];
  const summary = calculateWordChoiceSummary(items, answers);

  assert.equal(summary.correctCount, 6);
  assert.equal(summary.questionCount, 8);
  assert.equal(summary.xpEarned, 60);
  assert.equal(summary.bestStreak, 3);
  assert.equal(summary.scorePercent, 75);
  assert.deepEqual(summary.categoryResults.Lexique, { correct: 4, total: 5 });
  assert.deepEqual(summary.categoryResults.Accords, { correct: 2, total: 3 });
  assert.ok(Object.isFrozen(summary.categoryResults.Accords));
});

test("la sélection de session est stable, filtrable et limitée à dix items", () => {
  const first = createWordChoiceSession(wordChoiceItems, { seed: "classe-5a" });
  const second = createWordChoiceSession(wordChoiceItems, { seed: "classe-5a" });
  assert.equal(first.length, WORD_CHOICE_DEFAULT_QUESTION_COUNT);
  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));

  const filtered = createWordChoiceSession(wordChoiceItems, {
    level: "5e AEP",
    category: "Accords",
    limit: 20,
    seed: "accords-5e",
  });
  assert.ok(filtered.length >= 2);
  assert.ok(filtered.every((item) => item.level === "5e AEP" && item.category === "Accords"));
});

test("le compte à rebours dure exactement dix secondes", () => {
  const start = 5_000;
  assert.equal(WORD_CHOICE_DURATION_SECONDS, 10);
  assert.equal(getWordChoiceRemainingSeconds(start, start), 10);
  assert.equal(getWordChoiceRemainingSeconds(start, start + 1), 10);
  assert.equal(getWordChoiceRemainingSeconds(start, start + 1_000), 9);
  assert.equal(getWordChoiceRemainingSeconds(start, start + 9_999), 1);
  assert.equal(getWordChoiceRemainingSeconds(start, start + 10_000), 0);
  assert.equal(getWordChoiceRemainingSeconds(start, start + 40_000), 0);
  assert.equal(isWordChoiceTimeExpired(start, start + 9_999), false);
  assert.equal(isWordChoiceTimeExpired(start, start + 10_000), true);
});

test("le moteur refuse les items ambigus ou incomplets", () => {
  const valid = wordChoiceItems[0];
  assert.throws(() => validateWordChoiceItem({ ...valid, prompt: "Phrase sans blanc." }), /exactement un blanc/);
  assert.throws(() => validateWordChoiceItem({ ...valid, choices: ["un", "deux"] }), /exactement quatre choix/);
  assert.throws(() => validateWordChoiceItem({ ...valid, choices: ["un", "un", "deux", "trois"] }), /doivent être distincts/);
  assert.throws(() => validateWordChoiceItem({ ...valid, level: "collège" }), /Niveau inconnu/);
});
