export const QUESTION_BANK_SCHEMA_VERSION = 1;
export const QUESTION_BANK_STORAGE_KEY = "jde.question-bank.v1";

export const QUESTION_STATUSES = Object.freeze({
  DRAFT: "brouillon",
  APPROVED: "valide",
  PUBLISHED: "publie",
});

export const QUESTION_STATUS_LABELS = Object.freeze({
  [QUESTION_STATUSES.DRAFT]: "Brouillon",
  [QUESTION_STATUSES.APPROVED]: "Validé",
  [QUESTION_STATUSES.PUBLISHED]: "Publié",
});

export const QUESTION_CATEGORIES = Object.freeze([
  "Culture marocaine",
  "Langue française",
  "Sciences",
  "Géographie",
  "Histoire",
  "Monde francophone",
  "Arts et littérature",
  "Vie quotidienne",
]);

export const QUESTION_LEVELS = Object.freeze([
  "1re AEP",
  "2e AEP",
  "3e AEP",
  "4e AEP",
  "5e AEP",
  "6e AEP",
]);

export const QUESTION_DIFFICULTIES = Object.freeze([
  "facile",
  "intermediaire",
  "difficile",
]);

export const QUESTION_DIFFICULTY_LABELS = Object.freeze({
  facile: "Facile",
  intermediaire: "Intermédiaire",
  difficile: "Difficile",
});

export const QUESTION_MEDIA_KINDS = Object.freeze(["image", "audio"]);

export const QUESTION_LIMITS = Object.freeze({
  prompt: Object.freeze({ min: 10, max: 240 }),
  choice: Object.freeze({ min: 1, max: 120 }),
  explanation: Object.freeze({ min: 12, max: 420 }),
  source: Object.freeze({ max: 120 }),
  mediaAlt: Object.freeze({ min: 5, max: 180 }),
  tags: Object.freeze({ maxItems: 8, maxLength: 32 }),
});

export const QUESTION_STATUS_TRANSITIONS = Object.freeze({
  [QUESTION_STATUSES.DRAFT]: Object.freeze([QUESTION_STATUSES.APPROVED]),
  [QUESTION_STATUSES.APPROVED]: Object.freeze([
    QUESTION_STATUSES.DRAFT,
    QUESTION_STATUSES.PUBLISHED,
  ]),
  [QUESTION_STATUSES.PUBLISHED]: Object.freeze([QUESTION_STATUSES.APPROVED]),
});

export const EMPTY_QUESTION_DRAFT = Object.freeze({
  category: QUESTION_CATEGORIES[0],
  level: QUESTION_LEVELS[4],
  difficulty: QUESTION_DIFFICULTIES[0],
  prompt: "",
  choices: Object.freeze(["", "", "", ""]),
  correctIndex: 0,
  explanation: "",
  status: QUESTION_STATUSES.DRAFT,
  tags: Object.freeze([]),
  source: "Jet d’Encre Éditions",
  media: null,
});
