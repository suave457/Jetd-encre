import assert from "node:assert/strict";
import test from "node:test";
import { clearJetDencreLocalData, clearOwnedStorage } from "../src/localDataReset.js";

function createWebStorage(entries = {}, failingKeys = new Set()) {
  const values = new Map(Object.entries(entries));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) {
      if (failingKeys.has(key)) throw new Error("blocked");
      values.delete(key);
    },
    clear() { throw new Error("clear must never be called"); },
  };
}

test("efface toutes les données Jet d’Encre sans toucher aux autres clés de l’origine", () => {
  const localStorage = createWebStorage({
    "jde.demo.store.v3": "store",
    "jde.reader.notes": "note libre",
    "jde.a11y.textSize": "Grand",
    "jde.parent.preferences.v2": "prefs",
    "jde.mission-zellige:v2:user-eleve-lina:2026-08-28": "progress",
    "jde.mission-zellige:telemetry:v1": "events",
    "jde.mots-fleches:v1:user-eleve-lina": "grid progress",
    "jde.question-bank.v1": "questions",
    "jde.prototype.session.v4": "prototype",
    "projet-debat-v01-preferences-eleve": "names",
    "projet-debat-v01-preferences-enseignant": "teacher names",
    "projet-debat-v01-cards": "cards",
    "other.product.preference": "must remain",
  });
  const sessionStorage = createWebStorage({
    "jde.returnTo": "/eleve/progression",
    "jde.student.onboarding.v1": "Lina Mansouri",
    "projet-debat-v01-session-eleve": "game",
    "projet-debat-v01-session-enseignant": "teacher game",
    "other.product.session": "must remain",
  });

  const report = clearJetDencreLocalData({ localStorage, sessionStorage });
  assert.equal(report.ok, true);
  assert.equal(report.localStorage.removed, 12);
  assert.equal(report.sessionStorage.removed, 4);
  assert.equal(localStorage.getItem("jde.reader.notes"), null);
  assert.equal(localStorage.getItem("jde.mots-fleches:v1:user-eleve-lina"), null);
  assert.equal(localStorage.getItem("projet-debat-v01-cards"), null);
  assert.equal(sessionStorage.getItem("jde.student.onboarding.v1"), null);
  assert.equal(sessionStorage.getItem("projet-debat-v01-session-enseignant"), null);
  assert.equal(localStorage.getItem("other.product.preference"), "must remain");
  assert.equal(sessionStorage.getItem("other.product.session"), "must remain");
});

test("signale un stockage bloqué sans interrompre les autres suppressions", () => {
  const storage = createWebStorage({ "jde.reader.notes": "note", "jde.a11y.textSize": "Grand", outside: "keep" }, new Set(["jde.reader.notes"]));
  const report = clearOwnedStorage(storage);
  assert.deepEqual(report.failed, ["jde.reader.notes"]);
  assert.equal(report.removed, 1);
  assert.equal(storage.getItem("jde.reader.notes"), "note");
  assert.equal(storage.getItem("jde.a11y.textSize"), null);
  assert.equal(storage.getItem("outside"), "keep");

  const unavailable = clearOwnedStorage({ get length() { throw new Error("blocked"); } });
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.removed, 0);

  const globalReport = clearJetDencreLocalData({
    localStorage: { get length() { throw new Error("blocked"); } },
    sessionStorage: createWebStorage({ "jde.returnTo": "/eleve/progression" }),
  });
  assert.equal(globalReport.ok, false);
  assert.equal(globalReport.localStorage.available, false);
  assert.equal(globalReport.sessionStorage.removed, 1);
});
