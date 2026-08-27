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
const SENSITIVE_KEY = /(name|nom|email|mail|phone|telephone|message|answer|response|texte|text|audio|voice|location|adresse|address|ip|referrer|url|activation.?code|password|mot.?de.?passe)/i;

function text(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function iso(value, fallback = null) {
  const date = new Date(value || fallback || Date.now());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function sanitizeLearningEvent(input = {}) {
  const properties = {};
  for (const [key, value] of Object.entries(input.properties || {})) {
    if (!SAFE_PROPERTY_KEYS.has(key) || SENSITIVE_KEY.test(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value)) properties[key] = typeof value === "string" ? text(value, 80) : value;
  }
  const safe = {
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
    contentVersion: Number.isFinite(Number(input.contentVersion)) ? Number(input.contentVersion) : null,
    activityId: text(input.activityId, 100) || null,
    attemptId: text(input.attemptId, 100) || null,
    competencyCodes: [...new Set((input.competencyCodes || []).map((code) => text(code, 40).toUpperCase()).filter(Boolean))].slice(0, 20),
    properties,
  };
  return safe;
}

export function validateLearningEvent(input = {}) {
  const event = sanitizeLearningEvent(input);
  const errors = [];
  if (!event.eventId) errors.push({ field: "eventId", code: "required" });
  if (!LEARNING_EVENT_NAMES.includes(event.eventName)) errors.push({ field: "eventName", code: "unknown" });
  if (!event.occurredAt) errors.push({ field: "occurredAt", code: "invalid" });
  if (!event.subjectKey) errors.push({ field: "subjectKey", code: "required" });
  if (!event.tenantKey) errors.push({ field: "tenantKey", code: "required" });
  if (!ROLES.has(event.role)) errors.push({ field: "role", code: "unknown" });
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
