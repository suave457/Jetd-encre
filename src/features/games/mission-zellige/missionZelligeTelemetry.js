const STORAGE_VERSION = 1;

export const MISSION_ZELLIGE_TELEMETRY_STORAGE_KEY = "jde.mission-zellige:telemetry:v1";
export const MISSION_ZELLIGE_TELEMETRY_MAX_EVENTS = 200;

export const MISSION_ZELLIGE_TELEMETRY_EVENTS = Object.freeze([
  "view",
  "start",
  "audio_play",
  "audio_stop",
  "transcript_show",
  "location_error",
  "location_success",
  "sentence_error",
  "sentence_success",
  "complete",
  "abandon",
]);

const EVENT_NAMES = new Set(MISSION_ZELLIGE_TELEMETRY_EVENTS);
const MODES = new Set(["daily", "preview", "replay"]);
const PHASES = new Set(["location", "sentence", "complete"]);
const INPUT_METHODS = new Set(["keyboard", "pointer", "touch", "unknown"]);
const AUDIO_SOURCES = new Set(["recorded", "speech-synthesis", "none"]);
const TOKEN_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const DAILY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ELAPSED_MS = 24 * 60 * 60 * 1000;

const BOOLEAN_METADATA_KEYS = new Set([
  "audioAvailable",
  "completed",
  "firstTry",
  "rewardEligible",
  "transcriptVisible",
]);

const INTEGER_METADATA_LIMITS = Object.freeze({
  attempt: [1, 100],
  attempts: [0, 100],
  locationAttempts: [0, 100],
  pieceCount: [0, 50],
  scorePercent: [0, 100],
  sentenceAttempts: [0, 100],
  xpEarned: [0, 10000],
});

const TOKEN_METADATA_KEYS = new Set([
  "choiceId",
  "hotspotId",
  "reasonCode",
  "variantId",
]);

function getDefaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function isStorageLike(storage) {
  return Boolean(storage)
    && typeof storage.getItem === "function"
    && typeof storage.setItem === "function";
}

function clampInteger(value, minimum, maximum) {
  if (!Number.isFinite(value)) return null;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function isToken(value) {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;

  const sanitized = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (BOOLEAN_METADATA_KEYS.has(key) && typeof value === "boolean") {
      sanitized[key] = value;
      continue;
    }

    const limits = INTEGER_METADATA_LIMITS[key];
    if (limits) {
      const normalized = clampInteger(value, limits[0], limits[1]);
      if (normalized !== null) sanitized[key] = normalized;
      continue;
    }

    if (TOKEN_METADATA_KEYS.has(key) && isToken(value)) {
      sanitized[key] = value;
      continue;
    }

    if (key === "inputMethod" && INPUT_METHODS.has(value)) {
      sanitized[key] = value;
      continue;
    }

    if (key === "audioSource" && AUDIO_SOURCES.has(value)) {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? Object.freeze(sanitized) : undefined;
}

function normalizeTimestamp(now) {
  try {
    const value = typeof now === "function" ? now() : Date.now();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function normalizeEvent(eventName, context, now) {
  if (!EVENT_NAMES.has(eventName) || !context || typeof context !== "object") return null;

  const {
    missionId,
    dailyKey,
    mode,
    phase,
    elapsedMs = 0,
    metadata,
  } = context;

  if (!isToken(missionId)
    || typeof dailyKey !== "string"
    || !DAILY_KEY_PATTERN.test(dailyKey)
    || !MODES.has(mode)
    || !PHASES.has(phase)) {
    return null;
  }

  const normalizedElapsedMs = clampInteger(elapsedMs, 0, MAX_ELAPSED_MS);
  if (normalizedElapsedMs === null) return null;

  const sanitizedMetadata = sanitizeMetadata(metadata);
  const record = {
    version: STORAGE_VERSION,
    event: eventName,
    occurredAt: normalizeTimestamp(now),
    missionId,
    dailyKey,
    mode,
    phase,
    elapsedMs: normalizedElapsedMs,
  };
  if (sanitizedMetadata) record.metadata = sanitizedMetadata;
  return Object.freeze(record);
}

function isStoredEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.version !== STORAGE_VERSION || !EVENT_NAMES.has(value.event)) return false;
  if (typeof value.occurredAt !== "string" || Number.isNaN(Date.parse(value.occurredAt))) return false;
  if (!isToken(value.missionId)
    || typeof value.dailyKey !== "string"
    || !DAILY_KEY_PATTERN.test(value.dailyKey)
    || !MODES.has(value.mode)
    || !PHASES.has(value.phase)) {
    return false;
  }
  return Number.isInteger(value.elapsedMs)
    && value.elapsedMs >= 0
    && value.elapsedMs <= MAX_ELAPSED_MS;
}

function readStoredEvents(storage, storageKey, maximum) {
  if (!isStorageLike(storage)) return [];
  try {
    const serialized = storage.getItem(storageKey);
    if (!serialized) return [];
    const parsed = JSON.parse(serialized);
    const candidates = Array.isArray(parsed) ? parsed : parsed?.events;
    if (!Array.isArray(candidates)) return [];
    return candidates.filter(isStoredEvent).slice(-maximum);
  } catch {
    return [];
  }
}

function writeStoredEvents(storage, storageKey, events) {
  if (!isStorageLike(storage)) return false;
  try {
    storage.setItem(storageKey, JSON.stringify({
      version: STORAGE_VERSION,
      events,
    }));
    return true;
  } catch {
    return false;
  }
}

function cloneEvents(events) {
  return events.map((event) => ({
    ...event,
    ...(event.metadata ? { metadata: { ...event.metadata } } : {}),
  }));
}

/**
 * Crée un journal local sans identifiant utilisateur, e-mail, nom ni texte libre.
 * Seuls les événements et métadonnées explicitement autorisés sont conservés.
 */
export function createMissionZelligeTelemetry(options = {}) {
  const storage = Object.prototype.hasOwnProperty.call(options, "storage")
    ? options.storage
    : getDefaultStorage();
  const storageKey = typeof options.storageKey === "string" && options.storageKey.length > 0
    ? options.storageKey
    : MISSION_ZELLIGE_TELEMETRY_STORAGE_KEY;
  const now = typeof options.now === "function" ? options.now : Date.now;
  const maximum = clampInteger(
    options.maxEvents ?? MISSION_ZELLIGE_TELEMETRY_MAX_EVENTS,
    1,
    1000,
  ) ?? MISSION_ZELLIGE_TELEMETRY_MAX_EVENTS;

  let events = readStoredEvents(storage, storageKey, maximum);

  function track(eventName, context) {
    const record = normalizeEvent(eventName, context, now);
    if (!record) return null;
    events = [...events, record].slice(-maximum);
    writeStoredEvents(storage, storageKey, events);
    return { ...record, ...(record.metadata ? { metadata: { ...record.metadata } } : {}) };
  }

  function getEvents() {
    return cloneEvents(events);
  }

  function clear() {
    events = [];
    if (!storage) return true;
    try {
      if (typeof storage.removeItem === "function") {
        storage.removeItem(storageKey);
        return true;
      }
      return writeStoredEvents(storage, storageKey, events);
    } catch {
      return false;
    }
  }

  return Object.freeze({
    track,
    getEvents,
    clear,
    storageKey,
    maxEvents: maximum,
  });
}
