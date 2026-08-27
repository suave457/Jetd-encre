import assert from "node:assert/strict";
import test from "node:test";
import { AEP_LEVELS, LEARNING_COMPETENCIES, normalizeAepLevel, normalizeCefrLevel, validateCompetencyCodes } from "../src/features/beta-data/learningTaxonomy.js";
import { canTransitionContentStatus, createContentRevision, validatePublicationReadiness } from "../src/features/beta-data/contentModelCore.js";
import { buildContentImportPlan, escapeCsvCell, parseCsv } from "../src/features/beta-data/csvImportCore.js";
import { deduplicateLearningEvents, sanitizeLearningEvent, validateLearningEvent } from "../src/features/beta-data/learningEventCore.js";
import { buildKpiSnapshot, calculateCompetencyProgress28d, calculateUsefulActivation } from "../src/features/beta-data/kpiCore.js";
import { profileLearningDataQuality } from "../src/features/beta-data/dataQualityCore.js";
import { BETA_AS_OF, createBetaFixtureDataset } from "../src/features/beta-data/betaFixtures.js";

test("normalizes the shared AEP and CEFR taxonomy without inventing equivalences", () => {
  assert.equal(normalizeAepLevel("5e AEP"), "aep5");
  assert.equal(normalizeAepLevel("Niveau 2"), "aep2");
  assert.equal(normalizeAepLevel("collège"), null);
  assert.equal(normalizeCefrLevel("Pré-A1"), "pre_a1");
  assert.equal(AEP_LEVELS.length, 6);
  assert.equal(new Set(LEARNING_COMPETENCIES.map((item) => item.code)).size, LEARNING_COMPETENCIES.length);
  assert.deepEqual(validateCompetencyCodes(["LEX-01", "inconnu"]).unknown, ["INCONNU"]);
});

test("blocks publication until pedagogy, rights and accessibility are complete", () => {
  const base = {
    id: "audio-1", type: "audio", title: "Écouter le quartier", summary: "Une écoute guidée.",
    aepLevels: ["aep5"], competencyTargets: [{ competencyCode: "ORAL-REP-02", cefrTarget: "a1" }],
    learningObjectives: ["Repérer trois informations."], rights: { holder: "Jet d’Encre", licenseType: "Scolaire" },
    accessibility: { altReady: true, transcriptReady: false }, editorialStatus: "approved",
  };
  assert.equal(validatePublicationReadiness(base).ok, false);
  assert.equal(validatePublicationReadiness({ ...base, accessibility: { altReady: true, transcriptReady: true } }).ok, true);
  assert.equal(canTransitionContentStatus("draft", "published"), false);
  assert.equal(canTransitionContentStatus("approved", "published"), true);
  const revision = createContentRevision(base, { title: "Nouveau titre" }, { now: "2026-08-27T10:00:00Z" });
  assert.equal(revision.version, 2);
  assert.equal(revision.before.title, "Écouter le quartier");
  assert.equal(revision.snapshot.title, "Nouveau titre");
});

test("previews French Excel CSV imports, duplicates and formula-safe exports", () => {
  const csv = "\uFEFFexternal_id;type;title;summary;aep_levels;competency_codes;cefr_targets;status\r\nC-1;article;\"La ville, mon quartier\";Résumé;5e AEP;LEX-01;A1;Brouillon\r\nC-1;article;Doublon;Résumé;5e AEP;LEX-01;A1;Brouillon";
  const plan = buildContentImportPlan([], csv);
  assert.equal(plan.ok, false);
  assert.equal(plan.summary.create, 1);
  assert.equal(plan.summary.rejected, 1);
  assert.ok(plan.errors.some((error) => error.code === "duplicate"));
  assert.equal(parseCsv('a;b\n"ligne\nlongue";c')[1][0], "ligne\nlongue");
  assert.equal(escapeCsvCell("=2+2"), "'=2+2");
});

test("learning events use a strict privacy allowlist and deduplicate event ids", () => {
  const input = {
    eventId: "evt-1", eventName: "game_completed", occurredAt: "2026-08-27T10:00:00Z", subjectKey: "pseudonym-1", tenantKey: "school-1", role: "eleve",
    properties: { scorePercent: 80, email: "child@example.test", answerText: "secret", source: "quiz" },
  };
  const validated = validateLearningEvent(input);
  assert.equal(validated.ok, true);
  assert.deepEqual(sanitizeLearningEvent(input).properties, { scorePercent: 80, source: "quiz" });
  assert.equal(deduplicateLearningEvents([input, { ...input }]).length, 1);
});

test("calculates decision KPIs with raw denominators and mature D+7 cohorts", () => {
  const dataset = createBetaFixtureDataset();
  const snapshot = buildKpiSnapshot(dataset, { asOf: BETA_AS_OF, weekStart: "2026-08-24T00:00:00Z", weekEnd: "2026-08-30T23:59:59Z" });
  assert.deepEqual(snapshot.usefulActivation, { rate: 77.8, numerator: 14, denominator: 18, pending: 2, excluded: 0, windowDays: 7 });
  assert.equal(snapshot.weeklyLearningValue.numerator, 13);
  assert.equal(snapshot.weeklyLearningValue.denominator, 17);
  assert.equal(snapshot.competencyProgress.comparablePairs, 12);
  assert.equal(snapshot.provisional, true);
});

test("keeps D+7 boundaries and 28-day comparisons deterministic", () => {
  const accesses = [{ subjectKey: "s1", assignedAt: "2026-08-01T00:00:00Z" }];
  const events = [
    { eventId: "a", subjectKey: "s1", eventName: "manual_activated", occurredAt: "2026-08-08T00:00:00Z" },
    { eventId: "b", subjectKey: "s1", eventName: "lesson_completed", occurredAt: "2026-08-08T00:00:00Z" },
  ];
  assert.equal(calculateUsefulActivation(accesses, events, { asOf: "2026-08-08T00:00:00Z" }).numerator, 1);
  const progress = calculateCompetencyProgress28d([
    { subjectKey: "s1", competencyCode: "LEX-01", assessmentFamilyId: "f1", score: 5, scaleMax: 10, assessedAt: "2026-08-01T00:00:00Z" },
    { subjectKey: "s1", competencyCode: "LEX-01", assessmentFamilyId: "f1", score: 16, scaleMax: 20, assessedAt: "2026-08-27T00:00:00Z" },
  ], { endAt: "2026-08-27T12:00:00Z" });
  assert.equal(progress.medianDeltaPoints, 30);
});

test("reports blocking data-quality defects instead of hiding them in one score", () => {
  const event = { eventId: "duplicate", eventName: "game_completed", occurredAt: "2026-09-01T00:00:00Z", receivedAt: "2026-09-01T00:00:00Z", subjectKey: "s1", tenantKey: "t1", competencyCodes: ["UNKNOWN"] };
  const quality = profileLearningDataQuality({ events: [event, event], accesses: [], assessments: [], references: { competencyCodes: ["LEX-01"] }, now: BETA_AS_OF });
  assert.equal(quality.readyForDecision, false);
  assert.ok(quality.findings.some((item) => item.code === "duplicate_event_id"));
  assert.ok(quality.findings.some((item) => item.code === "future_event"));
  assert.ok(quality.findings.some((item) => item.code === "orphan_competency"));
});
