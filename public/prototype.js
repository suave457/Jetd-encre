(() => {
  "use strict";

  const LEGACY_FRAME_NAMES = {
    studio: {
      desktop: "W03_01_ADM_StudioContenus_D_1440x900",
      tablet: "W03_01_ADM_StudioContenus_T_1024x768",
    },
    library: {
      desktop: "W03_02_ADM_Bibliotheque_D_1440x900",
      tablet: "W03_02_ADM_Bibliotheque_T_1024x768",
    },
  };

  const FALLBACK_CONFIG = {
    storageKey: "jde.prototype.session.v4",
    routes: [
      {
        key: "admin.library",
        patterns: ["^/admin/?$", "^/admin/bibliotheque/?$", "^/bibliotheque/?$"],
        frames: LEGACY_FRAME_NAMES.library,
        title: "Bibliothèque de contenus — Jet d’Encre",
      },
      {
        key: "admin.studio",
        patterns: ["^/admin/contenus/nouveau/?$", "^/admin/contenus/([^/]+)/modifier/?$", "^/studio/?$"],
        params: ["contentId"],
        frames: LEGACY_FRAME_NAMES.studio,
        title: "Studio de contenus — Jet d’Encre",
      },
    ],
    actionRoutes: {},
    defaultState: {
      schemaVersion: 4,
      activeRoute: "/admin/bibliotheque",
      activeContentId: "POD-0018",
      editorial: {
        content: {
          id: "POD-0018",
          type: "Podcast",
          title: "Les voix du Maroc · Épisode 01",
          publicTitle: "Les voix du Maroc : la marche du quartier",
          slug: "les-voix-du-maroc-la-marche-du-quartier",
          status: "Brouillons",
        },
        review: { decision: "pending", comment: "" },
        schedule: { date: "2026-08-27", time: "10:00", timezone: "Africa/Casablanca" },
        publication: {
          publishedAt: null,
          publicPath: "/contenus/les-voix-du-maroc-la-marche-du-quartier",
          systemState: null,
        },
        versions: [],
      },
      director: {
        metrics: { activeClasses: 18, invitedTeachers: 3 },
        classes: [],
        filters: { schoolYear: "2026–2027", level: "Tous", classId: "Toutes", status: "Tous", period: "30 derniers jours" },
        pendingInvitations: [],
        assignments: {},
        activationBatches: [],
        supportTickets: [],
      },
      student: {
        auth: { signedIn: true, onboardingComplete: true, activationState: "active" },
        profile: { pseudonym: "Lina", level: "5e AEP", school: "École Al Manar", classId: "5A" },
        learning: { progress: 68, weeklyStreak: 4, points: 1240, quizChoice: null, quizScore: 8, quizTotal: 10 },
        assignments: { activeTab: "Tous", currentId: "protegeons-la-nature", submittedIds: [] },
        media: { activeFilter: "Tous", playingType: null, transcriptOpen: false },
        rewards: { unlocked: ["Exploratrice", "Écoute attentive", "Série de 4 jours"] },
        systemState: null,
      },
    },
  };

  const CONFIG = window.JDE_PROTOTYPE_CONFIG || FALLBACK_CONFIG;
  const ROUTES = CONFIG.routes || FALLBACK_CONFIG.routes;
  const ACTION_ROUTES = CONFIG.actionRoutes || {};
  const DEFAULT_SESSION_STATE = CONFIG.defaultState || FALLBACK_CONFIG.defaultState;
  const STORAGE_KEY = CONFIG.storageKey || FALLBACK_CONFIG.storageKey;

  const RECORD_SELECTOR =
    '[data-pencil-name^="Ligne contenu"], [data-pencil-name^="Carte contenu tablette"]';
  const DIRECTOR_RECORD_SELECTOR = [
    '[data-pencil-name^="Ligne classe"]',
    '[data-pencil-name^="Carte classe"]',
    '[data-pencil-name^="Ligne enseignant"]',
    '[data-pencil-name^="Carte enseignant"]',
    '[data-pencil-name^="Ligne élève"]',
    '[data-pencil-name^="Carte élève"]',
  ].join(", ");
  const state = {
    view: "library",
    routeKey: "admin.library",
    routePath: "/admin/bibliotheque",
    routeParams: {},
    session: null,
    query: "",
    status: "Tous",
    filters: {
      type: "Tous",
      audience: "Toutes",
      level: "Tous",
    },
    sort: "Dernière modification",
    sortTouched: false,
    page: 1,
    selected: new Set(),
    copyCounter: 0,
    toastTimer: null,
    openPopover: null,
    directorQueries: { classes: "", teachers: "", students: "" },
    directorTab: "Vue d’ensemble",
  };

  const STATUS_OPTIONS = ["Tous", "Brouillons", "En revue", "Planifiés", "Publiés", "Archivés"];
  const SORT_OPTIONS = ["Dernière modification", "Plus ancienne", "Titre A–Z", "Titre Z–A"];
  const STATUS_STYLES = {
    Brouillons: { label: "Brouillon", background: "#FFF1D5", color: "#B66A2C" },
    "En revue": { label: "En revue", background: "#EAF0F6", color: "#2E5F86" },
    Planifiés: { label: "Planifié", background: "#FFF1D5", color: "#051223" },
    Publiés: { label: "Publié", background: "#E8F3F1", color: "#2F7563" },
    Archivés: { label: "Archivé", background: "#F0ECE8", color: "#6B6258" },
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const pencilName = (element) => element?.getAttribute("data-pencil-name") || "";

  function cloneValue(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function mergeState(defaults, saved) {
    if (Array.isArray(defaults)) return Array.isArray(saved) ? cloneValue(saved) : cloneValue(defaults);
    if (!defaults || typeof defaults !== "object") return saved === undefined ? defaults : saved;
    const result = {};
    const source = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    new Set([...Object.keys(defaults), ...Object.keys(source)]).forEach((key) => {
      result[key] = key in defaults ? mergeState(defaults[key], source[key]) : cloneValue(source[key]);
    });
    return result;
  }

  function loadSessionState() {
    const defaults = cloneValue(DEFAULT_SESSION_STATE);
    try {
      const current = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      if (current?.schemaVersion === defaults.schemaVersion) return mergeState(defaults, current);
      const legacy = JSON.parse(sessionStorage.getItem("jde.prototype.session.v3") || "null");
      if (!legacy) return defaults;
      const migrated = mergeState(defaults, legacy);
      migrated.schemaVersion = defaults.schemaVersion;
      return migrated;
    } catch {
      return defaults;
    }
  }

  function persistSessionState() {
    if (!state.session) return;
    state.session.activeRoute = state.routePath;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.session));
    } catch {
      // The prototype remains usable when storage is blocked.
    }
  }

  function mutateSession(mutator) {
    if (!state.session) state.session = loadSessionState();
    mutator(state.session);
    persistSessionState();
    hydrateActiveFrame();
  }

  function getHostWindow() {
    try {
      if (window.parent !== window && window.parent.location.origin === window.location.origin) {
        return window.parent;
      }
    } catch {
      return window;
    }
    return window;
  }

  function normalizeRoutePath(value) {
    let route = String(value || "").trim().replace(/^#/, "");
    if (!route) return "/admin/bibliotheque";
    if (!route.startsWith("/")) route = `/${route}`;
    return route.replace(/\/{2,}/g, "/");
  }

  function routeFromHost() {
    const host = getHostWindow();
    if (host.location.hash) return normalizeRoutePath(host.location.hash);
    if (window.location.hash) return normalizeRoutePath(window.location.hash);
    return normalizeRoutePath(state.session?.activeRoute || "/admin/bibliotheque");
  }

  function matchRoute(routePath) {
    const normalized = normalizeRoutePath(routePath);
    for (const route of ROUTES) {
      for (const source of route.patterns || []) {
        const match = normalized.match(new RegExp(source, "i"));
        if (!match) continue;
        const params = {};
        (route.params || []).forEach((name, index) => {
          if (match[index + 1]) params[name] = decodeURIComponent(match[index + 1]);
        });
        return { definition: route, params, path: normalized };
      }
    }
    return null;
  }

  function routeDefinition(key = state.routeKey) {
    return ROUTES.find((route) => route.key === key) || ROUTES[0];
  }

  function routeForFrameName(frameName) {
    return ROUTES.find((route) => Object.values(route.frames || {}).includes(frameName));
  }

  function writeHostRoute(routePath, replace = false) {
    const host = getHostWindow();
    const nextHash = `#${normalizeRoutePath(routePath)}`;
    if (host.location.hash === nextHash) return;
    const nextUrl = `${host.location.pathname}${host.location.search}${nextHash}`;
    host.history[replace ? "replaceState" : "pushState"]({ jdePrototypeRoute: routePath }, "", nextUrl);
  }

  function setRoute(routePath, options = {}) {
    const requestedPath = normalizeRoutePath(routePath);
    let matched = matchRoute(requestedPath);
    if (!matched && /^\/eleve(?:\/|$)/i.test(requestedPath)) {
      matched = matchRoute("/eleve/etat-systeme/page-introuvable");
    }
    matched ||= matchRoute("/admin/bibliotheque");
    if (!matched) return;
    const studentKey = matched.definition.key;
    const publicStudentRoute =
      studentKey === "student.onboarding-profile" ||
      studentKey === "student.onboarding-class" ||
      studentKey === "student.system" ||
      studentKey === "student.profile" && matched.path === "/eleve/aide";
    if (studentKey.startsWith("student.") && !publicStudentRoute && state.session?.student?.auth?.signedIn === false) {
      matched = matchRoute("/connexion/eleve");
    }
    state.routeKey = matched.definition.key;
    state.routePath = matched.path;
    state.routeParams = matched.params;
    state.view = state.routeKey === "admin.library" ? "library" : state.routeKey === "admin.studio" ? "studio" : state.routeKey;
    if (state.session) {
      state.session.activeRoute = state.routePath;
      if (matched.params.contentId) state.session.activeContentId = matched.params.contentId;
      if (state.routeKey === "student.system") {
        state.session.student.systemState = matched.params.systemState || "hors-connexion";
      }
    }
    if (state.routeKey === "admin.studio") {
      const content = state.session?.editorial?.content || {};
      updateStudio({
        mode: matched.params.contentId ? "edit" : "new",
        title: content.title,
        status: content.status,
      });
    }
    renderFrame();
    persistSessionState();
    if (!options.fromHost) writeHostRoute(state.routePath, options.replace);
  }

  function navigate(routePath, options = {}) {
    setRoute(routePath, options);
  }

  function syncRouteFromHost() {
    const next = routeFromHost();
    if (next !== state.routePath) setRoute(next, { fromHost: true });
  }

  function routeWithActiveContent(template) {
    const content = state.session?.editorial?.content || {};
    const contentId = state.session?.activeContentId || content.id || "POD-0018";
    return String(template || "")
      .replaceAll("POD-0018", contentId)
      .replaceAll(":contentId", encodeURIComponent(contentId))
      .replaceAll(":slug", encodeURIComponent(content.slug || "les-voix-du-maroc-la-marche-du-quartier"));
  }

  function stripAccents(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function normalizeStatus(value) {
    const normalized = stripAccents(value);
    if (normalized.includes("brouillon")) return "Brouillons";
    if (normalized.includes("revue")) return "En revue";
    if (normalized.includes("planifi")) return "Planifiés";
    if (normalized.includes("publie")) return "Publiés";
    if (normalized.includes("archive")) return "Archivés";
    return "Tous";
  }

  function recordIdFrom(value) {
    const match = String(value || "").match(/\b(?:DOC|POD|BLOG|JEU|EBOOK|VID|COPY)-[A-Z0-9-]+\b/i);
    return match?.[0] || "";
  }

  function getRecordId(record) {
    return record?.dataset.prototypeRecordId || recordIdFrom(pencilName(record));
  }

  function getRecordTitle(record) {
    if (!record) return "ce contenu";
    const id = getRecordId(record);
    const exact = id
      ? $(`[data-pencil-name="Titre contenu ${CSS.escape(id)}"], [data-pencil-name="Titre carte tablette ${CSS.escape(id)}"]`, record)
      : null;
    const fallback = $('[data-pencil-name^="Titre contenu"], [data-pencil-name^="Titre carte tablette"]', record);
    return (exact || fallback)?.textContent?.trim() || "ce contenu";
  }

  function getRecordStatus(record) {
    if (!record) return "Tous";
    if (record.dataset.prototypeStatus) return record.dataset.prototypeStatus;
    const label = $('[data-pencil-name^="Libellé statut"]', record);
    return normalizeStatus(label?.textContent || record.textContent);
  }

  function compactText(element) {
    return element?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function extractLevel(value) {
    const text = compactText({ textContent: value });
    if (/tous niveaux/i.test(text)) return "Tous niveaux";
    const aep = text.match(/\b([1-6]e(?:\s*[–-]\s*[1-6]e)?\s*AEP)\b/i);
    if (aep) return aep[1].replace(/\s*[–-]\s*/g, "–").replace(/\s+/g, " ");
    const cycle = text.match(/\b(Collège|Lycée|Préscolaire)\b/i);
    return cycle ? cycle[1] : "Tous niveaux";
  }

  function extractAudiences(value) {
    const normalized = stripAccents(value);
    return ["Élèves", "Enseignants", "Parents"].filter((audience) =>
      normalized.includes(stripAccents(audience)),
    );
  }

  function parseFrenchDate(value) {
    const normalized = stripAccents(value).replace(/·/g, " ");
    const months = {
      janvier: 0,
      fevrier: 1,
      mars: 2,
      avril: 3,
      mai: 4,
      juin: 5,
      juillet: 6,
      aout: 7,
      septembre: 8,
      octobre: 9,
      novembre: 10,
      decembre: 11,
    };
    const match = normalized.match(/(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/);
    const time = normalized.match(/(\d{1,2})\s*h\s*(\d{1,2})?/);
    if (!match || !(match[2] in months)) return 0;
    return new Date(
      Number(match[3] || 2026),
      months[match[2]],
      Number(match[1]),
      Number(time?.[1] || 0),
      Number(time?.[2] || 0),
    ).getTime();
  }

  function recordMetadata(record) {
    const type = compactText(
      $('[data-pencil-name^="Valeur type "], [data-pencil-name^="Libellé type carte tablette "]', record),
    );
    const audienceText = compactText(
      $('[data-pencil-name^="Valeur audience "], [data-pencil-name^="Valeur Audience carte tablette "]', record),
    );
    const dateText = compactText(
      $('[data-pencil-name^="Valeur modification "], [data-pencil-name^="Valeur Date carte tablette "]', record),
    );
    return {
      type: type || "Autre",
      audiences: extractAudiences(audienceText),
      level: extractLevel(audienceText),
      timestamp: parseFrenchDate(dateText),
    };
  }

  function statusForId(id) {
    const record = $$(RECORD_SELECTOR).find((candidate) => getRecordId(candidate) === id);
    return getRecordStatus(record);
  }

  function getDevice() {
    const forced = new URLSearchParams(getHostWindow().location.search).get("device");
    if (forced === "desktop" || forced === "tablet") return forced;
    return window.innerWidth >= 1200 ? "desktop" : "tablet";
  }

  function getFrame(view = state.view, device = getDevice()) {
    if (LEGACY_FRAME_NAMES[view]) {
      return $(`[data-pencil-name="${LEGACY_FRAME_NAMES[view][device]}"]`);
    }
    const matched = String(view).startsWith("/") ? matchRoute(view)?.definition : routeDefinition(view);
    const frameName = matched?.frames?.[device];
    return frameName ? $(`[data-pencil-name="${CSS.escape(frameName)}"]`) : null;
  }

  function getActiveFrame(device = getDevice()) {
    return getFrame(state.routeKey, device);
  }

  function configuredFrames() {
    const names = new Set(ROUTES.flatMap((route) => Object.values(route.frames || {})));
    return Array.from(names)
      .map((name) => $(`[data-pencil-name="${CSS.escape(name)}"]`))
      .filter(Boolean);
  }

  function resizeStage() {
    const device = getDevice();
    const width = device === "desktop" ? 1440 : 1024;
    const height = device === "desktop" ? 900 : 768;
    const forcedDevice = new URLSearchParams(getHostWindow().location.search).get("device");
    const containScale = Math.min(1, window.innerWidth / width, window.innerHeight / height);
    const needsReadableDesktop =
      device === "desktop" &&
      forcedDevice === "desktop" &&
      window.innerWidth < width;
    const desktopHeightBudget = Math.max(1, window.innerHeight - 16);
    const readableDesktopScale = Math.min(
      1,
      Math.max(0.75, desktopHeightBudget / height),
    );
    const scale = needsReadableDesktop ? readableDesktopScale : containScale;
    const safeScale = Math.max(0.25, scale);
    const overflowsHorizontally = width * safeScale > window.innerWidth + 1;
    document.documentElement.style.setProperty("--prototype-width", `${width}px`);
    document.documentElement.style.setProperty("--prototype-height", `${height}px`);
    document.documentElement.style.setProperty("--prototype-scale", String(safeScale));
    document.documentElement.dataset.prototypePresentation =
      needsReadableDesktop && overflowsHorizontally ? "desktop-scroll" : "contain";
  }

  function renderFrame() {
    const activeFrame = getActiveFrame();
    configuredFrames().forEach((frame) => {
      const active = frame === activeFrame;
      frame.dataset.prototypeScreen = "true";
      frame.classList.toggle("prototype-active", active);
      frame.setAttribute("aria-hidden", active ? "false" : "true");
      frame.toggleAttribute("inert", !active);
    });
    resizeStage();
    syncInputs();
    renderTabs();
    renderFilterControls();
    renderPagination();
    renderSelection();
    hydrateActiveFrame();
    const title = routeDefinition()?.title || "Administration — Jet d’Encre";
    document.title = title;
    let announcer = $("#prototype-route-announcer");
    if (!announcer) {
      announcer = document.createElement("div");
      announcer.id = "prototype-route-announcer";
      announcer.className = "prototype-visually-hidden";
      announcer.setAttribute("role", "status");
      announcer.setAttribute("aria-live", "polite");
      document.body.appendChild(announcer);
    }
    announcer.dataset.routeKey = state.routeKey;
    announcer.textContent = title;
  }

  function setView(view, editorContext = null) {
    if (view === "library") {
      navigate("/admin/bibliotheque");
      return;
    }
    if (view === "studio") {
      const context = editorContext || { mode: "new" };
      if (context.mode !== "new") {
        mutateSession((session) => {
          if (context.id) {
            session.activeContentId = context.id;
            session.editorial.content.id = context.id;
          }
          if (context.title) session.editorial.content.title = context.title;
          if (context.status) session.editorial.content.status = context.status;
        });
      }
      updateStudio(context);
      const contentId = context.id || state.session?.activeContentId || state.session?.editorial?.content?.id || "POD-0018";
      navigate(context.mode === "new" ? "/admin/contenus/nouveau" : `/admin/contenus/${encodeURIComponent(contentId)}/modifier`);
    }
  }

  function rememberOriginalText(element) {
    if (element && !element.dataset.prototypeOriginalText) {
      element.dataset.prototypeOriginalText = element.textContent.trim();
    }
  }

  function updateStudio(context) {
    const mode = context?.mode || "new";
    const title = context?.title || "Les voix du Maroc · Épisode 01";
    const status = context?.status || "Brouillons";

    const headings = [
      $('[data-pencil-name="Titre Créer un contenu"]'),
      $('[data-pencil-name="Titre Studio tablette"]'),
    ].filter(Boolean);
    const contentTitles = [
      $('[data-pencil-name="Titre contenu Podcast"]'),
      $('[data-pencil-name="Valeur titre public Podcast"]'),
      $('[data-pencil-name="Titre Podcast tablette"]'),
      $('[data-pencil-name="Valeur titre Podcast tablette"]'),
    ].filter(Boolean);

    [...headings, ...contentTitles].forEach(rememberOriginalText);

    headings.forEach((heading) => {
      if (mode === "new") {
        heading.textContent = heading.dataset.prototypeOriginalText;
      } else {
        heading.textContent = "Modifier un contenu";
      }
    });
    contentTitles.forEach((element) => {
      element.textContent = mode === "new" ? element.dataset.prototypeOriginalText : title;
    });

    const statusLabel = normalizeStatus(status).replace(/s$/, "").toUpperCase();
    $$('[data-pencil-name="Texte statut Brouillon"], [data-pencil-name="Texte Brouillon tablette"]').forEach(
      (element) => {
        rememberOriginalText(element);
        element.textContent = mode === "new" ? element.dataset.prototypeOriginalText : statusLabel;
      },
    );
  }

  function currentContent() {
    return state.session?.editorial?.content || DEFAULT_SESSION_STATE.editorial.content;
  }

  function currentContentId() {
    return state.session?.activeContentId || currentContent().id || "POD-0018";
  }

  function formatNowFrench() {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Casablanca",
    })
      .format(new Date())
      .replace(",", " ·");
  }

  function addEditorialVersion(session, status, summary) {
    const versions = session.editorial.versions || (session.editorial.versions = []);
    const nextNumber = versions.reduce((max, version) => {
      const number = Number.parseInt(String(version.id || "").replace(/\D/g, ""), 10);
      return Number.isFinite(number) ? Math.max(max, number) : max;
    }, 0) + 1;
    versions.unshift({
      id: `v${nextNumber}`,
      label: "Version actuelle",
      status,
      author: "Nadia El Fassi",
      at: formatNowFrench(),
      summary,
    });
    versions.slice(1).forEach((version) => {
      version.label = "Version précédente";
    });
    session.editorial.selectedVersionId = versions[0].id;
  }

  function setNamedText(frame, names, value) {
    if (!frame || value === undefined || value === null) return;
    names.forEach((name) => {
      $$(`[data-pencil-name="${CSS.escape(name)}"]`, frame).forEach((element) => {
        if (element.childElementCount === 0) element.textContent = String(value);
      });
    });
  }

  function replaceExactLeafText(frame, replacements) {
    if (!frame) return;
    $$('*', frame).forEach((element) => {
      if (element.childElementCount > 0) return;
      const current = element.textContent.trim();
      if (current in replacements) element.textContent = replacements[current];
    });
  }

  function hydrateEditorialFrame(frame) {
    const content = currentContent();
    const editorial = state.session?.editorial;
    if (!frame || !editorial) return;
    const statusLabels = {
      Brouillons: "BROUILLON",
      "En revue": "EN REVUE",
      Planifiés: "PLANIFIÉ",
      Publiés: "PUBLIÉ",
      Archivés: "ARCHIVÉ",
    };
    replaceExactLeafText(frame, {
      "POD-0018": content.id,
      "Les voix du Maroc · Épisode 01": content.title,
      "Les voix du Maroc : la marche du quartier": content.publicTitle,
    });
    setNamedText(
      frame,
      ["Texte statut Brouillon", "Texte Brouillon tablette"],
      statusLabels[content.status] || String(content.status || "BROUILLON").toUpperCase(),
    );
    setNamedText(frame, ["Valeur statut éditorial", "Libellé statut éditorial"], content.status);
    setNamedText(frame, ["Valeur date planifiée", "Date de publication"], editorial.schedule?.date);
    setNamedText(frame, ["Valeur heure planifiée", "Heure de publication"], editorial.schedule?.time);

    $$('[data-pencil-name^="Onglet type "]', frame).filter((tab) => !isNamedDecorator(pencilName(tab))).forEach((tab) => {
      const type = pencilName(tab).replace("Onglet type ", "");
      const activeType = editorial.publicPreviewType || content.type;
      const active = stripAccents(type) === stripAccents(activeType);
      tab.classList.toggle("prototype-choice-active", active);
      tab.setAttribute("aria-pressed", active ? "true" : "false");
    });
    $$('[data-pencil-name^="Carte état "]', frame).filter((card) => !isNamedDecorator(pencilName(card))).forEach((card) => {
      const normalized = stripAccents(pencilName(card));
      const systemState = editorial.publication?.systemState || "";
      const active =
        (systemState === "refused" && normalized.includes("refuse")) ||
        (systemState === "forbidden" && normalized.includes("droits")) ||
        (systemState === "failed" && normalized.includes("erreur"));
      card.classList.toggle("prototype-choice-active", active);
      card.setAttribute("aria-pressed", active ? "true" : "false");
    });
    $$('[data-pencil-name="CTA Écouter épisode"]', frame).forEach((button) => {
      button.setAttribute("aria-pressed", editorial.isPlaying ? "true" : "false");
      button.classList.toggle("prototype-choice-active", Boolean(editorial.isPlaying));
    });
    $$('[data-pencil-name^="Ligne version"]', frame).filter((row) => !isNamedDecorator(pencilName(row))).forEach((row) => {
      const rowName = stripAccents(pencilName(row));
      const version = rowName.includes("actuelle")
        ? editorial.versions?.[0]
        : rowName.includes("precedente")
          ? editorial.versions?.[1]
          : null;
      if (!version) return;
      row.dataset.prototypeVersionId = version.id;
      const selected = editorial.selectedVersionId === version.id;
      row.classList.toggle("prototype-choice-active", selected);
      row.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function hydrateDirectorFrame(frame) {
    const director = state.session?.director;
    if (!frame || !director) return;
    setNamedText(frame, ["Valeur KPI Classes", "KPI · Classes · Valeur"], director.metrics?.activeClasses);
    setNamedText(frame, ["Valeur KPI Enseignants", "KPI · Enseignants · Valeur"], director.metrics?.teachers);
    setNamedText(frame, ["Valeur KPI Élèves", "KPI · Élèves · Valeur"], director.metrics?.students);
    setNamedText(frame, ["Valeur KPI Activité", "KPI · Activité · Valeur"], `${director.metrics?.weeklyActiveRate || 0} %`);
    setNamedText(frame, ["Valeur santé établissement"], `${director.school?.healthScore || 0}/100`);
    setNamedText(frame, ["Valeur synchronisation"], `${director.school?.syncRate || 0} %`);

    if (state.routeKey === "director.classes") {
      const selector = [
        '[data-pencil-name^="Ligne classe · "]',
        '[data-pencil-name^="Carte classe · "]',
        '[data-pencil-name^="Carte classe tablette · "]',
      ].join(", ");
      const records = $$(selector, frame);
      const template = records[0];
      if (template) {
        const existingIds = new Set(
          records.map((record) => pencilName(record).split("·").pop().trim()).filter(Boolean),
        );
        const templateId = pencilName(template).split("·").pop().trim();
        const templateData = director.classes?.find((item) => item.id === templateId);
        (director.classes || []).forEach((item) => {
          if (existingIds.has(item.id)) return;
          const clone = template.cloneNode(true);
          [clone, ...$$('[data-pencil-name]', clone)].forEach((element) => {
            element.removeAttribute("id");
            const name = pencilName(element);
            if (name.includes(templateId)) {
              element.setAttribute("data-pencil-name", name.replaceAll(templateId, item.id));
            }
          });
          clone.dataset.prototypeGeneratedDirectorClass = item.id;
          clone.classList.remove("prototype-director-filtered");
          replaceExactLeafText(clone, {
            [templateId]: item.id,
            [templateData?.level || "A2"]: item.level,
            [`${templateData?.students || 34} élèves`]: `${item.students} élèves`,
            [templateData?.teacher || "Salma Idrissi"]: item.teacher || "Non affecté",
            [`${templateData?.activation || 97} %`]: `${item.activation || 0} %`,
            [`${templateData?.usage || 82} %`]: `${item.usage || 0} %`,
          });
          template.parentElement?.appendChild(clone);
          existingIds.add(item.id);
        });
      }
    }

    $$('[data-pencil-name^="Onglet · "], [data-pencil-name^="Onglet tablette · "]', frame)
      .filter((tab) => !isNamedDecorator(pencilName(tab)))
      .forEach((tab) => {
      const label = canonicalNamedControl(pencilName(tab)).replace("Onglet · ", "");
      const active = label === state.directorTab;
      tab.classList.toggle("prototype-choice-active", active);
      tab.setAttribute("aria-pressed", active ? "true" : "false");
    });
    applyDirectorFilters(frame);
  }

  function studentSectionActive(label) {
    const normalized = stripAccents(label);
    if (normalized.includes("tableau de bord") || normalized.includes("accueil")) return state.routeKey === "student.dashboard";
    if (normalized.includes("manuel")) {
      return ["student.manuals", "student.reader", "student.exercise", "student.exercise-result"].includes(state.routeKey);
    }
    if (normalized.includes("devoir")) {
      return ["student.assignments", "student.assignment", "student.assignment-submitted"].includes(state.routeKey);
    }
    if (normalized.includes("mediatheque")) return state.routeKey === "student.media";
    if (normalized.includes("progression") || normalized.includes("progres")) return state.routeKey === "student.progress";
    if (normalized.includes("recompense")) return state.routeKey === "student.rewards";
    if (normalized.includes("profil")) return state.routeKey === "student.profile";
    return false;
  }

  function applyStudentAssignmentTab(frame) {
    const activeTab = state.session?.student?.assignments?.activeTab || "Tous";
    $$('[data-pencil-name^="Carte devoir"], [data-pencil-name^="Devoir · "]', frame).forEach((card) => {
      const text = stripAccents(card.textContent);
      let visible = activeTab === "Tous";
      if (activeTab === "À faire") visible = /a faire|commencer|reprendre|retard/.test(text);
      if (activeTab === "Rendus") visible = /rendu|remis/.test(text);
      if (activeTab === "Corrigés") visible = /corrige|resultat|note/.test(text);
      card.classList.toggle("prototype-student-filtered", !visible);
    });
  }

  function applyStudentMediaFilter(frame) {
    const activeFilter = state.session?.student?.media?.activeFilter || "Tous";
    $$('[data-pencil-name^="Carte média"], [data-pencil-name^="Carte Média"]', frame).forEach((card) => {
      const text = stripAccents(`${pencilName(card)} ${card.textContent}`);
      const needle = stripAccents(activeFilter).replace(/s$/, "");
      const visible = activeFilter === "Tous" || text.includes(needle);
      card.classList.toggle("prototype-student-filtered", !visible);
    });
  }

  function hydrateStudentFrame(frame) {
    const student = state.session?.student;
    if (!frame || !student) return;
    replaceExactLeafText(frame, {
      "LINA-5A-2026": "CODE-DEMO-5A",
      "1 240": new Intl.NumberFormat("fr-FR").format(student.learning?.points || 0),
      "68 %": `${student.learning?.progress || 0} %`,
      "8/10": `${student.learning?.quizScore || 0}/${student.learning?.quizTotal || 10}`,
      "8 / 10": `${student.learning?.quizScore || 0} / ${student.learning?.quizTotal || 10}`,
    });

    $$('[data-pencil-name^="Nav Élève · "], [data-pencil-name^="Rail Élève · "], [data-pencil-name^="Navigation Élève · "]', frame)
      .filter((item) => !isNamedDecorator(pencilName(item)))
      .forEach((item) => {
        const active = studentSectionActive(pencilName(item));
        item.classList.toggle("prototype-choice-active", active);
        if (active) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
      });

    $$('[data-pencil-name^="Choix Quiz · "]', frame)
      .filter((choice) => !isNamedDecorator(pencilName(choice)))
      .forEach((choice) => {
        const value = pencilName(choice).replace("Choix Quiz · ", "");
        const active = stripAccents(value) === stripAccents(student.learning?.quizChoice || "");
        choice.classList.toggle("prototype-choice-active", active);
        choice.setAttribute("aria-pressed", active ? "true" : "false");
      });

    $$('[data-pencil-name^="Onglet Devoirs · "]', frame)
      .filter((tab) => !isNamedDecorator(pencilName(tab)))
      .forEach((tab) => {
        const value = pencilName(tab).replace("Onglet Devoirs · ", "");
        const active = value === (student.assignments?.activeTab || "Tous");
        tab.classList.toggle("prototype-choice-active", active);
        tab.setAttribute("aria-pressed", active ? "true" : "false");
      });

    $$('[data-pencil-name^="Filtre Média · "]', frame)
      .filter((filter) => !isNamedDecorator(pencilName(filter)))
      .forEach((filter) => {
        const value = pencilName(filter).replace("Filtre Média · ", "");
        const active = value === (student.media?.activeFilter || "Tous");
        filter.classList.toggle("prototype-choice-active", active);
        filter.setAttribute("aria-pressed", active ? "true" : "false");
      });

    $$('[data-pencil-name="Action Élève · Lire média"], [data-pencil-name="Action Élève · Écouter média"]', frame).forEach((control) => {
      const active = Boolean(student.media?.playingType);
      control.classList.toggle("prototype-choice-active", active);
      control.setAttribute("aria-pressed", active ? "true" : "false");
    });

    applyStudentAssignmentTab(frame);
    applyStudentMediaFilter(frame);
  }

  function hydrateActiveFrame() {
    const frame = getActiveFrame();
    if (!frame || !state.session) return;
    if (state.routeKey.startsWith("admin.") || state.routeKey === "public.content") {
      hydrateEditorialFrame(frame);
    }
    if (state.routeKey.startsWith("director.")) hydrateDirectorFrame(frame);
    if (state.routeKey.startsWith("student.")) hydrateStudentFrame(frame);
  }

  function updateEditorialStatus(status, decision, summary) {
    mutateSession((session) => {
      session.editorial.content.status = status;
      if (decision) session.editorial.review.decision = decision;
      addEditorialVersion(session, status.replace(/s$/, ""), summary);
    });
  }

  function selectedVersion() {
    const editorial = state.session?.editorial;
    const versions = editorial?.versions || [];
    return versions.find((version) => version.id === editorial.selectedVersionId) || versions[1] || versions[0];
  }

  function compareVersions() {
    const editorial = state.session?.editorial;
    const current = editorial?.versions?.[0];
    const explicitlySelected = editorial?.versions?.find(
      (version) => version.id === editorial.selectedVersionId,
    );
    const reference =
      explicitlySelected && explicitlySelected.id !== current?.id
        ? explicitlySelected
        : editorial?.versions?.find((version) => version.id !== current?.id);
    if (!current || !reference) {
      showToast("Deux versions sont nécessaires pour lancer la comparaison.");
      return;
    }
    mutateSession((session) => {
      session.editorial.comparison = [current.id, reference.id];
    });
    showDialog({
      title: `${current.id} comparée à ${reference.id}`,
      message: `${current.summary}. Version comparée : ${reference.summary}.`,
      confirmLabel: "Fermer la comparaison",
      onConfirm: () => {},
    });
  }

  function restoreSelectedVersion() {
    const version = selectedVersion();
    if (!version) return;
    showDialog({
      title: `Restaurer ${version.id} ?`,
      message: "Cette restauration créera une nouvelle version Brouillon. Les versions existantes resteront dans l’historique.",
      confirmLabel: "Restaurer comme brouillon",
      onConfirm: () => {
        mutateSession((session) => {
          session.editorial.content.status = "Brouillons";
          addEditorialVersion(session, "Brouillon", `Restauration de ${version.id} — ${version.summary}`);
        });
        navigate(`/admin/contenus/${encodeURIComponent(currentContentId())}/modifier`);
        showToast(`${version.id} restaurée comme nouvelle version Brouillon.`);
      },
    });
  }

  function saveDirectorClass() {
    mutateSession((session) => {
      const classes = session.director.classes || (session.director.classes = []);
      const requestedId = state.routeParams.classId;
      const id = requestedId && requestedId !== "nouvelle" ? requestedId : "6D";
      const existing = classes.find((item) => item.id === id);
      if (existing) {
        existing.level = existing.level || "B1";
        existing.students = existing.students || 27;
      } else {
        classes.push({ id, level: "B1", students: 27, teacher: null, activation: 0, usage: 0 });
        session.director.metrics.activeClasses = Number(session.director.metrics.activeClasses || 0) + 1;
      }
    });
    navigate("/directeur/classes");
    showToast("Classe enregistrée et ajoutée à la liste.");
  }

  function sendTeacherInvitation() {
    mutateSession((session) => {
      const invitations = session.director.pendingInvitations || (session.director.pendingInvitations = []);
      const number = invitations.length + 1;
      invitations.push({
        id: `INV-${String(number).padStart(3, "0")}`,
        name: "Khadija Alaoui",
        email: "khadija.alaoui@example.com",
        status: "En attente",
        sentAt: new Date().toISOString(),
      });
      session.director.metrics.invitedTeachers = Number(session.director.metrics.invitedTeachers || 0) + 1;
    });
    showToast("Invitation envoyée. Le statut En attente est enregistré.");
  }

  function confirmDirectorAssignment() {
    mutateSession((session) => {
      session.director.assignments["6B"] = { teacher: "Khadija Alaoui", manual: "Cap sur le français · 6e AEP" };
      const targetClass = session.director.classes.find((item) => item.id === "6B");
      if (targetClass) targetClass.teacher = "Khadija Alaoui";
    });
    showToast("Affectation confirmée pour la classe 6B.");
  }

  function generateActivationCodes() {
    mutateSession((session) => {
      session.director.activationBatches.push({
        id: `LOT-${Date.now().toString().slice(-6)}`,
        classId: "6B",
        count: 31,
        createdAt: new Date().toISOString(),
        status: "Prêt",
      });
    });
    showToast("31 codes d’activation fictifs générés pour la classe 6B.");
  }

  function createSupportTicket() {
    let ticketId = "";
    mutateSession((session) => {
      ticketId = `AST-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(session.director.supportTickets.length + 1).padStart(3, "0")}`;
      session.director.supportTickets.push({ id: ticketId, status: "Envoyé", createdAt: new Date().toISOString() });
    });
    showToast(`Demande ${ticketId} envoyée à l’assistance.`);
  }

  function publicTypeFromName(name) {
    return name.replace("Onglet type ", "").replace("Jeu vidéo", "Jeu vidéo");
  }

  function systemStateFromName(name) {
    if (stripAccents(name).includes("refuse")) return "refused";
    if (stripAccents(name).includes("droits")) return "forbidden";
    return "failed";
  }

  function handleStudentEntryAction(name) {
    const routeKey = state.routeKey;
    const isName = (...values) => values.includes(name);

    if (routeKey === "auth.student-login") {
      if (/^Action principale W01_03_AUTH_ConnexionEleve_/.test(name)) {
        mutateSession((session) => {
          session.student.auth.signedIn = true;
          session.student.auth.onboardingComplete = true;
          session.student.systemState = null;
        });
        navigate("/eleve/tableau-de-bord");
        showToast("Bienvenue Lina. Ta progression est prête.");
        return true;
      }
      if (/^Action secondaire W01_03_AUTH_ConnexionEleve_/.test(name)) {
        navigate("/activation");
        return true;
      }
    }

    if (routeKey === "auth.forgot-password") {
      if (/^Action principale W01_07_AUTH_MotDePasseOublie_/.test(name)) {
        navigate("/reinitialisation");
        showToast("Instructions simulées. Aucun message réel n’a été envoyé.");
        return true;
      }
      if (/^Action secondaire W01_07_AUTH_MotDePasseOublie_/.test(name)) {
        navigate("/activation/acces-deja-active");
        return true;
      }
    }

    if (routeKey === "auth.reset-password" && /^Action principale W01_08_AUTH_Reinitialisation_/.test(name)) {
      navigate("/connexion/eleve");
      showToast("Mot de passe de démonstration mis à jour.");
      return true;
    }

    if (routeKey === "activation.entry" && isName("Activer mon manuel", "CTA · Activer mon manuel")) {
      mutateSession((session) => {
        session.student.auth.activationState = "active";
      });
      navigate("/activation/succes");
      showToast("Manuel activé pour cette démonstration.");
      return true;
    }
    if (routeKey === "activation.invalid" && isName("Réessayer", "CTA · Corriger mon code")) {
      navigate("/activation");
      return true;
    }
    if (routeKey === "activation.used" && isName("Retrouver compte", "CTA · Retrouver mon compte")) {
      navigate("/connexion/eleve");
      return true;
    }
    if (routeKey === "activation.expired" && isName("Contacter", "CTA · Contacter l’assistance")) {
      navigate("/eleve/aide");
      showToast("Aide ouverte. Aucun message public n’est envoyé.");
      return true;
    }
    if (routeKey === "activation.success" && isName("Créer profil", "CTA · Créer mon profil")) {
      navigate("/eleve/onboarding/profil");
      return true;
    }
    if (routeKey === "student.onboarding-profile" && name === "Action principale · Continuer") {
      navigate("/eleve/onboarding/classe");
      return true;
    }
    if (routeKey === "student.onboarding-class" && name === "Action principale · Rejoindre ma classe") {
      mutateSession((session) => {
        session.student.auth.signedIn = true;
        session.student.auth.onboardingComplete = true;
      });
      navigate("/eleve/tableau-de-bord");
      showToast("Ta classe est prête. Tu peux commencer.");
      return true;
    }
    return false;
  }

  function handleStudentAction(element, name) {
    if (name.startsWith("Choix Quiz · ")) {
      const choice = name.replace("Choix Quiz · ", "");
      mutateSession((session) => {
        session.student.learning.quizChoice = choice;
      });
      showToast(`Réponse « ${choice} » sélectionnée.`);
      return true;
    }
    if (name === "Action Élève · Valider réponse") {
      const choice = state.session?.student?.learning?.quizChoice;
      if (!choice) {
        showToast("Choisis une réponse avant de valider.");
        return true;
      }
      mutateSession((session) => {
        session.student.learning.quizScore = stripAccents(choice) === "recycler" ? 8 : 6;
      });
      navigate("/eleve/activites/les-mots-de-l-environnement/resultat");
      showToast("Réponse enregistrée. Découvre la correction expliquée.");
      return true;
    }
    if (name.startsWith("Onglet Devoirs · ")) {
      const tab = name.replace("Onglet Devoirs · ", "");
      mutateSession((session) => {
        session.student.assignments.activeTab = tab;
      });
      return true;
    }
    if (name.startsWith("Filtre Média · ")) {
      const filter = name.replace("Filtre Média · ", "");
      mutateSession((session) => {
        session.student.media.activeFilter = filter;
      });
      showToast(`Médiathèque filtrée : ${filter}.`);
      return true;
    }
    if (name === "Action Élève · Rendre le devoir") {
      mutateSession((session) => {
        const submitted = session.student.assignments.submittedIds || (session.student.assignments.submittedIds = []);
        if (!submitted.includes("protegeons-la-nature")) submitted.push("protegeons-la-nature");
      });
      navigate("/eleve/devoirs/protegeons-la-nature/remise-confirmee");
      showToast("Bravo, ton devoir a bien été remis à ton enseignant.");
      return true;
    }
    if (name === "Action Élève · Lire média" || name === "Action Élève · Écouter média") {
      const mediaType = name.includes("Écouter") ? "audio" : "lecture";
      mutateSession((session) => {
        session.student.media.playingType = session.student.media.playingType === mediaType ? null : mediaType;
      });
      showToast(state.session.student.media.playingType ? "Lecture démarrée avec transcription disponible." : "Lecture mise en pause.");
      return true;
    }
    if (name === "Action Élève · Copier code récupération") {
      const code = "CODE-DEMO-5A";
      navigator.clipboard?.writeText(code).catch(() => {});
      showToast("Code de récupération copié. Garde-le dans un endroit sûr.");
      return true;
    }
    if (name === "Action Élève · Modifier avatar") {
      mutateSession((session) => {
        session.student.profile.avatar = session.student.profile.avatar === "livre" ? "plume" : "livre";
      });
      showToast("Avatar mis à jour pour la démonstration.");
      return true;
    }
    if (name === "Action Élève · Se déconnecter" || name === "Navigation Élève · Déconnexion") {
      showDialog({
        title: "Se déconnecter ?",
        message: "Ta progression est enregistrée. Tu pourras reprendre exactement ici lors de ta prochaine connexion.",
        confirmLabel: "Me déconnecter",
        onConfirm: () => {
          mutateSession((session) => {
            session.student.auth.signedIn = false;
            session.student.systemState = null;
          });
          navigate("/connexion/eleve");
        },
      });
      return true;
    }
    if (name === "Action Élève · Réessayer") {
      mutateSession((session) => {
        session.student.systemState = null;
      });
      navigate("/eleve/tableau-de-bord");
      showToast("Connexion rétablie. Tu peux continuer.");
      return true;
    }
    if (name === "Action Élève · Contacter aide") {
      navigate("/eleve/aide");
      showToast("L’aide est ouverte. Aucun message public n’est envoyé.");
      return true;
    }
    return false;
  }

  function isNamedDecorator(name) {
    return / · (icône|libellé|chevron|espace|indication)$/i.test(String(name || ""));
  }

  function canonicalNamedControl(name) {
    let canonical = String(name || "")
      .replace(/^Action tablette · /, "Action · ")
      .replace(/^Bouton tablette · /, "Bouton · ")
      .replace(/^Onglet tablette · /, "Onglet · ")
      .replace(/^Filtre tablette · /, "Filtre · ");
    if (canonical === "Action · Inviter enseignant") canonical = "Action · Inviter un enseignant";
    return canonical;
  }

  function findKnownNamedElement(target) {
    let element = target instanceof Element ? target.closest("[data-pencil-name]") : null;
    while (element && element !== document.body) {
      const name = pencilName(element);
      if (isNamedDecorator(name)) {
        element = element.parentElement?.closest("[data-pencil-name]") || null;
        continue;
      }
      const canonicalName = canonicalNamedControl(name);
      const isDirectorTabletControl =
        state.routeKey.startsWith("director.") && /^(Filtre|Onglet) tablette · /.test(name);
      if (
        canonicalName in ACTION_ROUTES ||
        canonicalName.startsWith("CTA ") ||
        canonicalName.startsWith("Action · ") ||
        canonicalName.startsWith("Bouton · ") ||
        canonicalName.startsWith("Filtre · ") && !name.startsWith("Filtre tablette · ") ||
        canonicalName.startsWith("Onglet · ") && !name.startsWith("Onglet tablette · ") ||
        isDirectorTabletControl ||
        canonicalName.startsWith("Onglet type ") ||
        canonicalName.startsWith("Choix Quiz · ") ||
        canonicalName.startsWith("Onglet Devoirs · ") ||
        canonicalName.startsWith("Filtre Média · ") ||
        canonicalName.startsWith("Carte état ") ||
        canonicalName.startsWith("Ligne version")
      ) {
        return element;
      }
      element = element.parentElement?.closest("[data-pencil-name]") || null;
    }
    return null;
  }

  function handleNamedAction(element) {
    const name = canonicalNamedControl(pencilName(element));
    const contentId = encodeURIComponent(currentContentId());

    if (handleStudentEntryAction(name)) return true;
    if (state.routeKey.startsWith("student.") && handleStudentAction(element, name)) return true;

    if (name === "Action Envoyer en revue" || name === "CTA Envoyer en revue") {
      updateEditorialStatus("En revue", "pending", "Contenu envoyé en revue éditoriale");
      navigate(`/admin/contenus/${contentId}/revue`);
      showToast("Contenu envoyé en revue éditoriale.");
      return true;
    }
    if (name === "CTA Demander corrections") {
      updateEditorialStatus("Brouillons", "changes_requested", "Corrections demandées par la revue éditoriale");
      navigate(`/admin/contenus/${contentId}/modifier`);
      showToast("Corrections demandées. Le commentaire reste associé au Brouillon.");
      return true;
    }
    if (name === "CTA Valider revue") {
      mutateSession((session) => {
        session.editorial.review.decision = "approved";
        addEditorialVersion(session, "Validé", "Revue éditoriale validée");
      });
      navigate(`/admin/contenus/${contentId}/planification`);
      showToast("Revue validée. Le contenu est prêt à être planifié.");
      return true;
    }
    if (name === "CTA Planifier publication") {
      updateEditorialStatus("Planifiés", "approved", "Publication planifiée");
      navigate(`/admin/contenus/${contentId}/publication-reussie`);
      showToast("Publication planifiée avec succès.");
      return true;
    }
    if (name === "CTA Publier maintenant") {
      mutateSession((session) => {
        session.editorial.content.status = "Publiés";
        session.editorial.publication.publishedAt = new Date().toISOString();
        session.editorial.publication.systemState = null;
        addEditorialVersion(session, "Publié", "Publication immédiate confirmée");
      });
      navigate(`/admin/contenus/${contentId}/publication-reussie`);
      showToast("Contenu publié avec succès.");
      return true;
    }
    if (name === "CTA Comparer versions") {
      compareVersions();
      return true;
    }
    if (name === "CTA Restaurer cette version") {
      restoreSelectedVersion();
      return true;
    }
    if (name === "CTA Réessayer publication") {
      mutateSession((session) => {
        session.editorial.publication.systemState = null;
      });
      navigate(`/admin/contenus/${contentId}/planification`);
      showToast("L’erreur est levée. Vous pouvez relancer la publication.");
      return true;
    }
    if (name === "CTA Écouter épisode") {
      mutateSession((session) => {
        session.editorial.isPlaying = !session.editorial.isPlaying;
      });
      showToast(state.session.editorial.isPlaying ? "Lecture de l’épisode démarrée." : "Lecture mise en pause.");
      return true;
    }
    if (name === "CTA Lire transcription") {
      showDialog({
        title: "Transcription de l’épisode",
        message: "Dans la médina, les voix du quartier racontent les gestes, les métiers et les souvenirs qui font vivre la ville.",
        confirmLabel: "Fermer la transcription",
        onConfirm: () => {},
      });
      return true;
    }
    if (name.startsWith("Onglet type ")) {
      mutateSession((session) => {
        session.editorial.publicPreviewType = publicTypeFromName(name);
      });
      showToast(`Aperçu ${publicTypeFromName(name)} affiché.`);
      return true;
    }
    if (name.startsWith("Carte état ")) {
      const systemState = systemStateFromName(name);
      mutateSession((session) => {
        session.editorial.publication.systemState = systemState;
      });
      navigate(`/admin/contenus/${contentId}/etat-systeme/${systemState}`, { replace: true });
      return true;
    }
    if (name.startsWith("Ligne version")) {
      const versionId = element.dataset.prototypeVersionId;
      if (versionId) {
        mutateSession((session) => {
          session.editorial.selectedVersionId = versionId;
        });
      }
      return true;
    }
    if (name.startsWith("Filtre · ")) {
      openDirectorFilterPopover(element);
      return true;
    }
    if (name === "Bouton · Enregistrer la classe") {
      saveDirectorClass();
      return true;
    }
    if (name === "Bouton · Envoyer l’invitation") {
      sendTeacherInvitation();
      return true;
    }
    if (name === "Bouton · Confirmer l’affectation") {
      confirmDirectorAssignment();
      return true;
    }
    if (name === "Bouton · Générer les codes") {
      generateActivationCodes();
      return true;
    }
    if (name === "Bouton · Contacter l’assistance") {
      createSupportTicket();
      return true;
    }
    if (name.startsWith("Onglet · ")) {
      state.directorTab = name.replace("Onglet · ", "");
      hydrateActiveFrame();
      return true;
    }
    if (name in ACTION_ROUTES) {
      navigate(routeWithActiveContent(ACTION_ROUTES[name]));
      return true;
    }
    return false;
  }

  function makeInteractive(element, label, role = "button") {
    if (!element) return;
    element.classList.add("prototype-interactive");
    element.setAttribute("role", role);
    element.setAttribute("tabindex", "0");
    if (label) {
      element.setAttribute("aria-label", label);
      element.setAttribute("title", label);
    }
    $$('svg', element).forEach((icon) => icon.setAttribute("aria-hidden", "true"));
  }

  function setupAccessibleControls() {
    document.documentElement.lang = "fr";

    const labels = [
      ['[data-pencil-name="Navigation Admin · Bibliothèque"]', "Ouvrir la Bibliothèque"],
      ['[data-pencil-name="Rail Admin · Bibliothèque"]', "Ouvrir la Bibliothèque"],
      ['[data-pencil-name="Navigation Admin · Studio de contenus"]', "Ouvrir le Studio de contenus"],
      ['[data-pencil-name="Rail Admin · Studio"]', "Ouvrir le Studio de contenus"],
      ['[data-pencil-name="Action Nouveau contenu"]', "Créer un nouveau contenu"],
      ['[data-pencil-name="Action Nouveau contenu tablette"]', "Créer un nouveau contenu"],
      ['[data-pencil-name="Action Importer des contenus"]', "Importer des contenus"],
      ['[data-pencil-name="Action Importer tablette"]', "Importer des contenus"],
      ['[data-pencil-name="Action Filtres tablette"]', "Afficher les filtres"],
      ['[data-pencil-name="Topbar/Notifications"]', "Consulter les notifications"],
      ['[data-pencil-name="Topbar/Profil"]', "Ouvrir le profil administrateur"],
    ];
    labels.forEach(([selector, label]) => $$(selector).forEach((element) => makeInteractive(element, label)));

    $$('[data-pencil-name^="Action Modifier"], [data-pencil-name^="Action tablette Modifier"]').forEach(
      (element) => {
        if (!element.closest(RECORD_SELECTOR)) return;
        makeInteractive(element, `Modifier ${recordIdFrom(pencilName(element))}`);
      },
    );
    $$('[data-pencil-name^="Action Dupliquer"], [data-pencil-name^="Action tablette Dupliquer"]').forEach(
      (element) => makeInteractive(element, `Dupliquer ${recordIdFrom(pencilName(element))}`),
    );
    $$('[data-pencil-name^="Action Archiver"], [data-pencil-name^="Action tablette Archiver"]').forEach(
      (element) => {
        const record = element.closest(RECORD_SELECTOR);
        const archived = record && getRecordStatus(record) === "Archivés";
        makeInteractive(
          element,
          `${archived ? "Restaurer" : "Archiver"} ${recordIdFrom(pencilName(element))}`,
        );
      },
    );
    $$('[data-pencil-name^="Filtre statut ·"], [data-pencil-name^="Filtre tablette ·"]').filter(
      (element) => {
        if (isNamedDecorator(pencilName(element))) return false;
        if (pencilName(element).startsWith("Filtre statut ·")) return true;
        return Boolean(
          element.closest(
            `[data-pencil-name="${CSS.escape(LEGACY_FRAME_NAMES.library.tablet)}"]`,
          ),
        );
      },
    ).forEach(
      (element) => {
        const status = pencilName(element).split("·").pop().trim();
        element.dataset.prototypeStatusFilter = status;
        makeInteractive(element, `Filtrer par statut : ${status}`);
      },
    );
    $$('[data-pencil-name^="Page "] , [data-pencil-name^="Page tablette "]').forEach((element) => {
      const suffix = pencilName(element).split(" ").pop();
      if (suffix !== "…") makeInteractive(element, `Aller à la page ${suffix}`);
    });
  }

  function directorQueryScope(name) {
    if (name.includes("Classes")) return "classes";
    if (name.includes("Enseignants")) return "teachers";
    return "students";
  }

  function directorFilterKey(name) {
    if (name.includes("Année")) return "schoolYear";
    if (name.includes("Niveau")) return "level";
    if (name.includes("Classe")) return "classId";
    if (name.includes("Statut")) return "status";
    return "period";
  }

  function directorFilterOptions(kind) {
    if (kind === "schoolYear") return ["2026–2027", "2025–2026"];
    if (kind === "level") return ["Tous", "A1", "A2", "B1"];
    if (kind === "classId") return ["Toutes", "3A", "4C", "5A", "5B", "6B", "6C"];
    if (kind === "status") return ["Tous", "Actif", "À activer", "Non ajouté"];
    return ["7 derniers jours", "30 derniers jours", "Trimestre en cours"];
  }

  function applyDirectorFilters(frame = getActiveFrame()) {
    if (!frame || !state.session?.director) return;
    const filters = state.session.director.filters || {};
    let scope = "classes";
    if (state.routeKey === "director.teachers") scope = "teachers";
    else if (state.routeKey === "director.activation" || state.directorTab === "Élèves") scope = "students";
    const query = stripAccents(state.directorQueries[scope]);

    $$(DIRECTOR_RECORD_SELECTOR, frame).forEach((record) => {
      const text = stripAccents(record.textContent);
      const matchesQuery = !query || text.includes(query);
      const matchesLevel = !filters.level || filters.level === "Tous" || text.includes(stripAccents(filters.level));
      const matchesClass = !filters.classId || filters.classId === "Toutes" || text.includes(stripAccents(filters.classId));
      const matchesStatus = !filters.status || filters.status === "Tous" || text.includes(stripAccents(filters.status));
      record.classList.toggle("prototype-director-filtered", !(matchesQuery && matchesLevel && matchesClass && matchesStatus));
    });

    if (state.routeKey === "director.classes") {
      const visibleRecords = $$(DIRECTOR_RECORD_SELECTOR, frame).filter(
        (record) => !record.classList.contains("prototype-director-filtered"),
      );
      $$('[data-pencil-name="État condensé · Aucune classe"]', frame).forEach((emptyState) => {
        emptyState.classList.toggle("prototype-filtered", visibleRecords.length > 0);
      });
    }

    $$('[data-pencil-name^="Filtre · "], [data-pencil-name^="Filtre tablette · "]', frame)
      .filter((control) => !isNamedDecorator(pencilName(control)))
      .forEach((control) => {
      const kind = directorFilterKey(pencilName(control));
      const value = filters[kind];
      const isDefault = ["Tous", "Toutes", "2026–2027", "30 derniers jours"].includes(value);
      control.classList.toggle("prototype-filter-control--active", !isDefault);
      const label = canonicalNamedControl(pencilName(control)).replace("Filtre · ", "");
      control.setAttribute("aria-label", `${label} : ${value}`);
      control.setAttribute("title", `${label} : ${value}`);
    });
  }

  function openDirectorFilterPopover(control) {
    const kind = directorFilterKey(pencilName(control));
    closeDesktopPopover();
    const popover = document.createElement("div");
    popover.className = "prototype-filter-popover";
    popover.setAttribute("role", "listbox");
    popover.setAttribute("aria-label", canonicalNamedControl(pencilName(control)).replace("Filtre · ", ""));
    directorFilterOptions(kind).forEach((value) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "prototype-filter-option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", state.session.director.filters[kind] === value ? "true" : "false");
      option.textContent = value;
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        mutateSession((session) => {
          session.director.filters[kind] = value;
        });
        closeDesktopPopover(true);
        applyDirectorFilters();
      });
      popover.appendChild(option);
    });
    control.style.position = "relative";
    control.appendChild(popover);
    control.setAttribute("aria-expanded", "true");
    state.openPopover = popover;
    $("button", popover)?.focus();
  }

  function setupDirectorSearch() {
    const searches = ["Recherche · Classes", "Recherche · Enseignants", "Recherche · Élèves"];
    searches.forEach((name) => {
      $$(`[data-pencil-name="${CSS.escape(name)}"], [data-pencil-name="${CSS.escape(`${name} tablette`)}"]`).forEach((container, index) => {
        const scope = directorQueryScope(name);
        container.setAttribute("role", "search");
        container.classList.add("prototype-has-native-input");
        let input = $(".prototype-director-search-input", container);
        if (input) return;
        input = document.createElement("input");
        input.type = "search";
        input.className = "prototype-search-input prototype-director-search-input";
        input.placeholder = name.replace("Recherche · ", "Rechercher dans ").toLowerCase();
        input.autocomplete = "off";
        input.setAttribute("aria-label", name.replace("Recherche · ", "Rechercher : "));
        input.id = `prototype-director-search-${scope}-${index}`;
        input.addEventListener("input", () => {
          state.directorQueries[scope] = input.value;
          $$(".prototype-director-search-input").forEach((other) => {
            if (other !== input && other.id.includes(`-${scope}-`)) other.value = input.value;
          });
          applyDirectorFilters();
        });
        container.appendChild(input);
      });
    });
  }

  function setupConfiguredControls() {
    configuredFrames().forEach((frame) => {
      const route = routeForFrameName(pencilName(frame));
      if (route) frame.dataset.prototypeRouteKey = route.key;
    });

    const names = new Set([
      ...Object.keys(ACTION_ROUTES),
      "Action Envoyer en revue",
      "CTA Demander corrections",
      "CTA Comparer versions",
      "CTA Restaurer cette version",
      "CTA Réessayer publication",
      "CTA Écouter épisode",
      "CTA Lire transcription",
      "Bouton · Enregistrer la classe",
      "Bouton · Envoyer l’invitation",
      "Bouton · Confirmer l’affectation",
      "Bouton · Générer les codes",
      "Bouton · Contacter l’assistance",
      "Carte état Refusé",
      "Carte état Droits insuffisants",
      "Carte état Erreur publication",
    ]);
    names.forEach((name) => {
      const variants = [name];
      if (name.startsWith("Action · ")) variants.push(name.replace("Action · ", "Action tablette · "));
      if (name.startsWith("Bouton · ")) variants.push(name.replace("Bouton · ", "Bouton tablette · "));
      const selector = variants.map((variant) => `[data-pencil-name="${CSS.escape(variant)}"]`).join(", ");
      $$(selector).forEach((element) => {
        const navigation = /^(?:Nav|Rail|Navigation|Retour)\b/.test(name);
        makeInteractive(
          element,
          name.replace(/^(CTA|Action|Bouton|Carte état)\s*(·)?\s*/, ""),
          navigation ? "link" : "button",
        );
      });
    });
    $$('[data-pencil-name^="Onglet type "], [data-pencil-name^="Onglet · "], [data-pencil-name^="Onglet tablette · "]')
      .filter((element) => !isNamedDecorator(pencilName(element)))
      .forEach((element) => {
      makeInteractive(element, canonicalNamedControl(pencilName(element)), "button");
      element.setAttribute("aria-pressed", "false");
    });
    $$('[data-pencil-name^="Choix Quiz · "], [data-pencil-name^="Onglet Devoirs · "], [data-pencil-name^="Filtre Média · "]')
      .filter((element) => !isNamedDecorator(pencilName(element)))
      .forEach((element) => {
        makeInteractive(element, pencilName(element), "button");
        element.setAttribute("aria-pressed", "false");
      });
    $$('[data-pencil-name^="Ligne version"]')
      .filter((element) => !isNamedDecorator(pencilName(element)))
      .forEach((element) => {
      makeInteractive(element, `Sélectionner ${pencilName(element).toLowerCase()}`, "option");
      element.setAttribute("aria-selected", "false");
    });
    $$('[data-pencil-name^="Filtre · "]')
      .filter((element) => !isNamedDecorator(pencilName(element)))
      .forEach((element) => {
      makeInteractive(element, pencilName(element));
      element.setAttribute("aria-haspopup", "listbox");
      element.setAttribute("aria-expanded", "false");
    });
    configuredFrames()
      .filter((frame) => frame.dataset.prototypeRouteKey?.startsWith("director."))
      .flatMap((frame) => $$('[data-pencil-name^="Filtre tablette · "]', frame))
      .filter((element) => !isNamedDecorator(pencilName(element)))
      .forEach((element) => {
        makeInteractive(element, canonicalNamedControl(pencilName(element)));
        element.setAttribute("aria-haspopup", "listbox");
        element.setAttribute("aria-expanded", "false");
      });
    setupDirectorSearch();
  }

  function updateArchiveAction(record) {
    const archived = getRecordStatus(record) === "Archivés";
    const id = getRecordId(record);
    const action = $(
      '[data-pencil-name^="Action Archiver"], [data-pencil-name^="Action tablette Archiver"]',
      record,
    );
    if (!action) return;
    action.dataset.prototypeArchiveMode = archived ? "restore" : "archive";
    action.setAttribute("aria-label", `${archived ? "Restaurer" : "Archiver"} ${id}`);
    action.setAttribute("title", `${archived ? "Restaurer" : "Archiver"} ${id}`);
    const label = $('[data-pencil-name^="Libellé action tablette Archiver"]', action);
    if (label) {
      label.textContent = archived ? "Restaurer" : "Archiver";
      label.style.color = archived ? "#2F7563" : "#BA6544";
    }
    $$('path', action).forEach((path) => path.setAttribute("fill", archived ? "#2F7563" : "#BA6544"));
  }

  function setRecordStatus(record, status) {
    const normalized = normalizeStatus(status);
    const visual = STATUS_STYLES[normalized] || STATUS_STYLES.Brouillons;
    record.dataset.prototypeStatus = normalized;
    record.dataset.prototypeArchived = normalized === "Archivés" ? "true" : "false";
    record.classList.remove("prototype-archived");
    const label = $('[data-pencil-name^="Libellé statut"]', record);
    if (label) {
      label.textContent = visual.label;
      label.style.color = visual.color;
    }
    const container = $('[data-pencil-name^="Statut "]', record);
    if (container) container.style.backgroundColor = visual.background;
    $$('[data-pencil-name^="Icône statut"] path', record).forEach((path) =>
      path.setAttribute("fill", visual.color),
    );
    updateArchiveAction(record);
    record.dataset.prototypeSearchText = stripAccents(record.textContent);
    record.setAttribute("aria-label", `${getRecordTitle(record)}, ${normalized}`);
  }

  function annotateRecord(record) {
    const id = getRecordId(record);
    if (!id) return;
    record.dataset.prototypeRecordId = id;
    record.dataset.prototypeStatus = getRecordStatus(record);
    const metadata = recordMetadata(record);
    record.dataset.prototypeType = metadata.type;
    record.dataset.prototypeAudiences = metadata.audiences.join("|");
    record.dataset.prototypeLevel = metadata.level;
    record.dataset.prototypeTimestamp = String(metadata.timestamp || 0);
    if (!record.dataset.prototypeOriginalOrder) {
      record.dataset.prototypeOriginalOrder = String($$(RECORD_SELECTOR).indexOf(record));
    }
    record.dataset.prototypeSearchText = stripAccents(record.textContent);
    const title = getRecordTitle(record);
    record.setAttribute("aria-label", `${title}, ${record.dataset.prototypeStatus}`);

    const isTablet = pencilName(record).startsWith("Carte contenu tablette");
    const checkbox = isTablet
      ? $('[data-pencil-name="Case à cocher sélection carte tablette"]', record)
      : $('[data-pencil-name^="Case à cocher "]', record);
    if (checkbox) {
      checkbox.classList.add("prototype-select-toggle");
      checkbox.dataset.prototypeSelectId = id;
      makeInteractive(checkbox, `Sélectionner ${title}`, "checkbox");
      checkbox.setAttribute("aria-checked", "false");
    }
    if (record.dataset.prototypeStatus === "Archivés" && !record.dataset.prototypePreviousStatus) {
      record.dataset.prototypePreviousStatus = "Brouillons";
    }
    updateArchiveAction(record);
  }

  function setupRecords() {
    $$(RECORD_SELECTOR).forEach(annotateRecord);
    const selectAll = $('[data-pencil-name="Sélectionner tous les contenus"]');
    if (selectAll) {
      selectAll.classList.add("prototype-select-toggle");
      makeInteractive(selectAll, "Sélectionner tous les contenus visibles", "checkbox");
      selectAll.setAttribute("aria-checked", "false");
    }
  }

  function uniqueValues(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function filterOptions(kind) {
    const source = $$(RECORD_SELECTOR, getFrame("library", "desktop"));
    if (kind === "type") return ["Tous", ...uniqueValues(source.map((record) => record.dataset.prototypeType))];
    if (kind === "audience") {
      const available = new Set(source.flatMap((record) => record.dataset.prototypeAudiences.split("|").filter(Boolean)));
      return ["Toutes", ...["Élèves", "Enseignants", "Parents"].filter((value) => available.has(value))];
    }
    if (kind === "level") {
      return ["Tous", ...uniqueValues(source.map((record) => record.dataset.prototypeLevel))];
    }
    if (kind === "status") return STATUS_OPTIONS;
    return SORT_OPTIONS;
  }

  function currentFilterValue(kind) {
    if (kind === "status") return state.status;
    if (kind === "sort") return state.sort;
    return state.filters[kind];
  }

  function setStatusFilter(status, apply = true) {
    state.status = STATUS_OPTIONS.includes(status) ? status : "Tous";
    state.page = 1;
    renderTabs();
    renderFilterControls();
    renderPagination();
    if (apply) applyFilters();
  }

  function applyFilterValue(kind, value) {
    if (kind === "status") {
      setStatusFilter(value);
      return;
    }
    if (kind === "sort") {
      state.sort = value;
      state.sortTouched = true;
    }
    else state.filters[kind] = value;
    state.page = 1;
    renderFilterControls();
    renderPagination();
    applyFilters();
  }

  function closeDesktopPopover(restoreFocus = false) {
    const popover = state.openPopover;
    if (!popover) return;
    const control = popover.parentElement;
    popover.remove();
    state.openPopover = null;
    control?.setAttribute("aria-expanded", "false");
    if (restoreFocus) control?.focus();
  }

  function openDesktopPopover(control, kind) {
    const wasOpen = state.openPopover?.parentElement === control;
    closeDesktopPopover();
    if (wasOpen) return;
    const popover = document.createElement("div");
    popover.className = `prototype-filter-popover${kind === "sort" ? " prototype-filter-popover--right" : ""}`;
    popover.setAttribute("role", "listbox");
    popover.setAttribute("aria-label", control.getAttribute("aria-label") || "Options de filtre");
    filterOptions(kind).forEach((value) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "prototype-filter-option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", currentFilterValue(kind) === value ? "true" : "false");
      option.textContent = value;
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        applyFilterValue(kind, value);
        closeDesktopPopover(true);
      });
      popover.appendChild(option);
    });
    control.appendChild(popover);
    control.setAttribute("aria-expanded", "true");
    state.openPopover = popover;
    $("button", popover)?.focus();
  }

  function setupDesktopFilters() {
    const controls = [
      ['[data-pencil-name="Filtre Type"]', "type", "Filtrer par type"],
      ['[data-pencil-name="Filtre Statut"]', "status", "Filtrer par statut"],
      ['[data-pencil-name="Filtre Audience"]', "audience", "Filtrer par audience"],
      ['[data-pencil-name="Filtre Niveau"]', "level", "Filtrer par niveau"],
      ['[data-pencil-name="Tri Bibliothèque"]', "sort", "Trier les contenus"],
    ];
    controls.forEach(([selector, kind, label]) => {
      const control = $(selector, getFrame("library", "desktop"));
      if (!control || control.dataset.prototypeFilterKind) return;
      control.dataset.prototypeFilterKind = kind;
      control.classList.add("prototype-filter-control");
      makeInteractive(control, label);
      control.setAttribute("aria-haspopup", "listbox");
      control.setAttribute("aria-expanded", "false");
      control.addEventListener("click", (event) => {
        if (event.target.closest(".prototype-filter-option")) return;
        event.stopPropagation();
        openDesktopPopover(control, kind);
      });
    });
    document.addEventListener("click", () => closeDesktopPopover());
    renderFilterControls();
  }

  function renderFilterControls() {
    const labels = {
      type: state.filters.type === "Tous" ? "Type" : state.filters.type,
      status: state.status === "Tous" ? "Statut" : state.status,
      audience: state.filters.audience === "Toutes" ? "Audience" : state.filters.audience,
      level: state.filters.level === "Tous" ? "Niveau" : state.filters.level,
      sort: state.sort,
    };
    $$('[data-prototype-filter-kind]').forEach((control) => {
      const kind = control.dataset.prototypeFilterKind;
      const label = $(
        '[data-pencil-name^="Libellé filtre"], [data-pencil-name="Libellé tri Bibliothèque"]',
        control,
      );
      if (label) label.textContent = labels[kind];
      const active = kind !== "sort" && !["Tous", "Toutes"].includes(currentFilterValue(kind));
      control.classList.toggle("prototype-filter-control--active", active);
      control.setAttribute("aria-label", `${kind === "sort" ? "Tri" : "Filtre"} : ${labels[kind]}`);
      control.setAttribute("title", `${kind === "sort" ? "Tri" : "Filtre"} : ${labels[kind]}`);
    });

    const activeCount =
      Number(state.filters.type !== "Tous") +
      Number(state.filters.audience !== "Toutes") +
      Number(state.filters.level !== "Tous") +
      Number(state.status !== "Tous");
    $$('[data-pencil-name="Action Filtres tablette"]').forEach((button) => {
      button.setAttribute("aria-label", `Afficher les filtres${activeCount ? `, ${activeCount} actif${activeCount > 1 ? "s" : ""}` : ""}`);
      button.setAttribute("aria-expanded", $(".prototype-filter-drawer") ? "true" : "false");
      const label = $('[data-pencil-name="Libellé Filtres tablette"]', button);
      if (label) label.textContent = activeCount ? `Filtres · ${activeCount}` : "Filtres";
      button.classList.toggle("prototype-filter-control--active", activeCount > 0);
    });
  }

  function appendSelectField(form, name, labelText, options, value) {
    const field = document.createElement("label");
    field.className = "prototype-drawer__field";
    const label = document.createElement("span");
    label.textContent = labelText;
    const select = document.createElement("select");
    select.name = name;
    select.setAttribute("aria-label", labelText);
    options.forEach((optionValue) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      select.appendChild(option);
    });
    select.value = value;
    field.append(label, select);
    form.appendChild(field);
    return select;
  }

  function openFilterDrawer() {
    $(".prototype-filter-drawer-backdrop")?.remove();
    const previous = document.activeElement;
    const activeFrame = getActiveFrame();
    activeFrame?.setAttribute("inert", "");
    const backdrop = document.createElement("div");
    backdrop.className = "prototype-filter-drawer-backdrop";
    backdrop.innerHTML = `
      <aside class="prototype-filter-drawer" role="dialog" aria-modal="true" aria-labelledby="prototype-filter-drawer-title">
        <header class="prototype-drawer__header">
          <div>
            <p>Bibliothèque</p>
            <h2 id="prototype-filter-drawer-title">Filtrer les contenus</h2>
          </div>
          <button class="prototype-drawer__close" type="button">Fermer</button>
        </header>
        <form class="prototype-drawer__form"></form>
        <footer class="prototype-drawer__actions">
          <button class="prototype-drawer__reset" type="button">Réinitialiser</button>
          <button class="prototype-drawer__apply" type="button">Appliquer les filtres</button>
        </footer>
      </aside>
    `;
    const form = $(".prototype-drawer__form", backdrop);
    const selects = {
      type: appendSelectField(form, "type", "Type", filterOptions("type"), state.filters.type),
      audience: appendSelectField(
        form,
        "audience",
        "Audience",
        filterOptions("audience"),
        state.filters.audience,
      ),
      level: appendSelectField(form, "level", "Niveau", filterOptions("level"), state.filters.level),
      status: appendSelectField(form, "status", "Statut", STATUS_OPTIONS, state.status),
    };
    const close = () => {
      backdrop.remove();
      if (activeFrame === getActiveFrame()) activeFrame.removeAttribute("inert");
      renderFilterControls();
      previous?.focus?.();
    };
    $(".prototype-drawer__close", backdrop).addEventListener("click", close);
    $(".prototype-drawer__reset", backdrop).addEventListener("click", () => {
      selects.type.value = "Tous";
      selects.audience.value = "Toutes";
      selects.level.value = "Tous";
      selects.status.value = "Tous";
      selects.type.focus();
    });
    $(".prototype-drawer__apply", backdrop).addEventListener("click", () => {
      state.filters.type = selects.type.value;
      state.filters.audience = selects.audience.value;
      state.filters.level = selects.level.value;
      setStatusFilter(selects.status.value, false);
      state.page = 1;
      close();
      renderPagination();
      applyFilters();
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const focusable = $$('button, select', backdrop).filter((element) => !element.disabled);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    document.body.appendChild(backdrop);
    renderFilterControls();
    selects.type.focus();
  }

  function setupSearch() {
    $$('[data-pencil-name="Recherche Bibliothèque"], [data-pencil-name="Recherche Bibliothèque tablette"]').forEach(
      (container, index) => {
        container.setAttribute("role", "search");
        let input = $(".prototype-search-input", container);
        if (!input) {
          input = document.createElement("input");
          input.className = "prototype-search-input";
          input.type = "search";
          input.placeholder = "Rechercher par titre, type, auteur ou identifiant…";
          input.autocomplete = "off";
          input.setAttribute("aria-label", "Rechercher dans la bibliothèque de contenus");
          input.id = `prototype-search-${index + 1}`;
          container.appendChild(input);
          input.addEventListener("input", () => {
            state.query = input.value;
            state.page = 1;
            syncInputs(input);
            applyFilters();
            renderPagination();
          });
        }
      },
    );
  }

  function syncInputs(source = null) {
    $$(".prototype-search-input").forEach((input) => {
      if (input !== source && input.value !== state.query) input.value = state.query;
    });
  }

  function renderTabs() {
    $$('[data-prototype-status-filter]').forEach((tab) => {
      const active = tab.dataset.prototypeStatusFilter === state.status;
      tab.setAttribute("aria-pressed", active ? "true" : "false");
      tab.style.backgroundColor = active ? "#051223" : "#FFFFFF00";
      $$('div[data-pencil-name^="Libellé statut"], div[data-pencil-name^="Libellé filtre"]', tab).forEach(
        (label) => {
          label.style.color = active ? "#FAF7F3" : "#2B3548";
        },
      );
      $$('div[data-pencil-name^="Valeur compteur"]', tab).forEach((counter) => {
        counter.style.color = active ? "#D4B27A" : "#5A616F";
      });
    });
  }

  function renderPagination() {
    $$('[data-pencil-name^="Page "] , [data-pencil-name^="Page tablette "]').forEach((page) => {
      const suffix = pencilName(page).split(" ").pop();
      const pageNumber = Number.parseInt(suffix, 10);
      page.classList.toggle("prototype-page-active", Number.isFinite(pageNumber) && pageNumber === state.page);
      if (Number.isFinite(pageNumber)) page.setAttribute("aria-current", pageNumber === state.page ? "page" : "false");
    });
  }

  function updateTabletRowVisibility() {
    $$('[data-pencil-name^="Rangée cartes Bibliothèque tablette"], .prototype-generated-row').forEach((row) => {
      const cards = $$('[data-pencil-name^="Carte contenu tablette"]', row);
      const hasVisibleCard = cards.some(
        (card) =>
          !card.classList.contains("prototype-filtered") &&
          !card.classList.contains("prototype-paged-out"),
      );
      row.style.display = hasVisibleCard ? "flex" : "none";
    });
  }

  function sortRecords(records) {
    return [...records].sort((left, right) => {
      if (state.sort === "Titre A–Z") {
        return getRecordTitle(left).localeCompare(getRecordTitle(right), "fr", { sensitivity: "base" });
      }
      if (state.sort === "Titre Z–A") {
        return getRecordTitle(right).localeCompare(getRecordTitle(left), "fr", { sensitivity: "base" });
      }
      const leftDate = Number(left.dataset.prototypeTimestamp || 0);
      const rightDate = Number(right.dataset.prototypeTimestamp || 0);
      if (leftDate !== rightDate) return state.sort === "Plus ancienne" ? leftDate - rightDate : rightDate - leftDate;
      return Number(left.dataset.prototypeOriginalOrder || 0) - Number(right.dataset.prototypeOriginalOrder || 0);
    });
  }

  function applySort() {
    if (!state.sortTouched) return;
    const desktop = getFrame("library", "desktop");
    const desktopMarker = $('[data-pencil-name="Espace flexible Table Bibliothèque"]', desktop);
    if (desktopMarker) {
      sortRecords($$(RECORD_SELECTOR, desktop)).forEach((record) => desktopMarker.before(record));
    }

    const tablet = getFrame("library", "tablet");
    const firstRow = $('[data-pencil-name="Rangée cartes Bibliothèque tablette 1"]', tablet);
    const secondRow = $('[data-pencil-name="Rangée cartes Bibliothèque tablette 2"]', tablet);
    if (firstRow && secondRow) {
      sortRecords($$(RECORD_SELECTOR, tablet)).forEach((record, index) => {
        (index < 2 ? firstRow : secondRow).appendChild(record);
      });
    }
  }

  function paginateFilteredRecords() {
    [
      [getFrame("library", "desktop"), 6],
      [getFrame("library", "tablet"), 4],
    ].forEach(([frame, limit]) => {
      const matches = $$(RECORD_SELECTOR, frame).filter((record) => !record.classList.contains("prototype-filtered"));
      $$(RECORD_SELECTOR, frame).forEach((record) => record.classList.remove("prototype-paged-out"));
      matches.slice(limit).forEach((record) => record.classList.add("prototype-paged-out"));
    });
  }

  function updateEmptyStates() {
    [
      [getFrame("library", "desktop"), '[data-pencil-name="Table Bibliothèque de contenus"]'],
      [getFrame("library", "tablet"), '[data-pencil-name="Grille cartes Bibliothèque tablette"]'],
    ].forEach(([frame, containerSelector]) => {
      const container = $(containerSelector, frame);
      if (!container) return;
      container.classList.add("prototype-results-container");
      let empty = $(".prototype-empty-state", container);
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "prototype-empty-state";
        empty.setAttribute("role", "status");
        container.appendChild(empty);
      }
      const visible = $$(RECORD_SELECTOR, frame).some(
        (record) =>
          !record.classList.contains("prototype-filtered") && !record.classList.contains("prototype-paged-out"),
      );
      empty.hidden = visible;
      empty.textContent =
        state.status === "Archivés"
          ? "Aucun contenu archivé ne correspond à ces filtres."
          : "Aucun contenu ne correspond à ces filtres.";
    });
  }

  function applyFilters() {
    applySort();
    const query = stripAccents(state.query);
    $$(RECORD_SELECTOR).forEach((record) => {
      const text = record.dataset.prototypeSearchText || stripAccents(record.textContent);
      const matchesQuery = !query || text.includes(query);
      const status = getRecordStatus(record);
      const matchesStatus =
        state.status === "Archivés"
          ? status === "Archivés"
          : status !== "Archivés" && (state.status === "Tous" || status === state.status);
      const matchesType =
        state.filters.type === "Tous" ||
        stripAccents(record.dataset.prototypeType) === stripAccents(state.filters.type);
      const audiences = record.dataset.prototypeAudiences.split("|").filter(Boolean);
      const matchesAudience =
        state.filters.audience === "Toutes" || audiences.includes(state.filters.audience);
      const matchesLevel =
        state.filters.level === "Tous" ||
        stripAccents(record.dataset.prototypeLevel) === stripAccents(state.filters.level);
      record.classList.toggle(
        "prototype-filtered",
        !(matchesQuery && matchesStatus && matchesType && matchesAudience && matchesLevel),
      );
    });
    paginateFilteredRecords();
    updateTabletRowVisibility();
    updateEmptyStates();
    renderSelection();
  }

  function renderCheckbox(box, checked, indeterminate = false) {
    if (!box) return;
    box.setAttribute("aria-checked", indeterminate ? "mixed" : checked ? "true" : "false");
    box.style.alignItems = "center";
    box.style.backgroundColor = checked ? "#051223" : indeterminate ? "#D4B27A" : "#FFFFFF";
    box.style.color = "#FFFFFF";
    box.style.justifyContent = "center";
    box.style.outlineColor = checked || indeterminate ? "#051223" : "#9F927F";
    box.replaceChildren();
    if (checked) {
      const icon = $('svg[data-icon-name="check"]')?.cloneNode(true);
      if (icon) {
        icon.removeAttribute("data-pencil-name");
        icon.style.height = "11px";
        icon.style.width = "11px";
        $$('path', icon).forEach((path) => path.setAttribute("fill", "#FFFFFF"));
        box.appendChild(icon);
      }
    }
  }

  function visibleRecordIds() {
    const active = getFrame("library");
    if (!active) return [];
    return $$(RECORD_SELECTOR, active)
      .filter(
        (record) =>
          !record.classList.contains("prototype-filtered") &&
          !record.classList.contains("prototype-paged-out"),
      )
      .map(getRecordId)
      .filter(Boolean);
  }

  function renderSelection() {
    $$(RECORD_SELECTOR).forEach((record) => {
      const id = getRecordId(record);
      const checked = state.selected.has(id);
      record.classList.toggle("prototype-selected", checked);
      $$('[data-prototype-select-id]', record).forEach((box) => renderCheckbox(box, checked));
    });

    const visible = visibleRecordIds();
    const selectedVisible = visible.filter((id) => state.selected.has(id));
    const selectAll = $('[data-pencil-name="Sélectionner tous les contenus"]');
    renderCheckbox(selectAll, visible.length > 0 && selectedVisible.length === visible.length, selectedVisible.length > 0 && selectedVisible.length < visible.length);

    const bar = ensureSelectionBar();
    const count = state.selected.size;
    bar.hidden = count === 0 || state.view !== "library";
    $(".prototype-selection-bar__count", bar).textContent =
      count > 1 ? `${count} contenus sélectionnés` : "1 contenu sélectionné";
    const allArchived = count > 0 && Array.from(state.selected).every((id) => statusForId(id) === "Archivés");
    const primaryAction = $(".prototype-selection-bar__archive", bar);
    primaryAction.textContent = allArchived ? "Restaurer" : "Archiver";
    primaryAction.classList.toggle("prototype-selection-bar__archive--restore", allArchived);
  }

  function ensureSelectionBar() {
    let bar = $(".prototype-selection-bar");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.className = "prototype-selection-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Actions sur la sélection");
    bar.innerHTML = `
      <span class="prototype-selection-bar__count" aria-live="polite">0 contenu sélectionné</span>
      <button class="prototype-selection-bar__archive" type="button">Archiver</button>
      <button class="prototype-selection-bar__clear" type="button">Effacer la sélection</button>
    `;
    bar.hidden = true;
    $(".prototype-selection-bar__archive", bar).addEventListener("click", archiveSelection);
    $(".prototype-selection-bar__clear", bar).addEventListener("click", () => {
      state.selected.clear();
      renderSelection();
    });
    document.body.appendChild(bar);
    return bar;
  }

  function toggleSelection(id) {
    if (!id) return;
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    renderSelection();
  }

  function toggleSelectAll() {
    const visible = visibleRecordIds();
    const allSelected = visible.length > 0 && visible.every((id) => state.selected.has(id));
    visible.forEach((id) => {
      if (allSelected) state.selected.delete(id);
      else state.selected.add(id);
    });
    renderSelection();
  }

  function showDialog({ title, message, confirmLabel, danger = false, onConfirm }) {
    $(".prototype-dialog-backdrop")?.remove();
    const previous = document.activeElement;
    const activeFrame = getActiveFrame();
    activeFrame?.setAttribute("inert", "");
    const backdrop = document.createElement("div");
    backdrop.className = "prototype-dialog-backdrop";
    backdrop.innerHTML = `
      <section class="prototype-dialog" role="dialog" aria-modal="true" aria-labelledby="prototype-dialog-title" aria-describedby="prototype-dialog-description">
        <p class="prototype-dialog__eyebrow">Jet d’Encre · Administration</p>
        <h2 id="prototype-dialog-title"></h2>
        <p id="prototype-dialog-description"></p>
        <div class="prototype-dialog__actions">
          <button class="prototype-dialog__cancel" type="button">Annuler</button>
          <button class="prototype-dialog__confirm${danger ? " prototype-dialog__confirm--danger" : ""}" type="button"></button>
        </div>
      </section>
    `;
    $("#prototype-dialog-title", backdrop).textContent = title;
    $("#prototype-dialog-description", backdrop).textContent = message;
    $(".prototype-dialog__confirm", backdrop).textContent = confirmLabel;

    const close = () => {
      backdrop.remove();
      if (activeFrame === getActiveFrame()) activeFrame.removeAttribute("inert");
      previous?.focus?.();
    };
    $(".prototype-dialog__cancel", backdrop).addEventListener("click", close);
    $(".prototype-dialog__confirm", backdrop).addEventListener("click", () => {
      close();
      onConfirm();
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const focusable = $$('button:not([disabled]), input:not([disabled]), select:not([disabled])', backdrop);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
    document.body.appendChild(backdrop);
    $(".prototype-dialog__confirm", backdrop).focus();
  }

  function showToast(message, action = null) {
    clearTimeout(state.toastTimer);
    $(".prototype-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "prototype-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    const text = document.createElement("span");
    text.textContent = message;
    toast.appendChild(text);
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        toast.remove();
        action.run();
      });
      toast.appendChild(button);
    }
    document.body.appendChild(toast);
    state.toastTimer = window.setTimeout(() => toast.remove(), 5000);
  }

  function archiveIds(ids) {
    const previousStatuses = new Map();
    ids.forEach((id) => {
      const records = $$(RECORD_SELECTOR).filter((record) => getRecordId(record) === id);
      const previousStatus = records.map(getRecordStatus).find((status) => status !== "Archivés");
      if (!previousStatus) return;
      previousStatuses.set(id, previousStatus);
      records.forEach((record) => {
        record.dataset.prototypePreviousStatus = previousStatus;
        setRecordStatus(record, "Archivés");
      });
      state.selected.delete(id);
    });
    applyFilters();
    const archivedCount = previousStatuses.size;
    if (!archivedCount) return;
    showToast(archivedCount > 1 ? `${archivedCount} contenus archivés.` : "Contenu archivé.", {
      label: "Annuler",
      run: () => {
        restoreIds(Array.from(previousStatuses.keys()), previousStatuses, false);
        showToast(archivedCount > 1 ? "Archivage des contenus annulé." : "Archivage annulé.");
      },
    });
  }

  function restoreIds(ids, statusSnapshot = null, announce = true) {
    let restoredCount = 0;
    ids.forEach((id) => {
      const records = $$(RECORD_SELECTOR).filter((record) => getRecordId(record) === id);
      if (!records.length || !records.some((record) => getRecordStatus(record) === "Archivés")) return;
      const restoredStatus =
        statusSnapshot?.get(id) ||
        records.map((record) => record.dataset.prototypePreviousStatus).find(Boolean) ||
        "Brouillons";
      records.forEach((record) => {
        setRecordStatus(record, restoredStatus);
        delete record.dataset.prototypePreviousStatus;
      });
      state.selected.delete(id);
      restoredCount += 1;
    });
    applyFilters();
    if (announce && restoredCount) {
      showToast(restoredCount > 1 ? `${restoredCount} contenus restaurés.` : "Contenu restauré.");
    }
  }

  function archiveRecord(record) {
    const id = getRecordId(record);
    const title = getRecordTitle(record);
    if (getRecordStatus(record) === "Archivés") {
      restoreIds([id]);
      return;
    }
    showDialog({
      title: "Archiver ce contenu ?",
      message: `« ${title} » sera déplacé dans l’onglet Archivés. Vous pourrez annuler juste après l’action.`,
      confirmLabel: "Archiver",
      danger: true,
      onConfirm: () => archiveIds([id]),
    });
  }

  function archiveSelection() {
    const ids = Array.from(state.selected);
    if (!ids.length) return;
    if (ids.every((id) => statusForId(id) === "Archivés")) {
      restoreIds(ids);
      return;
    }
    showDialog({
      title: `Archiver ${ids.length} contenu${ids.length > 1 ? "s" : ""} ?`,
      message: "La sélection sera déplacée dans l’onglet Archivés. Cette action reste annulable immédiatement.",
      confirmLabel: "Archiver la sélection",
      danger: true,
      onConfirm: () => archiveIds(ids),
    });
  }

  function updateNamesAndMetadata(clone, sourceId, copyId, title) {
    [clone, ...$$('[data-pencil-name]', clone)].forEach((element) => {
      const name = pencilName(element);
      if (name.includes(sourceId)) element.setAttribute("data-pencil-name", name.replaceAll(sourceId, copyId));
      if (element.childElementCount === 0 && element.textContent.trim() === sourceId) element.textContent = copyId;
    });
    clone.dataset.prototypeRecordId = copyId;
    clone.dataset.prototypeStatus = "Brouillons";
    clone.dataset.prototypeSearchText = stripAccents(`${title} ${copyId} Brouillon`);
    clone.classList.add("prototype-generated-copy");
    clone.classList.remove("prototype-filtered", "prototype-paged-out", "prototype-selected", "prototype-archived");
    clone.removeAttribute("aria-label");
    delete clone.dataset.prototypePreviousStatus;

    $('[data-pencil-name^="Titre contenu"], [data-pencil-name^="Titre carte tablette"]', clone)?.replaceChildren(title);
    const now = new Date();
    const month = [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ][now.getMonth()];
    const dateLabel = `${now.getDate()} ${month} · ${String(now.getHours()).padStart(2, "0")} h ${String(now.getMinutes()).padStart(2, "0")}`;
    $$('[data-pencil-name^="Valeur modification "], [data-pencil-name^="Valeur Date carte tablette "]', clone).forEach(
      (element) => {
        element.textContent = dateLabel;
      },
    );
    annotateRecord(clone);
    clone.dataset.prototypeTimestamp = String(Date.now());
    setRecordStatus(clone, "Brouillons");
    setupAccessibleControls();
  }

  function addDesktopCopy(sourceId, copyId, title) {
    const frame = getFrame("library", "desktop");
    const source = $(`[data-prototype-record-id="${CSS.escape(sourceId)}"]`, frame);
    if (!source) return;
    const clone = source.cloneNode(true);
    updateNamesAndMetadata(clone, sourceId, copyId, title);
    const firstRow = $(RECORD_SELECTOR, frame);
    firstRow?.before(clone);
    const visibleRows = $$(RECORD_SELECTOR, frame).filter((row) => !row.classList.contains("prototype-paged-out"));
    if (visibleRows.length > 6) visibleRows.at(-1).classList.add("prototype-paged-out");
  }

  function addTabletCopy(sourceId, copyId, title) {
    const frame = getFrame("library", "tablet");
    const source = $(`[data-prototype-record-id="${CSS.escape(sourceId)}"]`, frame);
    if (!source) return;
    const clone = source.cloneNode(true);
    updateNamesAndMetadata(clone, sourceId, copyId, title);

    const firstRow = $('[data-pencil-name="Rangée cartes Bibliothèque tablette 1"]', frame);
    const secondRow = $('[data-pencil-name="Rangée cartes Bibliothèque tablette 2"]', frame);
    if (!firstRow || !secondRow) return;
    firstRow.prepend(clone);
    const firstVisible = $$(RECORD_SELECTOR, firstRow).filter((card) => !card.classList.contains("prototype-paged-out"));
    if (firstVisible.length > 2) secondRow.prepend(firstVisible.at(-1));
    const allVisible = $$(RECORD_SELECTOR, frame).filter((card) => !card.classList.contains("prototype-paged-out"));
    if (allVisible.length > 4) allVisible.at(-1).classList.add("prototype-paged-out");
  }

  function duplicateRecord(record) {
    const sourceId = getRecordId(record);
    const sourceTitle = getRecordTitle(record);
    showDialog({
      title: "Dupliquer ce contenu ?",
      message: `Une copie de « ${sourceTitle} » sera créée avec le statut Brouillon.`,
      confirmLabel: "Créer la copie",
      onConfirm: () => {
        state.copyCounter += 1;
        const copyId = `COPY-${Date.now().toString().slice(-6)}-${state.copyCounter}`;
        const copyTitle = `Copie de ${sourceTitle}`;
        addDesktopCopy(sourceId, copyId, copyTitle);
        addTabletCopy(sourceId, copyId, copyTitle);
        applyFilters();
        setView("studio", { mode: "duplicate", id: copyId, title: copyTitle, status: "Brouillons" });
        showToast("Copie ajoutée aux Brouillons et ouverte dans le Studio.", {
          label: "Bibliothèque",
          run: () => setView("library"),
        });
      },
    });
  }

  function setupImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.hidden = true;
    input.multiple = true;
    input.accept = ".pdf,.epub,.doc,.docx,.mp3,.wav,.mp4,.webm,.jpg,.jpeg,.png";
    input.setAttribute("aria-label", "Choisir des contenus à importer");
    input.addEventListener("change", () => {
      const count = input.files?.length || 0;
      if (count) showToast(`${count} fichier${count > 1 ? "s" : ""} prêt${count > 1 ? "s" : ""} à être importé${count > 1 ? "s" : ""}.`);
      input.value = "";
    });
    document.body.appendChild(input);
    return input;
  }

  function recordFromAction(action) {
    return action?.closest(RECORD_SELECTOR) || null;
  }

  function setupEvents(importInput) {
    document.addEventListener("click", (event) => {
      const configuredAction = findKnownNamedElement(event.target);
      if (configuredAction && handleNamedAction(configuredAction)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const selectAll = event.target.closest('[data-pencil-name="Sélectionner tous les contenus"]');
      if (selectAll) {
        event.preventDefault();
        toggleSelectAll();
        return;
      }

      const checkbox = event.target.closest('[data-prototype-select-id]');
      if (checkbox) {
        event.preventDefault();
        event.stopPropagation();
        toggleSelection(checkbox.dataset.prototypeSelectId);
        return;
      }

      if (
        event.target.closest('[data-pencil-name="Navigation Admin · Bibliothèque"], [data-pencil-name="Rail Admin · Bibliothèque"]')
      ) {
        setView("library");
        return;
      }
      if (
        event.target.closest('[data-pencil-name="Navigation Admin · Studio de contenus"], [data-pencil-name="Rail Admin · Studio"]')
      ) {
        setView("studio", { mode: "new" });
        return;
      }

      if (event.target.closest('[data-pencil-name="Action Nouveau contenu"], [data-pencil-name="Action Nouveau contenu tablette"]')) {
        setView("studio", { mode: "new" });
        return;
      }

      if (event.target.closest('[data-pencil-name="Action Importer des contenus"], [data-pencil-name="Action Importer tablette"]')) {
        importInput.click();
        return;
      }

      const tab = event.target.closest('[data-prototype-status-filter]');
      if (tab) {
        setStatusFilter(tab.dataset.prototypeStatusFilter);
        return;
      }

      const modify = event.target.closest('[data-pencil-name^="Action Modifier"], [data-pencil-name^="Action tablette Modifier"]');
      if (modify) {
        const record = recordFromAction(modify);
        if (!record) return;
        setView("studio", {
          mode: "edit",
          id: getRecordId(record),
          title: getRecordTitle(record),
          status: getRecordStatus(record),
        });
        return;
      }

      const duplicate = event.target.closest('[data-pencil-name^="Action Dupliquer"], [data-pencil-name^="Action tablette Dupliquer"]');
      if (duplicate) {
        duplicateRecord(recordFromAction(duplicate));
        return;
      }

      const archive = event.target.closest('[data-pencil-name^="Action Archiver"], [data-pencil-name^="Action tablette Archiver"]');
      if (archive) {
        archiveRecord(recordFromAction(archive));
        return;
      }

      const page = event.target.closest('[data-pencil-name^="Page "] , [data-pencil-name^="Page tablette "]');
      if (page) {
        const suffix = pencilName(page).split(" ").pop();
        if (suffix === "…") return;
        if (suffix === "‹") state.page = Math.max(1, state.page - 1);
        else if (suffix === "›") state.page += 1;
        else if (Number.isFinite(Number.parseInt(suffix, 10))) state.page = Number.parseInt(suffix, 10);
        renderPagination();
        showToast(`Page ${state.page} sélectionnée.`);
        return;
      }

      if (event.target.closest('[data-pencil-name="Action Filtres tablette"]')) {
        openFilterDrawer();
      }
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (event.key === "Escape" && state.openPopover) {
        event.preventDefault();
        closeDesktopPopover(true);
        return;
      }
      if ((event.key === "Enter" || event.key === " ") && target.matches('[role="button"], [role="checkbox"]')) {
        event.preventDefault();
        target.click();
      }
    });

    window.addEventListener("resize", renderFrame, { passive: true });
    const host = getHostWindow();
    host.addEventListener("hashchange", syncRouteFromHost);
    host.addEventListener("popstate", syncRouteFromHost);
  }

  function init() {
    state.session = loadSessionState();
    setupAccessibleControls();
    setupRecords();
    setupDesktopFilters();
    setupSearch();
    setupConfiguredControls();
    ensureSelectionBar();
    const importInput = setupImport();
    setupEvents(importInput);
    applyFilters();
    const hostHasRoute = Boolean(getHostWindow().location.hash || window.location.hash);
    setRoute(routeFromHost(), { fromHost: hostHasRoute, replace: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
