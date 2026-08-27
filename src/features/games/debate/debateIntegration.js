export const DEBATE_INTEGRATION_SOURCE = "jet-dencre.projet-debat";
export const DEBATE_INTEGRATION_VERSION = 1;
export const DEBATE_XP_PER_COMPLETED_ROUND = 10;

export const DEBATE_EVENT_TYPES = Object.freeze({
  READY: "ready",
  SESSION_STARTED: "session-started",
  ROUND_COMPLETED: "round-completed",
  XP_EARNED: "xp-earned",
  GAME_COMPLETED: "game-completed",
});

const ALLOWED_AUDIENCES = Object.freeze(["eleve", "enseignant"]);
const ALLOWED_EVENT_TYPES = new Set(Object.values(DEBATE_EVENT_TYPES));
const SAFE_CHANNEL = /^[a-z0-9-]{8,96}$/i;

export function normalizeDebateAudience(role) {
  return role === "enseignant" ? "enseignant" : "eleve";
}

export function createDebateIntegrationChannel(randomId) {
  const generated = randomId || (
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  );
  const safe = String(generated).replace(/[^a-z0-9-]/gi, "-").slice(0, 72);
  return `jde-${safe || "debat-session"}`;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeScoreTotals(value) {
  return isRecord(value) && ["A", "B"].every((side) =>
    Number.isFinite(value[side]) && value[side] >= 0 && value[side] <= 100);
}

/**
 * Refuse tout message qui ne correspond pas exactement au canal et au rôle de
 * l'iframe courante. Le composant parent vérifie en plus `origin` et `source`.
 */
export function parseDebateIntegrationEvent(
  data,
  { audience, channel } = {},
) {
  if (!isRecord(data)) return null;
  if (data.source !== DEBATE_INTEGRATION_SOURCE) return null;
  if (data.version !== DEBATE_INTEGRATION_VERSION) return null;
  if (!ALLOWED_EVENT_TYPES.has(data.type)) return null;
  if (!ALLOWED_AUDIENCES.includes(data.audience)) return null;
  if (data.audience !== normalizeDebateAudience(audience)) return null;
  if (!SAFE_CHANNEL.test(String(data.channel || "")) || data.channel !== channel) return null;
  if (!isRecord(data.payload)) return null;

  if (data.type === DEBATE_EVENT_TYPES.XP_EARNED) {
    if (data.audience !== "eleve") return null;
    if (!Number.isInteger(data.payload.amount) || data.payload.amount <= 0 || data.payload.amount > 100) return null;
    if (typeof data.payload.eventId !== "string" || !data.payload.eventId) return null;
  }
  if ([
    DEBATE_EVENT_TYPES.ROUND_COMPLETED,
    DEBATE_EVENT_TYPES.GAME_COMPLETED,
  ].includes(data.type) && typeof data.payload.attemptId !== "string") return null;
  if (data.type === DEBATE_EVENT_TYPES.ROUND_COMPLETED) {
    if (!Number.isInteger(data.payload.round) || data.payload.round < 1 || data.payload.round > 10) return null;
    if (!isSafeScoreTotals(data.payload.totals)) return null;
  }
  if (data.type === DEBATE_EVENT_TYPES.GAME_COMPLETED) {
    if (!Number.isInteger(data.payload.roundsCompleted) || data.payload.roundsCompleted < 1 || data.payload.roundsCompleted > 10) return null;
    if (!["A", "B", "tie"].includes(data.payload.winner)) return null;
    if (!isSafeScoreTotals(data.payload.totals)) return null;
    if (!Number.isInteger(data.payload.xpEarned) || data.payload.xpEarned < 0 || data.payload.xpEarned > 100) return null;
    if (data.audience === "enseignant" && data.payload.xpEarned !== 0) return null;
  }

  return Object.freeze({
    type: data.type,
    audience: data.audience,
    payload: Object.freeze({ ...data.payload }),
  });
}
