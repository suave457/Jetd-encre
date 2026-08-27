import {
  EMPTY_QUESTION_DRAFT,
  QUESTION_BANK_SCHEMA_VERSION,
  QUESTION_BANK_STORAGE_KEY,
  QUESTION_CATEGORIES,
  QUESTION_DIFFICULTIES,
  QUESTION_LEVELS,
  QUESTION_LIMITS,
  QUESTION_MEDIA_KINDS,
  QUESTION_STATUSES,
  QUESTION_STATUS_TRANSITIONS,
} from "./questionBankConstants.js";
import { seedQuestionBank } from "./questionBankSeed.js";

const EDITABLE_FIELDS = Object.freeze([
  "category",
  "level",
  "difficulty",
  "prompt",
  "choices",
  "correctIndex",
  "explanation",
  "status",
  "tags",
  "source",
  "media",
]);

const DIFFICULTY_TO_QUIZ_LEVEL = Object.freeze({
  facile: "facile",
  intermediaire: "intermédiaire",
  difficile: "difficile",
});

const QUIZ_THEME_TO_CATEGORY = Object.freeze({
  maroc: "Culture marocaine",
  "culture marocaine": "Culture marocaine",
  "culture generale maroc": "Culture marocaine",
  "patrimoine marocain": "Culture marocaine",
  "langue francaise": "Langue française",
  litterature: "Arts et littérature",
  arts: "Arts et littérature",
  "arts et litterature": "Arts et littérature",
  sciences: "Sciences",
  geographie: "Géographie",
  histoire: "Histoire",
  "histoire et sport": "Histoire",
  "monde francophone": "Monde francophone",
  "vie quotidienne": "Vie quotidienne",
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function foldText(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function textError(value, limits, label) {
  if (!value) return `${label} est obligatoire.`;
  if (value.length < limits.min) return `${label} doit contenir au moins ${limits.min} caractères.`;
  if (value.length > limits.max) return `${label} ne peut pas dépasser ${limits.max} caractères.`;
  return null;
}

function normalizeTags(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input
    .map(cleanText)
    .filter(Boolean)
    .filter((tag) => {
      const key = foldText(tag);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeMedia(input) {
  if (!input || typeof input !== "object") return null;
  const kind = cleanText(input.kind);
  const src = cleanText(input.src);
  const alt = cleanText(input.alt);
  if (!kind && !src && !alt) return null;
  return { kind, src, alt };
}

export function createEmptyQuestionDraft(overrides = {}) {
  return {
    ...clone(EMPTY_QUESTION_DRAFT),
    ...clone(overrides),
    choices: Array.isArray(overrides.choices)
      ? [...overrides.choices]
      : [...EMPTY_QUESTION_DRAFT.choices],
    tags: Array.isArray(overrides.tags) ? [...overrides.tags] : [],
    media: overrides.media ? { ...overrides.media } : null,
  };
}

export function normalizeQuestionInput(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    category: cleanText(source.category),
    level: cleanText(source.level),
    difficulty: cleanText(source.difficulty).toLocaleLowerCase("fr"),
    prompt: cleanText(source.prompt),
    choices: Array.isArray(source.choices) ? source.choices.map(cleanText) : [],
    correctIndex: source.correctIndex,
    explanation: cleanText(source.explanation),
    status: cleanText(source.status).toLocaleLowerCase("fr"),
    tags: normalizeTags(source.tags),
    source: cleanText(source.source),
    media: normalizeMedia(source.media),
  };
}

export function validateQuestion(input) {
  const value = normalizeQuestionInput(input);
  const fieldErrors = {};

  if (!QUESTION_CATEGORIES.includes(value.category)) {
    fieldErrors.category = "Choisissez une catégorie reconnue.";
  }
  if (!QUESTION_LEVELS.includes(value.level)) {
    fieldErrors.level = "Choisissez un niveau scolaire reconnu.";
  }
  if (!QUESTION_DIFFICULTIES.includes(value.difficulty)) {
    fieldErrors.difficulty = "Choisissez une difficulté reconnue.";
  }

  const promptError = textError(value.prompt, QUESTION_LIMITS.prompt, "La question");
  if (promptError) fieldErrors.prompt = promptError;

  if (value.choices.length !== 4) {
    fieldErrors.choices = "La question doit proposer exactement quatre réponses.";
  } else {
    value.choices.forEach((choice, index) => {
      const error = textError(choice, QUESTION_LIMITS.choice, `La réponse ${index + 1}`);
      if (error) fieldErrors[`choices.${index}`] = error;
    });
    const normalizedChoices = value.choices.filter(Boolean).map(foldText);
    if (new Set(normalizedChoices).size !== normalizedChoices.length) {
      fieldErrors.choices = "Les quatre réponses doivent être différentes.";
    }
  }

  if (!Number.isInteger(value.correctIndex) || value.correctIndex < 0 || value.correctIndex > 3) {
    fieldErrors.correctIndex = "Sélectionnez la bonne réponse parmi les quatre propositions.";
  }

  const explanationError = textError(value.explanation, QUESTION_LIMITS.explanation, "L’explication");
  if (explanationError) fieldErrors.explanation = explanationError;

  if (!Object.values(QUESTION_STATUSES).includes(value.status)) {
    fieldErrors.status = "Choisissez un statut éditorial reconnu.";
  }

  if (value.tags.length > QUESTION_LIMITS.tags.maxItems) {
    fieldErrors.tags = `Ajoutez au maximum ${QUESTION_LIMITS.tags.maxItems} mots-clés.`;
  } else if (value.tags.some((tag) => tag.length > QUESTION_LIMITS.tags.maxLength)) {
    fieldErrors.tags = `Chaque mot-clé est limité à ${QUESTION_LIMITS.tags.maxLength} caractères.`;
  }

  if (value.source.length > QUESTION_LIMITS.source.max) {
    fieldErrors.source = `La source est limitée à ${QUESTION_LIMITS.source.max} caractères.`;
  }

  if (value.media) {
    if (!QUESTION_MEDIA_KINDS.includes(value.media.kind)) {
      fieldErrors.media = "Le média facultatif doit être une image ou un audio.";
    }
    if (!value.media.src || /^javascript:/i.test(value.media.src)) {
      fieldErrors.media = "Renseignez une adresse de média sûre.";
    }
    if (value.media.kind === "image") {
      const altError = textError(value.media.alt, QUESTION_LIMITS.mediaAlt, "Le texte alternatif");
      if (altError) fieldErrors.mediaAlt = altError;
    }
  }

  const valid = Object.keys(fieldErrors).length === 0;
  return {
    ok: valid,
    valid,
    error: valid ? null : "validation_failed",
    fieldErrors,
    value,
  };
}

export function canTransitionQuestionStatus(fromStatus, toStatus) {
  if (fromStatus === toStatus) return true;
  return Boolean(QUESTION_STATUS_TRANSITIONS[fromStatus]?.includes(toStatus));
}

export function slugifyQuestionId(value) {
  return foldText(value)
    .replace(/[’']/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "question";
}

function normalizeEntity(question, fallbackDate) {
  const validation = validateQuestion(question);
  if (!validation.ok) return null;
  return {
    id: cleanText(question.id),
    ...validation.value,
    createdAt: question.createdAt || fallbackDate,
    updatedAt: question.updatedAt || fallbackDate,
    publishedAt: question.publishedAt || (validation.value.status === QUESTION_STATUSES.PUBLISHED ? fallbackDate : null),
    revision: Number.isInteger(question.revision) && question.revision > 0 ? question.revision : 1,
  };
}

function buildSeedState(initialQuestions, nowIso) {
  const seenIds = new Set();
  const questions = [];
  for (const candidate of initialQuestions) {
    const entity = normalizeEntity(candidate, nowIso);
    if (!entity?.id || seenIds.has(entity.id)) continue;
    seenIds.add(entity.id);
    questions.push(entity);
  }
  return {
    schemaVersion: QUESTION_BANK_SCHEMA_VERSION,
    questions,
    updatedAt: nowIso,
  };
}

export function migrateQuestionBankState(candidate, options = {}) {
  const nowIso = options.nowIso || new Date().toISOString();
  const initialQuestions = options.initialQuestions || seedQuestionBank;
  const seed = buildSeedState(initialQuestions, nowIso);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return seed;
  const version = Number(candidate.schemaVersion || 0);
  if (!Number.isFinite(version) || version > QUESTION_BANK_SCHEMA_VERSION) return seed;
  if (!Array.isArray(candidate.questions)) return seed;
  const migrated = buildSeedState(candidate.questions, nowIso);
  return { ...migrated, updatedAt: candidate.updatedAt || nowIso };
}

export function createMemoryQuestionBankStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

export function createSafeQuestionBankStorage(storage, fallback = createMemoryQuestionBankStorage()) {
  let active = storage || fallback;
  const safely = (method, args) => {
    try {
      return active[method](...args);
    } catch {
      active = fallback;
      return active[method](...args);
    }
  };
  return {
    get backend() { return active === fallback ? "memory" : "provided"; },
    getItem(key) { return safely("getItem", [key]); },
    setItem(key, value) { return safely("setItem", [key, value]); },
    removeItem(key) { return safely("removeItem", [key]); },
  };
}

function pickEditable(input) {
  return Object.fromEntries(EDITABLE_FIELDS.filter((field) => field in input).map((field) => [field, input[field]]));
}

function readState(storage, storageKey, initialQuestions, nowIso) {
  const raw = storage.getItem(storageKey);
  if (!raw) return migrateQuestionBankState(null, { initialQuestions, nowIso });
  try {
    return migrateQuestionBankState(JSON.parse(raw), { initialQuestions, nowIso });
  } catch {
    return migrateQuestionBankState(null, { initialQuestions, nowIso });
  }
}

export function createQuestionBank(options = {}) {
  const now = options.now || (() => new Date());
  const storageKey = options.storageKey || QUESTION_BANK_STORAGE_KEY;
  const storage = createSafeQuestionBankStorage(options.storage);
  const initialQuestions = options.initialQuestions || seedQuestionBank;
  let sequence = 0;
  const makeId = options.makeId || ((prompt) => `qb-${slugifyQuestionId(prompt)}-${now().getTime().toString(36)}-${++sequence}`);
  let state = readState(storage, storageKey, initialQuestions, now().toISOString());
  const listeners = new Set();

  const emit = () => {
    storage.setItem(storageKey, JSON.stringify(state));
    const snapshot = clone(state);
    listeners.forEach((listener) => listener(snapshot));
    options.onChange?.(snapshot);
  };

  const findIndex = (id) => state.questions.findIndex((item) => item.id === id);
  const missing = () => ({ ok: false, error: "not_found" });

  const createQuestion = (input) => {
    const candidate = { ...createEmptyQuestionDraft(), ...pickEditable(input || {}) };
    const validation = validateQuestion(candidate);
    if (!validation.ok) return validation;
    const timestamp = now().toISOString();
    const id = cleanText(input?.id) || makeId(validation.value.prompt);
    if (!id || state.questions.some((item) => item.id === id)) {
      return { ok: false, error: "duplicate_id", fieldErrors: { id: "Cet identifiant existe déjà." } };
    }
    const item = {
      id,
      ...validation.value,
      createdAt: timestamp,
      updatedAt: timestamp,
      publishedAt: validation.value.status === QUESTION_STATUSES.PUBLISHED ? timestamp : null,
      revision: 1,
    };
    state = { ...state, questions: [item, ...state.questions], updatedAt: timestamp };
    emit();
    return { ok: true, item: clone(item) };
  };

  const updateQuestion = (id, patch = {}) => {
    const index = findIndex(id);
    if (index < 0) return missing();
    const current = state.questions[index];
    const candidate = { ...current, ...pickEditable(patch) };
    if (candidate.status !== current.status && !canTransitionQuestionStatus(current.status, candidate.status)) {
      return { ok: false, error: "invalid_status_transition", from: current.status, to: candidate.status };
    }
    const validation = validateQuestion(candidate);
    if (!validation.ok) return validation;
    const timestamp = now().toISOString();
    const item = {
      ...current,
      ...validation.value,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: timestamp,
      publishedAt: validation.value.status === QUESTION_STATUSES.PUBLISHED
        ? current.publishedAt || timestamp
        : current.publishedAt,
      revision: current.revision + 1,
    };
    const questions = [...state.questions];
    questions[index] = item;
    state = { ...state, questions, updatedAt: timestamp };
    emit();
    return { ok: true, item: clone(item) };
  };

  const transitionQuestionStatus = (id, toStatus) => updateQuestion(id, { status: toStatus });

  const duplicateQuestion = (id) => {
    const original = state.questions[findIndex(id)];
    if (!original) return missing();
    return createQuestion({
      ...pickEditable(original),
      prompt: `${original.prompt} (copie)`,
      status: QUESTION_STATUSES.DRAFT,
    });
  };

  const deleteQuestion = (id) => {
    const index = findIndex(id);
    if (index < 0) return missing();
    const [item] = state.questions.slice(index, index + 1);
    const timestamp = now().toISOString();
    state = {
      ...state,
      questions: state.questions.filter((question) => question.id !== id),
      updatedAt: timestamp,
    };
    emit();
    return { ok: true, item: clone(item) };
  };

  const replaceQuestions = (questions) => {
    if (!Array.isArray(questions)) return { ok: false, error: "invalid_collection" };
    const errors = [];
    const seenIds = new Set();
    const timestamp = now().toISOString();
    const normalized = questions.map((candidate, index) => {
      const entity = normalizeEntity(candidate, timestamp);
      if (!entity?.id) errors.push({ index, error: "validation_failed" });
      else if (seenIds.has(entity.id)) errors.push({ index, error: "duplicate_id" });
      else seenIds.add(entity.id);
      return entity;
    }).filter(Boolean);
    if (errors.length) return { ok: false, error: "invalid_collection", errors };
    state = { schemaVersion: QUESTION_BANK_SCHEMA_VERSION, questions: normalized, updatedAt: timestamp };
    emit();
    return { ok: true, count: normalized.length };
  };

  const reset = () => {
    state = migrateQuestionBankState(null, { initialQuestions, nowIso: now().toISOString() });
    emit();
    return { ok: true, count: state.questions.length };
  };

  const actions = Object.freeze({
    createQuestion,
    updateQuestion,
    transitionQuestionStatus,
    duplicateQuestion,
    deleteQuestion,
    replaceQuestions,
    reset,
  });

  return Object.freeze({
    storage,
    actions,
    getState: () => clone(state),
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

export function filterQuestions(questions, filters = {}) {
  const query = foldText(filters.query || "");
  const category = filters.category || "toutes";
  const level = filters.level || "tous";
  const difficulty = filters.difficulty || "toutes";
  const status = filters.status || "tous";
  return [...(Array.isArray(questions) ? questions : [])]
    .filter((item) => category === "toutes" || item.category === category)
    .filter((item) => level === "tous" || item.level === level)
    .filter((item) => difficulty === "toutes" || item.difficulty === difficulty)
    .filter((item) => status === "tous" || item.status === status)
    .filter((item) => {
      if (!query) return true;
      const haystack = [
        item.prompt,
        item.explanation,
        item.category,
        item.level,
        ...(item.choices || []),
        ...(item.tags || []),
      ].map(foldText).join(" ");
      return haystack.includes(query);
    })
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) || a.prompt.localeCompare(b.prompt, "fr"));
}

export function getQuestionBankStats(questions) {
  const values = Array.isArray(questions) ? questions : [];
  const byStatus = Object.fromEntries(Object.values(QUESTION_STATUSES).map((status) => [status, 0]));
  const byCategory = Object.fromEntries(QUESTION_CATEGORIES.map((category) => [category, 0]));
  values.forEach((question) => {
    if (question.status in byStatus) byStatus[question.status] += 1;
    if (question.category in byCategory) byCategory[question.category] += 1;
  });
  return {
    total: values.length,
    byStatus,
    byCategory,
    publishable: byStatus[QUESTION_STATUSES.APPROVED],
    coverage: QUESTION_CATEGORIES.filter((category) => byCategory[category] > 0).length,
  };
}

export function toCultureQuizQuestion(question) {
  const validation = validateQuestion(question);
  if (!validation.ok) throw new TypeError("Impossible de projeter une question invalide vers le quiz.");
  return Object.freeze({
    id: cleanText(question.id),
    theme: validation.value.category,
    sourceCategory: validation.value.category,
    level: DIFFICULTY_TO_QUIZ_LEVEL[validation.value.difficulty],
    targetLevel: validation.value.level,
    tags: Object.freeze([...validation.value.tags]),
    prompt: validation.value.prompt,
    choices: Object.freeze([...validation.value.choices]),
    correctIndex: validation.value.correctIndex,
    explanation: validation.value.explanation,
  });
}

export function fromCultureQuizQuestion(question, overrides = {}) {
  const themeKey = foldText(question?.theme).replace(/\s*·\s*/g, " ");
  const difficultyKey = foldText(question?.level);
  const candidate = {
    category: QUIZ_THEME_TO_CATEGORY[themeKey] || "Culture marocaine",
    level: "5e AEP",
    difficulty: difficultyKey === "intermediaire" ? "intermediaire" : difficultyKey === "difficile" ? "difficile" : "facile",
    prompt: question?.prompt,
    choices: question?.choices,
    correctIndex: question?.correctIndex,
    explanation: question?.explanation,
    status: QUESTION_STATUSES.PUBLISHED,
    tags: [cleanText(question?.theme)].filter(Boolean),
    source: "Quiz Culture générale Jet d’Encre",
    media: null,
    ...overrides,
  };
  const validation = validateQuestion(candidate);
  if (!validation.ok) return validation;
  return {
    ok: true,
    item: {
      id: cleanText(overrides.id || question?.id),
      ...validation.value,
    },
  };
}

export function selectPublishedQuizQuestions(questions, filters = {}) {
  return filterQuestions(questions, { ...filters, status: QUESTION_STATUSES.PUBLISHED })
    .map(toCultureQuizQuestion);
}
