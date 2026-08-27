import { normalizeAepLevel, normalizeCefrLevel, validateCompetencyCodes } from "./learningTaxonomy.js";

export const CONTENT_TYPES = Object.freeze(["manual", "unit", "lesson", "activity", "question_bank", "game_pack", "audio", "video", "ebook", "article"]);
export const CONTENT_STATUSES = Object.freeze(["draft", "fle_review", "pedagogical_review", "accessibility_review", "approved", "scheduled", "published", "archived"]);

const TRANSITIONS = Object.freeze({
  draft: ["fle_review", "archived"],
  fle_review: ["draft", "pedagogical_review", "archived"],
  pedagogical_review: ["fle_review", "accessibility_review", "archived"],
  accessibility_review: ["pedagogical_review", "approved", "archived"],
  approved: ["accessibility_review", "scheduled", "published", "archived"],
  scheduled: ["approved", "published", "archived"],
  published: ["approved", "archived"],
  archived: ["draft"],
});

const TYPE_ALIASES = Object.freeze({
  podcast: "audio", audio: "audio", documentaire: "video", video: "video", vidéo: "video",
  "e-book": "ebook", ebook: "ebook", article: "article", "jeu educatif": "game_pack", "jeu éducatif": "game_pack",
  manuel: "manual", unite: "unit", unité: "unit", lecon: "lesson", leçon: "lesson", activite: "activity", activité: "activity",
});

const STATUS_ALIASES = Object.freeze({
  brouillon: "draft", "a reviser": "fle_review", "à réviser": "fle_review", revision: "fle_review",
  approuve: "approved", approuvé: "approved", planifie: "scheduled", planifié: "scheduled", publie: "published", publié: "published", archive: "archived", archivé: "archived",
});

function normalizeText(value) {
  return String(value ?? "").trim();
}

function ascii(value) {
  return normalizeText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeType(value) {
  const raw = normalizeText(value);
  if (CONTENT_TYPES.includes(raw)) return raw;
  return TYPE_ALIASES[raw.toLowerCase()] || TYPE_ALIASES[ascii(raw)] || null;
}

function normalizeStatus(value) {
  const raw = normalizeText(value);
  if (CONTENT_STATUSES.includes(raw)) return raw;
  return STATUS_ALIASES[raw.toLowerCase()] || STATUS_ALIASES[ascii(raw)] || "draft";
}

export function normalizeContentInput(input = {}) {
  const legacyLevel = input.level ? [input.level] : [];
  const aepLevels = [...new Set([...(input.aepLevels || []), ...legacyLevel].map(normalizeAepLevel).filter(Boolean))];
  const legacyCompetencies = Array.isArray(input.competencies) ? input.competencies : [];
  const competencyTargets = (input.competencyTargets || []).map((target) => ({
    competencyCode: normalizeText(target?.competencyCode).toUpperCase(),
    cefrTarget: normalizeCefrLevel(target?.cefrTarget),
    weight: Math.max(0, Number(target?.weight) || 1),
  })).filter((target) => target.competencyCode);
  return {
    id: normalizeText(input.id || input.externalId),
    externalId: normalizeText(input.externalId || input.id),
    type: normalizeType(input.type),
    title: normalizeText(input.title),
    slug: normalizeText(input.slug),
    summary: normalizeText(input.summary),
    language: normalizeText(input.language || "fr"),
    aepLevels,
    unitCode: normalizeText(input.unitCode || input.unit),
    competencyTargets,
    legacyCompetencies,
    learningObjectives: (Array.isArray(input.learningObjectives) ? input.learningObjectives : String(input.learningObjectives || "").split("|")).map(normalizeText).filter(Boolean),
    audience: (Array.isArray(input.audience) ? input.audience : String(input.audience || input.visibility || "").split("|")).map(normalizeText).filter(Boolean),
    editorialStatus: normalizeStatus(input.editorialStatus || input.status),
    visibility: normalizeText(input.visibility || "private"),
    assetIds: (input.assetIds || []).map(normalizeText).filter(Boolean),
    rights: {
      holder: normalizeText(input.rights?.holder || input.rightsHolder),
      licenseType: normalizeText(input.rights?.licenseType || input.licenseType),
      validUntil: normalizeText(input.rights?.validUntil || input.rightsValidUntil) || null,
      territories: input.rights?.territories || ["MA"],
    },
    accessibility: {
      altReady: Boolean(input.accessibility?.altReady || input.mediaAlt),
      transcriptReady: Boolean(input.accessibility?.transcriptReady || input.transcriptUrl),
      captionsReady: Boolean(input.accessibility?.captionsReady || input.captionsUrl),
    },
    version: Math.max(1, Number(input.version) || 1),
    createdAt: input.createdAt || null,
    updatedAt: input.updatedAt || null,
    scheduledAt: input.scheduledAt || null,
    publishedAt: input.publishedAt || null,
    archivedAt: input.archivedAt || null,
  };
}

export function validatePublicationReadiness(input, { now = new Date() } = {}) {
  const content = normalizeContentInput(input);
  const errors = [];
  if (!content.title) errors.push({ field: "title", code: "required", message: "Le titre est obligatoire." });
  if (!content.type) errors.push({ field: "type", code: "invalid", message: "Le format de contenu est inconnu." });
  if (!content.summary) errors.push({ field: "summary", code: "required", message: "Un résumé éditorial est obligatoire." });
  if (!content.aepLevels.length) errors.push({ field: "aepLevels", code: "required", message: "Au moins un niveau AEP est requis." });
  if (!content.learningObjectives.length) errors.push({ field: "learningObjectives", code: "required", message: "Au moins un objectif d’apprentissage est requis." });
  const competencyValidation = validateCompetencyCodes(content.competencyTargets.map((target) => target.competencyCode));
  if (!content.competencyTargets.length) errors.push({ field: "competencyTargets", code: "required", message: "Au moins une microcompétence est requise." });
  if (competencyValidation.unknown.length) errors.push({ field: "competencyTargets", code: "unknown", message: `Compétences inconnues : ${competencyValidation.unknown.join(", ")}.` });
  if (content.competencyTargets.some((target) => !target.cefrTarget)) errors.push({ field: "competencyTargets", code: "cefr_required", message: "Chaque microcompétence doit avoir une cible CECRL explicite." });
  if (!content.rights.holder || !content.rights.licenseType) errors.push({ field: "rights", code: "required", message: "Le titulaire et la licence du média doivent être renseignés." });
  if (content.rights.validUntil && new Date(content.rights.validUntil).getTime() < new Date(now).getTime()) errors.push({ field: "rights.validUntil", code: "expired", message: "Les droits du média ont expiré." });
  if (["video", "audio", "ebook"].includes(content.type) && !content.accessibility.altReady) errors.push({ field: "accessibility.altReady", code: "required", message: "Une description accessible est requise." });
  if (content.type === "audio" && !content.accessibility.transcriptReady) errors.push({ field: "accessibility.transcriptReady", code: "required", message: "La transcription audio est requise." });
  if (content.type === "video" && (!content.accessibility.transcriptReady || !content.accessibility.captionsReady)) errors.push({ field: "accessibility", code: "required", message: "La transcription et les sous-titres vidéo sont requis." });
  return { ok: errors.length === 0, content, errors };
}

export function validateContent(input, options) {
  const content = normalizeContentInput(input);
  if (["approved", "scheduled", "published"].includes(content.editorialStatus)) return validatePublicationReadiness(content, options);
  const errors = [];
  if (!content.title) errors.push({ field: "title", code: "required", message: "Le titre est obligatoire." });
  if (!content.type) errors.push({ field: "type", code: "invalid", message: "Le format est inconnu." });
  return { ok: errors.length === 0, content, errors };
}

export function canTransitionContentStatus(from, to) {
  const source = normalizeStatus(from);
  const target = normalizeStatus(to);
  return source === target || Boolean(TRANSITIONS[source]?.includes(target));
}

export function createContentRevision(input, patch = {}, { now = new Date(), actorKey = "editor" } = {}) {
  const before = normalizeContentInput(input);
  const after = normalizeContentInput({ ...before, ...patch, rights: { ...before.rights, ...(patch.rights || {}) }, accessibility: { ...before.accessibility, ...(patch.accessibility || {}) }, version: before.version + 1, updatedAt: new Date(now).toISOString() });
  return Object.freeze({ id: `${before.id || "content"}:v${after.version}`, contentId: before.id, version: after.version, actorKey, createdAt: after.updatedAt, before: structuredClone(before), snapshot: structuredClone(after) });
}

export function compareContentRevisions(left, right) {
  const a = left?.snapshot || left || {};
  const b = right?.snapshot || right || {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys.filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key])).map((key) => ({ field: key, before: a[key], after: b[key] }));
}
