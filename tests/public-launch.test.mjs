import assert from "node:assert/strict";
import test from "node:test";
import { readAccessibilityPreferences, saveAccessibilityPreferences, applyAccessibilityPreferences } from "../src/accessibilityPreferences.js";
import { PUBLIC_PREVIEW_PATHS, getPageMetadata, getSiteOrigin, isPublicIndexingEnabled, buildPublicSitemap, buildPublicRobots } from "../src/publicContent.js";
import { parseRoute, usesSchoolDocumentNavigation } from "../src/routeCore.js";
import { getSchoolSection, getAutomaticSignInPath, getSignInFailure, withSchoolProfile } from "../src/features/pilote/schoolNavigationCore.js";

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

test("le choix du profil lance uniquement la connexion OIDC explicitement demandée", () => {
  const anonymous = { authenticated: false, mode: "oidc", signInPath: "/api/pilot/auth/start" };
  for (const search of ["?connexion=1", "?profil=eleve&connexion=1", "?profil=parent&connexion=1", "?profil=admin&connexion=1"]) {
    const profile=new URLSearchParams(search).get('profil');
    assert.equal(getAutomaticSignInPath(anonymous, search), '/api/pilot/auth/start'+(profile?'?profil='+profile:''), search);
  }
  for (const search of ["", "?profil=eleve", "?connexion=0", "?connexion=echec", "?connexion=expiree", "?connexion=non-autorisee", "?connexion=1&connexion=1", "?connexion=1&connexion=echec", "?connexion=echec&connexion=1", "?profil=admin&profil=eleve&connexion=1", "?profil=inconnu&connexion=1", "?profil=&connexion=1"]) {
    assert.equal(getAutomaticSignInPath(anonymous, search), null, search);
  }
  assert.equal(getAutomaticSignInPath(anonymous,'?connexion=1','admin'),'/api/pilot/auth/start?profil=admin');
});

test("une session existante, locale ou invalide ne déclenche aucune redirection automatique", () => {
  const anonymous = { authenticated: false, mode: "oidc", signInPath: "/api/pilot/auth/start" };
  const sessions = [
    null,
    {},
    { ...anonymous, authenticated: true, user: { id: "teacher-a", role: "enseignant" } },
    { ...anonymous, authenticated: "false" },
    { ...anonymous, authenticated: undefined },
    { ...anonymous, mode: "local_fixture" },
    { ...anonymous, mode: undefined },
    { ...anonymous, signInPath: null },
    { ...anonymous, signInPath: "https://foreign.example/login" },
    { ...anonymous, signInPath: "//foreign.example/login" },
    { ...anonymous, signInPath: "/api/pilot/auth/start?returnTo=https://foreign.example" },
  ];
  for (const session of sessions) {
    assert.equal(getAutomaticSignInPath(session, "?profil=admin&connexion=1"), null);
  }
});

test('un retour de connexion refusé ne reprend pas une ancienne session en silence',()=>{
  for(const reason of ['profil-incompatible','non-autorisee','expiree','echec'])assert.ok(getSignInFailure('?profil=eleve&connexion='+reason));
  assert.ok(getSignInFailure('?connexion=echec&connexion=1'));
  for(const query of ['','?profil=eleve','?connexion=1'])assert.equal(getSignInFailure(query),null);
});

test('les liens natifs conservent le profil sans détourner une destination extérieure',()=>{
  for(const role of ['eleve','parent','enseignant']){
    assert.equal(withSchoolProfile('/pilote',role),'/pilote?profil='+role);
    assert.equal(withSchoolProfile('/pilote?section=devoirs&profil=admin&profil=eleve#travaux',role),'/pilote?section=devoirs&profil='+role+'#travaux');
    for(const target of ['/guide-ecole','/admin/accueil','//foreign.example/pilote','https://foreign.example/pilote','/pilote-inconnu'])assert.equal(withSchoolProfile(target,role),target);
  }
  assert.equal(withSchoolProfile('/pilote?section=jeux','inconnu'),'/pilote?section=jeux');
});

test("les rubriques intégrées restent dans le parcours scolaire privé et le jeu conserve son URL", () => {
  const metadataOptions = { origin: "https://example.org", indexable: true };
  for (const section of ["accueil", "devoirs", "jeux", "mediatheque", "progres", "classes", "enfants", "aide"]) {
    const path = `/pilote?section=${section}`;
    assert.equal(parseRoute(path).kind, "pilot", path);
    assert.equal(usesSchoolDocumentNavigation(path), true, path);
    assert.equal(getPageMetadata(path, metadataOptions).robots, "noindex,nofollow", path);
    assert.equal(getPageMetadata(path, metadataOptions).canonical, null, path);
  }
  assert.equal(parseRoute("/pilote/jeux/mots-fleches?section=jeux").screen, "pilot.game.mots-fleches");
  for (const role of ["eleve", "parent", "enseignant", "directeur", "admin"]) {
    assert.equal(parseRoute(`/connexion/${role}`).kind, "login", role);
    assert.equal(usesSchoolDocumentNavigation(`/connexion/${role}`), false, role);
  }
});

test("l’accueil reste l’entrée par défaut et une rubrique inconnue ne crée pas de nouvel écran", () => {
  for (const role of ["eleve", "parent", "enseignant"]) {
    for (const search of ["", "?profil=eleve", "?section=", "?section=inconnue", "?section=../admin", "?section=https://foreign.example", "?section=devoirs&section=classes", "?section=devoirs&section=devoirs"]) {
      assert.equal(getSchoolSection(search, role), "accueil", `${role} ${search}`);
    }
    assert.equal(getSchoolSection("?section=devoirs", role), "devoirs", role);
    assert.equal(getSchoolSection("?section=aide", role), "aide", role);
  }
});

test("les rubriques se fondent sur le rôle de session et jamais sur le profil demandé dans l’URL", () => {
  assert.equal(getSchoolSection("?section=classes", "enseignant"), "classes");
  assert.equal(getSchoolSection("?section=enfants", "parent"), "enfants");
  assert.equal(getSchoolSection("?section=jeux", "eleve"), "jeux");
  assert.equal(getSchoolSection("?section=classes&profil=enseignant", "eleve"), "accueil");
  assert.equal(getSchoolSection("?section=enfants&profil=parent", "eleve"), "accueil");
  assert.equal(getSchoolSection("?section=classes&profil=enseignant", "parent"), "accueil");
  assert.equal(getSchoolSection("?section=enfants&profil=parent", "enseignant"), "accueil");
  for (const role of [undefined, null, "inconnu", "admin", "directeur", "__proto__", "constructor", "toString"]) {
    assert.equal(getSchoolSection("?section=devoirs&profil=eleve", role), "accueil", String(role));
  }
});
