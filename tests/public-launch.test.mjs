import assert from "node:assert/strict";
import test from "node:test";
import { readAccessibilityPreferences, saveAccessibilityPreferences, applyAccessibilityPreferences } from "../src/accessibilityPreferences.js";
import { PUBLIC_PREVIEW_PATHS, getPageMetadata, getSiteOrigin, isPublicIndexingEnabled, buildPublicSitemap, buildPublicRobots } from "../src/publicContent.js";
import { parseRoute, usesSchoolDocumentNavigation } from "../src/routeCore.js";

test("les nouvelles pages publiques ont une route et des métadonnées propres, sans indexation par défaut", () => {
  const titles = new Set();
  for (const path of PUBLIC_PREVIEW_PATHS) {
    assert.ok(["landing", "public-info", "blog-index", "blog-article"].includes(parseRoute(path).kind));
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
  for (const path of ["/pilote", "/pilote/jeux/mots-fleches", "/eleve/mediatheque/test-momo-chapitre-1", "/parent", "/admin", "/admin/ecoles-acces", "/api/v1/dashboard", "/connexion", "/connexion/enseignant", "/reinitialisation", "/inconnue"]) {
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


test("les hôtes de test restent fermés aux moteurs même avec l’option d’indexation", () => {
  for (const origin of ["https://test.workers.dev", "https://preview.test.pages.dev", "https://sample.chatgpt.site"]) {
    const options = { origin, indexable: true };
    assert.equal(isPublicIndexingEnabled(options), false);
    assert.equal(getPageMetadata("/guide-ecole", options).robots, "noindex,nofollow");
    assert.equal(buildPublicRobots(options), "User-agent: *\nDisallow: /\n");
    assert.equal(buildPublicSitemap(options).includes("<url>"), false);
  }
});

test("le sitemap ne contient que les pages publiques préparées, dont le guide et les articles", () => {
  const options = { origin: "https://example.org", indexable: true };
  assert.equal(buildPublicSitemap({ origin: options.origin }).includes("<url>"), false);
  const urls = [...buildPublicSitemap(options).matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(urls, PUBLIC_PREVIEW_PATHS.map(path => options.origin + path));
  assert.ok(urls.includes("https://example.org/guide-ecole"));
  assert.ok(urls.includes("https://example.org/blog"));
  assert.ok(urls.includes("https://example.org/blog/7-jeux-parler-francais-maison"));
  const robots = buildPublicRobots(options);
  for (const path of ["/pilote", "/admin", "/connexion", "/reinitialisation", "/api"]) assert.ok(robots.includes("Disallow: " + path + "\n"));
  assert.ok(robots.includes("Sitemap: https://example.org/sitemap.xml"));
});

test("le jeu scolaire a une route exacte et ne transforme pas tout le préfixe en page valide", () => {
  const route = parseRoute("/pilote/jeux/mots-fleches");
  assert.equal(route.kind, "pilot");
  assert.equal(route.screen, "pilot.game.mots-fleches");
  assert.equal(route.params.game, "mots-fleches");
  assert.equal(parseRoute("/pilote/jeux/inconnu").kind, "not-found");
  assert.equal(parseRoute("/pilote/jeux/mots-fleches/extra").kind, "not-found");
  assert.equal(parseRoute("/connexion").kind, "connection");
  assert.equal(parseRoute("/connexion/directeur").kind, "login");
});

test("les liens scolaires changent de document tandis que la navigation de démonstration reste locale", () => {
  for (const path of ["/connexion", "/connexion?mode=demo", "/pilote", "/pilote?profil=eleve", "/pilote/jeux/mots-fleches/", "/admin", "/admin/accueil/", "/admin/ecoles-acces?ecole=test"]) assert.equal(usesSchoolDocumentNavigation(path), true, path);
  for (const path of ["/connexion/enseignant", "/connexion/directeur", "/admin/pilotage", "/guide-ecole", "/pilote-inconnu"]) assert.equal(usesSchoolDocumentNavigation(path), false,path);
});

test('l’accueil administrateur connecté reste distinct du pilotage de démonstration',()=>{
  for(const path of ['/admin','/admin/accueil','/admin/accueil/'])assert.equal(parseRoute(path).screen,'pilot.admin.home');
  assert.equal(parseRoute('/admin/ecoles-acces?ecole=test').screen,'pilot.admin.access');
  assert.equal(parseRoute('/admin/pilotage').kind,'app');
  assert.equal(parseRoute('/admin/accueil/inconnu').kind,'not-found');
  assert.equal(getPageMetadata('/admin/accueil',{origin:'https://example.org',indexable:true}).robots,'noindex,nofollow');
});
