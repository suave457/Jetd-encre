import { normalizeContentInput, validateContent } from "./contentModelCore.js";

const HEADER_ALIASES = Object.freeze({
  id: "external_id", externalid: "external_id", identifiant: "external_id", format: "type", titre: "title", resume: "summary", résumé: "summary",
  langue: "language", niveaux: "aep_levels", niveau: "aep_levels", unite: "unit_code", unité: "unit_code",
  competences: "competency_codes", compétences: "competency_codes", cecrl: "cefr_targets", public: "audience", statut: "status",
  titulaire_droits: "rights_holder", licence: "license_type", expiration_droits: "rights_valid_until", url_media: "media_url", texte_alternatif: "media_alt", transcription: "transcript_url",
});

export const CONTENT_IMPORT_HEADERS = Object.freeze(["external_id", "type", "title", "summary", "language", "aep_levels", "unit_code", "competency_codes", "cefr_targets", "audience", "status", "rights_holder", "license_type", "rights_valid_until", "media_url", "media_alt", "transcript_url"]);

function normalizedHeader(value) {
  const raw = String(value ?? "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const ascii = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return HEADER_ALIASES[raw] || HEADER_ALIASES[ascii] || raw;
}

export function detectCsvDelimiter(text) {
  const firstLogicalLine = String(text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0];
  let comma = 0; let semicolon = 0; let quoted = false;
  for (let index = 0; index < firstLogicalLine.length; index += 1) {
    const char = firstLogicalLine[index];
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") comma += 1;
    else if (!quoted && char === ";") semicolon += 1;
  }
  return semicolon >= comma ? ";" : ",";
}

export function parseCsv(text, delimiter = detectCsvDelimiter(text)) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((cells) => cells.some((value) => String(value).trim() !== ""));
}

export function normalizeCsvHeaders(headers = []) {
  const normalized = headers.map(normalizedHeader);
  const unknown = normalized.filter((header) => !CONTENT_IMPORT_HEADERS.includes(header));
  const duplicates = normalized.filter((header, index) => normalized.indexOf(header) !== index);
  return { headers: normalized, unknown: [...new Set(unknown)], duplicates: [...new Set(duplicates)] };
}

function list(value) { return String(value ?? "").split(/[|,]/).map((item) => item.trim()).filter(Boolean); }

export function mapContentImportRow(row = {}, rowNumber = 2) {
  const competencyCodes = list(row.competency_codes).map((code) => code.toUpperCase());
  const cefrTargets = list(row.cefr_targets);
  const content = normalizeContentInput({
    externalId: row.external_id, type: row.type, title: row.title, summary: row.summary, language: row.language || "fr",
    aepLevels: list(row.aep_levels), unitCode: row.unit_code,
    competencyTargets: competencyCodes.map((competencyCode, index) => ({ competencyCode, cefrTarget: cefrTargets[index] || cefrTargets[0], weight: 1 })),
    audience: list(row.audience), editorialStatus: row.status || "draft",
    rights: { holder: row.rights_holder, licenseType: row.license_type, validUntil: row.rights_valid_until || null, territories: ["MA"] },
    accessibility: { altReady: Boolean(String(row.media_alt || "").trim()), transcriptReady: Boolean(String(row.transcript_url || "").trim()), captionsReady: Boolean(String(row.transcript_url || "").trim()) },
    assetIds: row.media_url ? [String(row.media_url).trim()] : [],
    learningObjectives: row.title ? [`Mobiliser les apprentissages visés par « ${String(row.title).trim()} ».`] : [],
  });
  return { rowNumber, raw: { ...row }, content };
}

export function validateContentImportRows(text, { now = new Date() } = {}) {
  const matrix = parseCsv(text);
  if (!matrix.length) return { ok: false, rows: [], errors: [{ row: 1, field: "file", code: "empty", severity: "error", message: "Le fichier CSV est vide." }] };
  const headerCheck = normalizeCsvHeaders(matrix[0]);
  const errors = [
    ...headerCheck.unknown.map((field) => ({ row: 1, field, code: "unknown_header", severity: "error", message: `Colonne inconnue : ${field}.` })),
    ...headerCheck.duplicates.map((field) => ({ row: 1, field, code: "duplicate_header", severity: "error", message: `Colonne dupliquée : ${field}.` })),
  ];
  const seen = new Set();
  const rows = matrix.slice(1).map((cells, index) => {
    const raw = Object.fromEntries(headerCheck.headers.map((header, column) => [header, cells[column] ?? ""]));
    const mapped = mapContentImportRow(raw, index + 2);
    const id = mapped.content.externalId;
    if (!id) errors.push({ row: index + 2, field: "external_id", code: "required", severity: "error", message: "L’identifiant externe est obligatoire." });
    else if (seen.has(id)) errors.push({ row: index + 2, field: "external_id", code: "duplicate", severity: "error", message: `Identifiant dupliqué : ${id}.` });
    seen.add(id);
    const validation = validateContent(mapped.content, { now });
    for (const issue of validation.errors) errors.push({ row: index + 2, field: issue.field, code: issue.code, severity: "error", message: issue.message });
    return mapped;
  });
  return { ok: errors.length === 0, rows, errors };
}

export function buildContentImportPlan(existing = [], text, options = {}) {
  const validation = validateContentImportRows(text, options);
  const byId = new Map(existing.map((item) => [String(item.externalId || item.id), item]));
  const rejectedRows = new Set(validation.errors.filter((error) => error.severity === "error" && error.row > 1).map((error) => error.row));
  const operations = validation.rows.filter((row) => !rejectedRows.has(row.rowNumber)).map((row) => {
    const current = byId.get(row.content.externalId);
    if (!current) return { type: "create", externalId: row.content.externalId, content: row.content, row: row.rowNumber };
    const normalizedCurrent = normalizeContentInput(current);
    const comparableCurrent = JSON.stringify({ ...normalizedCurrent, createdAt: null, updatedAt: null });
    const comparableNext = JSON.stringify({ ...row.content, createdAt: null, updatedAt: null });
    return comparableCurrent === comparableNext ? { type: "unchanged", externalId: row.content.externalId, content: row.content, row: row.rowNumber } : { type: "update", externalId: row.content.externalId, content: row.content, row: row.rowNumber };
  });
  return {
    ok: validation.ok,
    rows: validation.rows,
    errors: validation.errors,
    operations,
    summary: {
      create: operations.filter((item) => item.type === "create").length,
      update: operations.filter((item) => item.type === "update").length,
      unchanged: operations.filter((item) => item.type === "unchanged").length,
      rejected: rejectedRows.size + validation.errors.filter((error) => error.row === 1 && error.severity === "error").length,
    },
  };
}

export function escapeCsvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[";,\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
