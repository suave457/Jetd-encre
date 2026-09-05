import { PUBLIC_PAGES } from "./publicContent.js";

export const ROLES = Object.freeze(["eleve", "parent", "enseignant", "directeur", "admin"]);

export const ROLE_PAGES = Object.freeze({
  eleve: Object.freeze([
    "tableau-de-bord",
    "manuel",
    "manuels",
    "activites",
    "devoirs",
    "mediatheque",
    "jeux",
    "progres",
    "progression",
    "recompenses",
    "profil",
    "aide",
    "etat-systeme",
    "onboarding",
  ]),
  parent: Object.freeze([
    "tableau-de-bord",
    "enfants",
    "devoirs",
    "progres",
    "messages",
    "parametres",
  ]),
  enseignant: Object.freeze([
    "tableau-de-bord",
    "actions",
    "classes",
    "eleves",
    "devoirs",
    "remises",
    "jeux",
    "ressources",
    "analyses",
    "defis",
  ]),
  directeur: Object.freeze([
    "tableau-de-bord",
    "actions",
    "classes",
    "enseignants",
    "activations",
    "utilisation",
    "rapports",
    "affectations",
    "eleves",
    "suivi-utilisation",
    "etablissement",
    "assistance",
  ]),
  admin: Object.freeze([
    "pilotage",
    "analyses",
    "imports",
    "referentiels",
    "medias",
    "etablissements",
    "utilisateurs",
    "licences",
    "bibliotheque",
    "questions",
    "blog",
    "studio",
    "support",
    "securite",
    "contenus",
  ]),
});

export const ROLE_HOME = Object.freeze({
  eleve: "/eleve/tableau-de-bord",
  parent: "/parent/tableau-de-bord",
  enseignant: "/enseignant/tableau-de-bord",
  directeur: "/directeur/tableau-de-bord",
  admin: "/admin/pilotage",
});

const ROLE_SCREEN_PREFIX = Object.freeze({
  eleve: "student",
  parent: "parent",
  enseignant: "teacher",
  directeur: "director",
  admin: "admin",
});

export const ROLE_NOT_FOUND_SCREEN = Object.freeze(
  Object.fromEntries(
    ROLES.map((role) => [role, `${ROLE_SCREEN_PREFIX[role]}.not-found`]),
  ),
);

const SEGMENT_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;
const DETAIL_SEGMENT_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/i;

const APP_SCREEN_ALIASES = Object.freeze({
  parent: Object.freeze({
    "tableau-de-bord": "parent.dashboard",
    enfants: "parent.children",
    devoirs: "parent.assignments",
    progres: "parent.progress",
    messages: "parent.messages",
    parametres: "parent.settings",
  }),
  eleve: Object.freeze({
    "tableau-de-bord": "student.dashboard",
    manuel: "student.manuals",
    manuels: "student.manuals",
    devoirs: "student.assignments",
    mediatheque: "student.media",
    progres: "student.progress",
    progression: "student.progress",
    recompenses: "student.rewards",
    profil: "student.profile",
    aide: "student.profile",
    "etat-systeme": "student.system",
  }),
  directeur: Object.freeze({
    "tableau-de-bord": "director.dashboard",
    classes: "director.classes",
    enseignants: "director.teachers",
    affectations: "director.assignments",
    activations: "director.activation",
    utilisation: "director.usage",
    "suivi-utilisation": "director.usage",
    etablissement: "director.school",
    assistance: "director.school",
  }),
  admin: Object.freeze({
    bibliotheque: "admin.library",
    studio: "admin.beta-studio",
  }),
});

const CANONICAL_APP_ROUTES = Object.freeze([
  Object.freeze({
    pattern: /^\/parent\/enfants\/([^/]+)$/,
    role: "parent",
    page: "enfants",
    screen: "parent.child-detail",
    paramNames: Object.freeze(["childId"]),
    detailParam: "childId",
  }),
  Object.freeze({
    pattern: /^\/enseignant\/devoirs\/nouveau$/,
    role: "enseignant",
    page: "devoirs",
    detail: "nouveau",
    screen: "teacher.assignment-new",
    staticParams: Object.freeze({ assignmentId: null, mode: "create" }),
  }),
  Object.freeze({
    pattern: /^\/enseignant\/devoirs\/([^/]+)\/previsualisation$/,
    role: "enseignant",
    page: "devoirs",
    screen: "teacher.assignment-preview",
    paramNames: Object.freeze(["assignmentId"]),
    detailParam: "assignmentId",
  }),
  Object.freeze({
    pattern: /^\/enseignant\/devoirs\/([^/]+)\/remises$/,
    role: "enseignant",
    page: "devoirs",
    screen: "teacher.submissions",
    paramNames: Object.freeze(["assignmentId"]),
    detailParam: "assignmentId",
  }),
  Object.freeze({
    pattern: /^\/enseignant\/remises\/([^/]+)\/correction-audio$/,
    role: "enseignant",
    page: "remises",
    screen: "teacher.audio-correction",
    paramNames: Object.freeze(["submissionId"]),
    detailParam: "submissionId",
  }),
  Object.freeze({
    pattern: /^\/eleve\/onboarding\/profil$/,
    role: "eleve",
    page: "onboarding",
    detail: "profil",
    screen: "student.onboarding-profile",
  }),
  Object.freeze({
    pattern: /^\/eleve\/onboarding\/(?:classe|ecole-classe)$/,
    role: "eleve",
    page: "onboarding",
    detail: "classe",
    screen: "student.onboarding-class",
  }),
  Object.freeze({
    pattern: /^\/eleve\/manuels\/([^/]+)\/lecons\/([^/]+)$/,
    role: "eleve",
    page: "manuels",
    screen: "student.reader",
    paramNames: Object.freeze(["manualId", "lessonId"]),
    detailParam: "lessonId",
  }),
  Object.freeze({
    pattern: /^\/eleve\/activites\/([^/]+)\/resultat$/,
    role: "eleve",
    page: "activites",
    screen: "student.exercise-result",
    paramNames: Object.freeze(["activityId"]),
    detailParam: "activityId",
  }),
  Object.freeze({
    pattern: /^\/eleve\/activites\/([^/]+)$/,
    role: "eleve",
    page: "activites",
    screen: "student.exercise",
    paramNames: Object.freeze(["activityId"]),
    detailParam: "activityId",
  }),
  Object.freeze({
    pattern: /^\/eleve\/devoirs\/([^/]+)\/remise-confirmee$/,
    role: "eleve",
    page: "devoirs",
    screen: "student.assignment-submitted",
    paramNames: Object.freeze(["assignmentId"]),
    detailParam: "assignmentId",
  }),
  Object.freeze({
    pattern: /^\/eleve\/devoirs\/([^/]+)$/,
    role: "eleve",
    page: "devoirs",
    screen: "student.assignment",
    paramNames: Object.freeze(["assignmentId"]),
    detailParam: "assignmentId",
  }),
  Object.freeze({
    pattern: /^\/eleve\/etat-systeme(?:\/([^/]+))?$/,
    role: "eleve",
    page: "etat-systeme",
    screen: "student.system",
    paramNames: Object.freeze(["systemState"]),
    detailParam: "systemState",
  }),
  Object.freeze({
    pattern: /^\/directeur\/classes\/nouvelle$/,
    role: "directeur",
    page: "classes",
    detail: "nouvelle",
    screen: "director.class",
    staticParams: Object.freeze({ classId: null, mode: "create" }),
  }),
  Object.freeze({
    pattern: /^\/directeur\/classes\/([^/]+)$/,
    role: "directeur",
    page: "classes",
    screen: "director.class",
    paramNames: Object.freeze(["classId"]),
    detailParam: "classId",
    staticParams: Object.freeze({ mode: "edit" }),
  }),
  Object.freeze({
    pattern: /^\/directeur\/eleves\/activation$/,
    role: "directeur",
    page: "eleves",
    detail: "activation",
    screen: "director.activation",
  }),
  Object.freeze({
    pattern: /^\/admin\/contenus\/nouveau$/,
    role: "admin",
    page: "contenus",
    detail: "nouveau",
    screen: "admin.studio",
    staticParams: Object.freeze({ contentId: null, mode: "create" }),
  }),
  Object.freeze({
    pattern: /^\/admin\/contenus\/([^/]+)\/modifier$/,
    role: "admin",
    page: "contenus",
    screen: "admin.studio",
    paramNames: Object.freeze(["contentId"]),
    detailParam: "contentId",
    staticParams: Object.freeze({ mode: "edit" }),
  }),
  ...[
    ["previsualisation", "admin.preview"],
    ["revue", "admin.review"],
    ["planification", "admin.schedule"],
    ["publication-reussie", "admin.published"],
    ["historique", "admin.history"],
  ].map(([suffix, screen]) =>
    Object.freeze({
      pattern: new RegExp(`^/admin/contenus/([^/]+)/${suffix}$`),
      role: "admin",
      page: "contenus",
      screen,
      paramNames: Object.freeze(["contentId"]),
      detailParam: "contentId",
    }),
  ),
  Object.freeze({
    pattern: /^\/admin\/contenus\/([^/]+)\/etat-systeme(?:\/([^/]+))?$/,
    role: "admin",
    page: "contenus",
    screen: "admin.system",
    paramNames: Object.freeze(["contentId", "systemState"]),
    detailParam: "contentId",
  }),
]);

function withRouteMeta(route, screen, params = {}) {
  const result = { ...route };
  Object.defineProperties(result, {
    screen: {
      value: screen,
      enumerable: false,
      configurable: false,
      writable: false,
    },
    params: {
      value: Object.freeze({ ...params }),
      enumerable: false,
      configurable: false,
      writable: false,
    },
  });
  return Object.freeze(result);
}

function publicRoute(route, screen, params = {}) {
  return withRouteMeta(route, screen, params);
}

function appRoute(path, role, page, detail = null, screen = null, params = {}) {
  return withRouteMeta(
    {
      kind: "app",
      path,
      role,
      page,
      detail,
      isDetail: Boolean(detail),
    },
    screen || APP_SCREEN_ALIASES[role]?.[page] || `${role}.${page}`,
    params,
  );
}

function matchCanonicalAppRoute(path) {
  for (const definition of CANONICAL_APP_ROUTES) {
    const match = path.match(definition.pattern);
    if (!match) continue;
    if (match.slice(1).some((value) => value != null && !DETAIL_SEGMENT_PATTERN.test(value))) {
      continue;
    }

    const params = { ...(definition.staticParams || {}) };
    definition.paramNames?.forEach((name, index) => {
      params[name] = match[index + 1] ?? null;
    });
    const detail = definition.detailParam ? params[definition.detailParam] : definition.detail || null;
    return appRoute(
      path,
      definition.role,
      definition.page,
      detail,
      definition.screen,
      params,
    );
  }
  return null;
}

function notFound(path, reason = "unknown_route", context = {}) {
  const routeRole = isRole(context.role) ? context.role : null;
  const route = {
    kind: "not-found",
    path,
    reason,
    ...context,
  };
  return withRouteMeta(
    route,
    routeRole ? ROLE_NOT_FOUND_SCREEN[routeRole] : "public.not-found",
    {
      role: routeRole,
      home: routeRole ? ROLE_HOME[routeRole] : "/",
      reason,
    },
  );
}

function pathFromUrl(value) {
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) return value;

  try {
    const url = new URL(value);
    return url.hash.startsWith("#/") ? url.hash.slice(1) : `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

export function isRouteHash(value) {
  return /^#\//.test(String(value ?? "").trim());
}

export function isDocumentAnchor(value) {
  const hash = String(value ?? "").trim();
  return hash.startsWith("#") && !isRouteHash(hash) && hash.length > 1;
}

export function normalizeRoute(input = "/") {
  let path = pathFromUrl(String(input ?? "/").trim());
  if (isDocumentAnchor(path)) return "/";
  if (isRouteHash(path)) path = path.slice(1);
  path = path.replace(/\\/g, "/");
  path = path.split(/[?#]/, 1)[0] || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

/**
 * Résout l'adresse d'une fenêtre sans confondre les ancres d'accessibilité
 * (`#auth-main`) avec les routes historiques du prototype (`#/eleve/...`).
 */
export function resolveLocationRoute(locationLike = {}) {
  if (typeof locationLike === "string") return normalizeRoute(locationLike);

  const pathname = normalizeRoute(locationLike?.pathname || "/");
  const hash = String(locationLike?.hash ?? "").trim();
  if (isRouteHash(hash)) return normalizeRoute(hash);

  return pathname === "/index.html" ? "/" : pathname;
}

export function isRole(role) {
  return ROLES.includes(role);
}

export function getRoleHome(role) {
  return isRole(role) ? ROLE_HOME[role] : null;
}

export function isPageAllowed(role, page) {
  return isRole(role) && typeof page === "string" && ROLE_PAGES[role].includes(page);
}

export function buildAppPath(role, page = null, detail = null) {
  if (!isRole(role)) throw new TypeError(`Rôle inconnu : ${String(role)}`);
  const resolvedPage = page || ROLE_HOME[role].split("/").at(-1);
  if (!isPageAllowed(role, resolvedPage)) {
    throw new TypeError(`Page « ${String(resolvedPage)} » indisponible pour le rôle « ${role} »`);
  }
  if (detail == null || detail === "") return `/${role}/${resolvedPage}`;
  const detailSegment = String(detail);
  if (!DETAIL_SEGMENT_PATTERN.test(detailSegment)) {
    throw new TypeError("Le détail doit être un segment d’adresse simple.");
  }
  return `/${role}/${resolvedPage}/${detailSegment}`;
}

/**
 * Recherche stricte d'une ressource ciblée par une route. Une absence reste
 * une absence : ce contrat ne retombe jamais sur le premier élément.
 */
export function resolveRouteRecord(records, identifier, key = "id") {
  if (!Array.isArray(records) || identifier == null || identifier === "") return null;
  if (typeof key !== "string" || !key) return null;
  const expected = String(identifier);
  return records.find((record) => record && String(record[key]) === expected) ?? null;
}

export function getNotFoundHome(routeOrPath, sessionRole = null) {
  const route = typeof routeOrPath === "string" ? parseRoute(routeOrPath) : routeOrPath;
  if (isRole(route?.role)) return ROLE_HOME[route.role];
  if (isRole(sessionRole)) return ROLE_HOME[sessionRole];
  return "/";
}

export function parseRoute(input = "/") {
  const path = normalizeRoute(input);

  if (path === "/") return publicRoute({ kind: "landing", path }, "public.landing");
  if (path === "/pilote") return publicRoute({ kind: "pilot", path }, "pilot.entry");
  if (path === "/blog") return publicRoute({ kind: "blog-index", path }, "public.blog-index");
  if (Object.hasOwn(PUBLIC_PAGES, path)) return publicRoute({ kind: "public-info", path }, "public.info");
  if (path === "/connexion") {
    return publicRoute({ kind: "connection", path }, "auth.profile-choice");
  }
  if (path === "/mot-de-passe-oublie") {
    return publicRoute({ kind: "auth", path }, "auth.forgot-password");
  }
  if (path === "/reinitialisation") {
    return publicRoute({ kind: "auth", path }, "auth.reset-password");
  }
  if (path === "/session-expiree") {
    return publicRoute({ kind: "auth", path }, "auth.session-expired");
  }
  const invitation = path.match(/^\/invitation(?:\/([^/]+))?$/);
  if (invitation && (!invitation[1] || DETAIL_SEGMENT_PATTERN.test(invitation[1]))) {
    return publicRoute(
      { kind: "auth", path },
      "auth.invitation",
      { token: invitation[1] || null },
    );
  }
  if (path === "/activation") {
    return publicRoute({ kind: "activation", path }, "activation.entry");
  }

  const legalPages = Object.freeze([
    "mentions-legales",
    "confidentialite",
    "conditions-utilisation",
    "cookies",
    "accessibilite",
  ]);
  const legalPage = path.slice(1);
  if (legalPages.includes(legalPage)) {
    return publicRoute({ kind: "legal", path, page: legalPage }, "public.legal", { page: legalPage });
  }

  const activationStates = Object.freeze({
    "code-invalide": "activation.invalid",
    "acces-deja-active": "activation.used",
    "deja-actif": "activation.used",
    "code-expire": "activation.expired",
    succes: "activation.success",
  });
  const activationState = path.match(/^\/activation\/([^/]+)$/)?.[1];
  if (activationState && activationStates[activationState]) {
    return publicRoute(
      { kind: "activation", path, state: activationState },
      activationStates[activationState],
      { activationState },
    );
  }

  const publicContent = path.match(/^\/contenus\/([^/]+)$/);
  if (publicContent && DETAIL_SEGMENT_PATTERN.test(publicContent[1])) {
    return publicRoute(
      { kind: "public-content", path, slug: publicContent[1] },
      "public.content",
      { slug: publicContent[1] },
    );
  }

  const segments = path.slice(1).split("/");

  if (segments[0] === "blog") {
    if (segments.length === 2 && SEGMENT_PATTERN.test(segments[1])) {
      return Object.freeze({ kind: "blog-article", path, slug: segments[1] });
    }
    return notFound(path, "invalid_blog_route");
  }

  if (segments[0] === "connexion") {
    if (segments.length === 2 && isRole(segments[1])) {
      const role = segments[1];
      const screen = role === "eleve" ? "auth.student-login" : `auth.${role}-login`;
      return publicRoute({ kind: "login", path, role }, screen, { role });
    }
    return notFound(path, "unknown_login_role", { role: segments[1] || null });
  }

  const role = segments[0];
  if (!isRole(role)) return notFound(path, "unknown_role", { role: role || null });

  if (segments.length === 1) {
    return Object.freeze({ kind: "redirect", path, to: ROLE_HOME[role], reason: "role_home" });
  }

  const canonicalRoute = matchCanonicalAppRoute(path);
  if (canonicalRoute) return canonicalRoute;
  if (segments.length > 3) return notFound(path, "too_many_segments", { role });

  const page = segments[1];
  if (!isPageAllowed(role, page)) return notFound(path, "page_not_allowed", { role, page });

  const detail = segments[2] || null;
  if (detail && !DETAIL_SEGMENT_PATTERN.test(detail)) {
    return notFound(path, "invalid_detail", { role, page, detail });
  }

  const params = detail ? { detail } : {};
  return appRoute(path, role, page, detail, null, params);
}

export function resolveAppAccess(route, session = {}) {
  const parsed = typeof route === "string" ? parseRoute(route) : route;
  const protectedRole = parsed?.kind === "app"
    ? parsed.role
    : parsed?.kind === "not-found" && isRole(parsed.role)
      ? parsed.role
      : null;
  if (!protectedRole) {
    return Object.freeze({ allowed: true, route: parsed, redirectTo: null, reason: null });
  }
  if (
    protectedRole === "eleve" &&
    parsed.kind === "app" &&
    ["student.onboarding-profile", "student.onboarding-class"].includes(parsed.screen) &&
    session.pendingActivation
  ) {
    return Object.freeze({ allowed: true, route: parsed, redirectTo: null, reason: null });
  }
  if (!session.authenticated || !isRole(session.role)) {
    return Object.freeze({
      allowed: false,
      route: parsed,
      redirectTo: `/connexion/${protectedRole}`,
      reason: "authentication_required",
    });
  }
  if (session.role !== protectedRole) {
    return Object.freeze({
      allowed: false,
      route: parsed,
      redirectTo: ROLE_HOME[session.role],
      reason: "role_mismatch",
    });
  }
  return Object.freeze({ allowed: true, route: parsed, redirectTo: null, reason: null });
}
