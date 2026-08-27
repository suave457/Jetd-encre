import { LEARNING_EVENT_NAMES, deduplicateLearningEvents, pairStartAndCompletionEvents } from "./learningEventCore.js";

function finding(dimension, severity, count, total, code, label) {
  return { dimension, severity, count, rate: total ? Math.round((count / total) * 1000) / 10 : 0, code, label };
}

export function profileLearningDataQuality({ events = [], accesses = [], assessments = [], references = {}, now = new Date(), freshnessThresholdHours = 24 } = {}) {
  const findings = []; const nowTime = new Date(now).getTime(); const competencyCodes = new Set(references.competencyCodes || []); const contentIds = new Set(references.contentIds || []);
  const duplicateCount = Math.max(0, events.length - deduplicateLearningEvents(events).length);
  if (duplicateCount) findings.push(finding("unicite", "critical", duplicateCount, events.length, "duplicate_event_id", "Événements dupliqués"));
  const missingIds = events.filter((event) => !event.eventId || !event.subjectKey || !event.tenantKey).length;
  if (missingIds) findings.push(finding("completude", "critical", missingIds, events.length, "missing_required_id", "Identifiants analytiques manquants"));
  const futureEvents = events.filter((event) => new Date(event.occurredAt).getTime() > nowTime + 300_000).length;
  if (futureEvents) findings.push(finding("validite", "critical", futureEvents, events.length, "future_event", "Événements datés dans le futur"));
  const unknownNames = events.filter((event) => !LEARNING_EVENT_NAMES.includes(event.eventName)).length;
  if (unknownNames) findings.push(finding("validite", "warning", unknownNames, events.length, "unknown_event", "Événements inconnus"));
  const orphanCompetencies = events.filter((event) => (event.competencyCodes || []).some((code) => competencyCodes.size && !competencyCodes.has(code))).length + assessments.filter((record) => competencyCodes.size && !competencyCodes.has(record.competencyCode)).length;
  if (orphanCompetencies) findings.push(finding("integrite", "critical", orphanCompetencies, events.length + assessments.length, "orphan_competency", "Compétences sans référentiel"));
  const orphanContents = events.filter((event) => event.contentId && contentIds.size && !contentIds.has(event.contentId)).length;
  if (orphanContents) findings.push(finding("integrite", "critical", orphanContents, events.length, "orphan_content", "Contenus sans référentiel"));
  const pairings = pairStartAndCompletionEvents(events);
  if (pairings.orphanCompletions.length) findings.push(finding("coherence", "warning", pairings.orphanCompletions.length, events.length, "orphan_completion", "Fins d’activité sans début associé"));
  const latestReceivedAt = events.reduce((latest, event) => Math.max(latest, new Date(event.receivedAt || event.occurredAt).getTime() || 0), 0);
  const freshnessHours = latestReceivedAt ? Math.max(0, Math.round(((nowTime - latestReceivedAt) / 3_600_000) * 10) / 10) : null;
  if (freshnessHours == null || freshnessHours > freshnessThresholdHours) findings.push(finding("fraicheur", "warning", 1, 1, "stale_data", "Données non actualisées dans le délai attendu"));
  const invalidAssessments = assessments.filter((record) => !Number.isFinite(Number(record.score)) || !Number.isFinite(Number(record.scaleMax)) || Number(record.scaleMax) <= 0 || Number(record.score) < 0 || Number(record.score) > Number(record.scaleMax)).length;
  if (invalidAssessments) findings.push(finding("validite", "critical", invalidAssessments, assessments.length, "invalid_assessment", "Mesures de progression invalides"));
  const critical = findings.filter((item) => item.severity === "critical").reduce((sum, item) => sum + item.count, 0);
  return {
    readyForDecision: critical === 0 && events.length > 0 && accesses.length > 0,
    findings,
    freshnessHours,
    coverage: { events: events.length, accesses: accesses.length, assessments: assessments.length },
    summary: { critical, warnings: findings.filter((item) => item.severity === "warning").reduce((sum, item) => sum + item.count, 0) },
  };
}
