import assert from "node:assert/strict";
import test from "node:test";

import { cultureQuizQuestions } from "../src/features/games/cultureQuizData.js";
import {
  QUESTION_CATEGORIES,
  QUESTION_BANK_STORAGE_KEY,
  QUESTION_STATUSES,
} from "../src/features/question-bank/questionBankConstants.js";
import {
  createMemoryQuestionBankStorage,
  createQuestionBank,
  filterQuestions,
  fromCultureQuizQuestion,
  getQuestionBankStats,
  migrateQuestionBankState,
  selectPublishedQuizQuestions,
  validateQuestion,
} from "../src/features/question-bank/questionBankCore.js";
import { seedQuestionBank } from "../src/features/question-bank/questionBankSeed.js";
import { readPublishedGameQuestions } from "../src/features/games/publishedQuestionSource.js";

function clock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 7, 26, 10, 0, tick++));
}

function validDraft(overrides = {}) {
  return {
    category: "Vie quotidienne",
    level: "4e AEP",
    difficulty: "facile",
    prompt: "Quelle formule convient pour saluer une personne le matin ?",
    choices: ["Bonjour !", "Bonne nuit !", "À demain !", "Bon voyage !"],
    correctIndex: 0,
    explanation: "On utilise « Bonjour ! » pour saluer une personne pendant la matinée.",
    status: QUESTION_STATUSES.DRAFT,
    tags: ["oral", "politesse"],
    source: "Jet d’Encre Éditions",
    media: null,
    ...overrides,
  };
}

test("la banque initiale couvre les huit catégories avec des questions strictement valides", () => {
  assert.equal(seedQuestionBank.length, 20);
  assert.equal(new Set(seedQuestionBank.map((item) => item.id)).size, seedQuestionBank.length);
  seedQuestionBank.forEach((question) => {
    const result = validateQuestion(question);
    assert.equal(result.ok, true, `${question.id}: ${JSON.stringify(result.fieldErrors)}`);
  });
  const stats = getQuestionBankStats(seedQuestionBank);
  assert.equal(stats.coverage, QUESTION_CATEGORIES.length);
  assert.equal(stats.byStatus[QUESTION_STATUSES.PUBLISHED], 10);
  assert.equal(stats.byStatus[QUESTION_STATUSES.APPROVED], 7);
  assert.equal(stats.byStatus[QUESTION_STATUSES.DRAFT], 3);
});

test("la validation exige quatre réponses uniques, une bonne réponse et une explication", () => {
  const result = validateQuestion(validDraft({
    prompt: "Courte",
    choices: ["Même réponse", " même   réponse ", "", "Quatrième"],
    correctIndex: 8,
    explanation: "Courte",
  }));
  assert.equal(result.ok, false);
  assert.match(result.fieldErrors.prompt, /au moins/);
  assert.match(result.fieldErrors.choices, /différentes/);
  assert.ok(result.fieldErrors["choices.2"]);
  assert.ok(result.fieldErrors.correctIndex);
  assert.ok(result.fieldErrors.explanation);
});

test("le média facultatif impose une source sûre et un texte alternatif pour une image", () => {
  const unsafe = validateQuestion(validDraft({ media: { kind: "image", src: "javascript:alert(1)", alt: "" } }));
  assert.equal(unsafe.ok, false);
  assert.ok(unsafe.fieldErrors.media);
  assert.ok(unsafe.fieldErrors.mediaAlt);

  const accessible = validateQuestion(validDraft({
    media: { kind: "image", src: "/assets/carte-maroc.png", alt: "Carte simplifiée du Maroc et de ses côtes." },
  }));
  assert.equal(accessible.ok, true);
});

test("le CRUD respecte le cycle brouillon, validé, publié et reste persistant", () => {
  const storage = createMemoryQuestionBankStorage();
  const now = clock();
  let idSequence = 0;
  const bank = createQuestionBank({ storage, now, initialQuestions: [], makeId: () => `qb-test-salutation-${++idSequence}` });
  const created = bank.actions.createQuestion(validDraft());
  assert.equal(created.ok, true);
  assert.equal(created.item.status, QUESTION_STATUSES.DRAFT);

  const updated = bank.actions.updateQuestion(created.item.id, { prompt: "Quelle formule polie utilise-t-on pour saluer une personne le matin ?" });
  assert.equal(updated.ok, true);
  assert.equal(updated.item.revision, 2);

  const skippedReview = bank.actions.transitionQuestionStatus(created.item.id, QUESTION_STATUSES.PUBLISHED);
  assert.equal(skippedReview.error, "invalid_status_transition");
  assert.equal(bank.actions.transitionQuestionStatus(created.item.id, QUESTION_STATUSES.APPROVED).ok, true);
  const published = bank.actions.transitionQuestionStatus(created.item.id, QUESTION_STATUSES.PUBLISHED);
  assert.equal(published.ok, true);
  assert.ok(published.item.publishedAt);

  const copy = bank.actions.duplicateQuestion(created.item.id);
  assert.equal(copy.ok, true);
  assert.equal(copy.item.status, QUESTION_STATUSES.DRAFT);
  assert.match(copy.item.prompt, /\(copie\)$/);
  assert.equal(bank.getState().questions.length, 2);

  const restored = createQuestionBank({ storage, now, initialQuestions: [] });
  assert.equal(restored.getState().questions.length, 2);
  assert.equal(restored.getState().questions.find((item) => item.id === created.item.id).status, QUESTION_STATUSES.PUBLISHED);
  assert.equal(restored.actions.deleteQuestion(copy.item.id).ok, true);
  assert.equal(restored.actions.deleteQuestion("absente").error, "not_found");
});

test("les filtres combinent recherche sans accents, catégorie, niveau, difficulté et statut", () => {
  const result = filterQuestions(seedQuestionBank, {
    query: "mediterranee",
    category: "Géographie",
    level: "6e AEP",
    difficulty: "intermediaire",
    status: QUESTION_STATUSES.PUBLISHED,
  });
  assert.deepEqual(result.map((item) => item.id), ["qb-geographie-detroit"]);
  assert.ok(filterQuestions(seedQuestionBank, { query: "zellige" }).some((item) => item.id === "qb-arts-zellige"));
});

test("seules les questions publiées sont projetées vers le moteur du quiz", () => {
  const projected = selectPublishedQuizQuestions(seedQuestionBank, { level: "5e AEP" });
  assert.ok(projected.length > 0);
  assert.ok(projected.every((item) => item.targetLevel === "5e AEP"));
  assert.ok(projected.every((item) => item.choices.length === 4));
  assert.equal(projected.find((item) => item.id === "qb-maroc-atlantique").level, "facile");
});

test("les jeux relisent les publications enregistrées par l'administration", () => {
  const storage = createMemoryQuestionBankStorage();
  storage.setItem(QUESTION_BANK_STORAGE_KEY, JSON.stringify({
    schemaVersion: 1,
    questions: seedQuestionBank.map((question) =>
      question.id === "qb-maroc-atlantique"
        ? { ...question, status: QUESTION_STATUSES.APPROVED }
        : question),
    updatedAt: "2026-08-27T10:00:00.000Z",
  }));

  const published = readPublishedGameQuestions(storage);
  assert.equal(published.some(({ id }) => id === "qb-maroc-atlantique"), false);
  assert.ok(published.every(({ id }) =>
    seedQuestionBank.find((question) => question.id === id)?.status === QUESTION_STATUSES.PUBLISHED));
});

test("la projection éditoriale peut faire un aller-retour sans changer de catégorie", () => {
  const imported = cultureQuizQuestions.map((item) => fromCultureQuizQuestion(item));
  assert.ok(imported.every((result) => result.ok));
  imported.forEach((result, index) => {
    assert.equal(result.item.level, "5e AEP");
    assert.equal(result.item.status, QUESTION_STATUSES.PUBLISHED);
    assert.equal(result.item.category, cultureQuizQuestions[index].sourceCategory);
  });
});

test("une sauvegarde illisible ou issue d’une version future revient aux données initiales", () => {
  const nowIso = "2026-08-26T10:00:00.000Z";
  const future = migrateQuestionBankState({ schemaVersion: 999, questions: [] }, { nowIso });
  assert.equal(future.questions.length, seedQuestionBank.length);
  const invalid = migrateQuestionBankState({ schemaVersion: 1, questions: [{ id: "invalide" }] }, { nowIso });
  assert.equal(invalid.questions.length, 0);
});
