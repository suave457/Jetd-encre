import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const configSource = await readFile(new URL("public/prototype-config.js", root), "utf8");
const runtimeSource = await readFile(new URL("public/prototype.js", root), "utf8");
const prototypeCss = await readFile(new URL("public/prototype.css", root), "utf8");
const exportHtml = await readFile(new URL("public/pencil-export.html", root), "utf8");
const context = { window: {} };
vm.runInNewContext(configSource, context);
const config = context.window.JDE_PROTOTYPE_CONFIG;
const expectedFrames = [...new Set(config.routes.flatMap((route) => Object.values(route.frames || {})))];
const extendedExportReady = /data-pencil-name="W05_/.test(exportHtml);
const studentExportReady = /data-pencil-name="W06_ELV_13_EtatsSysteme_D_1440x900"/.test(exportHtml);

function routeKeyFor(pathname) {
  for (const route of config.routes) {
    if ((route.patterns || []).some((source) => new RegExp(source, "i").test(pathname))) return route.key;
  }
  return null;
}

function localResourceReferences(source) {
  const references = [
    ...[...source.matchAll(/(?:\bsrc|\bhref)=["']([^"']+)["']/gi)].map((match) => match[1]),
    ...[...source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((match) => match[1]),
  ];

  return [...new Set(references)]
    .map((reference) => reference.trim())
    .filter(
      (reference) =>
        reference &&
        !/^(?:data:|https?:|\/\/|#|mailto:|tel:|javascript:)/i.test(reference),
    );
}

test("declares the complete W01–W06 route manifest", () => {
  assert.equal(config.storageKey, "jde.prototype.session.v4");
  assert.equal(expectedFrames.length, 84);
  assert.equal(new Set(expectedFrames).size, expectedFrames.length);
  for (const route of config.routes) {
    assert.ok(route.key);
    assert.ok(route.patterns.length > 0);
    assert.ok(route.frames.desktop);
    assert.ok(route.frames.tablet);
  }
});

test("matches representative Admin, Directeur and Élève deep routes", () => {
  const samples = {
    "/admin/bibliotheque": "admin.library",
    "/admin/contenus/POD-0018/modifier": "admin.studio",
    "/admin/contenus/POD-0018/previsualisation": "admin.preview",
    "/admin/contenus/POD-0018/revue": "admin.review",
    "/admin/contenus/POD-0018/planification": "admin.schedule",
    "/admin/contenus/POD-0018/publication-reussie": "admin.published",
    "/admin/contenus/POD-0018/historique": "admin.history",
    "/contenus/les-voix-du-maroc-la-marche-du-quartier": "public.content",
    "/admin/contenus/POD-0018/etat-systeme/failed": "admin.system",
    "/directeur/tableau-de-bord": "director.dashboard",
    "/directeur/classes": "director.classes",
    "/directeur/classes/5A": "director.class",
    "/directeur/enseignants": "director.teachers",
    "/directeur/affectations": "director.assignments",
    "/directeur/eleves/activation": "director.activation",
    "/directeur/suivi-utilisation": "director.usage",
    "/directeur/etablissement": "director.school",
    "/connexion": "auth.profile-choice",
    "/connexion/eleve": "auth.student-login",
    "/mot-de-passe-oublie": "auth.forgot-password",
    "/reinitialisation": "auth.reset-password",
    "/session-expiree": "auth.session-expired",
    "/activation": "activation.entry",
    "/activation/code-invalide": "activation.invalid",
    "/activation/deja-actif": "activation.used",
    "/activation/code-expire": "activation.expired",
    "/activation/succes": "activation.success",
    "/eleve/onboarding/profil": "student.onboarding-profile",
    "/eleve/onboarding/classe": "student.onboarding-class",
    "/eleve/tableau-de-bord": "student.dashboard",
    "/eleve/manuels": "student.manuals",
    "/eleve/manuels/francais-5-aep/lecons/protegeons-notre-environnement": "student.reader",
    "/eleve/activites/les-mots-de-l-environnement/resultat": "student.exercise-result",
    "/eleve/activites/les-mots-de-l-environnement": "student.exercise",
    "/eleve/devoirs": "student.assignments",
    "/eleve/devoirs/protegeons-la-nature/remise-confirmee": "student.assignment-submitted",
    "/eleve/devoirs/protegeons-la-nature": "student.assignment",
    "/eleve/progression": "student.progress",
    "/eleve/mediatheque": "student.media",
    "/eleve/recompenses": "student.rewards",
    "/eleve/profil": "student.profile",
    "/eleve/etat-systeme/hors-connexion": "student.system",
  };
  for (const [pathname, expected] of Object.entries(samples)) {
    assert.equal(routeKeyFor(pathname), expected, pathname);
  }
  assert.equal(config.actionRoutes["Action Aperçu tablette"], "/admin/contenus/POD-0018/previsualisation");
  assert.equal(config.actionRoutes["Action Revue tablette"], "/admin/contenus/POD-0018/revue");
  assert.equal(config.actionRoutes["Action Élève · Se déconnecter"], "/connexion/eleve");
  assert.equal(config.defaultState.student.auth.signedIn, true);
  assert.equal(config.defaultState.student.profile.recoveryCode, undefined);
});

test("extended Pen export contains each manifest frame exactly once", { skip: !extendedExportReady || !studentExportReady }, () => {
  for (const name of expectedFrames) {
    const count = exportHtml.split(`data-pencil-name="${name}"`).length - 1;
    assert.equal(count, 1, name);
  }
});

test("extended export loads config before the interaction runtime", { skip: !extendedExportReady || !studentExportReady }, () => {
  const configIndex = exportHtml.indexOf('src="prototype-config.js"');
  const runtimeIndex = exportHtml.indexOf('src="prototype.js"');
  assert.ok(configIndex > -1);
  assert.ok(runtimeIndex > configIndex);
});

test("every local src, href and url resource exists in public", async () => {
  const publicRoot = new URL("public/", root);
  const references = [
    ...localResourceReferences(exportHtml),
    ...localResourceReferences(prototypeCss),
  ];
  const missing = [];

  for (const reference of new Set(references)) {
    const cleanPath = reference.split(/[?#]/, 1)[0].replace(/^\/+/, "");
    try {
      await access(new URL(cleanPath, publicRoot));
    } catch {
      missing.push(reference);
    }
  }

  assert.deepEqual(missing, []);
});

test("tablet Director P0 roots have desktop-equivalent behavior contracts", { skip: !extendedExportReady }, () => {
  const routeActions = [
    ["Action tablette · Créer une classe", "Action · Créer une classe"],
    ["Action tablette · Inviter un enseignant", "Action · Inviter un enseignant"],
    ["Action tablette · Affecter", "Action · Affecter"],
    ["Action tablette · Activer des élèves", "Action · Activer des élèves"],
    ["Action tablette · Voir les alertes", "Action · Voir les alertes"],
  ];
  const mutationButtons = [
    "Bouton tablette · Enregistrer la classe",
    "Bouton tablette · Envoyer l’invitation",
    "Bouton tablette · Confirmer l’affectation",
    "Bouton tablette · Générer les codes",
    "Bouton tablette · Contacter l’assistance",
  ];

  for (const [tabletName, desktopName] of routeActions) {
    assert.ok(exportHtml.split(`data-pencil-name="${tabletName}"`).length - 1 >= 1, tabletName);
    assert.ok(config.actionRoutes[desktopName], desktopName);
  }
  for (const tabletName of mutationButtons) {
    assert.ok(exportHtml.split(`data-pencil-name="${tabletName}"`).length - 1 >= 1, tabletName);
  }
  assert.match(runtimeSource, /replace\(\/\^Action tablette/);
  assert.match(runtimeSource, /replace\(\/\^Bouton tablette/);
  assert.match(runtimeSource, /replace\(\/\^Onglet tablette/);
  assert.match(runtimeSource, /replace\(\/\^Filtre tablette/);
});

test("Student P0 controls and child-safe state contract are present", { skip: !studentExportReady }, () => {
  const requiredControls = [
    "Nav Élève · Tableau de bord",
    "Nav Élève · Manuels",
    "Nav Élève · Devoirs",
    "Nav Élève · Médiathèque",
    "Nav Élève · Progression",
    "Navigation Élève · Accueil",
    "Action Élève · Reprendre la leçon",
    "Action Élève · Lancer activité",
    "Action Élève · Valider réponse",
    "Action Élève · Rendre le devoir",
    "Action Élève · Voir récompenses",
    "Action Élève · Se déconnecter",
  ];
  for (const name of requiredControls) {
    assert.ok(exportHtml.includes(`data-pencil-name="${name}"`), name);
  }
  assert.match(runtimeSource, /session\.student\.auth\.signedIn = false/);
  assert.doesNotMatch(JSON.stringify(config.defaultState.student), /recoveryCode|email|birth|audioBlob/i);
  assert.ok(
    config.routes.find((route) => route.key === "student.reader").patterns.every((pattern) => !pattern.includes("^/eleve/lecons/")),
  );
});
