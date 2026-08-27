import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSafeClassLeaderboard,
  calculateClassChallengeScore,
  canParticipateInClassChallenge,
  getClassChallengeStatus,
  rankClassChallengeResults,
  validateClassChallengeDraft,
} from "../src/features/games/class-challenges/classChallengeEngine.js";
import {
  CURRENT_CLASS_PARTICIPANT,
  getPublishedClassChallengeBanks,
  resolveClassChallengeQuestions,
  selectClassChallengeQuestionIds,
} from "../src/features/games/class-challenges/classChallengeData.js";
import { seedQuestionBank } from "../src/features/question-bank/questionBankSeed.js";
import { createDemoStore, createMemoryStorage, DEMO_ACCOUNTS } from "../src/demoStoreCore.js";

const activeChallenge = {
  id: "challenge-a",
  classId: "classe-5a",
  classLabel: "5e AEP · Classe 5A",
  status: "en_cours",
  endAt: "2026-08-29T12:00:00.000Z",
  questionIds: ["q1", "q2", "q3", "q4", "q5"],
};

test("calcule le statut et le score sans utiliser la vitesse comme départage", () => {
  assert.equal(getClassChallengeStatus(activeChallenge, new Date("2026-08-26T12:00:00.000Z")), "en_cours");
  assert.equal(getClassChallengeStatus(activeChallenge, new Date("2026-08-30T12:00:00.000Z")), "termine");
  assert.deepEqual(calculateClassChallengeScore(4, 5), {
    correctCount: 4,
    questionCount: 5,
    score: 400,
    scorePercent: 80,
  });
});

test("attribue des rangs de compétition et signale clairement les ex æquo", () => {
  const ranked = rankClassChallengeResults([
    { participantId: "a", pseudonym: "Étoile Safran", score: 500, status: "termine" },
    { participantId: "b", pseudonym: "Nuage Menthe", score: 400, status: "termine" },
    { participantId: "c", pseudonym: "Comète Corail", score: 400, status: "termine" },
    { participantId: "d", pseudonym: "Soleil Azur", score: 300, status: "termine" },
  ]);
  assert.deepEqual(ranked.map(({ rank, tied }) => [rank, tied]), [[1, false], [2, true], [2, true], [4, false]]);
});

test("limite le classement à la classe et retire toute donnée identifiante", () => {
  const rows = buildSafeClassLeaderboard(activeChallenge, [
    { challengeId: "challenge-a", classId: "classe-5a", participantId: "a", pseudonym: "Étoile Safran", score: 500, correctCount: 5, questionCount: 5, progressPercent: 100, status: "termine", fullName: "Nom à ne jamais afficher", email: "secret@example.test" },
    { challengeId: "challenge-a", classId: "classe-5b", participantId: "b", pseudonym: "Perle Océane", score: 500, correctCount: 5, questionCount: 5, progressPercent: 100, status: "termine" },
    { challengeId: "autre", classId: "classe-5a", participantId: "c", pseudonym: "Nuage Menthe", score: 400, correctCount: 4, questionCount: 5, progressPercent: 100, status: "termine" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pseudonym, "Étoile Safran");
  assert.equal("participantId" in rows[0], false);
  assert.equal("fullName" in rows[0], false);
  assert.equal("email" in rows[0], false);
});

test("n’autorise qu’une banque publiée contenant au moins cinq questions", () => {
  const banks = getPublishedClassChallengeBanks(seedQuestionBank);
  assert.ok(banks.length >= 2);
  assert.ok(banks.every((bank) => bank.status === "publie" && bank.questionCount >= 5));
  const validation = validateClassChallengeDraft({
    title: "Le défi des explorateurs",
    classId: "classe-5a",
    classLabel: "5e AEP · Classe 5A",
    level: "5e AEP",
    theme: "Culture générale",
    bankId: banks[0].id,
    durationHours: 72,
  }, banks);
  assert.equal(validation.ok, true);
  assert.equal(validation.value.questionIds.length, 5);
  assert.equal(validateClassChallengeDraft({ ...validation.value, bankId: "brouillon" }, banks).ok, false);
});

test("projette uniquement les questions publiées choisies par le défi", () => {
  const bank = getPublishedClassChallengeBanks(seedQuestionBank)[0];
  const questions = resolveClassChallengeQuestions({ questionIds: bank.questionIds.slice(0, 5) }, seedQuestionBank);
  assert.equal(questions.length, 5);
  assert.ok(questions.every((question) => question.choices.length === 4));
});

test("le niveau et le thème modifient réellement la sélection du défi", () => {
  const bank = getPublishedClassChallengeBanks(seedQuestionBank)[0];
  const maroc5 = selectClassChallengeQuestionIds({
    bank,
    questions: seedQuestionBank,
    level: "5e AEP",
    theme: "Culture marocaine",
  });
  const maroc6 = selectClassChallengeQuestionIds({
    bank,
    questions: seedQuestionBank,
    level: "6e AEP",
    theme: "Culture marocaine",
  });
  const sciences5 = selectClassChallengeQuestionIds({
    bank,
    questions: seedQuestionBank,
    level: "5e AEP",
    theme: "Sciences & découvertes",
  });

  assert.equal(maroc5.length, 5);
  assert.equal(new Set(maroc5).size, 5);
  assert.notDeepEqual(maroc5, maroc6);
  assert.notDeepEqual(maroc5, sciences5);
  assert.equal(seedQuestionBank.find(({ id }) => id === maroc5[0]).level, "5e AEP");
  assert.equal(seedQuestionBank.find(({ id }) => id === maroc6[0]).level, "6e AEP");

  const validation = validateClassChallengeDraft({
    title: "Le Maroc en cinquième",
    classId: "classe-5a",
    classLabel: "5e AEP · Classe 5A",
    level: "5e AEP",
    theme: "Culture marocaine",
    bankId: bank.id,
    durationHours: 72,
    questionIds: maroc5,
  }, [bank]);
  assert.equal(validation.ok, true);
  assert.deepEqual(validation.value.questionIds, maroc5);
});

test("empêche une seconde participation terminée", () => {
  assert.equal(canParticipateInClassChallenge(activeChallenge, [], CURRENT_CLASS_PARTICIPANT.participantId, new Date("2026-08-26T12:00:00.000Z")), true);
  assert.equal(canParticipateInClassChallenge(activeChallenge, [{ challengeId: activeChallenge.id, participantId: CURRENT_CLASS_PARTICIPANT.participantId, status: "termine" }], CURRENT_CLASS_PARTICIPANT.participantId, new Date("2026-08-26T12:00:00.000Z")), false);
});

test("persiste création, résultat et clôture sans doubler les XP", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");
  const store = createDemoStore({ storageAdapter: createMemoryStorage(), now: () => now });
  const bank = getPublishedClassChallengeBanks(seedQuestionBank)[0];
  const created = store.actions.createClassChallenge({
    title: "Défi test de la classe",
    classId: "classe-5a",
    classLabel: "5e AEP · Classe 5A",
    level: "5e AEP",
    theme: "Culture générale",
    bankId: bank.id,
    bankLabel: bank.label,
    bankStatus: "publie",
    durationHours: 24,
    questionIds: bank.questionIds,
  });
  assert.equal(created.ok, true);
  const initialXp = store.getState().users.find((user) => user.id === DEMO_ACCOUNTS.eleve.userId).xp;
  const recorded = store.actions.recordClassChallengeResult({
    challengeId: created.challenge.id,
    participantId: CURRENT_CLASS_PARTICIPANT.participantId,
    pseudonym: CURRENT_CLASS_PARTICIPANT.pseudonym,
    correctCount: 4,
    xpEarned: 40,
    fullName: "champ ignoré",
  });
  assert.equal(recorded.ok, true);
  assert.equal(recorded.result.classId, "classe-5a");
  assert.equal("fullName" in recorded.result, false);
  assert.equal(store.getState().users.find((user) => user.id === DEMO_ACCOUNTS.eleve.userId).xp, initialXp, "enregistrer le score ne verse pas une deuxième fois les XP");
  assert.equal(store.actions.recordClassChallengeResult({ ...recorded.result }).duplicate, true);

  const award = { userId: DEMO_ACCOUNTS.eleve.userId, amount: 10, eventId: `${created.challenge.id}:q1`, source: "defi-classe" };
  assert.equal(store.actions.awardStudentXp(award).awarded, true);
  assert.equal(store.actions.awardStudentXp(award).duplicate, true);
  assert.equal(store.getState().users.find((user) => user.id === DEMO_ACCOUNTS.eleve.userId).xp, initialXp + 10);
  assert.equal(store.actions.finishClassChallenge(created.challenge.id).updated, true);
  assert.equal(store.actions.finishClassChallenge(created.challenge.id).updated, false);
});
