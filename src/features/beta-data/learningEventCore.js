import { validateCompetencyCodes } from "./learningTaxonomy.js";

export const LEARNING_EVENT_SCHEMA_VERSION = 1;
export const LEARNING_EVENT_NAMES = Object.freeze([
  "access_assigned", "manual_activated", "lesson_completed", "activity_started", "activity_completed",
  "game_completed", "assessment_completed", "assignment_published", "assignment_submitted",
  "submission_reviewed", "feedback_viewed", "search_no_result",
]);

const ROLES = new Set(["eleve", "parent", "enseignant", "directeur", "admin", "system"]);
const SAFE_PROPERTY_KEYS = new Set([
  "scorePercent", "correctCount", "questionCount", "durationSeconds", "resultCode", "source",
  "dataMode", "attemptNumber", "completionPercent", "format", "levelCode", "unitCode",
]);
const NUMERIC_PROPERTY_RULES = new Map([
  ["scorePercent", { min: 0, max: 100, integer: false }],
  ["correctCount", { min: 0, max: 1000, integer: true }],
  ["questionCount", { min: 0, max: 1000, integer: true }],
  ["durationSeconds", { min: 0, max: 86400, integer: true }],
  ["attemptNumber", { min: 1, max: 10000, integer: true }],
  ["completionPercent", { min: 0, max: 100, integer: false }],
]);
const STRING_PROPERTY_VALUES = new Map([
  ["source", new Set(["manual", "lesson", "activity", "game", "quiz", "assessment", "assignment", "search", "admin", "system"])],
  ["dataMode", new Set(["fixture", "demo", "beta"])],
  ["format", new Set(["manual", "lesson", "activity", "game", "assessment", "assignment", "audio", "video", "ebook", "article"])],
  ["levelCode", new Set(["aep1", "aep2", "aep3", "aep4", "aep5", "aep6", "pre_a1", "a1", "a2", "b1"])],
  ["unitCode", new Set(Array.from({ length: 12 }, (_, index) => `unit${index + 1}`))],
]);
const SENSITIVE_KEY = /(name|nom|email|mail|phone|telephone|message|answer|response|texte|text|audio|voice|location|adresse|address|ip|referrer|url|activation.?code|password|mot.?de.?passe)/i;
const MAX_CONTENT_VERSION = 1_000_000;

function text(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function iso(value, fallback = null) {
  const date = new Date(value || fallback || Date.now());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeContentVersion(value) {
  if (value === undefined || value === null) return { valid: true, value: null };
  const valid = typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_CONTENT_VERSION;
  return { valid, value: valid ? value : null };
}

function buildLearningEvent(input = {}) {
  const properties = {};
  const propertyErrors = [];
  for (const [key, value] of Object.entries(input.properties || {})) {
    if (!SAFE_PROPERTY_KEYS.has(key) || SENSITIVE_KEY.test(key)) continue;
    const numericRule = NUMERIC_PROPERTY_RULES.get(key);
    if (numericRule) {
      const valid = typeof value === "number" && Number.isFinite(value)
        && value >= numericRule.min && value <= numericRule.max
        && (!numericRule.integer || Number.isInteger(value));
      if (valid) properties[key] = value;
      else propertyErrors.push({ field: `properties.${key}`, code: "invalid" });
      continue;
    }
    const allowedValues = STRING_PROPERTY_VALUES.get(key);
    if (allowedValues) {
      const normalized = typeof value === "string" ? text(value, 40) : "";
      if (allowedValues.has(normalized)) properties[key] = normalized;
      else propertyErrors.push({ field: `properties.${key}`, code: "invalid" });
      continue;
    }
    propertyErrors.push({ field: `properties.${key}`, code: "invalid" });
  }
  const competencyValidation = validateCompetencyCodes(input.competencyCodes || []);
  const contentVersion = normalizeContentVersion(input.contentVersion);
  const event = {
    eventId: text(input.eventId, 100),
    schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
    eventName: text(input.eventName, 60),
    occurredAt: iso(input.occurredAt),
    receivedAt: iso(input.receivedAt || input.occurredAt),
    subjectKey: text(input.subjectKey, 100),
    role: text(input.role || "system", 30),
    tenantKey: text(input.tenantKey, 100),
    classKey: text(input.classKey, 100) || null,
    sessionId: text(input.sessionId, 100) || null,
    contentId: text(input.contentId, 100) || null,
    contentVersion: contentVersion.value,
    activityId: text(input.activityId, 100) || null,
    attemptId: text(input.attemptId, 100) || null,
    competencyCodes: competencyValidation.codes.slice(0, 20),
    properties,
  };
  return { event, propertyErrors, unknownCompetencies: competencyValidation.unknown, contentVersionValid: contentVersion.valid };
}

export function sanitizeLearningEvent(input = {}) {
  return buildLearningEvent(input).event;
}

export function validateLearningEvent(input = {}) {
  const { event, propertyErrors, unknownCompetencies, contentVersionValid } = buildLearningEvent(input);
  const errors = [...propertyErrors];
  if (!event.eventId) errors.push({ field: "eventId", code: "required" });
  if (!LEARNING_EVENT_NAMES.includes(event.eventName)) errors.push({ field: "eventName", code: "unknown" });
  if (!event.occurredAt) errors.push({ field: "occurredAt", code: "invalid" });
  if (!event.subjectKey) errors.push({ field: "subjectKey", code: "required" });
  if (!event.tenantKey) errors.push({ field: "tenantKey", code: "required" });
  if (!ROLES.has(event.role)) errors.push({ field: "role", code: "unknown" });
  if (!contentVersionValid) errors.push({ field: "contentVersion", code: "invalid" });
  if (unknownCompetencies.length) errors.push({ field: "competencyCodes", code: "unknown" });
  return { ok: errors.length === 0, event, errors };
}

export function normalizeLearningEvent(input = {}) {
  return validateLearningEvent(input).event;
}

export function deduplicateLearningEvents(events = []) {
  const seen = new Set();
  return events.filter((input) => {
    const id = String(input?.eventId || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function sortLearningEvents(events = []) {
  return [...events].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
}

export function pairStartAndCompletionEvents(events = []) {
  const starts = new Map(); const pairs = []; const orphans = [];
  for (const event of sortLearningEvents(deduplicateLearningEvents(events))) {
    const key = `${event.subjectKey}:${event.attemptId || event.activityId || event.contentId || "unknown"}`;
    if (event.eventName === "activity_started") starts.set(key, event);
    if (["activity_completed", "game_completed", "assessment_completed"].includes(event.eventName)) {
      const start = starts.get(key);
      if (start) { pairs.push({ key, start, completion: event }); starts.delete(key); }
      else orphans.push(event);
    }
  }
  return { pairs, orphanCompletions: orphans, orphanStarts: [...starts.values()] };
}
