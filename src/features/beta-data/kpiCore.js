import { deduplicateLearningEvents } from "./learningEventCore.js";

export const VALUE_EVENT_NAMES = Object.freeze(["lesson_completed", "activity_completed", "game_completed", "assignment_submitted"]);

function ratio(numerator, denominator) { return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0; }
function at(value) { const time = new Date(value).getTime(); return Number.isFinite(time) ? time : null; }
function uniqueSubjects(values) { return new Set(values.map((item) => item.subjectKey).filter(Boolean)); }

export function calculateUsefulActivation(accesses = [], events = [], { asOf = new Date(), windowDays = 7 } = {}) {
  const asOfTime = at(asOf) ?? Date.now();
  const windowMs = windowDays * 86_400_000;
  const mature = []; let pending = 0; let excluded = 0;
  const accessBySubject = new Map();
  for (const access of accesses) {
    const assignedAt = at(access.assignedAt);
    if (!access.subjectKey || assignedAt == null) { excluded += 1; continue; }
    if (assignedAt + windowMs > asOfTime) { pending += 1; continue; }
    const previous = accessBySubject.get(access.subjectKey);
    if (!previous || at(previous.assignedAt) > assignedAt) accessBySubject.set(access.subjectKey, access);
  }
  mature.push(...accessBySubject.values());
  const bySubject = new Map();
  for (const event of deduplicateLearningEvents(events)) {
    if (!bySubject.has(event.subjectKey)) bySubject.set(event.subjectKey, []);
    bySubject.get(event.subjectKey).push(event);
  }
  let numerator = 0;
  for (const access of mature) {
    const start = at(access.assignedAt); const end = start + windowMs;
    const subjectEvents = bySubject.get(access.subjectKey) || [];
    const activated = subjectEvents.some((event) => event.eventName === "manual_activated" && at(event.occurredAt) >= start && at(event.occurredAt) <= end);
    const value = subjectEvents.some((event) => VALUE_EVENT_NAMES.includes(event.eventName) && at(event.occurredAt) >= start && at(event.occurredAt) <= end);
    if (activated && value) numerator += 1;
  }
  return { rate: ratio(numerator, mature.length), numerator, denominator: mature.length, pending, excluded, windowDays };
}

export function calculateWeeklyLearningValue(activatedSubjects = [], events = [], { weekStart, weekEnd } = {}) {
  const start = at(weekStart); const end = at(weekEnd) ?? (start == null ? null : start + 7 * 86_400_000 - 1);
  if (start == null || end == null) return { rate: 0, numerator: 0, denominator: 0, excluded: activatedSubjects.length };
  const eligible = uniqueSubjects(activatedSubjects.filter((item) => at(item.activatedAt) != null && at(item.activatedAt) <= end));
  const active = new Set(deduplicateLearningEvents(events).filter((event) => eligible.has(event.subjectKey) && VALUE_EVENT_NAMES.includes(event.eventName) && at(event.occurredAt) >= start && at(event.occurredAt) <= end).map((event) => event.subjectKey));
  return { rate: ratio(active.size, eligible.size), numerator: active.size, denominator: eligible.size, excluded: 0 };
}

function median(numbers) {
  if (!numbers.length) return 0;
  const sorted = [...numbers].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function calculateCompetencyProgress28d(records = [], { endAt = new Date(), windowDays = 28 } = {}) {
  const end = at(endAt) ?? Date.now(); const start = end - windowDays * 86_400_000;
  const eligibleSubjects = uniqueSubjects(records.filter((record) => at(record.assessedAt) >= start && at(record.assessedAt) <= end));
  const groups = new Map();
  for (const record of records) {
    const time = at(record.assessedAt); const scaleMax = Number(record.scaleMax); const score = Number(record.score);
    if (!record.subjectKey || !record.competencyCode || !record.assessmentFamilyId || time == null || time < start || time > end || !Number.isFinite(score) || !Number.isFinite(scaleMax) || scaleMax <= 0) continue;
    const key = `${record.subjectKey}:${record.competencyCode}:${record.assessmentFamilyId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...record, normalized: (score / scaleMax) * 100, time });
  }
  const deltas = []; const pairedSubjects = new Set();
  for (const group of groups.values()) {
    group.sort((a, b) => a.time - b.time);
    if (group.length < 2) continue;
    deltas.push(group.at(-1).normalized - group[0].normalized); pairedSubjects.add(group[0].subjectKey);
  }
  const improved = deltas.filter((delta) => delta > 0).length;
  return {
    medianDeltaPoints: Math.round(median(deltas) * 10) / 10,
    improvedRate: ratio(improved, deltas.length),
    comparablePairs: deltas.length,
    eligibleSubjects: eligibleSubjects.size,
    coverageRate: ratio(pairedSubjects.size, eligibleSubjects.size),
    windowDays,
  };
}

export function buildKpiSnapshot(dataset, options = {}) {
  return {
    usefulActivation: calculateUsefulActivation(dataset.accesses, dataset.events, { asOf: options.asOf, windowDays: 7 }),
    weeklyLearningValue: calculateWeeklyLearningValue(dataset.activations, dataset.events, { weekStart: options.weekStart, weekEnd: options.weekEnd }),
    competencyProgress: calculateCompetencyProgress28d(dataset.assessments, { endAt: options.asOf, windowDays: 28 }),
    freshness: dataset.freshness || null,
    sourceStatus: dataset.sourceStatus || "unknown",
    provisional: dataset.sourceStatus !== "connected",
  };
}
