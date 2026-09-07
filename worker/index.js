import { handlePilot } from "./pilot/api.js";
import { authSettings } from "./pilot/oidc.js";
import { handlePublicArticles } from './public-articles.js';
import { publicArticleDocument } from './public-article-document.js';
import { PUBLIC_PREVIEW_PATHS } from "../src/publicContent.js";

const SECURITY_HEADERS = Object.freeze({
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(self), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self' mailto:",
    "frame-ancestors 'self'",
    "frame-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
  ].join("; "),
});

const API_EVENT_NAMES = new Set([
  "access_assigned", "manual_activated", "lesson_completed", "activity_started", "activity_completed",
  "game_completed", "assessment_completed", "assignment_published", "assignment_submitted",
  "submission_reviewed", "feedback_viewed", "search_no_result",
]);
const API_EVENT_ROLES = new Set(["eleve", "parent", "enseignant", "directeur", "admin", "system"]);
const API_PROPERTY_KEYS = new Set(["scorePercent", "correctCount", "questionCount", "durationSeconds", "resultCode", "source", "dataMode", "attemptNumber", "completionPercent", "format", "levelCode", "unitCode"]);
const API_NUMERIC_PROPERTY_RULES = new Map([
  ["scorePercent", { min: 0, max: 100, integer: false }],
  ["correctCount", { min: 0, max: 1000, integer: true }],
  ["questionCount", { min: 0, max: 1000, integer: true }],
  ["durationSeconds", { min: 0, max: 86400, integer: true }],
  ["attemptNumber", { min: 1, max: 10000, integer: true }],
  ["completionPercent", { min: 0, max: 100, integer: false }],
]);
const API_STRING_PROPERTY_VALUES = new Map([
  ["source", new Set(["manual", "lesson", "activity", "game", "quiz", "assessment", "assignment", "search", "admin", "system"])],
  ["dataMode", new Set(["fixture", "demo", "beta"])],
  ["format", new Set(["manual", "lesson", "activity", "game", "assessment", "assignment", "audio", "video", "ebook", "article"])],
  ["levelCode", new Set(["aep1", "aep2", "aep3", "aep4", "aep5", "aep6", "pre_a1", "a1", "a2", "b1"])],
  ["unitCode", new Set(Array.from({ length: 12 }, (_, index) => `unit${index + 1}`))],
]);
const API_COMPETENCY_CODES = new Set([
  "ORAL-REP-01", "ORAL-REP-02", "ORAL-PRO-01", "INTER-01", "INTER-02", "LECT-01",
  "LECT-02", "ECRIT-01", "MED-01", "LEX-01", "GRAM-01", "PLURI-01",
]);
const API_IDENTIFIER_DOMAINS = Object.freeze({
  eventId: "evt", subjectKey: "sub", tenantKey: "tnt", classKey: "cls",
  sessionId: "ses", contentId: "cnt", activityId: "act", attemptId: "att",
});
const SENSITIVE_KEY = /(name|nom|email|mail|phone|telephone|message|answer|response|texte|text|audio|voice|location|adresse|address|ip|referrer|url|activation.?code|password|mot.?de.?passe)/i;
const EDITORIAL_TYPES = new Set(["manual", "unit", "lesson", "activity", "question_bank", "game_pack", "audio", "video", "ebook", "article"]);
const EDITORIAL_STATUSES = new Set(["draft", "fle_review", "pedagogical_review", "accessibility_review", "approved", "scheduled", "published", "archived"]);
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "audio/mpeg", "audio/ogg", "video/mp4", "video/webm", "application/pdf", "application/epub+zip"]);
const MAX_JSON_BYTES = 64 * 1024;
const MAX_EVENT_BATCH = 50;
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_CONTENT_VERSION = 1_000_000;
const PUBLIC_PAGES = new Set(PUBLIC_PREVIEW_PATHS);
const PILOT_DOCUMENT_PATHS = new Set(["/pilote", "/pilote/jeux/mots-fleches", "/pilote/jeux/culture-generale", "/pilote/jeux/defi-du-jour", "/pilote/jeux/mot-juste", "/pilote/jeux/mission-zellige", "/pilote/jeux/souk-des-mots", "/pilote/jeux/defis-classe", "/pilote/bibliotheque", "/admin", "/admin/accueil", "/admin/ecoles-acces", "/admin/licences", "/admin/analyses", "/admin/blog", "/admin/bibliotheque"]);
const PILOT_DOCUMENT_PATTERNS = [/^\/pilote\/lecture\/[a-zA-Z0-9_-]{1,100}$/];
const APP_ROOTS = new Set(["eleve", "parent", "enseignant", "directeur", "admin"]);
const PUBLIC_APP_PATHS = new Set(["/blog", "/connexion", "/activation", "/mentions-legales", "/confidentialite", "/conditions-utilisation", "/cookies", "/accessibilite", "/mot-de-passe-oublie", "/reinitialisation", "/session-expiree", "/invitation"]);
const PUBLIC_APP_PATTERNS = [
  /^\/connexion\/(eleve|parent|enseignant|directeur|admin)$/,
  /^\/activation\/(code-invalide|acces-deja-active|deja-actif|code-expire|succes)$/,
  /^\/(blog|contenus|invitation)\/[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/i,
];

function cleanText(value, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

function asIso(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeContentVersion(value) {
  if (value === undefined || value === null) return { valid: true, value: null };
  const valid = typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_CONTENT_VERSION;
  return { valid, value: valid ? value : null };
}

function eventPseudonymSecret(env) {
  const secret = typeof env.BETA_EVENT_PSEUDONYM_KEY === "string" ? env.BETA_EVENT_PSEUDONYM_KEY : "";
  return secret.length >= 32 ? secret : null;
}

function secure(response, request, requestId = null) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (requestId) headers.set("X-Request-ID", requestId);
  if (new URL(request.url).protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function jsonResponse(payload, status = 200, requestId = null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(requestId ? { "X-Request-ID": requestId } : {}) },
  });
}

function apiError(status, code, message, requestId) {
  return jsonResponse({ error: { code, message }, requestId }, status, requestId);
}

function safeEqual(left, right) {
  const a = String(left || ""); const b = String(right || "");
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) mismatch |= (a.charCodeAt(index % Math.max(a.length, 1)) || 0) ^ (b.charCodeAt(index % Math.max(b.length, 1)) || 0);
  return mismatch === 0;
}

function authorizeBetaAccess(request, env, requestId, mode = "write") {
  const readMode = mode === "read";
  if (!env.BETA_WRITE_TOKEN) {
    return readMode
      ? apiError(503, "beta_private_access_disabled", "Les lectures privées BETA ne sont pas activées.", requestId)
      : apiError(503, "beta_writes_disabled", "Les écritures serveur BETA ne sont pas activées.", requestId);
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return apiError(403, "origin_rejected", "L’origine de la requête est refusée.", requestId);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!safeEqual(token, env.BETA_WRITE_TOKEN)) {
    return apiError(401, readMode ? "private_access_required" : "write_access_required", "Un accès BETA privé est requis.", requestId);
  }
  return null;
}

function authorizeWrite(request, env, requestId) {
  return authorizeBetaAccess(request, env, requestId, "write");
}

async function readBoundedBody(request, requestId, maxBytes, requireLength = false) {
  const header = request.headers.get("Content-Length");
  if (header !== null && !/^\d+$/.test(header)) throw apiError(400, "invalid_content_length", "La taille déclarée est invalide.", requestId);
  const declared = header === null ? null : Number(header);
  if (declared !== null && (!Number.isSafeInteger(declared) || declared > maxBytes)) throw apiError(413, "body_too_large", "La requête dépasse la taille autorisée.", requestId);
  if (requireLength && (declared === null || declared === 0)) throw apiError(411, "content_length_required", "La taille du fichier est requise.", requestId);
  // The declared length is bounded before allocation. Chunked requests are bounded while reading.
  const allocated = declared === null ? null : new Uint8Array(declared);
  const chunks = []; let size = 0;
  const reader = request.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes || (declared !== null && size > declared)) {
          await reader.cancel().catch(() => {});
          throw apiError(size > maxBytes ? 413 : 400, size > maxBytes ? "body_too_large" : "content_length_mismatch", "La taille réelle du corps est refusée.", requestId);
        }
        if (allocated) allocated.set(value, size - value.byteLength);
        else chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  if (declared !== null && size !== declared) throw apiError(400, "content_length_mismatch", "La taille réelle ne correspond pas à la taille déclarée.", requestId);
  if (allocated) return allocated;
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function readJson(request, requestId, maxBytes = MAX_JSON_BYTES) {
  if (request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw apiError(415, "json_required", "Le corps doit être envoyé en JSON.", requestId);
  const bytes = await readBoundedBody(request, requestId, maxBytes);
  try {
    const input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes) || "{}");
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("object_required");
    return input;
  } catch { throw apiError(400, "invalid_json", "Un objet JSON valide est requis.", requestId); }
}

async function sha256(value) {
  const buffer = await crypto.subtle.digest("SHA-256", value instanceof Uint8Array ? value : new TextEncoder().encode(String(value)));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sanitizeApiEvent(input = {}, now = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: ["event_object_required"] };
  const properties = {};
  const propertyErrors = [];
  for (const [key, value] of Object.entries(input.properties || {})) {
    if (!API_PROPERTY_KEYS.has(key) || SENSITIVE_KEY.test(key)) continue;
    const numericRule = API_NUMERIC_PROPERTY_RULES.get(key);
    if (numericRule) {
      const valid = typeof value === "number" && Number.isFinite(value)
        && value >= numericRule.min && value <= numericRule.max
        && (!numericRule.integer || Number.isInteger(value));
      if (valid) properties[key] = value;
      else propertyErrors.push(`invalid_property:${key}`);
      continue;
    }
    const allowedValues = API_STRING_PROPERTY_VALUES.get(key);
    if (allowedValues) {
      const normalized = typeof value === "string" ? cleanText(value, 40) : "";
      if (allowedValues.has(normalized)) properties[key] = normalized;
      else propertyErrors.push(`invalid_property:${key}`);
      continue;
    }
    propertyErrors.push(`invalid_property:${key}`);
  }
  const occurredAt = asIso(input.occurredAt);
  const currentTime = new Date(now).getTime();
  const occurredTime = occurredAt ? new Date(occurredAt).getTime() : Number.NaN;
  const contentVersion = normalizeContentVersion(input.contentVersion);
  const competencyInput = input.competencyCodes == null ? [] : input.competencyCodes;
  const event = {
    eventId: cleanText(input.eventId, 100),
    schemaVersion: 1,
    eventName: cleanText(input.eventName, 60),
    occurredAt,
    receivedAt: new Date(now).toISOString(),
    subjectKey: cleanText(input.subjectKey, 100),
    role: cleanText(input.role || "system", 30),
    tenantKey: cleanText(input.tenantKey, 100),
    classKey: cleanText(input.classKey, 100) || null,
    sessionId: cleanText(input.sessionId, 100) || null,
    contentId: cleanText(input.contentId, 100) || null,
    contentVersion: contentVersion.value,
    activityId: cleanText(input.activityId, 100) || null,
    attemptId: cleanText(input.attemptId, 100) || null,
    competencyCodes: Array.isArray(competencyInput)
      ? [...new Set(competencyInput.map((code) => cleanText(code, 40).toUpperCase()).filter(Boolean))].slice(0, 20)
      : [],
    properties,
  };
  const errors = [...propertyErrors];
  if (!contentVersion.valid) errors.push("invalid_content_version");
  if (!Array.isArray(competencyInput)) errors.push("invalid_competency_codes");
  if (!event.eventId || !event.subjectKey || !event.tenantKey) errors.push("required_identifier");
  if (!API_EVENT_NAMES.has(event.eventName)) errors.push("unknown_event");
  if (!API_EVENT_ROLES.has(event.role)) errors.push("unknown_role");
  if (event.competencyCodes.some((code) => !API_COMPETENCY_CODES.has(code))) errors.push("unknown_competency");
  if (!Number.isFinite(occurredTime) || occurredTime > currentTime + 5 * 60_000 || occurredTime < currentTime - 90 * 86_400_000) errors.push("invalid_time");
  return { ok: errors.length === 0, event, errors };
}

async function importPseudonymKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function pseudonymizeIdentifier(key, domain, value) {
  if (!value) return null;
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${domain}\u0000${value}`));
  const digest = [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${domain}_${digest}`;
}

async function pseudonymizeApiEvents(events, secret) {
  const key = await importPseudonymKey(secret);
  return Promise.all(events.map(async (event) => {
    const protectedIdentifiers = await Promise.all(Object.entries(API_IDENTIFIER_DOMAINS).map(async ([field, domain]) => [
      field,
      await pseudonymizeIdentifier(key, domain, event[field]),
    ]));
    return { ...event, ...Object.fromEntries(protectedIdentifiers) };
  }));
}

async function audit(env, requestId, actorKey, action, entityType, entityId, summary) {
  if (!env.DB) return;
  await env.DB.prepare("INSERT INTO beta_audit_entries (id, actor_key, action, entity_type, entity_id, summary, request_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), actorKey, action, entityType, entityId || null, cleanText(summary, 240), requestId, new Date().toISOString()).run();
}

async function dashboard(request, env, requestId) {
  const unauthorized = authorizeBetaAccess(request, env, requestId, "read"); if (unauthorized) return unauthorized;
  const [events, contents, media, imports, references] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM beta_events").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM beta_editorial_items WHERE archived_at IS NULL").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM beta_media_assets WHERE archived_at IS NULL").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM beta_import_jobs").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM beta_reference_items WHERE active = 1").first(),
  ]);
  return jsonResponse({
    release: "BETA",
    sourceStatus: Number(events?.count || 0) > 0 ? "demo_unverified" : "connected_no_data",
    generatedAt: new Date().toISOString(),
    counts: { events: Number(events?.count || 0), contents: Number(contents?.count || 0), media: Number(media?.count || 0), imports: Number(imports?.count || 0), activeReferences: Number(references?.count || 0) },
    identityAssurance: "unverified",
    note: "Ces événements de démonstration sont déclaratifs. Ils ne prouvent ni une identité, ni un rôle, ni une progression réelle.",
  }, 200, requestId);
}

async function listEditorial(request, env, requestId) {
  const unauthorized = authorizeBetaAccess(request, env, requestId, "read"); if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const status = cleanText(url.searchParams.get("status"), 40);
  const type = cleanText(url.searchParams.get("type"), 40);
  const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize")) || 50));
  const conditions = ["archived_at IS NULL"]; const values = [];
  if (status) { conditions.push("status = ?"); values.push(status); }
  if (type) { conditions.push("item_type = ?"); values.push(type); }
  const result = await env.DB.prepare(`SELECT id, item_type, title, status, level_code, audience, revision, created_at, updated_at FROM beta_editorial_items WHERE ${conditions.join(" AND ")} ORDER BY updated_at DESC LIMIT ?`).bind(...values, pageSize).all();
  return jsonResponse({ items: result.results || [], pageSize }, 200, requestId);
}

async function createEditorial(request, env, requestId) {
  const unauthorized = authorizeWrite(request, env, requestId); if (unauthorized) return unauthorized;
  const input = await readJson(request, requestId);
  const title = cleanText(input.title, 180); const itemType = cleanText(input.itemType, 40); const status = cleanText(input.status || "draft", 40);
  if (!title || !EDITORIAL_TYPES.has(itemType) || !EDITORIAL_STATUSES.has(status)) return apiError(422, "invalid_editorial_item", "Le titre, le format ou le statut est invalide.", requestId);
  if (["approved", "scheduled", "published"].includes(status)) return apiError(422, "review_required", "La création directe dans un statut publié est interdite.", requestId);
  const id = crypto.randomUUID(); const versionId = crypto.randomUUID(); const timestamp = new Date().toISOString();
  const payload = { ...input, id, title, itemType, status, revision: 1, createdAt: timestamp, updatedAt: timestamp };
  const payloadJson = JSON.stringify(payload); const checksum = await sha256(payloadJson);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO beta_editorial_items (id, item_type, title, status, level_code, audience, revision, current_version_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)").bind(id, itemType, title, status, cleanText(input.levelCode, 30) || null, cleanText(input.audience || "private", 80), versionId, timestamp, timestamp),
    env.DB.prepare("INSERT INTO beta_content_versions (id, content_id, version_no, payload_json, checksum, reason, created_by, created_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?)").bind(versionId, id, payloadJson, checksum, "Création BETA", "beta-service-token", timestamp),
  ]);
  await audit(env, requestId, "beta-service-token", "create", "editorial", id, `Création de « ${title} »`);
  return jsonResponse({ item: payload }, 201, requestId);
}

async function listMedia(request, env, requestId) {
  const unauthorized = authorizeBetaAccess(request, env, requestId, "read"); if (unauthorized) return unauthorized;
  const result = await env.DB.prepare("SELECT id, original_name, mime_type, byte_size, alt_text, source_label, credit, license_type, license_expires_at, status, created_at, updated_at FROM beta_media_assets WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT 100").all();
  return jsonResponse({ items: result.results || [] }, 200, requestId);
}

async function createMedia(request, env, requestId) {
  const unauthorized = authorizeWrite(request, env, requestId); if (unauthorized) return unauthorized;
  if (!env.FILES) return apiError(503, "media_storage_unavailable", "Le stockage média BETA n’est pas disponible.", requestId);
  const input = await readJson(request, requestId);
  const originalName = cleanText(input.originalName, 180); const mimeType = cleanText(input.mimeType, 100);
  if (!originalName || !MEDIA_TYPES.has(mimeType)) return apiError(422, "invalid_media", "Le nom ou le type de média est invalide.", requestId);
  const id = crypto.randomUUID(); const timestamp = new Date().toISOString(); const extension = originalName.includes(".") ? originalName.split(".").at(-1).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) : "bin"; const r2Key = `beta/${timestamp.slice(0, 7).replace("-", "/")}/${id}.${extension || "bin"}`;
  await env.DB.prepare("INSERT INTO beta_media_assets (id, r2_key, original_name, mime_type, byte_size, alt_text, source_label, credit, license_type, license_expires_at, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'uploading', ?, ?, ?)")
    .bind(id, r2Key, originalName, mimeType, cleanText(input.altText, 500) || null, cleanText(input.sourceLabel, 180) || null, cleanText(input.credit, 180) || null, cleanText(input.licenseType, 100) || null, input.licenseExpiresAt ? asIso(input.licenseExpiresAt) : null, "beta-service-token", timestamp, timestamp).run();
  await audit(env, requestId, "beta-service-token", "create", "media", id, `Préparation du média « ${originalName} »`);
  return jsonResponse({ media: { id, originalName, mimeType, status: "uploading" } }, 201, requestId);
}

function hasMediaSignature(bytes, type) {
  const ascii = (offset, length) => new TextDecoder("latin1").decode(bytes.subarray(offset, offset + length));
  const starts = (...values) => values.every((value, index) => bytes[index] === value);
  if (type === "application/pdf") return /^%PDF-[12]\.\d/.test(ascii(0, 8)) && /%%EOF\s*$/.test(ascii(Math.max(0, bytes.length - 1024), 1024));
  if (type === "image/png") return starts(137, 80, 78, 71, 13, 10, 26, 10);
  if (type === "image/jpeg") return starts(255, 216, 255);
  if (type === "image/webp") return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  if (type === "image/avif") return ascii(4, 4) === "ftyp" && /avif|avis/.test(ascii(8, 32));
  if (type === "audio/mpeg") return ascii(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224);
  if (type === "audio/ogg") return ascii(0, 4) === "OggS";
  if (type === "video/mp4") return ascii(4, 4) === "ftyp" && !/avif|avis/.test(ascii(8, 4));
  if (type === "video/webm") return starts(26, 69, 223, 163);
  if (type === "application/epub+zip") return starts(80, 75, 3, 4);
  return false;
}

async function putMediaBlob(request, env, requestId, id) {
  const unauthorized = authorizeWrite(request, env, requestId); if (unauthorized) return unauthorized;
  if (!env.FILES) return apiError(503, "media_storage_unavailable", "Le stockage média BETA n’est pas disponible.", requestId);
  const media = await env.DB.prepare("SELECT id, r2_key, mime_type, status FROM beta_media_assets WHERE id = ? AND archived_at IS NULL").bind(id).first();
  if (!media) return apiError(404, "media_not_found", "Le média est introuvable.", requestId);
  if (media.status !== "uploading") return apiError(409, "media_not_uploadable", "Créez une nouvelle fiche pour remplacer ce fichier.", requestId);
  const contentType = cleanText(request.headers.get("Content-Type")?.split(";", 1)[0], 100).toLowerCase();
  if (contentType !== media.mime_type || !MEDIA_TYPES.has(contentType)) return apiError(415, "media_type_mismatch", "Le type du fichier ne correspond pas à la fiche.", requestId);
  const bytes = await readBoundedBody(request, requestId, MAX_MEDIA_BYTES, true);
  if (!hasMediaSignature(bytes, contentType)) return apiError(422, "media_signature_mismatch", "Le contenu du fichier ne correspond pas au format annoncé.", requestId);
  const checksum = await sha256(bytes);
  const claimedAt = new Date().toISOString();
  const claim = await env.DB.prepare("UPDATE beta_media_assets SET status = 'receiving', updated_at = ? WHERE id = ? AND status = 'uploading' AND archived_at IS NULL").bind(claimedAt, id).run();
  if (Number(claim.meta?.changes) !== 1) return apiError(409, "media_upload_conflict", "Un envoi est déjà en cours ou cette fiche a changé.", requestId);
  // Magic bytes are only a first screen, not a decoder, malware scan, rights review or PDF active-content sanitization.
  // No upload is made publishable by this API; a separate trusted validation pipeline is still required.
  try {
    await env.FILES.put(media.r2_key, bytes, { httpMetadata: { contentType }, customMetadata: { validation: "quarantined", sha256: checksum } });
    const finalized = await env.DB.prepare("UPDATE beta_media_assets SET byte_size = ?, checksum_sha256 = ?, status = 'quarantined', updated_at = ? WHERE id = ? AND status = 'receiving'").bind(bytes.byteLength, checksum, new Date().toISOString(), id).run();
    if (Number(finalized.meta?.changes) !== 1) throw apiError(409, "media_upload_conflict", "La fiche a changé pendant l’envoi ; validation manuelle requise.", requestId);
  } catch (error) {
    await env.DB.prepare("UPDATE beta_media_assets SET status = 'uploading', updated_at = ? WHERE id = ? AND status = 'receiving'").bind(new Date().toISOString(), id).run().catch(() => {});
    throw error;
  }
  await audit(env, requestId, "beta-service-token", "upload_quarantined", "media", id, "Fichier reçu, signature contrôlée, validation complète et droits à vérifier avant publication");
  return jsonResponse({ media: { id, status: "quarantined", byteSize: bytes.byteLength, checksumSha256: checksum }, validation: { signatureChecked: true, safeForPublication: false, contentReviewRequired: true } }, 200, requestId);
}

async function ingestEvents(request, env, requestId) {
  const unauthorized = authorizeWrite(request, env, requestId); if (unauthorized) return unauthorized;
  const pseudonymSecret = eventPseudonymSecret(env);
  if (!pseudonymSecret) return apiError(503, "event_pseudonymization_disabled", "La pseudonymisation stable des événements BETA n’est pas configurée.", requestId);
  const input = await readJson(request, requestId);
  const events = Array.isArray(input.events) ? input.events : [];
  if (!events.length || events.length > MAX_EVENT_BATCH) return apiError(422, "invalid_batch", "Le lot doit contenir entre 1 et 50 événements.", requestId);
  const now = new Date(); const sanitized = events.map((event) => sanitizeApiEvent(event, now));
  if (sanitized.some((item) => !item.ok)) return apiError(422, "invalid_event", "Un ou plusieurs événements ne respectent pas le schéma autorisé.", requestId);
  if (sanitized.some(({ event }) => !["fixture", "demo"].includes(event.properties.dataMode))) return apiError(422, "verified_identity_required", "Seuls les événements explicitement fictifs ou de démonstration sont acceptés sans identité serveur vérifiée.", requestId);
  const protectedEvents = await pseudonymizeApiEvents(sanitized.map(({ event }) => ({
    ...event,
    role: "system",
    properties: { ...event.properties, reportedRole: event.role, identityAssurance: "unverified" },
  })), pseudonymSecret);
  const statements = protectedEvents.map((event) => env.DB.prepare("INSERT OR IGNORE INTO beta_events (event_id, schema_version, event_name, occurred_at, received_at, subject_key, role, tenant_key, class_key, session_id, content_id, content_version, activity_id, attempt_id, competency_codes_json, properties_json) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(event.eventId, event.eventName, event.occurredAt, event.receivedAt, event.subjectKey, event.role, event.tenantKey, event.classKey, event.sessionId, event.contentId, event.contentVersion, event.activityId, event.attemptId, JSON.stringify(event.competencyCodes), JSON.stringify(event.properties)));
  const results = await env.DB.batch(statements);
  const accepted = results.reduce((sum, result) => sum + Number(result.meta?.changes || 0), 0);
  return jsonResponse({ accepted, duplicates: events.length - accepted }, 202, requestId);
}

async function readiness(env, requestId) {
  if (!env.DB) return apiError(503, "database_unavailable", "La base BETA n’est pas disponible.", requestId);
  try {
    // Resolve required tables and columns even if there are no rows. A binding alone is not readiness.
    const result = await env.DB.prepare(`SELECT 1 AS ready,
      (SELECT event_id FROM beta_events LIMIT 1) AS events,
      (SELECT current_version_id FROM beta_editorial_items LIMIT 1) AS editorial,
      (SELECT checksum FROM beta_content_versions LIMIT 1) AS versions,
      (SELECT source_version_no FROM beta_article_publication_events LIMIT 1) AS article_publications,
      (SELECT checksum_sha256 FROM beta_media_assets LIMIT 1) AS media,
      (SELECT id FROM beta_import_jobs LIMIT 1) AS imports,
      (SELECT id FROM beta_reference_items LIMIT 1) AS reference_items,
      (SELECT action_id FROM beta_action_resolutions LIMIT 1) AS resolutions,
      (SELECT id FROM beta_kpi_snapshots LIMIT 1) AS snapshots,
      (SELECT request_id FROM beta_audit_entries LIMIT 1) AS audit_entries`).first();
    if (Number(result?.ready) !== 1) throw new Error("schema_probe_failed");
    if (env.PILOT_ENABLED === "true") {
      if (!authSettings(env)) return apiError(503, "pilot_identity_unavailable", "La configuration de connexion du pilote est incomplète.", requestId);
      await env.DB.prepare(`SELECT 1,
        (SELECT active FROM pilot_users LIMIT 1), (SELECT subject FROM pilot_identities LIMIT 1),
        (SELECT active FROM pilot_schools LIMIT 1), (SELECT role FROM pilot_memberships LIMIT 1),
        (SELECT school_id FROM pilot_classes LIMIT 1), (SELECT user_id FROM pilot_class_members LIMIT 1),
        (SELECT active FROM pilot_family_links LIMIT 1), (SELECT assurance FROM pilot_sessions LIMIT 1),
        (SELECT verifier FROM pilot_auth_flows LIMIT 1), (SELECT requested_role FROM pilot_auth_flows LIMIT 1), (SELECT return_path FROM pilot_auth_flows LIMIT 1), (SELECT attempts FROM pilot_auth_limits LIMIT 1),
        (SELECT request_hash FROM pilot_assignments LIMIT 1), (SELECT request_hash FROM pilot_submissions LIMIT 1),
        (SELECT score FROM pilot_reviews LIMIT 1), (SELECT active FROM pilot_admins LIMIT 1),
        (SELECT action FROM pilot_admin_events LIMIT 1),
        (SELECT revision FROM pilot_game_progress LIMIT 1), (SELECT xp FROM pilot_game_awards LIMIT 1),
        (SELECT active FROM pilot_manuals LIMIT 1), (SELECT code_hash FROM pilot_manual_codes LIMIT 1),
        (SELECT attempts FROM pilot_manual_attempts LIMIT 1), (SELECT avatar FROM pilot_student_profiles LIMIT 1),
        (SELECT revision FROM pilot_quiz_attempts LIMIT 1), (SELECT xp FROM pilot_quiz_awards LIMIT 1), (SELECT reward_type FROM pilot_market_awards LIMIT 1),
        (SELECT revision FROM pilot_class_challenges LIMIT 1), (SELECT revision FROM pilot_class_attempts LIMIT 1),
        (SELECT question_index FROM pilot_class_awards LIMIT 1),
        (SELECT id FROM pilot_quiz_attempts INDEXED BY pilot_quiz_attempt_owner LIMIT 1)`).first();
      const quizSchema = await env.DB.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='pilot_quiz_attempts'").first();
      if (!quizSchema?.sql?.includes("'mot-juste'")) throw new Error('quiz_game_migration_required');
    }
    return jsonResponse({ ok: true, release: "BETA", schema: "beta-v1", storage: { database: "checked", schema: "checked", media: env.FILES ? "binding_configured_not_probed" : "unavailable" }, writesEnabled: Boolean(env.BETA_WRITE_TOKEN), eventPseudonymsConfigured: Boolean(eventPseudonymSecret(env)), identityAssurance: env.PILOT_ENABLED === "true" ? "oidc" : "demo_only", time: new Date().toISOString() }, 200, requestId);
  } catch {
    console.error(JSON.stringify({ requestId, operation: "readiness", code: "database_schema_unavailable" }));
    return apiError(503, "database_schema_unavailable", "La base ou les migrations requises ne sont pas prêtes.", requestId);
  }
}

async function handleApi(request, env) {
  const requestId = crypto.randomUUID(); const url = new URL(request.url); const path = url.pathname;
  if (request.method === "OPTIONS") return apiError(405, "method_not_allowed", "Cette méthode n’est pas disponible.", requestId);
  if (path === "/api/v1/live" && request.method === "GET") return jsonResponse({ ok: true, check: "worker_only" }, 200, requestId);
  if (["/api/v1/health", "/api/v1/ready"].includes(path) && request.method === "GET") return readiness(env, requestId);
  if (!env.DB) return apiError(503, "database_unavailable", "La base BETA n’est pas disponible.", requestId);
  try {
    if (path === "/api/v1/dashboard" && request.method === "GET") return await dashboard(request, env, requestId);
    if (path === "/api/v1/editorial" && request.method === "GET") return await listEditorial(request, env, requestId);
    if (path === "/api/v1/editorial" && request.method === "POST") return await createEditorial(request, env, requestId);
    if (path === "/api/v1/media" && request.method === "GET") return await listMedia(request, env, requestId);
    if (path === "/api/v1/media" && request.method === "POST") return await createMedia(request, env, requestId);
    const mediaBlob = path.match(/^\/api\/v1\/media\/([a-f0-9-]+)\/blob$/i);
    if (mediaBlob && request.method === "PUT") return await putMediaBlob(request, env, requestId, mediaBlob[1]);
    if (path === "/api/v1/events/batch" && request.method === "POST") return await ingestEvents(request, env, requestId);
    return apiError(404, "api_route_not_found", "Cette route API n’existe pas.", requestId);
  } catch (errorResponse) {
    if (errorResponse instanceof Response) return errorResponse;
    console.error(JSON.stringify({ requestId, operation: path, code: "internal_error" }));
    return apiError(500, "internal_error", "Une erreur interne a empêché cette opération.", requestId);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if(url.pathname==='/api/public/articles'||url.pathname.startsWith('/api/public/articles/'))return secure(await handlePublicArticles(request,env),request);
    const publishedArticle=url.pathname.match(/^\/blog\/(article-[a-f0-9-]{36})\/?$/);
    if(publishedArticle)return secure(await publicArticleDocument(request,env,publishedArticle[1]),request);
    if (url.pathname.startsWith("/api/pilot/")) {
      const requestId=crypto.randomUUID();
      return secure(await handlePilot(request, env, {requestId}), request, requestId);
    }
    if (url.pathname.startsWith("/api/")) return secure(await handleApi(request, env), request);

    if (url.pathname.startsWith("/__local-media") || url.pathname.startsWith("/.local-media")) return secure(new Response("Document local non publié.", { status: 404 }), request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    const documentRequest = ["GET", "HEAD"].includes(request.method) && acceptsHtml;
    const canonicalPath = url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "");
    if (documentRequest && PUBLIC_PAGES.has(canonicalPath)) {
      const pageUrl = new URL(request.url);
      pageUrl.pathname = canonicalPath === "/" ? "/index.html" : `${canonicalPath}/index.html`;
      pageUrl.search = "";
      return secure(await env.ASSETS.fetch(new Request(pageUrl, request)), request);
    }
    if (documentRequest && (PILOT_DOCUMENT_PATHS.has(canonicalPath) || PILOT_DOCUMENT_PATTERNS.some((pattern) => pattern.test(canonicalPath)))) {
      const indexUrl = new URL("/index.html", request.url);
      const page = secure(await env.ASSETS.fetch(new Request(indexUrl, request)), request);
      page.headers.set("X-Robots-Tag", "noindex, nofollow");
      return page;
    }
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || !documentRequest) return secure(response, request);
    // Private/demo application routes retain SPA navigation. Unknown public pages keep a real 404.
    if (!APP_ROOTS.has(url.pathname.split("/")[1]) && !PUBLIC_APP_PATHS.has(canonicalPath) && !PUBLIC_APP_PATTERNS.some((pattern) => pattern.test(canonicalPath))) return secure(response, request);

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return secure(await env.ASSETS.fetch(new Request(indexUrl, request)), request);
  },
};
