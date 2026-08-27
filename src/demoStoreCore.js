import { createSeedClassChallengeState } from "./features/games/class-challenges/classChallengeData.js";
import {
  calculateClassChallengeScore,
  CLASS_CHALLENGE_DURATIONS,
  CLASS_CHALLENGE_QUESTION_COUNT,
  isSafeClassPseudonym,
} from "./features/games/class-challenges/classChallengeEngine.js";

export const DEMO_SCHEMA_VERSION = 6;
export const DEMO_STORAGE_KEY = "jde.demo.store.v3";
export const DEMO_ROLES = Object.freeze(["eleve", "parent", "enseignant", "directeur", "admin"]);
export const ACTIVATION_CODE_PATTERN = /^JDE-26-FR([1-6])-(\d{4})$/;

export const DEMO_ACCOUNTS = Object.freeze({
  eleve: Object.freeze({
    userId: "user-eleve-lina",
    role: "eleve",
    name: "Lina Mansouri",
    identifier: "lina.mansouri",
    password: "JET2026",
  }),
  parent: Object.freeze({
    userId: "user-parent-youssef",
    role: "parent",
    name: "Youssef Mansouri",
    identifier: "youssef.mansouri@demo.jetdencre.ma",
    password: "JET2026",
  }),
  enseignant: Object.freeze({
    userId: "user-enseignante-salma",
    role: "enseignant",
    name: "Salma Benjelloun",
    identifier: "salma.benjelloun@demo.jetdencre.ma",
    password: "JET2026",
  }),
  directeur: Object.freeze({
    userId: "user-directeur-amine",
    role: "directeur",
    name: "Amine Alaoui",
    identifier: "amine.alaoui@demo.jetdencre.ma",
    password: "JET2026",
  }),
  admin: Object.freeze({
    userId: "user-admin-nadia",
    role: "admin",
    name: "Nadia El Mansouri",
    identifier: "nadia@demo.jetdencre.ma",
    password: "JET2026",
  }),
});

const LEVELS = Object.freeze({
  1: "1re AEP",
  2: "2e AEP",
  3: "3e AEP",
  4: "4e AEP",
  5: "5e AEP",
  6: "6e AEP",
});

const moduleMemory = new Map();

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function asIso(now) {
  const value = typeof now === "function" ? now() : now;
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function createId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(value) {
  return String(value || "article")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "article";
}

function roleSessions() {
  return Object.fromEntries(
    DEMO_ROLES.map((role) => [
      role,
      {
        role,
        userId: DEMO_ACCOUNTS[role].userId,
        name: DEMO_ACCOUNTS[role].name,
        lastSignedInAt: null,
      },
    ]),
  );
}

export function createInitialDemoState(now = new Date()) {
  const timestamp = asIso(now);
  const classChallengeSeed = createSeedClassChallengeState(now);

  return {
    schemaVersion: DEMO_SCHEMA_VERSION,
    meta: {
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 0,
    },
    session: {
      authenticated: false,
      role: null,
      userId: null,
      signedInAt: null,
      pendingActivation: null,
    },
    sessions: roleSessions(),
    users: DEMO_ROLES.map((role) => ({
      id: DEMO_ACCOUNTS[role].userId,
      role,
      name: DEMO_ACCOUNTS[role].name,
      establishmentId: role === "admin" ? null : "etablissement-al-manar",
      status: "Actif",
      ...(role === "eleve" ? { xp: 1240, level: "5e AEP" } : {}),
    })),
    activationCodes: [
      { code: "JDE-26-FR1-1042", level: "1re AEP", status: "available", usedBy: null, usedAt: null },
      { code: "JDE-26-FR2-2098", level: "2e AEP", status: "available", usedBy: null, usedAt: null },
      { code: "JDE-26-FR3-3017", level: "3e AEP", status: "available", usedBy: null, usedAt: null },
      { code: "JDE-26-FR4-0029", level: "4e AEP", status: "available", usedBy: null, usedAt: null },
      { code: "JDE-26-FR5-0041", level: "5e AEP", status: "used", usedBy: "user-eleve-lina", usedAt: "2026-08-18T09:12:00.000Z" },
      { code: "JDE-26-FR5-0042", level: "5e AEP", status: "available", usedBy: null, usedAt: null },
      { code: "JDE-26-FR6-0019", level: "6e AEP", status: "available", usedBy: null, usedAt: null },
    ],
    manualActivations: [
      {
        id: "activation-lina-fr5",
        code: "JDE-26-FR5-0041",
        userId: "user-eleve-lina",
        level: "5e AEP",
        manualTitle: "Jet d’Encre · Français 5e AEP",
        activatedAt: "2026-08-18T09:12:00.000Z",
      },
    ],
    manualProgress: [
      {
        id: "progress-lina-fr5-unite-3",
        activationId: "activation-lina-fr5",
        userId: "user-eleve-lina",
        unitId: "unite-3",
        lessonId: "lecon-2",
        percent: 50,
        completedActivities: 1,
        updatedAt: "2026-08-24T14:05:00.000Z",
      },
    ],
    quizAwards: [],
    quizAttempts: [],
    classChallenges: classChallengeSeed.challenges,
    classChallengeResults: classChallengeSeed.results,
    submissions: [],
    assignments: [
      {
        id: "devoir-decrire-ville",
        title: "Décrire un lieu de ma ville",
        subject: "Français",
        classId: "classe-5a",
        className: "5e AEP · Classe 5A",
        level: "5e AEP",
        teacherId: "user-enseignante-salma",
        instructions: "Présente un lieu de ta ville en utilisant au moins cinq adjectifs qualificatifs.",
        dueAt: "2026-09-10T18:00:00.000Z",
        status: "Publié",
        submissions: 0,
        expectedSubmissions: 29,
        createdAt: "2026-08-24T09:15:00.000Z",
        updatedAt: "2026-08-24T09:15:00.000Z",
        archivedAt: null,
      },
      {
        id: "devoir-protegeons-nature",
        title: "Protégeons la nature",
        subject: "Français",
        classId: "classe-5a",
        className: "5e AEP · Classe A",
        level: "5e AEP",
        teacherId: "user-enseignante-salma",
        instructions: "Écouter le dialogue, relever cinq mots de l’environnement puis enregistrer une proposition pour protéger son quartier.",
        dueAt: "2026-09-10T18:00:00.000Z",
        status: "Publié",
        submissions: 21,
        expectedSubmissions: 28,
        createdAt: "2026-08-22T10:30:00.000Z",
        updatedAt: "2026-08-24T14:05:00.000Z",
        archivedAt: null,
      },
      {
        id: "devoir-carte-postale-essaouira",
        title: "Une carte postale d’Essaouira",
        subject: "Expression écrite",
        classId: "classe-5a",
        className: "5e AEP · Classe A",
        level: "5e AEP",
        teacherId: "user-enseignante-salma",
        instructions: "Rédiger une carte postale de 80 mots en utilisant trois indicateurs de lieu.",
        dueAt: "2026-09-16T18:00:00.000Z",
        status: "Brouillon",
        submissions: 0,
        expectedSubmissions: 28,
        createdAt: "2026-08-24T16:20:00.000Z",
        updatedAt: "2026-08-24T16:20:00.000Z",
        archivedAt: null,
      },
    ],
    contents: [
      {
        id: "POD-0018",
        title: "Les voix du Maroc · La marche du quartier",
        type: "Podcast",
        level: "5e AEP",
        unit: "Unité 3",
        competencies: ["Compréhension orale", "Lexique", "Interaction"],
        visibility: "Élèves et enseignants",
        status: "Publié",
        updatedAt: "2026-08-24T11:42:00.000Z",
        createdAt: "2026-08-18T08:20:00.000Z",
        archivedAt: null,
      },
      {
        id: "DOC-0024",
        title: "Les secrets de la médina",
        type: "Documentaire",
        level: "5e AEP",
        unit: "Unité 3",
        competencies: ["Compréhension orale", "Culture"],
        visibility: "Élèves et enseignants",
        status: "À réviser",
        updatedAt: "2026-08-23T15:10:00.000Z",
        createdAt: "2026-08-20T09:30:00.000Z",
        archivedAt: null,
      },
      {
        id: "EBK-0009",
        title: "Petites histoires du Maroc",
        type: "E-book",
        level: "4e AEP",
        unit: "Toutes",
        competencies: ["Lecture", "Culture"],
        visibility: "Élèves et enseignants",
        status: "Planifié",
        updatedAt: "2026-08-22T12:00:00.000Z",
        createdAt: "2026-08-19T10:00:00.000Z",
        archivedAt: null,
      },
      {
        id: "JEU-0012",
        title: "Le défi des mots voyageurs",
        type: "Jeu éducatif",
        level: "3e AEP",
        unit: "Unité 2",
        competencies: ["Vocabulaire", "Orthographe"],
        visibility: "Élèves",
        status: "Brouillon",
        updatedAt: "2026-08-21T17:45:00.000Z",
        createdAt: "2026-08-21T17:45:00.000Z",
        archivedAt: null,
      },
    ],
    articles: [
      {
        id: "article-jeux-maison",
        slug: "7-jeux-parler-francais-maison",
        title: "7 jeux pour parler français à la maison",
        excerpt: "Des activités courtes et sans pression pour transformer le quotidien en occasion de parler.",
        category: "Parents",
        theme: "Oral",
        author: "Nadia El Mansouri",
        status: "Publié",
        publishedAt: "2026-08-24T08:00:00.000Z",
        createdAt: "2026-08-18T10:00:00.000Z",
        updatedAt: "2026-08-24T08:00:00.000Z",
        archivedAt: null,
      },
      {
        id: "article-plurilinguisme",
        slug: "darija-arabe-amazigh-tremplins-francais",
        title: "Darija, arabe et amazigh : des tremplins vers le français",
        excerpt: "Comment valoriser les langues déjà parlées par l’enfant pour mieux apprendre le français.",
        category: "Enseignants",
        theme: "Plurilinguisme",
        author: "Samira El Fassi",
        status: "Publié",
        publishedAt: "2026-08-17T08:00:00.000Z",
        createdAt: "2026-08-10T13:30:00.000Z",
        updatedAt: "2026-08-17T08:00:00.000Z",
        archivedAt: null,
      },
      {
        id: "article-rituel-ecoute",
        slug: "rituel-ecoute-classe-fle",
        title: "Installer un rituel d’écoute en classe de FLE",
        excerpt: "Un dispositif simple pour développer la compréhension orale sans surcharger les élèves.",
        category: "Enseignants",
        theme: "Compréhension orale",
        author: "Salma Benjelloun",
        status: "Brouillon",
        publishedAt: null,
        createdAt: "2026-08-23T09:15:00.000Z",
        updatedAt: "2026-08-24T10:20:00.000Z",
        archivedAt: null,
      },
    ],
    notifications: [
      {
        id: "notification-eleve-devoir",
        role: "eleve",
        userId: "user-eleve-lina",
        type: "devoir",
        title: "Nouveau devoir",
        message: "« Protégeons la nature » est à rendre avant le 10 septembre.",
        read: false,
        createdAt: "2026-08-24T14:05:00.000Z",
        action: "/eleve/devoirs",
      },
      {
        id: "notification-enseignant-remises",
        role: "enseignant",
        userId: "user-enseignante-salma",
        type: "progression",
        title: "21 remises reçues",
        message: "Sept élèves doivent encore rendre « Protégeons la nature ».",
        read: false,
        createdAt: "2026-08-25T08:30:00.000Z",
        action: "/enseignant/devoirs",
      },
      {
        id: "notification-directeur-activation",
        role: "directeur",
        userId: "user-directeur-amine",
        type: "activation",
        title: "Campagne d’activation",
        message: "82 % des élèves de l’établissement ont activé leur manuel.",
        read: true,
        createdAt: "2026-08-24T07:20:00.000Z",
        action: "/directeur/activations",
      },
      {
        id: "notification-admin-revue",
        role: "admin",
        userId: "user-admin-nadia",
        type: "contenu",
        title: "Contenu à relire",
        message: "Le documentaire « Les secrets de la médina » attend une validation éditoriale.",
        read: false,
        createdAt: "2026-08-23T15:10:00.000Z",
        action: "/admin/bibliotheque",
      },
      {
        id: "notification-parent-progression",
        role: "parent",
        userId: "user-parent-youssef",
        type: "progression",
        title: "Belle progression de Lina",
        message: "Lina a terminé quatre activités cette semaine.",
        read: false,
        createdAt: "2026-08-24T18:15:00.000Z",
        action: "/parent/tableau-de-bord",
      },
    ],
  };
}

export function createMemoryStorage(entries) {
  const memory = entries instanceof Map ? entries : new Map(Object.entries(entries || {}));
  return {
    getItem(key) {
      return memory.has(String(key)) ? memory.get(String(key)) : null;
    },
    setItem(key, value) {
      memory.set(String(key), String(value));
    },
    removeItem(key) {
      memory.delete(String(key));
    },
    clear() {
      memory.clear();
    },
  };
}

function browserStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function createSafeStorage(primary = browserStorage(), fallback = createMemoryStorage(moduleMemory)) {
  let primaryAvailable = Boolean(primary);

  return {
    getItem(key) {
      if (primaryAvailable) {
        try {
          const value = primary.getItem(key);
          if (value !== null) fallback.setItem(key, value);
          return value;
        } catch {
          primaryAvailable = false;
        }
      }
      return fallback.getItem(key);
    },
    setItem(key, value) {
      fallback.setItem(key, value);
      if (primaryAvailable) {
        try {
          primary.setItem(key, value);
        } catch {
          primaryAvailable = false;
        }
      }
    },
    removeItem(key) {
      fallback.removeItem(key);
      if (primaryAvailable) {
        try {
          primary.removeItem(key);
        } catch {
          primaryAvailable = false;
        }
      }
    },
    get backend() {
      return primaryAvailable ? "localStorage" : "memory";
    },
  };
}

function mergeKnownState(candidate, seed) {
  const legacyAssignments = candidate.assignments || candidate.devoirs;
  const legacyContents = candidate.contents || candidate.contentItems;
  const legacyArticles = candidate.articles || candidate.blogArticles;
  const candidateUsers = Array.isArray(candidate.users) ? candidate.users : [];
  const users = seed.users.map((seedUser) => {
    const savedUser = candidateUsers.find((user) => user?.id === seedUser.id) || {};
    const mergedUser = { ...seedUser, ...savedUser, id: seedUser.id, role: seedUser.role };
    if (seedUser.role === "eleve") {
      const savedXp = savedUser.xp == null ? Number.NaN : Number(savedUser.xp);
      mergedUser.xp = Number.isFinite(savedXp) && savedXp >= 0 ? Math.round(savedXp) : seedUser.xp;
    }
    return mergedUser;
  });
  const candidateSession = candidate.session && typeof candidate.session === "object"
    ? candidate.session
    : {};
  const candidateRole = DEMO_ROLES.includes(candidateSession.role) ? candidateSession.role : null;
  const expectedUserId = candidateRole ? DEMO_ACCOUNTS[candidateRole].userId : null;
  const authenticated = candidateSession.authenticated === true
    && candidateRole !== null
    && candidateSession.userId === expectedUserId;
  const session = {
    ...seed.session,
    authenticated,
    role: authenticated ? candidateRole : null,
    userId: authenticated ? expectedUserId : null,
    signedInAt: authenticated && typeof candidateSession.signedInAt === "string"
      ? candidateSession.signedInAt
      : null,
    pendingActivation:
      candidateSession.pendingActivation && typeof candidateSession.pendingActivation === "object"
        ? candidateSession.pendingActivation
        : null,
  };

  return {
    ...seed,
    ...candidate,
    schemaVersion: DEMO_SCHEMA_VERSION,
    meta: { ...seed.meta, ...(candidate.meta || {}) },
    session,
    sessions: Object.fromEntries(
      DEMO_ROLES.map((role) => [role, { ...seed.sessions[role], ...(candidate.sessions?.[role] || {}) }]),
    ),
    users,
    activationCodes: Array.isArray(candidate.activationCodes) ? candidate.activationCodes : seed.activationCodes,
    manualActivations: Array.isArray(candidate.manualActivations) ? candidate.manualActivations : seed.manualActivations,
    manualProgress: Array.isArray(candidate.manualProgress) ? candidate.manualProgress : seed.manualProgress,
    quizAwards: Array.isArray(candidate.quizAwards) ? candidate.quizAwards : seed.quizAwards,
    quizAttempts: Array.isArray(candidate.quizAttempts) ? candidate.quizAttempts : seed.quizAttempts,
    classChallenges: Array.isArray(candidate.classChallenges) ? candidate.classChallenges : seed.classChallenges,
    classChallengeResults: Array.isArray(candidate.classChallengeResults) ? candidate.classChallengeResults : seed.classChallengeResults,
    submissions: Array.isArray(candidate.submissions) ? candidate.submissions : seed.submissions,
    assignments: Array.isArray(legacyAssignments) ? legacyAssignments : seed.assignments,
    contents: Array.isArray(legacyContents) ? legacyContents : seed.contents,
    articles: Array.isArray(legacyArticles) ? legacyArticles : seed.articles,
    notifications: Array.isArray(candidate.notifications) ? candidate.notifications : seed.notifications,
  };
}

export function migrateDemoState(candidate, now = new Date()) {
  const seed = createInitialDemoState(now);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return seed;

  const version = Number(candidate.schemaVersion ?? candidate.version ?? 0);
  if (!Number.isFinite(version) || version > DEMO_SCHEMA_VERSION) return seed;

  const migrated = clone(candidate);
  if (version < 1) {
    migrated.assignments = migrated.assignments || migrated.devoirs;
    migrated.contents = migrated.contents || migrated.contentItems;
    migrated.articles = migrated.articles || migrated.blogArticles;
  }
  if (version < 2) {
    migrated.sessions = migrated.sessions || {};
    migrated.manualActivations = migrated.manualActivations || [];
    migrated.meta = migrated.meta || {};
    migrated.meta.revision = Number(migrated.meta.revision || 0);
  }
  if (version < 3) {
    migrated.quizAwards = migrated.quizAwards || [];
    migrated.quizAttempts = migrated.quizAttempts || [];
  }
  if (version < 4) {
    migrated.submissions = migrated.submissions || [];
  }
  if (version < 5) {
    migrated.manualProgress = migrated.manualProgress || [];
  }
  if (version < 6) {
    migrated.classChallenges = migrated.classChallenges || seed.classChallenges;
    migrated.classChallengeResults = migrated.classChallengeResults || seed.classChallengeResults;
  }

  return mergeKnownState(migrated, seed);
}

export function hydrateDemoState(storage, storageKey = DEMO_STORAGE_KEY, now = new Date()) {
  const seed = createInitialDemoState(now);
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return seed;
    return migrateDemoState(JSON.parse(raw), now);
  } catch {
    return {
      ...seed,
      notifications: [
        {
          id: "notification-stockage-repare",
          role: "admin",
          userId: "user-admin-nadia",
          type: "systeme",
          title: "Données de démonstration restaurées",
          message: "Une sauvegarde locale illisible a été remplacée par les données de départ.",
          read: false,
          createdAt: asIso(now),
          action: "/admin/securite",
        },
        ...seed.notifications,
      ],
    };
  }
}

function normalizeCode(code) {
  return String(code ?? "").trim().toUpperCase();
}

function resultError(error, message) {
  return { ok: false, error, message };
}

export function validateDemoCredentials(role, credentials) {
  if (!DEMO_ROLES.includes(role)) {
    return resultError("unknown_role", "Ce profil de démonstration n’existe pas.");
  }

  const supplied = credentials && typeof credentials === "object" && !Array.isArray(credentials)
    ? credentials
    : {};
  const identifierValue = supplied.identifier ?? supplied.email ?? supplied.username;
  const passwordValue = supplied.password;
  const identifier = typeof identifierValue === "string" ? identifierValue.trim() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";
  if (!identifier || !password) {
    return resultError(
      "credentials_required",
      "Saisissez l’identifiant et le mot de passe du compte de démonstration.",
    );
  }

  const account = DEMO_ACCOUNTS[role];
  const identifierMatches = identifier.toLocaleLowerCase("fr")
    === account.identifier.toLocaleLowerCase("fr");
  const passwordMatches = password === account.password;
  if (!identifierMatches || !passwordMatches) {
    return resultError("invalid_credentials", "Identifiant ou mot de passe incorrect.");
  }

  return Object.freeze({ ok: true, role, userId: account.userId });
}

function titleFrom(input) {
  return String(input?.title ?? "").trim();
}

const collectionConfig = Object.freeze({
  assignments: { prefix: "devoir", defaultStatus: "Brouillon" },
  contents: { prefix: "contenu", defaultStatus: "Brouillon" },
  articles: { prefix: "article", defaultStatus: "Brouillon" },
});

export function createDemoStore(options = {}) {
  const storageKey = options.storageKey || DEMO_STORAGE_KEY;
  const safeStorage = options.storageAdapter || createSafeStorage(options.storage);
  const now = options.now || (() => new Date());
  let state = options.initialState
    ? migrateDemoState(options.initialState, now())
    : hydrateDemoState(safeStorage, storageKey, now());
  const listeners = new Set();

  function persist() {
    try {
      safeStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // createSafeStorage normally absorbs storage errors; this final guard keeps UI actions usable.
    }
  }

  function commit(nextState) {
    state = {
      ...nextState,
      schemaVersion: DEMO_SCHEMA_VERSION,
      meta: {
        ...(nextState.meta || {}),
        updatedAt: asIso(now),
        revision: Number(nextState.meta?.revision || 0) + 1,
      },
    };
    persist();
    listeners.forEach((listener) => listener());
    return state;
  }

  function getState() {
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function signIn(role, credentials = {}) {
    const validation = validateDemoCredentials(role, credentials);
    if (!validation.ok) return validation;
    const account = DEMO_ACCOUNTS[role];

    const signedInAt = asIso(now);
    const pendingActivation = role === "eleve" ? state.session.pendingActivation : null;
    const linkedActivation = pendingActivation
      ? { ...pendingActivation, userId: account.userId, linkedAt: signedInAt }
      : null;
    const manualActivations = linkedActivation
      ? state.manualActivations.map((item) => (item.id === linkedActivation.id ? linkedActivation : item))
      : state.manualActivations;
    const activationCodes = linkedActivation
      ? state.activationCodes.map((item) =>
          item.code === linkedActivation.code ? { ...item, usedBy: account.userId, usedAt: item.usedAt || signedInAt } : item,
        )
      : state.activationCodes;
    const manualProgress = linkedActivation && !state.manualProgress.some((item) => item.activationId === linkedActivation.id)
      ? [
          ...state.manualProgress,
          {
            id: createId("progression"),
            activationId: linkedActivation.id,
            userId: account.userId,
            unitId: "unite-1",
            lessonId: "lecon-1",
            percent: 0,
            completedActivities: 0,
            updatedAt: signedInAt,
          },
        ]
      : state.manualProgress;
    const activationNotification = linkedActivation
      ? {
          id: createId("notification"),
          role: "eleve",
          userId: account.userId,
          type: "activation",
          title: "Ton manuel est prêt",
          message: `« ${linkedActivation.manualTitle} » est maintenant associé à ton profil.`,
          read: false,
          createdAt: signedInAt,
          action: "/eleve/manuel",
        }
      : null;
    const session = {
      ...state.session,
      authenticated: true,
      role,
      userId: account.userId,
      signedInAt,
      pendingActivation: linkedActivation ? null : state.session.pendingActivation,
    };
    commit({
      ...state,
      session,
      activationCodes,
      manualActivations,
      manualProgress,
      notifications: activationNotification ? [activationNotification, ...state.notifications] : state.notifications,
      sessions: {
        ...state.sessions,
        [role]: { ...state.sessions[role], lastSignedInAt: signedInAt },
      },
    });
    return {
      ok: true,
      session: clone(session),
      user: clone(state.users.find((user) => user.id === account.userId)),
      activationLinked: Boolean(linkedActivation),
      activation: linkedActivation ? clone(linkedActivation) : null,
    };
  }

  function signOut() {
    const previous = clone(state.session);
    commit({
      ...state,
      session: {
        authenticated: false,
        role: null,
        userId: null,
        signedInAt: null,
        pendingActivation: null,
      },
    });
    return { ok: true, previousSession: previous };
  }

  function activateCode(input, optionsForActivation = {}) {
    const code = normalizeCode(input);
    const match = ACTIVATION_CODE_PATTERN.exec(code);
    if (!match) {
      return { ok: false, status: "invalid", code, message: "Saisissez un code au format JDE-26-FR5-0042." };
    }

    const codeIndex = state.activationCodes.findIndex((item) => item.code === code);
    if (codeIndex < 0) {
      return { ok: false, status: "invalid", code, message: "Ce code n’existe pas dans cette démonstration." };
    }
    const storedCode = state.activationCodes[codeIndex];
    if (storedCode.status === "used") {
      return {
        ok: false,
        status: "already_used",
        code,
        level: storedCode.level,
        message: "Ce code a déjà été activé.",
      };
    }
    if (storedCode.status !== "available") {
      return { ok: false, status: "invalid", code, message: "Ce code ne peut pas être activé." };
    }

    const levelNumber = Number(match[1]);
    const activatedAt = asIso(now);
    const userId = optionsForActivation.userId || state.session.userId || "activation-en-attente";
    const activation = {
      id: createId("activation"),
      code,
      userId,
      level: LEVELS[levelNumber],
      manualTitle: `Jet d’Encre · Français ${LEVELS[levelNumber]}`,
      activatedAt,
    };
    const activationCodes = [...state.activationCodes];
    activationCodes[codeIndex] = { ...storedCode, status: "used", usedBy: userId, usedAt: activatedAt };
    const pendingActivation = state.session.authenticated ? null : activation;
    commit({
      ...state,
      activationCodes,
      manualActivations: [...state.manualActivations, activation],
      session: { ...state.session, pendingActivation },
    });
    return { ok: true, status: "valid", code, level: activation.level, activation: clone(activation) };
  }

  function createEntity(collection, input = {}) {
    const config = collectionConfig[collection];
    if (!config) return resultError("unknown_collection", "Cette collection n’existe pas.");
    const title = titleFrom(input);
    if (!title) return resultError("title_required", "Le titre est obligatoire.");
    const timestamp = asIso(now);
    const entity = {
      ...clone(input),
      id: createId(config.prefix),
      title,
      status: input.status || config.defaultStatus,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    };
    if (collection === "articles") entity.slug = input.slug ? slugify(input.slug) : slugify(title);
    commit({ ...state, [collection]: [entity, ...state[collection]] });
    return { ok: true, item: clone(entity) };
  }

  function updateEntity(collection, id, patch = {}) {
    if (!collectionConfig[collection]) return resultError("unknown_collection", "Cette collection n’existe pas.");
    const index = state[collection].findIndex((item) => item.id === id);
    if (index < 0) return resultError("not_found", "Élément introuvable.");
    const current = state[collection][index];
    const nextTitle = patch.title === undefined ? current.title : String(patch.title).trim();
    if (!nextTitle) return resultError("title_required", "Le titre est obligatoire.");
    const updated = {
      ...current,
      ...clone(patch),
      id: current.id,
      title: nextTitle,
      createdAt: current.createdAt,
      updatedAt: asIso(now),
    };
    if (collection === "articles" && patch.slug !== undefined) updated.slug = slugify(patch.slug);
    const nextCollection = [...state[collection]];
    nextCollection[index] = updated;
    commit({ ...state, [collection]: nextCollection });
    return { ok: true, item: clone(updated) };
  }

  function duplicateEntity(collection, id) {
    if (!collectionConfig[collection]) return resultError("unknown_collection", "Cette collection n’existe pas.");
    const original = state[collection].find((item) => item.id === id);
    if (!original) return resultError("not_found", "Élément introuvable.");
    const copyInput = {
      ...clone(original),
      title: `${original.title} (copie)`,
      status: "Brouillon",
    };
    delete copyInput.id;
    delete copyInput.createdAt;
    delete copyInput.updatedAt;
    delete copyInput.archivedAt;
    if (collection === "articles") copyInput.slug = `${slugify(original.slug || original.title)}-copie`;
    return createEntity(collection, copyInput);
  }

  function archiveEntity(collection, id) {
    return updateEntity(collection, id, { status: "Archivé", archivedAt: asIso(now) });
  }

  function deleteEntity(collection, id) {
    if (!collectionConfig[collection]) return resultError("unknown_collection", "Cette collection n’existe pas.");
    const item = state[collection].find((candidate) => candidate.id === id);
    if (!item) return resultError("not_found", "Élément introuvable.");
    commit({ ...state, [collection]: state[collection].filter((candidate) => candidate.id !== id) });
    return { ok: true, item: clone(item) };
  }

  function notify(input = {}) {
    const title = String(input.title || "").trim();
    if (!title) return resultError("title_required", "Le titre de la notification est obligatoire.");
    const notification = {
      id: createId("notification"),
      role: input.role || state.session.role || null,
      userId: input.userId || null,
      type: input.type || "information",
      title,
      message: String(input.message || "").trim(),
      read: false,
      createdAt: asIso(now),
      action: input.action || null,
    };
    commit({ ...state, notifications: [notification, ...state.notifications] });
    return { ok: true, notification: clone(notification) };
  }

  function markNotificationRead(id, read = true) {
    const notification = state.notifications.find((item) => item.id === id);
    if (!notification) return resultError("not_found", "Notification introuvable.");
    const notifications = state.notifications.map((item) => (item.id === id ? { ...item, read: Boolean(read) } : item));
    commit({ ...state, notifications });
    return { ok: true, notification: clone(notifications.find((item) => item.id === id)) };
  }

  function markAllNotificationsRead(role = state.session.role) {
    const notifications = state.notifications.map((item) =>
      !role || item.role === role ? { ...item, read: true } : item,
    );
    commit({ ...state, notifications });
    return { ok: true, role: role || null };
  }

  function removeNotification(id) {
    const notification = state.notifications.find((item) => item.id === id);
    if (!notification) return resultError("not_found", "Notification introuvable.");
    commit({ ...state, notifications: state.notifications.filter((item) => item.id !== id) });
    return { ok: true, notification: clone(notification) };
  }

  function submitAssignment(input = {}) {
    const assignmentId = String(input.assignmentId || "").trim();
    const assignmentIndex = state.assignments.findIndex((item) => item.id === assignmentId && item.status === "Publié");
    if (assignmentIndex < 0) return resultError("assignment_not_found", "Ce devoir publié est introuvable.");
    const answer = String(input.answer || "").trim();
    if (answer.length < 12) return resultError("answer_too_short", "La réponse doit contenir au moins 12 caractères.");

    const studentId = input.studentId || state.session.userId || DEMO_ACCOUNTS.eleve.userId;
    const student = state.users.find((user) => user.id === studentId && user.role === "eleve");
    if (!student) return resultError("student_not_found", "Profil élève introuvable.");
    const submittedAt = asIso(now);
    const existingIndex = state.submissions.findIndex(
      (item) => item.assignmentId === assignmentId && item.studentId === studentId,
    );
    const previous = existingIndex >= 0 ? state.submissions[existingIndex] : null;
    const submission = {
      ...(previous || {}),
      id: previous?.id || createId("remise"),
      assignmentId,
      studentId,
      studentName: student.name,
      answer,
      status: "À corriger",
      score: null,
      feedback: "",
      submittedAt,
      reviewedAt: null,
      updatedAt: submittedAt,
    };
    const submissions = [...state.submissions];
    if (existingIndex >= 0) submissions[existingIndex] = submission;
    else submissions.unshift(submission);

    const assignments = [...state.assignments];
    const assignment = assignments[assignmentIndex];
    assignments[assignmentIndex] = {
      ...assignment,
      submissions: existingIndex >= 0 ? Number(assignment.submissions || 0) : Number(assignment.submissions || 0) + 1,
      updatedAt: submittedAt,
    };
    const notification = {
      id: createId("notification"),
      role: "enseignant",
      userId: assignment.teacherId || DEMO_ACCOUNTS.enseignant.userId,
      type: "remise",
      title: "Nouvelle remise à corriger",
      message: `${student.name} a remis « ${assignment.title} ».`,
      read: false,
      createdAt: submittedAt,
      action: `/enseignant/devoirs/${assignmentId}`,
    };
    commit({ ...state, assignments, submissions, notifications: [notification, ...state.notifications] });
    return { ok: true, created: existingIndex < 0, submission: clone(submission) };
  }

  function reviewSubmission(id, input = {}) {
    const submissionIndex = state.submissions.findIndex((item) => item.id === id);
    if (submissionIndex < 0) return resultError("submission_not_found", "Remise introuvable.");
    const score = Number(input.score);
    if (!Number.isFinite(score) || score < 0 || score > 20) {
      return resultError("invalid_score", "La note doit être comprise entre 0 et 20.");
    }
    const feedback = String(input.feedback || "").trim();
    if (feedback.length < 8) return resultError("feedback_too_short", "Ajoutez un commentaire utile à l’élève.");
    const reviewedAt = asIso(now);
    const current = state.submissions[submissionIndex];
    const reviewed = { ...current, status: "Corrigé", score, feedback, reviewedAt, updatedAt: reviewedAt };
    const submissions = [...state.submissions];
    submissions[submissionIndex] = reviewed;
    const assignment = state.assignments.find((item) => item.id === current.assignmentId);
    const notification = {
      id: createId("notification"),
      role: "eleve",
      userId: current.studentId,
      type: "correction",
      title: "Ta correction est disponible",
      message: `« ${assignment?.title || "Ton devoir"} » a été corrigé : ${score}/20.`,
      read: false,
      createdAt: reviewedAt,
      action: `/eleve/devoirs/${current.assignmentId}`,
    };
    commit({ ...state, submissions, notifications: [notification, ...state.notifications] });
    return { ok: true, submission: clone(reviewed) };
  }

  function awardStudentXp(input = {}) {
    const amount = Number(input.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      return resultError("invalid_amount", "Le nombre d’XP doit être un entier positif.");
    }

    const awardId = String(input.awardId || input.eventId || "").trim();
    if (!awardId) return resultError("award_id_required", "Un identifiant de récompense est obligatoire.");

    const userId = input.userId || state.session.userId || DEMO_ACCOUNTS.eleve.userId;
    const userIndex = state.users.findIndex((user) => user.id === userId && user.role === "eleve");
    if (userIndex < 0) return resultError("student_not_found", "Profil élève introuvable.");

    const existingAward = state.quizAwards.find((award) => award.id === awardId);
    if (existingAward) {
      const currentUser = state.users[userIndex];
      return {
        ok: true,
        awarded: false,
        duplicate: true,
        amount: 0,
        totalXp: Number(currentUser.xp || 0),
        award: clone(existingAward),
      };
    }

    const awardedAt = asIso(now);
    const currentUser = state.users[userIndex];
    const updatedUser = {
      ...currentUser,
      xp: Math.max(0, Number(currentUser.xp || 0)) + amount,
    };
    const users = [...state.users];
    users[userIndex] = updatedUser;
    const award = {
      id: awardId,
      userId,
      amount,
      source: String(input.source || input.quizId || "quiz").trim() || "quiz",
      attemptId: input.attemptId || null,
      questionId: input.questionId || null,
      awardedAt,
    };

    commit({ ...state, users, quizAwards: [...state.quizAwards, award] });
    return { ok: true, awarded: true, duplicate: false, amount, totalXp: updatedUser.xp, award: clone(award) };
  }

  function recordQuizAttempt(input = {}) {
    const attemptId = String(input.attemptId || "").trim();
    if (!attemptId) return resultError("attempt_id_required", "Un identifiant de partie est obligatoire.");
    const userId = input.userId || state.session.userId || DEMO_ACCOUNTS.eleve.userId;
    const quizId = String(input.quizId || "culture-generale");
    const dailyKey = typeof input.dailyKey === "string" ? input.dailyKey.trim() : null;
    const existingAttempt = state.quizAttempts.find((attempt) => attempt.id === attemptId);
    if (existingAttempt) return { ok: true, recorded: false, duplicate: true, attempt: clone(existingAttempt) };
    const existingDailyAttempt = dailyKey
      ? state.quizAttempts.find(
        (attempt) =>
          attempt.userId === userId &&
          attempt.quizId === quizId &&
          attempt.dailyKey === dailyKey,
      )
      : null;
    if (existingDailyAttempt) {
      return { ok: true, recorded: false, duplicate: true, attempt: clone(existingDailyAttempt) };
    }

    const activeActivation = [...state.manualActivations].reverse().find((item) => item.userId === userId) || null;
    const attempt = {
      id: attemptId,
      userId,
      quizId,
      experienceType: input.experienceType ? String(input.experienceType) : null,
      dailyKey,
      category: input.category ? String(input.category) : null,
      fragmentId: input.fragmentId ? String(input.fragmentId) : null,
      fragmentLabel: input.fragmentLabel ? String(input.fragmentLabel) : null,
      assistanceLevel: input.assistanceLevel ? String(input.assistanceLevel) : null,
      masteryLabel: input.masteryLabel ? String(input.masteryLabel) : null,
      level: input.level ? String(input.level) : null,
      activationId: input.activationId || activeActivation?.id || null,
      unitId: input.unitId || "unite-3",
      lessonId: input.lessonId || "lecon-2",
      correctCount: Math.max(0, Number(input.correctCount || 0)),
      questionCount: Math.max(0, Number(input.questionCount || 0)),
      xpEarned: Math.max(0, Number(input.xpEarned || 0)),
      answerXpEarned: Math.max(0, Number(input.answerXpEarned ?? input.xpEarned ?? 0)),
      completionXp: Math.max(0, Number(input.completionXp || 0)),
      bestStreak: Math.max(0, Number(input.bestStreak || 0)),
      scorePercent: Math.max(0, Math.min(100, Number(input.scorePercent || 0))),
      completedAt: asIso(now),
    };
    const progressIndex = state.manualProgress.findIndex(
      (item) => item.userId === userId && item.activationId === attempt.activationId && item.unitId === attempt.unitId,
    );
    const currentProgress = progressIndex >= 0 ? state.manualProgress[progressIndex] : null;
    const progress = {
      ...(currentProgress || {}),
      id: currentProgress?.id || createId("progression"),
      activationId: attempt.activationId,
      userId,
      unitId: attempt.unitId,
      lessonId: attempt.lessonId,
      percent: Math.min(100, Math.max(0, currentProgress ? Number(currentProgress.percent || 0) : 0) + 10),
      completedActivities: Number(currentProgress?.completedActivities || 0) + 1,
      updatedAt: attempt.completedAt,
    };
    const manualProgress = [...state.manualProgress];
    if (progressIndex >= 0) manualProgress[progressIndex] = progress;
    else manualProgress.unshift(progress);
    commit({ ...state, quizAttempts: [attempt, ...state.quizAttempts], manualProgress });
    return { ok: true, recorded: true, duplicate: false, attempt: clone(attempt) };
  }

  function createClassChallenge(input = {}) {
    const title = String(input.title || "").trim();
    const classId = String(input.classId || "").trim();
    const classLabel = String(input.classLabel || "").trim();
    const level = String(input.level || "").trim();
    const theme = String(input.theme || "").trim();
    const bankId = String(input.bankId || "").trim();
    const bankLabel = String(input.bankLabel || "").trim();
    const durationHours = Number(input.durationHours);
    const questionIds = [...new Set(Array.isArray(input.questionIds) ? input.questionIds.map((id) => String(id).trim()).filter(Boolean) : [])];
    if (title.length < 5 || title.length > 80) return resultError("invalid_title", "Le titre du défi doit contenir entre 5 et 80 caractères.");
    if (!classId || !classLabel || !level || !theme) return resultError("missing_scope", "La classe, le niveau et le thème sont obligatoires.");
    if (input.bankStatus !== "publie" || !bankId || !bankLabel) return resultError("unpublished_bank", "Une banque publiée est obligatoire.");
    if (!CLASS_CHALLENGE_DURATIONS.some((duration) => duration.hours === durationHours)) return resultError("invalid_duration", "La durée du défi est invalide.");
    if (questionIds.length < CLASS_CHALLENGE_QUESTION_COUNT) return resultError("not_enough_questions", "Le défi requiert au moins cinq questions publiées.");

    const startAt = asIso(now);
    const endAt = new Date(new Date(startAt).getTime() + durationHours * 3_600_000).toISOString();
    const challenge = {
      id: createId("defi-classe"),
      title,
      classId,
      classLabel,
      level,
      theme,
      bankId,
      bankLabel,
      bankStatus: "publie",
      durationHours,
      questionIds: questionIds.slice(0, CLASS_CHALLENGE_QUESTION_COUNT),
      status: "en_cours",
      startAt,
      endAt,
      createdAt: startAt,
    };
    const notification = classId === "classe-5a" ? {
      id: createId("notification"),
      role: "eleve",
      userId: DEMO_ACCOUNTS.eleve.userId,
      type: "defi-classe",
      title: "Nouveau défi de classe",
      message: `« ${title} » est ouvert pour ${classLabel}.`,
      read: false,
      createdAt: startAt,
      action: "/eleve/jeux/defis-classe",
    } : null;
    commit({
      ...state,
      classChallenges: [challenge, ...state.classChallenges],
      notifications: notification ? [notification, ...state.notifications] : state.notifications,
    });
    return { ok: true, challenge: clone(challenge) };
  }

  function finishClassChallenge(challengeId) {
    const id = String(challengeId || "").trim();
    const index = state.classChallenges.findIndex((challenge) => challenge.id === id);
    if (index < 0) return resultError("challenge_not_found", "Défi introuvable.");
    const current = state.classChallenges[index];
    if (current.status === "termine") return { ok: true, updated: false, challenge: clone(current) };
    const challenge = { ...current, status: "termine", endAt: asIso(now), updatedAt: asIso(now) };
    const classChallenges = [...state.classChallenges];
    classChallenges[index] = challenge;
    commit({ ...state, classChallenges });
    return { ok: true, updated: true, challenge: clone(challenge) };
  }

  function recordClassChallengeResult(input = {}) {
    const challengeId = String(input.challengeId || "").trim();
    const participantId = String(input.participantId || "").trim();
    const pseudonym = String(input.pseudonym || "").trim();
    const challenge = state.classChallenges.find((item) => item.id === challengeId);
    if (!challenge) return resultError("challenge_not_found", "Défi introuvable.");
    if (!participantId) return resultError("participant_required", "Le participant pseudonymisé est obligatoire.");
    if (!isSafeClassPseudonym(pseudonym)) return resultError("unsafe_pseudonym", "Ce pseudonyme ne respecte pas la liste non identifiante.");
    const existing = state.classChallengeResults.find(
      (item) => item.challengeId === challengeId && item.participantId === participantId && item.status === "termine",
    );
    if (existing) return { ok: true, recorded: false, duplicate: true, result: clone(existing) };

    const score = calculateClassChallengeScore(input.correctCount, challenge.questionIds.length);
    const result = {
      id: `${challengeId}:${participantId}`,
      challengeId,
      participantId,
      pseudonym,
      classId: challenge.classId,
      status: "termine",
      correctCount: score.correctCount,
      questionCount: score.questionCount,
      score: score.score,
      scorePercent: score.scorePercent,
      progressPercent: 100,
      xpEarned: Math.max(0, Number(input.xpEarned) || 0),
      completedAt: asIso(now),
    };
    commit({ ...state, classChallengeResults: [result, ...state.classChallengeResults] });
    return { ok: true, recorded: true, duplicate: false, result: clone(result) };
  }

  function reset() {
    safeStorage.removeItem(storageKey);
    const initialState = createInitialDemoState(now());
    commit(initialState);
    return { ok: true, state: clone(state) };
  }

  const actions = Object.freeze({
    signIn,
    signOut,
    activateCode,
    createAssignment: (input) => createEntity("assignments", input),
    updateAssignment: (id, patch) => updateEntity("assignments", id, patch),
    duplicateAssignment: (id) => duplicateEntity("assignments", id),
    archiveAssignment: (id) => archiveEntity("assignments", id),
    deleteAssignment: (id) => deleteEntity("assignments", id),
    createContent: (input) => createEntity("contents", input),
    updateContent: (id, patch) => updateEntity("contents", id, patch),
    duplicateContent: (id) => duplicateEntity("contents", id),
    archiveContent: (id) => archiveEntity("contents", id),
    deleteContent: (id) => deleteEntity("contents", id),
    createArticle: (input) => createEntity("articles", input),
    updateArticle: (id, patch) => updateEntity("articles", id, patch),
    duplicateArticle: (id) => duplicateEntity("articles", id),
    archiveArticle: (id) => archiveEntity("articles", id),
    deleteArticle: (id) => deleteEntity("articles", id),
    notify,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    submitAssignment,
    reviewSubmission,
    awardStudentXp,
    recordQuizAttempt,
    createClassChallenge,
    finishClassChallenge,
    recordClassChallengeResult,
    reset,
  });

  persist();

  return Object.freeze({
    getState,
    subscribe,
    actions,
    storage: safeStorage,
    storageKey,
  });
}
