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
const SENSITIVE_KEY = /(name|nom|email|mail|phone|telephone|message|answer|response|texte|text|audio|voice|location|adresse|address|ip|referrer|url|activation.?code|password|mot.?de.?passe)/i;
const EDITORIAL_TYPES = new Set(["manual", "unit", "lesson", "activity", "question_bank", "game_pack", "audio", "video", "ebook", "article"]);
const EDITORIAL_STATUSES = new Set(["draft", "fle_review", "pedagogical_review", "accessibility_review", "approved", "scheduled", "published", "archived"]);
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "audio/mpeg", "audio/ogg", "video/mp4", "video/webm", "application/pdf", "application/epub+zip"]);
const MAX_JSON_BYTES = 64 * 1024;
const MAX_EVENT_BATCH = 50;
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

function cleanText(value, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

function asIso(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

function authorizeWrite(request, env, requestId) {
  if (!env.BETA_WRITE_TOKEN) return apiError(503, "beta_writes_disabled", "Les écritures serveur BETA ne sont pas activées.", requestId);
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return apiError(403, "origin_rejected", "L’origine de la requête est refusée.", requestId);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!safeEqual(token, env.BETA_WRITE_TOKEN)) return apiError(401, "write_access_required", "Un accès BETA privé est requis.", requestId);
  return null;
}

async function readJson(request, requestId, maxBytes = MAX_JSON_BYTES) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) throw apiError(415, "json_required", "Le corps doit être envoyé en JSON.", requestId);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw apiError(413, "body_too_large", "La requête dépasse la taille autorisée.", requestId);
  try { return JSON.parse(text || "{}"); } catch { throw apiError(400, "invalid_json", "Le JSON est invalide.", requestId); }
}

async function sha256(value) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sanitizeApiEvent(input = {}, now = new Date()) {
  const properties = {};
  for (const [key, value] of Object.entries(input.properties || {})) {
    if (!API_PROPERTY_KEYS.has(key) || SENSITIVE_KEY.test(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value)) properties[key] = typeof value === "string" ? cleanText(value, 80) : value;
  }
  const occurredAt = asIso(input.occurredAt);
  const currentTime = new Date(now).getTime();
  const occurredTime = occurredAt ? new Date(occurredAt).getTime() : Number.NaN;
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
    contentVersion: Number.isFinite(Number(input.contentVersion)) ? Number(input.contentVersion) : null,
    activityId: cleanText(input.activityId, 100) || null,
    attemptId: cleanText(input.attemptId, 100) || null,
    competencyCodes: [...new Set((input.competencyCodes || []).map((code) => cleanText(code, 40).toUpperCase()).filter(Boolean))].slice(0, 20),
    properties,
  };
  const errors = [];
  if (!event.eventId || !event.subjectKey || !event.tenantKey) errors.push("required_identifier");
  if (!API_EVENT_NAMES.has(event.eventName)) errors.push("unknown_event");
  if (!API_EVENT_ROLES.has(event.role)) errors.push("unknown_role");
  if (!Number.isFinite(occurredTime) || occurredTime > currentTime + 5 * 60_000 || occurredTime < currentTime - 90 * 86_400_000) errors.push("invalid_time");
  return { ok: errors.length === 0, event, errors };
}

async function audit(env, requestId, actorKey, action, entityType, entityId, summary) {
  if (!env.DB) return;
  await env.DB.prepare("INSERT INTO beta_audit_entries (id, actor_key, action, entity_type, entity_id, summary, request_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), actorKey, action, entityType, entityId || null, cleanText(summary, 240), requestId, new Date().toISOString()).run();
}

async function dashboard(env, requestId) {
  const [events, contents, media, imports, references] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM beta_events").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM beta_editorial_items WHERE archived_at IS NULL").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM beta_media_assets WHERE archived_at IS NULL").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM beta_import_jobs").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM beta_reference_items WHERE active = 1").first(),
  ]);
  return jsonResponse({
    release: "BETA",
    sourceStatus: Number(events?.count || 0) > 0 ? "connected" : "connected_no_data",
    generatedAt: new Date().toISOString(),
    counts: { events: Number(events?.count || 0), contents: Number(contents?.count || 0), media: Number(media?.count || 0), imports: Number(imports?.count || 0), activeReferences: Number(references?.count || 0) },
    note: "Les indicateurs pédagogiques restent provisoires tant que les événements réels ne sont pas raccordés.",
  }, 200, requestId);
}

async function listEditorial(request, env, requestId) {
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
    env.DB.prepare("INSERT INTO beta_content_versions (id, content_id, version_no, payload_json, checksum, reason, created_by, created_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?)").bind(versionId, id, payloadJson, checksum, "Création BETA", "private-beta-admin", timestamp),
  ]);
  await audit(env, requestId, "private-beta-admin", "create", "editorial", id, `Création de « ${title} »`);
  return jsonResponse({ item: payload }, 201, requestId);
}

async function listMedia(env, requestId) {
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
    .bind(id, r2Key, originalName, mimeType, cleanText(input.altText, 500) || null, cleanText(input.sourceLabel, 180) || null, cleanText(input.credit, 180) || null, cleanText(input.licenseType, 100) || null, input.licenseExpiresAt ? asIso(input.licenseExpiresAt) : null, "private-beta-admin", timestamp, timestamp).run();
  await audit(env, requestId, "private-beta-admin", "create", "media", id, `Préparation du média « ${originalName} »`);
  return jsonResponse({ media: { id, originalName, mimeType, status: "uploading" } }, 201, requestId);
}

async function putMediaBlob(request, env, requestId, id) {
  const unauthorized = authorizeWrite(request, env, requestId); if (unauthorized) return unauthorized;
  if (!env.FILES) return apiError(503, "media_storage_unavailable", "Le stockage média BETA n’est pas disponible.", requestId);
  const media = await env.DB.prepare("SELECT id, r2_key, mime_type FROM beta_media_assets WHERE id = ? AND archived_at IS NULL").bind(id).first();
  if (!media) return apiError(404, "media_not_found", "Le média est introuvable.", requestId);
  const contentType = cleanText(request.headers.get("Content-Type"), 100); const size = Number(request.headers.get("Content-Length"));
  if (contentType !== media.mime_type || !MEDIA_TYPES.has(contentType)) return apiError(415, "media_type_mismatch", "Le type du fichier ne correspond pas à la fiche.", requestId);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_MEDIA_BYTES) return apiError(413, "invalid_media_size", "La taille du fichier est absente ou dépasse 50 Mo.", requestId);
  await env.FILES.put(media.r2_key, request.body, { httpMetadata: { contentType } });
  const timestamp = new Date().toISOString();
  await env.DB.prepare("UPDATE beta_media_assets SET byte_size = ?, status = 'ready', updated_at = ? WHERE id = ?").bind(size, timestamp, id).run();
  await audit(env, requestId, "private-beta-admin", "upload", "media", id, "Fichier média envoyé");
  return jsonResponse({ media: { id, status: "ready", byteSize: size } }, 200, requestId);
}

async function ingestEvents(request, env, requestId) {
  const unauthorized = authorizeWrite(request, env, requestId); if (unauthorized) return unauthorized;
  const input = await readJson(request, requestId);
  const events = Array.isArray(input.events) ? input.events : [];
  if (!events.length || events.length > MAX_EVENT_BATCH) return apiError(422, "invalid_batch", "Le lot doit contenir entre 1 et 50 événements.", requestId);
  const now = new Date(); const sanitized = events.map((event) => sanitizeApiEvent(event, now));
  if (sanitized.some((item) => !item.ok)) return apiError(422, "invalid_event", "Un ou plusieurs événements ne respectent pas le schéma autorisé.", requestId);
  const statements = sanitized.map(({ event }) => env.DB.prepare("INSERT OR IGNORE INTO beta_events (event_id, schema_version, event_name, occurred_at, received_at, subject_key, role, tenant_key, class_key, session_id, content_id, content_version, activity_id, attempt_id, competency_codes_json, properties_json) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(event.eventId, event.eventName, event.occurredAt, event.receivedAt, event.subjectKey, event.role, event.tenantKey, event.classKey, event.sessionId, event.contentId, event.contentVersion, event.activityId, event.attemptId, JSON.stringify(event.competencyCodes), JSON.stringify(event.properties)));
  const results = await env.DB.batch(statements);
  const accepted = results.reduce((sum, result) => sum + Number(result.meta?.changes || 0), 0);
  return jsonResponse({ accepted, duplicates: events.length - accepted }, 202, requestId);
}

async function handleApi(request, env) {
  const requestId = crypto.randomUUID(); const url = new URL(request.url); const path = url.pathname;
  if (request.method === "OPTIONS") return apiError(405, "method_not_allowed", "Cette méthode n’est pas disponible.", requestId);
  if (path === "/api/v1/health" && request.method === "GET") return jsonResponse({ ok: true, release: "BETA", storage: { database: Boolean(env.DB), media: Boolean(env.FILES) }, writesEnabled: Boolean(env.BETA_WRITE_TOKEN), time: new Date().toISOString() }, 200, requestId);
  if (!env.DB) return apiError(503, "database_unavailable", "La base BETA n’est pas disponible.", requestId);
  try {
    if (path === "/api/v1/dashboard" && request.method === "GET") return await dashboard(env, requestId);
    if (path === "/api/v1/editorial" && request.method === "GET") return await listEditorial(request, env, requestId);
    if (path === "/api/v1/editorial" && request.method === "POST") return await createEditorial(request, env, requestId);
    if (path === "/api/v1/media" && request.method === "GET") return await listMedia(env, requestId);
    if (path === "/api/v1/media" && request.method === "POST") return await createMedia(request, env, requestId);
    const mediaBlob = path.match(/^\/api\/v1\/media\/([a-f0-9-]+)\/blob$/i);
    if (mediaBlob && request.method === "PUT") return await putMediaBlob(request, env, requestId, mediaBlob[1]);
    if (path === "/api/v1/events/batch" && request.method === "POST") return await ingestEvents(request, env, requestId);
    return apiError(404, "api_route_not_found", "Cette route API n’existe pas.", requestId);
  } catch (errorResponse) {
    if (errorResponse instanceof Response) return errorResponse;
    return apiError(500, "internal_error", "Une erreur interne a empêché cette opération.", requestId);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return secure(await handleApi(request, env), request);

    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) return secure(response, request);

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return secure(await env.ASSETS.fetch(new Request(indexUrl, request)), request);
  },
};
