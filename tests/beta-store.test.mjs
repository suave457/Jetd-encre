import assert from "node:assert/strict";
import test from "node:test";
import { createDemoStore, createMemoryStorage, DEMO_SCHEMA_VERSION, migrateDemoState } from "../src/demoStoreCore.js";
import { buildContentImportPlan } from "../src/features/beta-data/csvImportCore.js";

const NOW = new Date("2026-08-27T12:00:00.000Z");

test("migrates an ALPHA store to BETA without losing its editorial collections", () => {
  const alpha = {
    schemaVersion: 6,
    contents: [{ id: "alpha-content", title: "Contenu ALPHA", type: "Article", status: "Publié", createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() }],
    assignments: [{ id: "alpha-assignment", title: "Devoir ALPHA", status: "Brouillon" }],
    articles: [{ id: "alpha-article", title: "Article ALPHA", status: "Brouillon" }],
  };
  const migrated = migrateDemoState(alpha, NOW);
  assert.equal(migrated.schemaVersion, DEMO_SCHEMA_VERSION);
  assert.equal(migrated.contents[0].id, "alpha-content");
  assert.ok(migrated.referenceItems.length > 20);
  assert.ok(migrated.mediaAssets.length >= 3);
  assert.deepEqual(migrated.importJobs, []);
});

test("previews, applies, persists and idempotently rolls back a content import", () => {
  const storage = createMemoryStorage();
  const store = createDemoStore({ storage, now: () => NOW });
  const csv = "external_id;type;title;summary;aep_levels;competency_codes;cefr_targets;status\r\nBETA-001;activity;Décrire mon quartier;Activité orale;5e AEP;ORAL-PRO-01;A1;Brouillon";
  const plan = buildContentImportPlan(store.getState().contents, csv, { now: NOW });
  assert.equal(plan.ok, true);
  const applied = store.actions.applyContentImport(plan, { fileName: "beta.csv" });
  assert.equal(applied.ok, true);
  assert.ok(store.getState().contents.some((item) => item.externalId === "BETA-001"));
  const restored = createDemoStore({ storage, now: () => NOW });
  assert.ok(restored.getState().contents.some((item) => item.externalId === "BETA-001"));
  const rolledBack = restored.actions.rollbackImportJob(applied.job.id);
  assert.equal(rolledBack.rolledBack, true);
  assert.equal(restored.getState().contents.some((item) => item.externalId === "BETA-001"), false);
  assert.equal(restored.actions.rollbackImportJob(applied.job.id).duplicate, true);
});

test("creates real content versions for bulk edits and restores without destroying history", () => {
  const store = createDemoStore({ storage: createMemoryStorage(), now: () => NOW });
  const content = store.getState().contents[0];
  const updated = store.actions.bulkUpdateContents([content.id], { status: "À réviser" });
  assert.equal(updated.count, 1);
  const versions = store.getState().contentVersions.filter((item) => item.contentId === content.id);
  assert.deepEqual(versions.map((item) => item.version).sort(), [1, 2]);
  const baseline = versions.find((item) => item.version === 1);
  const restored = store.actions.restoreContentVersion(baseline.id);
  assert.equal(restored.ok, true);
  assert.equal(restored.item.title, content.title);
  assert.equal(restored.item.status, "Brouillon");
  assert.equal(store.getState().contentVersions.filter((item) => item.contentId === content.id).length, 3);
});

test("persists action decisions, media quality and guarded shared references", () => {
  const store = createDemoStore({ storage: createMemoryStorage(), now: () => NOW });
  assert.equal(store.actions.resolveActionItem("action-content-review", "resolved").ok, true);
  assert.equal(store.getState().actionResolutions[0].status, "resolved");

  const asset = store.actions.upsertMediaAsset({ name: "capsule.mp3", type: "audio", owner: "Jet d’Encre", license: "Scolaire", altReady: true, transcriptReady: false });
  assert.equal(asset.asset.status, "À compléter");
  assert.equal(store.actions.upsertMediaAsset({ ...asset.asset, transcriptReady: true }).asset.status, "Prêt");

  const reference = store.actions.upsertReferenceItem({ family: "competencies", code: "BETA-TEST", label: "Compétence de test" });
  assert.equal(reference.ok, true);
  store.actions.createContent({ title: "Contenu référencé", type: "Article", status: "Brouillon", competencies: ["BETA-TEST"] });
  const blocked = store.actions.toggleReferenceItem(reference.item.id, false);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, "in_use");
  assert.ok(store.getState().auditEntries.length >= 4);
});
