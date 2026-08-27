import assert from "node:assert/strict";
import test from "node:test";

import {
  ROLE_HOME,
  ROLE_PAGES,
  ROLES,
  buildAppPath,
  getRoleHome,
  isPageAllowed,
  isRole,
  normalizeRoute,
  parseRoute,
  resolveAppAccess,
} from "../src/routeCore.js";

test("les cinq rôles et leurs accueils sont centralisés", () => {
  assert.deepEqual(ROLES, ["eleve", "parent", "enseignant", "directeur", "admin"]);
  assert.equal(getRoleHome("parent"), "/parent/tableau-de-bord");
  assert.equal(getRoleHome("admin"), "/admin/pilotage");
  assert.equal(getRoleHome("inconnu"), null);
  assert.equal(ROLE_HOME.eleve, "/eleve/tableau-de-bord");
});

test("les pages sont validées par rôle", () => {
  assert.equal(isRole("parent"), true);
  assert.equal(isRole("famille"), false);
  assert.equal(isPageAllowed("parent", "enfants"), true);
  assert.equal(isPageAllowed("eleve", "jeux"), true);
  assert.equal(isPageAllowed("enseignant", "defis"), true);
  assert.equal(isPageAllowed("admin", "questions"), true);
  assert.equal(isPageAllowed("parent", "pilotage"), false);
  assert.equal(isPageAllowed("admin", "pilotage"), true);
  assert.equal(isPageAllowed("admin", "tableau-de-bord"), false);
  assert.ok(Object.isFrozen(ROLE_PAGES.parent));
});

test("normalise les chemins hashés, les requêtes et les URL complètes", () => {
  assert.equal(normalizeRoute("#/eleve/devoirs/?filtre=a-faire"), "/eleve/devoirs");
  assert.equal(normalizeRoute("eleve//manuel/"), "/eleve/manuel");
  assert.equal(
    normalizeRoute("https://prototype.example/?device=desktop#/directeur/enseignants"),
    "/directeur/enseignants",
  );
});

test("analyse toutes les routes publiques et d’authentification", () => {
  assert.deepEqual(parseRoute("/"), { kind: "landing", path: "/" });
  assert.deepEqual(parseRoute("/blog"), { kind: "blog-index", path: "/blog" });
  assert.deepEqual(parseRoute("/blog/7-jeux-parler-francais-maison"), {
    kind: "blog-article",
    path: "/blog/7-jeux-parler-francais-maison",
    slug: "7-jeux-parler-francais-maison",
  });
  assert.deepEqual(parseRoute("/connexion"), { kind: "connection", path: "/connexion" });
  assert.deepEqual(parseRoute("/activation"), { kind: "activation", path: "/activation" });
  assert.deepEqual(parseRoute("/connexion/parent"), {
    kind: "login",
    path: "/connexion/parent",
    role: "parent",
  });
});

test("analyse une page d’application et un unique segment de détail", () => {
  assert.deepEqual(parseRoute("/enseignant/classes"), {
    kind: "app",
    path: "/enseignant/classes",
    role: "enseignant",
    page: "classes",
    detail: null,
    isDetail: false,
  });
  assert.deepEqual(parseRoute("/parent/enfants/lina-mansouri"), {
    kind: "app",
    path: "/parent/enfants/lina-mansouri",
    role: "parent",
    page: "enfants",
    detail: "lina-mansouri",
    isDetail: true,
  });
  assert.equal(parseRoute("/eleve/jeux/mot-juste").detail, "mot-juste");
  assert.equal(parseRoute("/admin/questions").page, "questions");
});

test("accepte les identifiants éditoriaux en majuscules dans une fiche détaillée", () => {
  assert.deepEqual(parseRoute("/admin/bibliotheque/JEU-0012"), {
    kind: "app",
    path: "/admin/bibliotheque/JEU-0012",
    role: "admin",
    page: "bibliotheque",
    detail: "JEU-0012",
    isDetail: true,
  });
});

test("redirige la racine d’un espace vers son accueil", () => {
  assert.deepEqual(parseRoute("/admin"), {
    kind: "redirect",
    path: "/admin",
    to: "/admin/pilotage",
    reason: "role_home",
  });
});

test("rejette les rôles, pages, détails et profondeurs inconnus", () => {
  assert.equal(parseRoute("/famille/tableau-de-bord").reason, "unknown_role");
  assert.equal(parseRoute("/parent/pilotage").reason, "page_not_allowed");
  assert.equal(parseRoute("/parent/enfants/Lina Mansouri").reason, "invalid_detail");
  assert.equal(parseRoute("/parent/enfants/lina/progres").reason, "too_many_segments");
  assert.equal(parseRoute("/connexion/famille").reason, "unknown_login_role");
  assert.equal(parseRoute("/blog/article/suite").reason, "invalid_blog_route");
});

test("construit des chemins canoniques sûrs", () => {
  assert.equal(buildAppPath("parent"), "/parent/tableau-de-bord");
  assert.equal(buildAppPath("admin", "bibliotheque"), "/admin/bibliotheque");
  assert.equal(buildAppPath("enseignant", "classes", "5a"), "/enseignant/classes/5a");
  assert.throws(() => buildAppPath("parent", "pilotage"), /indisponible/);
  assert.throws(() => buildAppPath("parent", "enfants", "Lina Mansouri"), /segment/);
});

test("protège une route applicative selon la session locale", () => {
  const route = parseRoute("/parent/enfants/lina-mansouri");
  assert.deepEqual(resolveAppAccess(route, { authenticated: false }), {
    allowed: false,
    route,
    redirectTo: "/connexion/parent",
    reason: "authentication_required",
  });
  assert.deepEqual(resolveAppAccess(route, { authenticated: true, role: "eleve" }), {
    allowed: false,
    route,
    redirectTo: "/eleve/tableau-de-bord",
    reason: "role_mismatch",
  });
  assert.equal(resolveAppAccess(route, { authenticated: true, role: "parent" }).allowed, true);
  assert.equal(resolveAppAccess(parseRoute("/blog"), {}).allowed, true);
});

test("expose les écrans Pen d’accès, de récupération et d’activation", () => {
  const expectedScreens = {
    "/connexion": "auth.profile-choice",
    "/connexion/eleve": "auth.student-login",
    "/mot-de-passe-oublie": "auth.forgot-password",
    "/reinitialisation": "auth.reset-password",
    "/session-expiree": "auth.session-expired",
    "/invitation": "auth.invitation",
    "/invitation/demo-invitation": "auth.invitation",
    "/activation": "activation.entry",
    "/activation/code-invalide": "activation.invalid",
    "/activation/acces-deja-active": "activation.used",
    "/activation/deja-actif": "activation.used",
    "/activation/code-expire": "activation.expired",
    "/activation/succes": "activation.success",
  };

  for (const [path, screen] of Object.entries(expectedScreens)) {
    const route = parseRoute(path);
    assert.equal(route.screen, screen, path);
    assert.ok(Object.isFrozen(route.params), path);
  }
  assert.deepEqual(parseRoute("/activation/code-invalide").params, {
    activationState: "code-invalide",
  });
  assert.deepEqual(parseRoute("/invitation/demo-invitation").params, {
    token: "demo-invitation",
  });
});

test("résout les quatre étapes canoniques du cycle enseignant Pen", () => {
  const expectedScreens = {
    "/enseignant/devoirs/nouveau": "teacher.assignment-new",
    "/enseignant/devoirs/devoir-1/previsualisation": "teacher.assignment-preview",
    "/enseignant/devoirs/devoir-1/remises": "teacher.submissions",
    "/enseignant/remises/remise-1/correction-audio": "teacher.audio-correction",
  };
  for (const [path, screen] of Object.entries(expectedScreens)) {
    const route = parseRoute(path);
    assert.equal(route.kind, "app", path);
    assert.equal(route.role, "enseignant", path);
    assert.equal(route.screen, screen, path);
  }
});

test("résout le parcours Élève Pen avec ses paramètres métier", () => {
  const expectedRoutes = {
    "/eleve/onboarding/profil": ["student.onboarding-profile", {}],
    "/eleve/onboarding/classe": ["student.onboarding-class", {}],
    "/eleve/tableau-de-bord": ["student.dashboard", {}],
    "/eleve/manuels": ["student.manuals", {}],
    "/eleve/manuels/francais-5/lecons/unite-2": [
      "student.reader",
      { manualId: "francais-5", lessonId: "unite-2" },
    ],
    "/eleve/activites/quiz-12": ["student.exercise", { activityId: "quiz-12" }],
    "/eleve/activites/quiz-12/resultat": [
      "student.exercise-result",
      { activityId: "quiz-12" },
    ],
    "/eleve/devoirs": ["student.assignments", {}],
    "/eleve/devoirs/devoir-7": ["student.assignment", { assignmentId: "devoir-7" }],
    "/eleve/devoirs/devoir-7/remise-confirmee": [
      "student.assignment-submitted",
      { assignmentId: "devoir-7" },
    ],
    "/eleve/progression": ["student.progress", {}],
    "/eleve/mediatheque": ["student.media", {}],
    "/eleve/recompenses": ["student.rewards", {}],
    "/eleve/profil": ["student.profile", {}],
    "/eleve/aide": ["student.profile", {}],
    "/eleve/etat-systeme/hors-connexion": [
      "student.system",
      { systemState: "hors-connexion" },
    ],
  };

  for (const [path, [screen, params]] of Object.entries(expectedRoutes)) {
    const route = parseRoute(path);
    assert.equal(route.kind, "app", path);
    assert.equal(route.role, "eleve", path);
    assert.equal(route.screen, screen, path);
    assert.deepEqual(route.params, params, path);
  }
});

test("conserve les anciennes URL Élève et Direction comme alias", () => {
  assert.equal(parseRoute("/eleve/manuel").screen, "student.manuals");
  assert.equal(parseRoute("/eleve/progres").screen, "student.progress");
  assert.equal(parseRoute("/directeur/activations").screen, "director.activation");
  assert.equal(parseRoute("/directeur/utilisation").screen, "director.usage");
  assert.equal(parseRoute("/admin/studio").screen, "admin.studio");
});

test("résout les écrans canoniques Direction et leurs modes", () => {
  const createClass = parseRoute("/directeur/classes/nouvelle");
  assert.equal(createClass.screen, "director.class");
  assert.deepEqual(createClass.params, { classId: null, mode: "create" });

  const editClass = parseRoute("/directeur/classes/6B");
  assert.equal(editClass.screen, "director.class");
  assert.deepEqual(editClass.params, { mode: "edit", classId: "6B" });

  const expectedScreens = {
    "/directeur/tableau-de-bord": "director.dashboard",
    "/directeur/classes": "director.classes",
    "/directeur/enseignants": "director.teachers",
    "/directeur/affectations": "director.assignments",
    "/directeur/eleves/activation": "director.activation",
    "/directeur/suivi-utilisation": "director.usage",
    "/directeur/etablissement": "director.school",
    "/directeur/assistance": "director.school",
  };
  for (const [path, screen] of Object.entries(expectedScreens)) {
    assert.equal(parseRoute(path).screen, screen, path);
  }
});

test("résout tout le cycle éditorial Admin et le contenu public", () => {
  const expectedScreens = {
    "/admin/bibliotheque": "admin.library",
    "/admin/contenus/nouveau": "admin.studio",
    "/admin/contenus/POD-0018/modifier": "admin.studio",
    "/admin/contenus/POD-0018/previsualisation": "admin.preview",
    "/admin/contenus/POD-0018/revue": "admin.review",
    "/admin/contenus/POD-0018/planification": "admin.schedule",
    "/admin/contenus/POD-0018/publication-reussie": "admin.published",
    "/admin/contenus/POD-0018/historique": "admin.history",
    "/admin/contenus/POD-0018/etat-systeme/failed": "admin.system",
  };

  for (const [path, screen] of Object.entries(expectedScreens)) {
    const route = parseRoute(path);
    assert.equal(route.kind, "app", path);
    assert.equal(route.role, "admin", path);
    assert.equal(route.screen, screen, path);
  }
  assert.deepEqual(parseRoute("/admin/contenus/POD-0018/etat-systeme/failed").params, {
    contentId: "POD-0018",
    systemState: "failed",
  });

  const publicContent = parseRoute("/contenus/les-voix-du-maroc");
  assert.equal(publicContent.kind, "public-content");
  assert.equal(publicContent.screen, "public.content");
  assert.deepEqual(publicContent.params, { slug: "les-voix-du-maroc" });
  assert.equal(resolveAppAccess(publicContent, {}).allowed, true);
});

test("protège aussi les routes Pen profondes selon leur rôle", () => {
  const studentRoute = parseRoute("/eleve/manuels/francais-5/lecons/unite-2");
  assert.equal(resolveAppAccess(studentRoute, { authenticated: false }).redirectTo, "/connexion/eleve");
  assert.equal(
    resolveAppAccess(studentRoute, { authenticated: true, role: "admin" }).redirectTo,
    "/admin/pilotage",
  );

  const adminRoute = parseRoute("/admin/contenus/POD-0018/revue");
  assert.equal(resolveAppAccess(adminRoute, { authenticated: true, role: "admin" }).allowed, true);
  assert.equal(
    resolveAppAccess(adminRoute, { authenticated: true, role: "directeur" }).reason,
    "role_mismatch",
  );
});

test("autorise l’onboarding Élève juste après une activation en attente", () => {
  const route = parseRoute("/eleve/onboarding/profil");
  const access = resolveAppAccess(route, {
    authenticated: false,
    pendingActivation: { code: "JDE-26-FR5-0042" },
  });
  assert.equal(access.allowed, true);
  assert.equal(access.redirectTo, null);
});
