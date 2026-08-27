import { QUESTION_STATUSES } from "../../question-bank/questionBankConstants.js";
import { seedQuestionBank } from "../../question-bank/questionBankSeed.js";
import { toCultureQuizQuestion } from "../../question-bank/questionBankCore.js";
import { CLASS_CHALLENGE_QUESTION_COUNT } from "./classChallengeEngine.js";

export const CURRENT_CLASS_PARTICIPANT = Object.freeze({
  participantId: "participant-plume-indigo",
  pseudonym: "Plume Indigo",
  classId: "classe-5a",
  classLabel: "5e AEP · Classe 5A",
});

export const CLASS_OPTIONS = Object.freeze([
  Object.freeze({ id: "classe-5a", label: "5e AEP · Classe 5A", level: "5e AEP" }),
  Object.freeze({ id: "classe-5b", label: "5e AEP · Classe 5B", level: "5e AEP" }),
  Object.freeze({ id: "classe-6a", label: "6e AEP · Classe 6A", level: "6e AEP" }),
  Object.freeze({ id: "classe-6b", label: "6e AEP · Classe 6B", level: "6e AEP" }),
]);

const BANK_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "banque-culture-generale-publiee",
    label: "Culture générale · sélection publiée",
    description: "Repères du Maroc, sciences, langue et monde francophone.",
    matches: () => true,
  }),
  Object.freeze({
    id: "banque-maroc-francophonie",
    label: "Maroc & francophonie · publiée",
    description: "Géographie, patrimoine et horizons francophones.",
    matches: (question) => question.tags?.includes("maroc") || ["Culture marocaine", "Géographie", "Monde francophone", "Arts et littérature"].includes(question.category),
  }),
  Object.freeze({
    id: "banque-mots-decouvertes",
    label: "Mots & découvertes · publiée",
    description: "Langue française, sciences et arts pour apprendre en contexte.",
    matches: (question) => ["Langue française", "Sciences", "Arts et littérature"].includes(question.category),
  }),
]);

export function readQuestionBankQuestions(storage = globalThis.localStorage) {
  if (!storage?.getItem) return [...seedQuestionBank];
  try {
    const parsed = JSON.parse(storage.getItem("jde.question-bank.v1") || "null");
    return Array.isArray(parsed?.questions) ? parsed.questions : [...seedQuestionBank];
  } catch {
    return [...seedQuestionBank];
  }
}

export function getPublishedClassChallengeBanks(questions = seedQuestionBank) {
  const published = (Array.isArray(questions) ? questions : [])
    .filter((question) => question?.status === QUESTION_STATUSES.PUBLISHED);
  return BANK_DEFINITIONS.map((definition) => {
    const matches = published.filter(definition.matches);
    return Object.freeze({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      status: QUESTION_STATUSES.PUBLISHED,
      questionIds: Object.freeze(matches.map((question) => question.id)),
      questionCount: matches.length,
    });
  }).filter((bank) => bank.questionCount >= CLASS_CHALLENGE_QUESTION_COUNT);
}

export function resolveClassChallengeQuestions(challenge, questions = seedQuestionBank) {
  const allowedIds = new Set(Array.isArray(challenge?.questionIds) ? challenge.questionIds : []);
  return (Array.isArray(questions) ? questions : [])
    .filter((question) => question?.status === QUESTION_STATUSES.PUBLISHED && allowedIds.has(question.id))
    .slice(0, CLASS_CHALLENGE_QUESTION_COUNT)
    .map(toCultureQuizQuestion);
}

const addHours = (date, hours) => new Date(date.getTime() + hours * 3_600_000).toISOString();

export function createSeedClassChallengeState(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const activeBank = getPublishedClassChallengeBanks(seedQuestionBank)[1] || getPublishedClassChallengeBanks(seedQuestionBank)[0];
  const mixedBank = getPublishedClassChallengeBanks(seedQuestionBank)[0];
  const activeId = "defi-classe-tour-maroc-5a";
  const completedId = "defi-classe-mots-patrimoine-5a";
  const challenges = [
    {
      id: activeId,
      title: "Le tour du Maroc en 5 questions",
      classId: "classe-5a",
      classLabel: "5e AEP · Classe 5A",
      level: "5e AEP",
      theme: "Culture marocaine",
      bankId: activeBank.id,
      bankLabel: activeBank.label,
      bankStatus: "publie",
      durationHours: 72,
      questionIds: activeBank.questionIds.slice(0, CLASS_CHALLENGE_QUESTION_COUNT),
      status: "en_cours",
      startAt: addHours(current, -12),
      endAt: addHours(current, 60),
      createdAt: addHours(current, -12),
    },
    {
      id: completedId,
      title: "Les mots du patrimoine",
      classId: "classe-5a",
      classLabel: "5e AEP · Classe 5A",
      level: "5e AEP",
      theme: "Français & patrimoine",
      bankId: mixedBank.id,
      bankLabel: mixedBank.label,
      bankStatus: "publie",
      durationHours: 72,
      questionIds: mixedBank.questionIds.slice(0, CLASS_CHALLENGE_QUESTION_COUNT),
      status: "termine",
      startAt: addHours(current, -120),
      endAt: addHours(current, -48),
      createdAt: addHours(current, -120),
    },
  ];

  const result = (challengeId, participantId, pseudonym, correctCount, options = {}) => ({
    id: `${challengeId}:${participantId}`,
    challengeId,
    participantId,
    pseudonym,
    classId: options.classId || "classe-5a",
    status: options.status || "termine",
    correctCount,
    questionCount: CLASS_CHALLENGE_QUESTION_COUNT,
    score: correctCount * 100,
    scorePercent: correctCount * 20,
    progressPercent: options.progressPercent ?? (options.status === "en_cours" ? 40 : 100),
    xpEarned: options.xpEarned ?? correctCount * 10,
    completedAt: options.status === "en_cours" ? null : addHours(current, options.completedOffset ?? -4),
  });

  const results = [
    result(activeId, "participant-etoile-safran", "Étoile Safran", 5),
    result(activeId, "participant-nuage-menthe", "Nuage Menthe", 4),
    result(activeId, "participant-comete-corail", "Comète Corail", 4),
    result(activeId, "participant-soleil-azur", "Soleil Azur", 3),
    result(activeId, "participant-atlas-dore", "Atlas Doré", 2),
    result(activeId, "participant-lune-zellige", "Lune Zellige", 1, { status: "en_cours", progressPercent: 60 }),
    result(activeId, "participant-autre-classe", "Perle Océane", 5, { classId: "classe-5b" }),
    result(completedId, CURRENT_CLASS_PARTICIPANT.participantId, CURRENT_CLASS_PARTICIPANT.pseudonym, 4, { completedOffset: -60 }),
    result(completedId, "participant-rose-vents", "Rose des vents", 5, { completedOffset: -62 }),
    result(completedId, "participant-fennec", "Fennec Turquoise", 4, { completedOffset: -61 }),
    result(completedId, "participant-hirondelle", "Hirondelle Ivoire", 3, { completedOffset: -59 }),
  ];

  return { challenges, results };
}
