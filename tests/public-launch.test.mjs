import assert from "node:assert/strict";
import test from "node:test";
import { readAccessibilityPreferences, saveAccessibilityPreferences, applyAccessibilityPreferences } from "../src/accessibilityPreferences.js";
import { PUBLIC_PREVIEW_PATHS, getPageMetadata, getSiteOrigin } from "../src/publicContent.js";
import { parseRoute } from "../src/routeCore.js";

test("les nouvelles pages publiques ont une route et des métadonnées propres, sans indexation par défaut", () => {
  const titles = new Set();
  for (const path of PUBLIC_PREVIEW_PATHS) {
    assert.ok(["landing", "public-info"].includes(parseRoute(path).kind));
    const metadata = getPageMetadata(path);
    assert.equal(metadata.robots, "noindex,nofollow");
    assert.equal(metadata.canonical, null);
    assert.ok(metadata.description.length > 70);
    titles.add(metadata.title);
  }
  assert.equal(titles.size, PUBLIC_PREVIEW_PATHS.length);
});
test("l’indexation exige domaine validé et opt-in, et exclut tous les espaces privés", () => {
  assert.equal(getSiteOrigin("http://127.0.0.1:5173"), null);
  assert.equal(getSiteOrigin("https://demo.invalid"), null);
  assert.equal(getSiteOrigin("https://user:secret@example.org"), null);
  const options = { origin: "https://example.org", indexable: true };
  assert.equal(getPageMetadata("/familles", options).canonical, "https://example.org/familles");
  assert.equal(getPageMetadata("/familles", options).robots, "index,follow");
  for (const path of ["/eleve/mediatheque/test-momo-chapitre-1", "/parent", "/admin", "/api/v1/dashboard", "/connexion", "/inconnue"]) {
    assert.equal(getPageMetadata(path, options).robots, "noindex,nofollow");
    assert.equal(getPageMetadata(path, options).canonical, null);
  }
});
test("les préférences survivent au rechargement et normalisent les entrées", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key,value) => values.set(key,value) };
  const value = { textSize: "Grand", reduceMotion: true, autoTranscript: false };
  assert.equal(saveAccessibilityPreferences(value, storage).ok, true);
  assert.deepEqual(readAccessibilityPreferences(storage), value);
  values.set("jde.a11y.textSize", "gigantesque");
  assert.equal(readAccessibilityPreferences(storage).textSize, "Confortable");
  const root = { dataset: {}, style: { setProperty(name, value) { this[name] = value; } } };
  applyAccessibilityPreferences(value, root);
  assert.deepEqual(root.dataset, { textSize: "grand", reduceMotion: "true", autoTranscript: "false" });
  assert.equal(root.style["--jde-text-scale"], "1.18");
});
test("un stockage refusé ne plante pas et ne donne pas de faux succès", () => {
  const storage = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } };
  assert.doesNotThrow(() => readAccessibilityPreferences(storage));
  assert.equal(saveAccessibilityPreferences({ textSize: "Grand" }, storage).ok, false);
});

