import { LEARNING_COMPETENCIES } from "./learningTaxonomy.js";

export const BETA_AS_OF = "2026-08-27T12:00:00.000Z";
export const BETA_NETWORK_SCOPE = Object.freeze({ establishments: 63, licensesIssued: 14820, licensesActivated: 11964, teachers: 742 });
export const BETA_SCHOOL_SCOPE = Object.freeze({ id: "etablissement-al-manar", label: "Groupe scolaire Al Manar", students: 654, activated: 618, classes: 18, teachers: 42 });
export const BETA_TEACHER_SCOPE = Object.freeze({ id: "user-enseignante-salma", label: "Mme Salma Benjelloun", students: 112, weeklyActive: 86, classes: 4 });

function event(eventName, subjectKey, occurredAt, index, extra = {}) {
  return {
    eventId: `fixture-${eventName}-${subjectKey}-${index}`,
    schemaVersion: 1,
    eventName,
    occurredAt,
    receivedAt: occurredAt,
    subjectKey,
    role: "eleve",
    tenantKey: "fixture-al-manar",
    classKey: `fixture-class-${(index % 4) + 1}`,
    sessionId: `fixture-session-${subjectKey}`,
    contentId: extra.contentId || "fixture-manual-fr5",
    contentVersion: 1,
    activityId: extra.activityId || null,
    attemptId: extra.attemptId || null,
    competencyCodes: extra.competencyCodes || [LEARNING_COMPETENCIES[index % LEARNING_COMPETENCIES.length].code],
    properties: { dataMode: "fixture", ...(extra.properties || {}) },
  };
}

export function createBetaFixtureDataset() {
  const accesses = []; const activations = []; const events = []; const assessments = [];
  for (let index = 1; index <= 20; index += 1) {
    const subjectKey = `fixture-student-${String(index).padStart(2, "0")}`;
    const day = index <= 18 ? 8 + (index % 3) : 23;
    const assignedAt = `2026-08-${String(day).padStart(2, "0")}T08:00:00.000Z`;
    accesses.push({ accessId: `fixture-access-${index}`, subjectKey, tenantKey: "fixture-al-manar", assignedAt });
    events.push(event("access_assigned", subjectKey, assignedAt, index));
    if (index <= 17) {
      const activatedAt = `2026-08-${String(day + 1).padStart(2, "0")}T09:00:00.000Z`;
      activations.push({ subjectKey, activatedAt });
      events.push(event("manual_activated", subjectKey, activatedAt, index));
    }
    if (index <= 14) events.push(event("activity_completed", subjectKey, `2026-08-${String(day + 3).padStart(2, "0")}T10:00:00.000Z`, index, { activityId: `fixture-activity-${index}`, attemptId: `fixture-attempt-${index}`, properties: { scorePercent: 60 + index } }));
    if (index <= 13) events.push(event(index % 3 === 0 ? "game_completed" : "lesson_completed", subjectKey, `2026-08-${String(24 + (index % 3)).padStart(2, "0")}T15:00:00.000Z`, index, { activityId: `fixture-week-${index}`, properties: { scorePercent: 65 + index } }));
    if (index <= 12) {
      const competencyCode = LEARNING_COMPETENCIES[index % LEARNING_COMPETENCIES.length].code;
      assessments.push({ subjectKey, competencyCode, assessmentFamilyId: "fixture-family-a", score: 10 + (index % 5), scaleMax: 20, assessedAt: "2026-08-02T10:00:00.000Z" });
      assessments.push({ subjectKey, competencyCode, assessmentFamilyId: "fixture-family-a", score: Math.min(20, 13 + (index % 5)), scaleMax: 20, assessedAt: "2026-08-26T10:00:00.000Z" });
    }
  }
  return { accesses, activations, events, assessments, sourceStatus: "fixture", freshness: "2026-08-27T11:45:00.000Z" };
}

export const BETA_ACTION_ITEMS = Object.freeze([
  { id: "action-content-review", role: "admin", priority: "high", type: "content", title: "Valider 2 contenus avant publication", description: "Une revue FLE et une vérification d’accessibilité restent à terminer.", actionLabel: "Ouvrir la file éditoriale", route: "/admin/bibliotheque", dueLabel: "Aujourd’hui" },
  { id: "action-media-rights", role: "admin", priority: "high", type: "media", title: "Compléter 3 fiches média", description: "Droits, transcription ou texte alternatif manquants.", actionLabel: "Vérifier les médias", route: "/admin/medias", dueLabel: "Avant publication" },
  { id: "action-import-errors", role: "admin", priority: "medium", type: "import", title: "Corriger un import en attente", description: "Deux lignes du dernier fichier de contenus nécessitent une correction.", actionLabel: "Voir l’import", route: "/admin/imports", dueLabel: "2 erreurs" },
  { id: "action-license-renewal", role: "admin", priority: "medium", type: "license", title: "Préparer 8 renouvellements", description: "Les accès de huit établissements arrivent à échéance dans 30 jours.", actionLabel: "Voir les licences", route: "/admin/licences", dueLabel: "30 jours" },
  { id: "action-data-quality", role: "admin", priority: "low", type: "data", title: "Contrôler la fraîcheur des données", description: "Le jeu BETA est une simulation ; connecter la source réelle avant toute décision opérationnelle.", actionLabel: "Voir la qualité", route: "/admin/analyses", dueLabel: "BETA" },
]);

export const BETA_MEDIA_ASSETS = Object.freeze([
  { id: "media-podcast-quartier", name: "la-marche-du-quartier.mp3", type: "audio", owner: "Jet d’Encre Éditions", license: "Tous droits réservés", validUntil: "2027-08-31", altReady: true, transcriptReady: true, captionsReady: true, status: "Prêt" },
  { id: "media-medina-video", name: "secrets-medina.mp4", type: "video", owner: "Studio Atlas", license: "Licence scolaire Maroc", validUntil: "2026-12-31", altReady: true, transcriptReady: false, captionsReady: false, status: "À compléter" },
  { id: "media-ebook-histoires", name: "petites-histoires-maroc.epub", type: "ebook", owner: "Jet d’Encre Éditions", license: "Édition numérique scolaire", validUntil: "2028-06-30", altReady: false, transcriptReady: true, captionsReady: true, status: "À compléter" },
]);
