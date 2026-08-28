import {
  LEVELS,
  SCORE_CRITERIA,
  LANGUAGE_CRITERIA,
  TWISTS,
  assignmentChooserForRound,
  buildDeck,
  buildPhases,
  cardsForSelection,
  calculateRound,
  decideWinner,
  durationForPhase,
  isScoreEmpty,
  validateCardSet,
} from "./game-logic.mjs";

const integrationParams = new URLSearchParams(window.location.search);
const integrationAudience = integrationParams.get("audience");
const integrationEmbedded = integrationParams.get("embedded") === "1" && window.parent !== window;
const integrationChannel = String(integrationParams.get("channel") || "");
const integrationEnabled = integrationEmbedded &&
  ["eleve", "enseignant"].includes(integrationAudience) &&
  /^[a-z0-9-]{8,96}$/i.test(integrationChannel);
const integrationTargetOrigin = window.location.origin;
const storageScope = ["eleve", "enseignant"].includes(integrationAudience) ? `-${integrationAudience}` : "";
const SESSION_KEY = `projet-debat-v01-session${storageScope}`;
const PREFS_KEY = `projet-debat-v01-preferences${storageScope}`;
const CARDS_CACHE_KEY = "projet-debat-v01-cards";
const APP_VERSION = 8;
const INTEGRATION_SOURCE = "jet-dencre.projet-debat";
const INTEGRATION_VERSION = 1;
const INTEGRATION_XP_PER_ROUND = 10;
const QUICK_SCORE_IDS = ["d1", "d3", "d4"];
const HELP_LABELS = ["Indice / image", "Piste / amorce", "Phrase de secours"];
const HELP_FIELDS = ["indice_leger", "piste_thematique", "argument_complet_de_secours"];
const CONNECTORS = {
  1: ["parce que", "mais"],
  2: ["par exemple", "donc"],
  3: ["cependant", "en revanche"],
  4: ["néanmoins", "à condition que"],
};
const SCHOOL_LEVELS = [
  { code: "GENERAL", label: "Parcours général", short: "Général", detail: "6–12 ans" },
  { code: "4AP", label: "4e AP · CM1", short: "4e AP", detail: "9–10 ans" },
  { code: "5AP", label: "5e AP · CM2", short: "5e AP", detail: "10–11 ans" },
  { code: "6AP", label: "6e AP", short: "6e AP", detail: "11–12 ans" },
];
const THEME_ILLUSTRATIONS = [
  { match: ["forêt", "foret", "environnement", "eau", "animaux", "nature"], src: "assets/illustrations/theme-foret-bancs.webp" },
  { match: ["école", "ecole", "lecture", "livre", "média", "media", "information", "culture"], src: "assets/illustrations/theme-bibliotheque.webp" },
  { match: ["voyage", "tourisme", "patrimoine", "transport", "chemin", "territoire"], src: "assets/illustrations/theme-chemin.webp" },
  { match: ["commerce", "marché", "marche", "économie", "economie", "solidarité", "solidarite", "coopération", "cooperation"], src: "assets/illustrations/theme-marche.webp" },
];
const DEFAULT_THEME_ILLUSTRATION = "assets/illustrations/theme-quartier.webp";
const THEME_ILLUSTRATION_ALTS = {
  "assets/illustrations/theme-foret-bancs.webp": "Forêt marocaine avec un sentier et des bancs.",
  "assets/illustrations/theme-bibliotheque.webp": "Bibliothèque scolaire marocaine avec des enfants qui lisent.",
  "assets/illustrations/theme-chemin.webp": "Chemin marocain illustrant le voyage et le patrimoine.",
  "assets/illustrations/theme-marche.webp": "Marché marocain animé avec des habitants et des commerçants.",
  "assets/illustrations/theme-quartier.webp": "Quartier marocain où se déroule une situation de débat.",
};

const app = document.querySelector("#app");
const headerStatus = document.querySelector("#headerStatus");
const teacherDeskTrigger = document.querySelector("#teacherDeskTrigger");
const liveRegion = document.querySelector("#liveRegion");
const toast = document.querySelector("#toast");

let allCards = [];
let timerHandle = null;
let recoveryHandle = null;
let toastHandle = null;
let announceHandle = null;
let announceClearHandle = null;
let audioContextKey = "";

const defaultPreferences = {
  schoolLevel: "GENERAL",
  level: 1,
  mode: "duel",
  teamSize: 2,
  rounds: 2,
  twistEnabled: false,
  accessMode: "adult-audio",
  themeFilter: "all",
  sensitivityFilter: "all",
  scoreMode: "quick",
  displayMode: "projection",
  playerAName: "Joueur A",
  playerBName: "Joueur B",
};

const state = {
  version: APP_VERSION,
  screen: "setup",
  settings: loadPreferences(),
  round: 0,
  deck: [],
  playedCardIds: [],
  skippedCardIds: [],
  passUsed: { A: false, B: false },
  cardId: null,
  assignments: null,
  starter: null,
  starterChooser: null,
  previousStarter: null,
  helps: { pour: 0, contre: 0 },
  phases: [],
  phaseIndex: 0,
  timer: { phaseKey: "", initial: 0, remaining: 0, running: false, started: false, expired: false },
  twist: null,
  twistHistory: [],
  twistSkipped: false,
  score: null,
  recoveryUsed: { A: false, B: false },
  recoveryAwarded: { A: null, B: null },
  recoveryTimer: { side: null, remaining: 0, stage: "idle", paused: false },
  history: [],
  totals: emptyTotals(),
  lastStep: null,
  integrationAttemptId: null,
  integrationCompletionSent: false,
  ui: { teacherDeskOpen: false, setupAdvancedOpen: false },
};

function emptyTotals() {
  return {
    A: { base: 0, twist: 0, language: 0, interaction: 0 },
    B: { base: 0, twist: 0, language: 0, interaction: 0 },
  };
}

function captureLastStep() {
  const snapshot = JSON.parse(JSON.stringify(state));
  snapshot.lastStep = null;
  snapshot.timer.running = false;
  state.lastStep = snapshot;
}

function undoLastStep() {
  if (!state.lastStep) {
    showToast("Aucune étape précédente disponible.");
    return;
  }
  stopTimer();
  stopRecoveryTimer();
  stopAudio();
  const snapshot = state.lastStep;
  Object.assign(state, snapshot);
  state.lastStep = null;
  state.timer.running = false;
  persistSession();
  render(true);
  announce("Retour à l’étape précédente.");
}

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    return { ...defaultPreferences, ...(saved || {}) };
  } catch {
    return { ...defaultPreferences };
  }
}

function savePreferences() {
  const safePreferences = {
    schoolLevel: state.settings.schoolLevel,
    level: state.settings.level,
    mode: state.settings.mode,
    teamSize: state.settings.teamSize,
    rounds: state.settings.rounds,
    twistEnabled: state.settings.twistEnabled,
    accessMode: state.settings.accessMode,
    themeFilter: state.settings.themeFilter,
    sensitivityFilter: state.settings.sensitivityFilter,
    scoreMode: state.settings.scoreMode,
    displayMode: state.settings.displayMode,
    playerAName: state.settings.playerAName,
    playerBName: state.settings.playerBName,
  };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(safePreferences));
  } catch {
    // Le jeu reste entièrement jouable en mémoire si le stockage est indisponible.
  }
}

function persistSession() {
  try {
    if (state.screen === "setup") {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    const snapshot = JSON.parse(JSON.stringify(state));
    snapshot.timer.running = false;
    snapshot.ui = { ...(snapshot.ui || {}), teacherDeskOpen: false };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
  } catch {
    // La sauvegarde locale est un confort, jamais une condition pour jouer.
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Aucun blocage si le navigateur interdit le stockage local.
  }
}

function restoreSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (!saved || saved.version !== APP_VERSION || !saved.screen) return false;
    Object.assign(state, saved);
    state.ui = {
      teacherDeskOpen: false,
      setupAdvancedOpen: Boolean(saved.ui && saved.ui.setupAdvancedOpen),
    };
    state.timer.running = false;
    state.timer.started = Boolean(state.timer.started);
    state.recoveryTimer = { paused: false, ...state.recoveryTimer };
    if (state.cardId && !allCards.some((card) => card.identifiant === state.cardId)) return false;
    return true;
  } catch {
    clearSession();
    return false;
  }
}

function normalizeCards(cards) {
  return cards.map((source) => {
    const card = JSON.parse(JSON.stringify(source));
    card.code_niveau_scolaire = card.code_niveau_scolaire || "GENERAL";
    card.theme_programme = card.theme_programme || card.categorie;
    if (card.identifiant === "ECO-01") {
      card.question_centrale = "Faut-il supprimer les devoirs à la maison ?";
    }
    if (card.identifiant === "CIT-01") {
      const argumentsPour = card.arguments.pour;
      card.arguments.pour = card.arguments.contre;
      card.arguments.contre = argumentsPour;
      const aidesPour = card.aides.pour;
      card.aides.pour = card.aides.contre;
      card.aides.contre = aidesPour;
    }
    return card;
  });
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getLevel() {
  return LEVELS.find((level) => level.id === Number(state.settings.level)) || LEVELS[0];
}

function getSchool() {
  return SCHOOL_LEVELS.find((school) => school.code === String(state.settings.schoolLevel)) || SCHOOL_LEVELS[0];
}

function availableLevelIds(schoolCode = state.settings.schoolLevel) {
  return LEVELS
    .filter((level) => allCards.some((card) => card.code_niveau_scolaire === schoolCode && Number(card.niveau) === level.id))
    .map((level) => level.id);
}

function ensureSupportedSelection() {
  if (!SCHOOL_LEVELS.some((school) => school.code === state.settings.schoolLevel)) {
    state.settings.schoolLevel = "GENERAL";
  }
  const available = availableLevelIds();
  if (!available.includes(Number(state.settings.level))) {
    state.settings.level = available[0] || 1;
    state.settings.rounds = state.settings.level === 1 ? 2 : 3;
    state.settings.twistEnabled = state.settings.level !== 1;
  }
  if (!["quick", "full"].includes(state.settings.scoreMode)) state.settings.scoreMode = "quick";
  if (!["teacher", "projection"].includes(state.settings.displayMode)) state.settings.displayMode = "teacher";
  state.settings.playerAName = String(state.settings.playerAName || "Joueur A").slice(0, 24);
  state.settings.playerBName = String(state.settings.playerBName || "Joueur B").slice(0, 24);
  if (!["all", "low"].includes(state.settings.sensitivityFilter)) state.settings.sensitivityFilter = "all";
  if (!themesForSchool().includes(state.settings.themeFilter)) state.settings.themeFilter = "all";
  const safeCards = cardsForSelection(allCards, {
    level: state.settings.level,
    schoolLevel: state.settings.schoolLevel,
    sensitivity: "low",
  });
  if (state.settings.sensitivityFilter === "low" && safeCards.length < state.settings.rounds) {
    state.settings.sensitivityFilter = "all";
  }
  if (state.settings.themeFilter !== "all") {
    const themeAvailable = cardsForSelection(allCards, {
      level: state.settings.level,
      schoolLevel: state.settings.schoolLevel,
      sensitivity: state.settings.sensitivityFilter,
    }).some((card) => String(card.theme_programme || card.categorie) === state.settings.themeFilter);
    if (!themeAvailable) state.settings.themeFilter = "all";
  }
}

function themesForSchool() {
  const cards = allCards.filter((card) => card.code_niveau_scolaire === state.settings.schoolLevel);
  const themes = new Map();
  for (const card of cards) {
    const label = String(card.theme_programme || card.categorie || "Autre");
    const order = Number(card.unite_programme) || 99;
    if (!themes.has(label) || order < themes.get(label)) themes.set(label, order);
  }
  return [...themes.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], "fr")).map(([label]) => label);
}

function availableCardsForSettings() {
  return cardsForSelection(allCards, {
    level: state.settings.level,
    schoolLevel: state.settings.schoolLevel,
    sensitivity: state.settings.sensitivityFilter,
  });
}

function activeScoreCriteria() {
  return state.settings.scoreMode === "full"
    ? SCORE_CRITERIA
    : SCORE_CRITERIA.filter((criterion) => QUICK_SCORE_IDS.includes(criterion.id));
}

function maxDebateScore() {
  return activeScoreCriteria().length;
}

function assignmentChooser() {
  return assignmentChooserForRound(state.settings.level, state.round);
}

function currentCard() {
  return allCards.find((card) => card.identifiant === state.cardId) || null;
}

function sideName(side) {
  const custom = String(side === "A" ? state.settings.playerAName : state.settings.playerBName).trim();
  const defaultPlayerName = "Joueur " + side;
  if (custom && !(state.settings.mode === "teams" && custom === defaultPlayerName)) return custom;
  return state.settings.mode === "teams" ? "Équipe " + side : "Joueur " + side;
}

function normalizeThemeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesThemeTerm(source, term) {
  const normalizedTerm = normalizeThemeText(term);
  return normalizedTerm && (" " + source + " ").includes(" " + normalizedTerm + " ");
}

function illustrationForCard(card) {
  if (!card) return DEFAULT_THEME_ILLUSTRATION;
  if (card.identifiant === "P4-U5-A1") return "assets/illustrations/theme-foret-bancs.webp";
  const source = normalizeThemeText([card.theme_programme, card.categorie, card.titre, card.brief_illustration].join(" "));
  const match = THEME_ILLUSTRATIONS.find((entry) => entry.match.some((term) => matchesThemeTerm(source, term)));
  return match ? match.src : DEFAULT_THEME_ILLUSTRATION;
}

function illustrationAlt(card) {
  return THEME_ILLUSTRATION_ALTS[illustrationForCard(card)] || "Illustration du thème de la carte de débat.";
}

function avatarForSide(side) {
  return side === "B" ? "assets/illustrations/avatar-b.webp" : "assets/illustrations/avatar-a.webp";
}

function childPhaseLabel(phase) {
  if (!phase || phase.kind === "prepare") return "Je prépare mon idée";
  if (phase.action === "Affirmer") return "Je donne mon avis";
  if (phase.kind === "adapt") return "Je change et j’améliore mon idée";
  return "J’écoute et je réponds";
}

function teamSize() {
  const size = Number(state.settings.teamSize);
  return [2, 3, 4].includes(size) ? size : 2;
}

function spokespersonLabel() {
  const position = ((Math.max(1, state.round) - 1) % teamSize()) + 1;
  return "Porte-parole " + position + " sur " + teamSize();
}

function otherSide(side) {
  return side === "A" ? "B" : "A";
}

function positionForSide(side, phase = null) {
  if (!state.assignments) return "pour";
  let position = state.assignments[side];
  if (phase && phase.kind === "adapt" && state.twist && state.twist.title === "Change de camp") {
    position = position === "pour" ? "contre" : "pour";
  }
  return position;
}

function positionTitle(position) {
  return position === "pour" ? "Position 1" : "Position 2";
}

function campText(card, position) {
  return position === "pour" ? card.camp_pour : card.camp_contre;
}

function titleCase(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function announce(message) {
  window.clearTimeout(announceHandle);
  window.clearTimeout(announceClearHandle);
  liveRegion.textContent = "";
  announceHandle = window.setTimeout(() => {
    liveRegion.textContent = message;
    announceClearHandle = window.setTimeout(() => {
      liveRegion.textContent = "";
    }, 5000);
  }, 40);
}

function showToast(message) {
  window.clearTimeout(toastHandle);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastHandle = window.setTimeout(() => toast.classList.remove("is-visible"), 3000);
}

function createIntegrationAttemptId() {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `projet-debat:${integrationAudience || "autonome"}:${suffix}`;
}

function emitIntegrationEvent(type, payload = {}) {
  if (!integrationEnabled) return;
  window.parent.postMessage({
    source: INTEGRATION_SOURCE,
    version: INTEGRATION_VERSION,
    type,
    audience: integrationAudience,
    channel: integrationChannel,
    payload,
  }, integrationTargetOrigin);
}

function integrationTotals() {
  return {
    A: state.totals.A.base + state.totals.A.twist,
    B: state.totals.B.base + state.totals.B.twist,
    interactionA: state.totals.A.interaction,
    interactionB: state.totals.B.interaction,
  };
}

function emitIntegrationCompletion() {
  if (!integrationEnabled || state.integrationCompletionSent || !state.integrationAttemptId) return;
  const totals = integrationTotals();
  const winner = decideWinner(totals.A, totals.B, totals.interactionA, totals.interactionB);
  const xpEarned = integrationAudience === "eleve"
    ? state.history.length * INTEGRATION_XP_PER_ROUND
    : 0;
  state.integrationCompletionSent = true;
  persistSession();

  if (xpEarned > 0) {
    emitIntegrationEvent("xp-earned", {
      amount: xpEarned,
      eventId: `${state.integrationAttemptId}:completion`,
      attemptId: state.integrationAttemptId,
      roundsCompleted: state.history.length,
    });
  }
  emitIntegrationEvent("game-completed", {
    attemptId: state.integrationAttemptId,
    roundsCompleted: state.history.length,
    winner,
    totals,
    xpEarned,
    level: getLevel().code,
    schoolLevel: state.settings.schoolLevel,
  });
}

function focusScreenTitle(resetScroll = true) {
  window.requestAnimationFrame(() => {
    const title = app.querySelector("[data-screen-title]");
    if (resetScroll) window.scrollTo(0, 0);
    if (title) title.focus({ preventScroll: true });
  });
}

function updateHeader() {
  const gameActive = !["setup", "rules"].includes(state.screen);
  const deskAvailable = state.settings.displayMode === "projection" && ["reveal", "phase", "score"].includes(state.screen);
  document.body.classList.toggle("is-game-active", gameActive);
  document.body.classList.toggle("projection-mode", state.settings.displayMode === "projection");
  document.body.classList.toggle("teacher-desk-open", deskAvailable && state.ui.teacherDeskOpen);
  teacherDeskTrigger.hidden = !deskAvailable;
  teacherDeskTrigger.setAttribute("aria-expanded", String(deskAvailable && state.ui.teacherDeskOpen));
  if (state.screen === "setup" || state.screen === "rules") {
    headerStatus.innerHTML = "";
    return;
  }
  const level = getLevel();
  const roundText = state.round ? " · " + state.round + "/" + state.settings.rounds : "";
  headerStatus.innerHTML = '<span class="header-session">' + esc(getSchool().short + " · " + level.code + roundText) + "</span>";
}

function render(focus = false) {
  const activeControl = !focus && document.activeElement instanceof HTMLElement
    ? document.activeElement.closest("[data-action]")
    : null;
  const focusSnapshot = activeControl
    ? Object.fromEntries(["action", "value", "side", "group"].map((key) => [key, activeControl.dataset[key] || ""]))
    : null;
  const nextAudioContextKey = [state.screen, state.cardId || "", state.phaseIndex || 0].join(":");
  if (audioContextKey && audioContextKey !== nextAudioContextKey) stopAudio();
  audioContextKey = nextAudioContextKey;
  state.ui = { teacherDeskOpen: false, setupAdvancedOpen: false, ...(state.ui || {}) };
  updateHeader();
  if (state.screen === "setup") app.innerHTML = renderSetup();
  else if (state.screen === "rules") app.innerHTML = renderRules();
  else if (state.screen === "reveal") app.innerHTML = state.settings.displayMode === "projection" ? renderProjectionReveal() : renderReveal();
  else if (state.screen === "phase") app.innerHTML = state.settings.displayMode === "projection" ? renderProjectionPhase() : renderPhase();
  else if (state.screen === "score") app.innerHTML = state.settings.displayMode === "projection" ? renderProjectionScore() : renderScore();
  else if (state.screen === "roundResult") app.innerHTML = renderRoundResult();
  else if (state.screen === "summary") app.innerHTML = renderSummary();
  if (state.settings.displayMode === "projection" && ["reveal", "phase", "score"].includes(state.screen)) {
    app.insertAdjacentHTML("beforeend", renderTeacherDesk());
    if (state.ui.teacherDeskOpen) {
      const projection = app.querySelector(".projection-stage");
      projection?.setAttribute("inert", "");
      projection?.setAttribute("aria-hidden", "true");
    }
  }
  if (state.screen === "phase") updateTimerDisplay();
  if (focus) focusScreenTitle(true);
  else if (focusSnapshot) {
    window.requestAnimationFrame(() => {
      const focusRoot = state.ui.teacherDeskOpen ? app.querySelector("#teacherDesk") : app;
      const nextControl = [...focusRoot.querySelectorAll("[data-action]")].find((element) =>
        ["action", "value", "side", "group"].every((key) => (element.dataset[key] || "") === focusSnapshot[key])
      );
      if (nextControl && !nextControl.disabled) {
        nextControl.focus({ preventScroll: true });
        return;
      }
      if (focusSnapshot.action === "reveal-help") {
        focusRoot.querySelector('[data-help-position="' + focusSnapshot.value + '"]')?.focus({ preventScroll: true });
        return;
      }
      if (focusSnapshot.action === "toggle-recovery") {
        focusRoot.querySelector('[data-action="recovery-pause"]')?.focus({ preventScroll: true });
        return;
      }
      if (state.ui.teacherDeskOpen) {
        focusRoot.querySelector('[data-action="close-teacher-desk"]')?.focus({ preventScroll: true });
        return;
      }
      const successorSelector = {
        "choose-assignment": '[data-action="begin-prep"]',
        "change-assignment": '[data-action="choose-assignment"]',
        "set-starter": '[data-action="begin-prep"]',
      }[focusSnapshot.action];
      if (successorSelector) {
        const successor = app.querySelector(successorSelector);
        if (successor && !successor.disabled) {
          successor.focus({ preventScroll: true });
          return;
        }
      }
      focusRoot.querySelector('[data-action]:not(:disabled)')?.focus({ preventScroll: true });
    });
  }
}

function renderSetup() {
  const selectedLevel = getLevel();
  const selectedSchool = getSchool();
  const availableLevels = availableLevelIds();
  const schoolButtons = SCHOOL_LEVELS.map((school) => {
    const selected = school.code === selectedSchool.code;
    return '<button type="button" class="school-choice ' + (selected ? "is-selected" : "") +
      '" data-action="select-school" data-value="' + school.code + '" data-radio-group="school" role="radio" aria-checked="' + selected +
      '" tabindex="' + (selected ? "0" : "-1") + '">' +
      '<strong>' + esc(school.label) + '</strong><small>' + esc(school.detail) + '</small><span class="check" aria-hidden="true">✓</span></button>';
  }).join("");
  const levelButtons = LEVELS.map((level) => {
    const selected = level.id === Number(state.settings.level);
    const available = availableLevels.includes(level.id);
    return (
      '<button type="button" class="level-choice ' + (selected ? "is-selected" : "") +
      '" data-action="select-level" data-value="' + level.id + '" data-radio-group="level" role="radio" aria-checked="' + selected +
      '" tabindex="' + (selected ? "0" : "-1") + '" aria-describedby="levelAvailabilityHelp" ' + (available ? "" : "disabled") + '>' +
      '<span class="level-code">' + esc(level.code) + "</span>" +
      "<span><strong>" + esc(level.name) + "</strong><small>" + esc(level.mission) + "</small></span>" +
      '<span class="check" aria-hidden="true">✓</span></button>'
    );
  }).join("");
  const themes = themesForSchool();
  const themeChips = themes.map((theme) => '<span>' + esc(titleCase(theme)) + '</span>').join("");
  const selectableCards = availableCardsForSettings();
  const themeOptions = ['<option value="all">Tous les thèmes · tirage surprise</option>'].concat(themes.map((theme) => {
    const available = selectableCards.some((card) => String(card.theme_programme || card.categorie) === theme);
    return '<option value="' + esc(theme) + '" ' + (state.settings.themeFilter === theme ? "selected" : "") +
      (available ? "" : " disabled") + '>' + esc(titleCase(theme)) + (available ? "" : " · indisponible") + "</option>";
  })).join("");
  const lowRiskCount = cardsForSelection(allCards, {
    level: state.settings.level,
    schoolLevel: state.settings.schoolLevel,
    sensitivity: "low",
  }).length;
  const cardCount = availableCardsForSettings().length;
  const canStart = cardCount >= state.settings.rounds;
  const selectedThemeNote = state.settings.themeFilter === "all"
    ? "La première carte sera tirée au hasard."
    : "La première carte privilégiera ce thème, puis le paquet restera varié.";
  const twistNote = selectedLevel.id === 1
    ? "Pour une première partie A1, gardez le Twist désactivé. Il pourra être ajouté ensuite."
    : "Un seul Twist commun sera proposé après les deux réponses.";
  const teamSizeControls = state.settings.mode === "teams"
    ? '<div class="team-size-row"><small>Joueurs par équipe</small><div class="team-size-segmented" role="group" aria-label="Nombre de joueurs par équipe">' +
      [2, 3, 4].map((size) => optionButton("select-team-size", String(size), String(size), teamSize() === size)).join("") +
      "</div><p>Le porte-parole changera automatiquement à chaque manche.</p></div>"
    : "";
  const preset = currentPreset();
  const advancedOpen = Boolean(state.ui.setupAdvancedOpen);
  return (
    '<section class="setup-page">' +
      '<div class="hero-panel">' +
        '<div class="eyebrow"><span></span> Jeu oral évolutif · 6–12 ans</div>' +
        '<h1 tabindex="-1" data-screen-title>Choisis ton camp.<br><em>Fais vivre le débat.</em></h1>' +
        "<p>Des situations proches du quotidien et du programme marocain pour apprendre à défendre une idée, écouter l’autre et construire une réponse en français.</p>" +
        '<div class="hero-pills" aria-label="Caractéristiques principales"><span>74 cartes</span><span>18 thèmes officiels</span><span>2 joueurs ou 2 équipes</span></div>' +
        '<img class="hero-illustration" src="assets/illustrations/welcome-debat.webp" alt="Livre ouvert, plume et bulles de parole pour lancer un débat.">' +
        '<div class="progression-ribbon"><b>A1</b><i></i><b>A2</b><i></i><b>B1</b><i></i><b>B2</b></div>' +
      "</div>" +
      '<div class="setup-card ' + (advancedOpen ? "is-advanced" : "") + '">' +
        '<div class="step-label setup-school-step"><span>1</span> Choisir la classe ou le parcours</div>' +
        '<div class="school-grid" role="radiogroup" aria-label="Classe ou parcours">' + schoolButtons + '</div>' +
        '<div class="theme-preview setup-advanced-item"><small>Thèmes de ce parcours</small><div>' + themeChips + '</div></div>' +
        '<div class="setup-filters setup-advanced-item"><label class="filter-field" for="themeFilter"><span>Thème de départ</span><select id="themeFilter" data-setting="theme-filter">' +
          themeOptions + '</select><small>' + esc(selectedThemeNote) + '</small></label>' +
          '<label class="filter-field" for="sensitivityFilter"><span>Sensibilité des sujets</span><select id="sensitivityFilter" data-setting="sensitivity-filter">' +
            '<option value="all" ' + (state.settings.sensitivityFilter === "all" ? "selected" : "") + '>Tous les sujets</option>' +
            '<option value="low" ' + (state.settings.sensitivityFilter === "low" ? "selected" : "") + ' ' + (lowRiskCount < state.settings.rounds ? "disabled" : "") +
            '>Sujets légers uniquement · ' + lowRiskCount + ' cartes</option></select><small>' +
            (lowRiskCount < state.settings.rounds ? "Pas assez de sujets légers pour cette partie." : "Les sujets modérés seront retirés du paquet.") +
          '</small></label></div>' +
        '<div class="setup-section setup-level-section"><div class="step-label compact"><span>2</span> Choisir le palier oral</div>' +
        '<div class="level-grid" role="radiogroup" aria-label="Palier oral" aria-describedby="levelAvailabilityHelp">' + levelButtons + "</div>" +
        '<p id="levelAvailabilityHelp" class="setup-help">Les options grisées ne disposent pas encore de cartes pour ce parcours.</p>' +
        '</div>' +
        '<div class="setup-section setup-preset-section"><div class="step-label compact"><span>3</span> Lancer rapidement la séance</div>' +
          '<div class="preset-grid" role="group" aria-label="Préréglage de séance">' +
            '<button type="button" class="preset-card ' + (preset === "express" ? "is-selected" : "") + '" data-action="select-preset" data-value="express" aria-pressed="' + (preset === "express") + '"><strong>Partie express</strong><small>10 min · duel · score essentiel</small></button>' +
            '<button type="button" class="preset-card ' + (preset === "complete" ? "is-selected" : "") + '" data-action="select-preset" data-value="complete" aria-pressed="' + (preset === "complete") + '"><strong>Séance complète</strong><small>20–30 min · équipes · débat guidé</small></button>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="advanced-toggle" data-action="toggle-advanced" aria-expanded="' + advancedOpen + '" aria-controls="advancedSettings">' +
          (advancedOpen ? "Masquer les options de l’enseignant" : "Options de l’enseignant") + '</button>' +
        '<div id="advancedSettings" class="setup-section setup-format-section setup-advanced-item"><span class="setup-section-title">Réglages personnalisés</span>' +
          '<div class="segmented" role="group" aria-label="Mode de jeu">' +
            optionButton("select-mode", "duel", "Duel", state.settings.mode === "duel") +
            optionButton("select-mode", "teams", "Équipes", state.settings.mode === "teams") +
          "</div>" +
          teamSizeControls +
          '<div class="format-row"><fieldset class="setup-fieldset"><legend>Nombre de manches</legend><div class="mini-segmented" role="group" aria-label="Nombre de manches">' +
            roundButton(2, selectedLevel.rounds.includes(2)) +
            roundButton(3, selectedLevel.rounds.includes(3)) +
          '</div><small>' + (selectedLevel.rounds.includes(2) ? "Choisissez deux ou trois manches." : "Ce palier se joue en trois manches.") + '</small></fieldset>' +
          '<fieldset class="setup-fieldset"><legend>Accès au texte</legend><div class="mini-segmented" role="group" aria-label="Accès au texte">' +
            optionButton("select-access", "adult-audio", "Adulte / audio", state.settings.accessMode === "adult-audio") +
            optionButton("select-access", "reader", "Lecture autonome", state.settings.accessMode === "reader") +
          '</div><small>La lecture audio reste disponible pendant le débat.</small></fieldset></div>' +
          '<div class="format-row"><fieldset class="setup-fieldset"><legend>Grille d’évaluation</legend><div class="mini-segmented" role="group" aria-label="Grille d’évaluation">' +
            optionButton("select-score-mode", "quick", "Essentielle · 3", state.settings.scoreMode === "quick") +
            optionButton("select-score-mode", "full", "Complète · 5", state.settings.scoreMode === "full") +
          '</div><small>La grille essentielle réduit la charge de l’enseignant.</small></fieldset>' +
          '<fieldset class="setup-fieldset"><legend>Affichage</legend><div class="mini-segmented" role="group" aria-label="Affichage de la séance">' +
            optionButton("select-display-mode", "teacher", "Enseignant", state.settings.displayMode === "teacher") +
            optionButton("select-display-mode", "projection", "Projection enfant", state.settings.displayMode === "projection") +
          '</div><small>La projection place les commandes dans le pupitre repliable.</small></fieldset></div>' +
          '<div class="participant-fields"><label><span>Nom du camp A</span><input type="text" maxlength="24" data-setting="side-a-name" value="' + esc(state.settings.playerAName) + '" autocomplete="off"></label>' +
          '<label><span>Nom du camp B</span><input type="text" maxlength="24" data-setting="side-b-name" value="' + esc(state.settings.playerBName) + '" autocomplete="off"></label></div>' +
        "</div>" +
        '<div class="switch-row setup-advanced-item"><div><strong>Activer le Twist</strong><small>' + esc(twistNote) + '</small></div>' +
          '<button type="button" class="switch ' + (state.settings.twistEnabled ? "is-on" : "") +
          '" data-action="toggle-twist" role="switch" aria-label="Activer ou désactiver le Twist" aria-checked="' + state.settings.twistEnabled + '"><span></span></button></div>' +
        '<div class="session-summary"><div><small>Parcours</small><strong>' + esc(selectedSchool.short) + '</strong></div>' +
          '<div><small>Palier</small><strong>' + esc(selectedLevel.code) + '</strong></div>' +
          '<div><small>Disponibles</small><strong>' + cardCount + ' cartes</strong></div>' +
          '<div><small>Partie</small><strong>' + state.settings.rounds + " manches</strong></div>" +
          '</div>' +
        '<button class="primary-action" type="button" data-action="show-rules" ' + (canStart ? "" : "disabled") + '>Préparer la partie en ' + esc(selectedLevel.code) + '<span aria-hidden="true">→</span></button>' +
        (!canStart ? '<p class="setup-warning" role="status">Élargissez les sujets pour obtenir au moins ' + state.settings.rounds + ' cartes.</p>' : '') +
        '<p class="reading-note">L’âge, le niveau oral et l’autonomie en lecture restent indépendants. Le B2 est une tâche avancée, pas une certification.</p>' +
      "</div>" +
    "</section>"
  );
}

function currentPreset() {
  const expressRounds = getLevel().rounds.includes(2) ? 2 : 3;
  if (state.settings.mode === "duel" && Number(state.settings.rounds) === expressRounds && state.settings.scoreMode === "quick" && !state.settings.twistEnabled) {
    return "express";
  }
  if (state.settings.mode === "teams" && Number(state.settings.rounds) === 3 && state.settings.scoreMode === "full") {
    return "complete";
  }
  return "custom";
}

function applyPreset(preset) {
  if (preset === "express") {
    state.settings.mode = "duel";
    state.settings.rounds = getLevel().rounds.includes(2) ? 2 : 3;
    state.settings.scoreMode = "quick";
    state.settings.twistEnabled = false;
    state.settings.accessMode = "adult-audio";
    state.settings.displayMode = "projection";
  } else if (preset === "complete") {
    state.settings.mode = "teams";
    state.settings.teamSize = 2;
    state.settings.rounds = 3;
    state.settings.scoreMode = "full";
    state.settings.twistEnabled = getLevel().id !== 1;
    state.settings.accessMode = "reader";
    state.settings.displayMode = "projection";
  }
  ensureSupportedSelection();
  savePreferences();
  render();
}

function optionButton(action, value, label, selected) {
  return '<button type="button" data-action="' + action + '" data-value="' + value + '" class="' +
    (selected ? "is-selected" : "") + '" aria-pressed="' + selected + '">' + esc(label) + "</button>";
}

function roundButton(rounds, allowed) {
  const selected = Number(state.settings.rounds) === rounds;
  return '<button type="button" data-action="select-rounds" data-value="' + rounds + '" class="' +
    (selected ? "is-selected" : "") + '" aria-pressed="' + selected + '" ' + (allowed ? "" : "disabled") + ">" + rounds + "</button>";
}

function renderRules() {
  const level = getLevel();
  const scoreRule = state.settings.scoreMode === "quick"
    ? "Trois critères essentiels valorisent la position, l’écoute et la réponse. En cas d’égalité, écoute et réponse directe départagent."
    : "Cinq critères valorisent le débat. En cas d’égalité, écoute et réponse directe départagent.";
  return (
    '<section class="screen-shell narrow">' +
      '<div class="screen-kicker">Avant de jouer · ' + esc(getSchool().short) + ' · ' + esc(level.code) + "</div>" +
      '<h1 tabindex="-1" data-screen-title>La charte en 60 secondes</h1>' +
      '<p class="screen-intro">Ces règles protègent la parole de chacun et gardent le jeu simple.</p>' +
      '<div class="rules-grid">' +
        ruleCard("1", "On écoute", "On reprend une idée de l’autre camp avant de répondre.") +
        ruleCard("2", "On respecte", "On discute des idées et des situations fictives, jamais des personnes présentes.") +
        ruleCard("3", "On peut passer", "Chaque joueur ou équipe peut passer une carte une fois, sans justification.") +
        ruleCard("4", "Les aides sont gratuites", "Indice, piste et phrase de secours ne retirent aucun point.") +
      "</div>" +
      '<div class="rules-teacher-note"><strong>Repère enseignant</strong><p>À 00:00, l’enfant termine sa phrase. ' + esc(level.id === 1 ? "En A1, un adulte valide les critères. " + scoreRule : scoreRule) + '</p></div>' +
      '<div class="rules-footer"><button class="secondary-action" type="button" data-action="back-setup">← Modifier</button>' +
        '<button class="primary-action compact" type="button" data-action="start-game">Tirer la première carte <span aria-hidden="true">→</span></button></div>' +
    "</section>"
  );
}

function ruleCard(number, title, text) {
  return '<article class="rule-card"><span>' + number + "</span><div><strong>" + esc(title) + "</strong><p>" + esc(text) + "</p></div></article>";
}

function startGame() {
  stopTimer();
  stopRecoveryTimer();
  state.ui.teacherDeskOpen = false;
  state.round = 1;
  state.deck = buildDeck(allCards, {
    level: state.settings.level,
    schoolLevel: state.settings.schoolLevel,
    theme: state.settings.themeFilter,
    sensitivity: state.settings.sensitivityFilter,
  });
  if (state.deck.length < state.settings.rounds) {
    state.screen = "setup";
    state.round = 0;
    showToast("Pas assez de cartes pour ces filtres. Élargissez la sélection.");
    render(true);
    return;
  }
  state.playedCardIds = [];
  state.skippedCardIds = [];
  state.passUsed = { A: false, B: false };
  state.history = [];
  state.totals = emptyTotals();
  state.twistHistory = [];
  state.previousStarter = null;
  state.lastStep = null;
  state.recoveryAwarded = { A: null, B: null };
  state.recoveryTimer = { side: null, remaining: 0, stage: "idle", paused: false };
  state.integrationAttemptId = createIntegrationAttemptId();
  state.integrationCompletionSent = false;
  drawRoundCard();
  emitIntegrationEvent("session-started", {
    attemptId: state.integrationAttemptId,
    roundsPlanned: state.settings.rounds,
    level: getLevel().code,
    schoolLevel: state.settings.schoolLevel,
  });
}

function drawRoundCard() {
  stopTimer();
  state.starterChooser = null;
  if (state.round === 1) state.starter = "A";
  else if (state.round === 2) state.starter = "B";
  else {
    const totalA = state.totals.A.base + state.totals.A.twist;
    const totalB = state.totals.B.base + state.totals.B.twist;
    if (totalA === totalB) state.starter = Math.random() < 0.5 ? "A" : "B";
    else {
      state.starter = null;
      state.starterChooser = totalA < totalB ? "A" : "B";
    }
  }
  replaceCard();
}

function replaceCard() {
  if (!state.deck.length) {
    showToast("Il n’y a plus de nouvelle carte disponible pour ce palier.");
    return;
  }
  state.cardId = state.deck.pop();
  state.helps = { pour: 0, contre: 0 };
  state.twist = null;
  state.twistSkipped = false;
  state.score = null;
  state.recoveryUsed = { A: false, B: false };
  state.recoveryAwarded = { A: null, B: null };
  state.recoveryTimer = { side: null, remaining: 0, stage: "idle", paused: false };
  state.assignments = canChooseAssignment() ? null : randomAssignments();
  state.screen = "reveal";
  persistSession();
  render(true);
  announce("Nouvelle carte : " + currentCard().titre);
}

function randomAssignments() {
  return Math.random() < 0.5 ? { A: "pour", B: "contre" } : { A: "contre", B: "pour" };
}

function canChooseAssignment() {
  return Boolean(assignmentChooser());
}

function renderAudioControls(listenAction, listenLabel) {
  return '<div class="audio-controls"><button type="button" class="text-action" data-action="' + listenAction + '">' +
    esc(listenLabel) + '</button><button type="button" class="text-action audio-stop" data-action="stop-audio">Arrêter l’audio</button></div>';
}

function renderUndoButton(label = "Annuler la dernière étape", shortLabel = label) {
  if (!state.lastStep) return "";
  return '<button type="button" class="text-action undo-action" data-action="undo-step" aria-label="' + esc(label) + '">' +
    '<span class="undo-full">' + esc(label) + '</span><span class="undo-short" aria-hidden="true">' + esc(shortLabel) + "</span></button>";
}

function renderProjectionReveal() {
  const card = currentCard();
  if (!card) return renderError("Carte introuvable.");
  const canBegin = Boolean(state.assignments && state.starter);
  const primaryAction = canBegin ? "begin-prep" : "open-teacher-desk";
  const primaryLabel = canBegin ? "Continuer le débat" : state.assignments ? "Choisir qui commence" : "Attribuer les camps";
  return (
    '<section class="projection-stage projection-reveal">' +
      '<div class="projection-main">' +
        '<figure class="projection-visual"><img src="' + esc(illustrationForCard(card)) + '" alt="' + esc(illustrationAlt(card)) + '"></figure>' +
        '<article class="projection-copy">' +
          '<div class="projection-meta"><span>' + esc(getSchool().short + " · " + getLevel().code) + '</span><span>Manche ' + state.round + ' sur ' + state.settings.rounds + '</span></div>' +
          '<h1 tabindex="-1" data-screen-title>' + esc(card.titre) + '</h1>' +
          '<p class="projection-situation">' + esc(card.situation) + '</p>' +
          '<div class="projection-question"><small>La question du débat</small><strong>' + esc(card.question_centrale) + '</strong></div>' +
          '<div class="projection-positions">' + positionCard("pour", card.camp_pour) + '<span class="versus" aria-hidden="true">ou</span>' + positionCard("contre", card.camp_contre) + '</div>' +
        '</article>' +
      '</div>' +
      renderProjectionTurnBanner({ action: primaryAction, label: primaryLabel, phase: null, collective: true }) +
    '</section>'
  );
}

function renderProjectionPhase() {
  const card = currentCard();
  const phase = currentPhase();
  if (!card) return renderError("Carte introuvable.");
  if (phase.kind === "twist" && !state.twist) {
    selectTwist();
    persistSession();
  }
  const isTwist = phase.kind === "twist";
  const side = isTwist ? otherSide(state.starter) : phase.kind === "prepare" ? state.starter || "A" : phase.side;
  const position = side ? positionForSide(side, phase) : null;
  const camp = position ? campText(card, position) : "";
  const title = isTwist ? state.twist.title : phase.kind === "prepare" ? "Préparez une idée claire" : promptForPhase(phase);
  const supporting = isTwist
    ? '<p class="projection-twist-instruction">' + esc(state.twist.instruction) + '</p>' +
      (state.twist.connector ? '<div class="projection-word"><small>Mot à utiliser</small><strong>' + esc(state.twist.connector) + '</strong></div>' : '')
    : phase.kind === "prepare"
      ? '<div class="projection-positions projection-prep-positions">' + positionCard(positionForSide("A"), campText(card, positionForSide("A"))) + '<span class="versus" aria-hidden="true">et</span>' + positionCard(positionForSide("B"), campText(card, positionForSide("B"))) + '</div>'
      : '<div class="projection-current-camp"><small>Mon camp</small><strong>' + esc(camp) + '</strong></div>' +
        '<div class="projection-expressions"><small>Je peux dire</small><div>' + card.expressions_de_debat.slice(0, 3).map((expression) => '<span>' + esc(expression) + '</span>').join("") + '</div></div>';
  return (
    '<section class="projection-stage projection-phase">' +
      '<div class="projection-main">' +
        '<figure class="projection-visual"><img src="' + esc(illustrationForCard(card)) + '" alt="' + esc(illustrationAlt(card)) + '"></figure>' +
        '<article class="projection-copy">' +
          '<div class="projection-meta"><span>' + esc(childPhaseLabel(phase)) + '</span><span>Manche ' + state.round + ' sur ' + state.settings.rounds + '</span></div>' +
          '<h1 tabindex="-1" data-screen-title>' + esc(title) + '</h1>' +
          '<div class="projection-question"><small>Notre question</small><strong>' + esc(card.question_centrale) + '</strong></div>' +
          supporting +
        '</article>' +
      '</div>' +
      renderProjectionTurnBanner({
        action: "next-phase",
        label: isTwist ? "Relever le défi" : phase.kind === "prepare" ? "Commencer le débat" : "Continuer le débat",
        phase,
        side,
        collective: phase.kind === "prepare",
      }) +
    '</section>'
  );
}

function renderProjectionScore() {
  const card = currentCard();
  if (!card) return renderError("Carte introuvable.");
  return (
    '<section class="projection-stage projection-score">' +
      '<div class="projection-main">' +
        '<figure class="projection-visual"><img src="' + esc(illustrationForCard(card)) + '" alt="' + esc(illustrationAlt(card)) + '"></figure>' +
        '<article class="projection-copy">' +
          '<div class="projection-meta"><span>Fin de la manche ' + state.round + '</span><span>' + esc(getLevel().code) + '</span></div>' +
          '<h1 tabindex="-1" data-screen-title>Bravo pour vos idées</h1>' +
          '<p class="projection-situation">Le professeur complète maintenant le bilan d’écoute et de réponse. Les aides utilisées ne retirent aucun point.</p>' +
          '<div class="projection-question"><small>Question discutée</small><strong>' + esc(card.question_centrale) + '</strong></div>' +
        '</article>' +
      '</div>' +
      renderProjectionTurnBanner({ action: "open-teacher-desk", label: "Ouvrir la grille d’évaluation", phase: null, status: "Nous attendons le bilan", collective: true }) +
    '</section>'
  );
}

function renderProjectionTurnBanner({ action, label, phase, side = null, status = "", collective = false }) {
  const activeSide = side || (state.assignments ? state.starter || "A" : "A");
  const childStatus = status || (collective
    ? state.assignments ? "Nous préparons nos idées" : "Nous découvrons la question"
    : phase ? childPhaseLabel(phase) : "Je découvre la question");
  const playerVisual = collective
    ? '<span class="projection-avatar-stack" aria-hidden="true"><img src="' + esc(avatarForSide("A")) + '" alt=""><img src="' + esc(avatarForSide("B")) + '" alt=""></span>' +
      '<span><small>Les deux camps</small><strong>' + esc(childStatus) + '</strong></span>'
    : '<img src="' + esc(avatarForSide(activeSide)) + '" alt=""><span><small>' + esc(sideName(activeSide)) + '</small><strong>' + esc(childStatus) + '</strong></span>';
  const time = phase && phase.kind !== "twist"
    ? '<span class="projection-time-wrap"><strong id="projectionTimer" class="projection-time" role="timer" aria-label="Temps restant">' + formatTime(state.timer.remaining) + '</strong><small id="projectionTimerStatus">Temps restant</small></span>'
    : '<strong class="projection-time">Prêts ?</strong>';
  return (
    '<footer class="projection-turn-banner">' +
      '<div class="projection-player ' + (collective ? "is-collective" : "") + '">' + playerVisual + '</div>' +
      time +
      '<button class="projection-primary" type="button" data-action="' + action + '">' + esc(label) + '</button>' +
    '</footer>'
  );
}

function renderTeacherDesk() {
  if (!state.ui.teacherDeskOpen) return '<aside id="teacherDesk" class="professor-desk" hidden></aside>';
  return (
    '<div class="professor-desk-layer">' +
      '<button class="professor-desk-scrim" type="button" tabindex="-1" data-action="close-teacher-desk" aria-label="Fermer le pupitre professeur"></button>' +
      '<aside id="teacherDesk" class="professor-desk" role="dialog" aria-modal="true" aria-label="Pupitre professeur">' +
        '<div class="professor-desk-head"><div><small>Commandes privées</small><strong>Pupitre professeur</strong></div><button type="button" data-action="close-teacher-desk">Fermer</button></div>' +
        renderTeacherDeskContent() +
      '</aside>' +
    '</div>'
  );
}

function renderTeacherDeskContent() {
  const card = currentCard();
  if (!card) return '';
  if (state.screen === "score") return '<div class="professor-score-form">' + renderScore() + '</div>';
  if (state.screen === "reveal") {
    const risk = card.risque_sensibilite || {};
    return (
      '<div class="professor-desk-section"><small>Manche ' + state.round + '</small><h2>Attribuer les camps</h2>' + renderAssignmentArea(card) + '</div>' +
      '<div class="professor-desk-section"><h2>Qui commence ?</h2><div class="starter-box">' + renderStarterArea() + '</div></div>' +
      '<div class="professor-desk-section"><h2>Lecture et vigilance</h2>' + renderAudioControls("listen-card", "Lire la carte") +
        '<p class="professor-note">' + esc(card.note_enseignant_systeme) + '</p>' +
        (risk.vigilance ? '<p class="professor-vigilance"><strong>Vigilance :</strong> ' + esc(risk.vigilance) + '</p>' : '') + '</div>' +
      '<div class="professor-desk-section pass-zone"><span>Changer de carte sans justification</span><div>' + passButton("A") + passButton("B") + '</div></div>' +
      renderUndoButton("Revenir au résultat précédent")
    );
  }
  const phase = currentPhase();
  if (phase.kind === "twist") {
    return '<div class="professor-desk-section"><small>Défi commun</small><h2>' + esc(state.twist.title) + '</h2><p>' + esc(state.twist.success) + '</p></div>' +
      '<div class="professor-desk-section"><button class="secondary-action" type="button" data-action="skip-twist">Passer sans pénalité</button></div>' + renderUndoButton("Retour au dernier tour");
  }
  const help = phase.kind === "prepare" ? renderHelpPanel("A", true) + renderHelpPanel("B", true) : renderHelpPanel(phase.side, true, phase);
  return (
    '<div class="professor-desk-section"><small>Étape didactique</small><h2>' + esc(phase.action) + '</h2><p>' + esc(getLevel().mission) + '</p></div>' +
    '<div class="professor-desk-section">' + renderTimer() + '</div>' +
    '<div class="professor-desk-section"><h2>Aides graduées</h2><div class="professor-help-list">' + help + '</div></div>' +
    '<div class="professor-desk-section">' + (phase.side ? renderAudioControls("listen-turn", "Lire la consigne et le camp") : '') + renderUndoButton("Étape précédente", "Retour") + '</div>'
  );
}

function renderReveal() {
  const card = currentCard();
  if (!card) return renderError("Carte introuvable.");
  const risk = card.risque_sensibilite || {};
  const isVigilant = String(risk.niveau).toLowerCase() === "modéré";
  const projection = state.settings.displayMode === "projection";
  const assignmentArea = renderAssignmentArea(card);
  const canBegin = Boolean(state.assignments && state.starter);
  const accessMessage = state.settings.accessMode === "adult-audio"
    ? "Lecture accompagnée : un adulte peut lire la carte ou lancer l’audio."
    : "Lecture autonome : prenez le temps de relire la situation avant de choisir.";
  return (
    '<section class="screen-shell">' +
      renderRoundProgress("Découvrir la situation") +
      '<div class="reveal-layout">' +
        '<article class="debate-card">' +
          '<div class="card-meta"><div><span>' + esc(getSchool().short + " · " + titleCase(card.theme_programme || card.categorie)) + '</span>' +
            (projection ? "" : '<b>' + esc(card.identifiant) + "</b>") + '</div><div class="meta-actions">' +
            renderAudioControls("listen-card", state.settings.accessMode === "adult-audio" ? "Lire la carte à voix haute" : "Écouter la carte") + "</div></div>" +
          '<p class="access-message">' + esc(accessMessage) + "</p>" +
          '<h1 tabindex="-1" data-screen-title>' + esc(card.titre) + "</h1>" +
          '<p class="situation">' + esc(card.situation) + "</p>" +
          '<div class="question-block"><small>La question du débat</small><strong>' + esc(card.question_centrale) + "</strong></div>" +
          '<div class="positions-grid">' +
            positionCard("pour", card.camp_pour) +
            positionCard("contre", card.camp_contre) +
          "</div>" +
          (isVigilant ? (projection
            ? '<div class="projection-alert"><strong>Sujet préparé par l’enseignant</strong><span>La vigilance détaillée reste masquée en mode projection.</span></div>'
            : '<div class="vigilance-banner"><span aria-hidden="true">!</span><div><strong>Vigilance adulte</strong><p>' + esc(risk.vigilance) + "</p></div></div>") : "") +
          (projection ? "" : '<details class="adult-note"><summary>Note pour l’adulte</summary><p>' + esc(card.note_enseignant_systeme) + "</p>" +
            (!isVigilant && risk.vigilance ? "<p>" + esc(risk.vigilance) + "</p>" : "") + "</details>") +
        "</article>" +
        '<aside class="control-card">' +
          '<div class="control-heading"><span>Manche ' + state.round + "</span><strong>Attribuer les positions</strong></div>" +
          assignmentArea +
          '<div class="starter-box">' + renderStarterArea() + "</div>" +
          '<button class="primary-action" type="button" data-action="begin-prep" ' + (canBegin ? "" : "disabled") + '>Préparer les arguments <span aria-hidden="true">→</span></button>' +
          renderUndoButton("Revenir au résultat précédent") +
          '<div class="pass-zone"><span>Carte inconfortable ?</span><div>' +
            passButton("A") + passButton("B") +
          "</div><small>Le passage ne consomme pas la manche et ne demande aucune justification.</small></div>" +
        "</aside>" +
      "</div>" +
    "</section>"
  );
}

function renderRoundProgress(label) {
  const percent = ((state.round - 1) / state.settings.rounds) * 100;
  return '<div class="round-strip"><span class="round-back">' + esc(label) + '</span><div class="round-progress"><span>Manche ' +
    state.round + " sur " + state.settings.rounds + '</span><i><b style="width:' + percent + '%"></b></i></div><span class="level-chip">' +
    esc(getLevel().code) + "</span></div>";
}

function positionCard(position, text) {
  return '<div class="position-card ' + (position === "pour" ? "position-one" : "position-two") + '"><span>' +
    positionTitle(position) + "</span><p>" + esc(text) + "</p></div>";
}

function renderAssignmentArea(card) {
  if (!state.assignments) {
    const chooser = assignmentChooser() || "A";
    const other = otherSide(chooser);
    return (
      '<p class="control-help">' + esc(sideName(chooser)) + " choisit sa position. L’autre position sera attribuée à " + esc(sideName(other)) + ".</p>" +
      '<div class="assignment-buttons">' +
        '<button type="button" data-action="choose-assignment" data-value="pour"><span>1</span>' + esc(card.camp_pour) + "</button>" +
        '<button type="button" data-action="choose-assignment" data-value="contre"><span>2</span>' + esc(card.camp_contre) + "</button>" +
      "</div>"
    );
  }
  return (
    '<div class="assignment-summary">' +
      assignmentLine("A") + assignmentLine("B") +
      (canChooseAssignment() ? '<button type="button" class="text-action small" data-action="change-assignment">Modifier le choix</button>' : "") +
    "</div>"
  );
}

function assignmentLine(side) {
  const card = currentCard();
  const position = state.assignments[side];
  return '<div><span class="side-avatar" aria-hidden="true">' + side + "</span><p><small>" + esc(sideName(side)) + "</small><strong>" +
    esc(positionTitle(position)) + "</strong><em>" + esc(campText(card, position)) + "</em></p></div>";
}

function renderStarterArea() {
  if (state.starter) {
    return '<small>Commence cette manche</small><strong>' + esc(sideName(state.starter)) + "</strong>";
  }
  return (
    '<small>' + esc(sideName(state.starterChooser)) + " est derrière au score et choisit qui commence.</small>" +
    '<div class="starter-actions">' +
      '<button type="button" data-action="set-starter" data-value="A">' + esc(sideName("A")) + "</button>" +
      '<button type="button" data-action="set-starter" data-value="B">' + esc(sideName("B")) + "</button>" +
    "</div>"
  );
}

function passButton(side) {
  const remainingFutureRounds = Math.max(0, state.settings.rounds - state.round);
  const replacementAvailable = state.deck.length > remainingFutureRounds;
  const label = !replacementAvailable
    ? " · paquet réservé"
    : state.passUsed[side]
      ? " · redemande"
      : " passe";
  return '<button type="button" data-action="pass-card" data-value="' + side + '" ' + (replacementAvailable ? "" : "disabled") +
    ">" + esc(sideName(side)) + label + "</button>";
}

function beginPreparation() {
  if (!state.assignments || !state.starter) return;
  captureLastStep();
  state.ui.teacherDeskOpen = false;
  state.previousStarter = state.starter;
  state.phases = buildPhases(state.starter, state.settings.twistEnabled);
  state.phaseIndex = 0;
  state.screen = "phase";
  configureTimer();
  persistSession();
  render(true);
}

function currentPhase() {
  return state.phases[state.phaseIndex] || { kind: "score", action: "Score", side: null };
}

function configureTimer() {
  stopTimer();
  const phase = currentPhase();
  let seconds = phase.kind === "twist" || phase.kind === "score" ? 0 : durationForPhase(state.settings.level, phase);
  if (state.settings.mode === "teams" && phase.kind === "prepare") seconds += 15;
  state.timer = {
    phaseKey: state.round + "-" + state.phaseIndex,
    initial: seconds,
    remaining: seconds,
    running: false,
    started: false,
    expired: false,
  };
}

function renderPhase() {
  const phase = currentPhase();
  if (phase.kind === "twist") return renderTwistPhase();
  const card = currentCard();
  const progress = Math.round((state.phaseIndex / Math.max(1, state.phases.length - 1)) * 100);
  const content = phase.kind === "prepare" ? renderPreparation(card) : renderSpeakingTurn(card, phase);
  return (
    '<section class="screen-shell phase-shell">' +
      renderPhaseContext(card, phase) +
      '<div class="phase-progress"><div><span>Manche ' + state.round + "/" + state.settings.rounds + "</span><strong>" +
        esc(phase.action) + '</strong></div><i><b style="width:' + progress + '%"></b></i><span class="level-chip">' + esc(getLevel().code) + "</span></div>" +
      content +
      renderMobilePhaseAction(phase) +
    "</section>"
  );
}

function renderPhaseContext(card, phase) {
  const timer = '<span class="context-time"><small>Temps</small><strong id="contextTimer">' + formatTime(state.timer.remaining) + "</strong></span>";
  if (phase.kind === "prepare") {
    return '<aside class="phase-context" aria-label="Repères de la préparation"><div><small>Préparation commune</small><strong>' +
      esc(sideName("A")) + " · " + esc(campText(card, positionForSide("A"))) + '<br>' + esc(sideName("B")) + " · " +
      esc(campText(card, positionForSide("B"))) + '</strong></div>' + timer + renderUndoButton("Retour à la carte", "Retour") + "</aside>";
  }
  const side = phase.side;
  const position = positionForSide(side, phase);
  return '<aside class="phase-context is-speaking" aria-label="Repères de la prise de parole"><span class="side-avatar" aria-hidden="true">' + side +
    '</span><div><small>' + esc(phase.action) + " · " + esc(sideName(side)) + '</small><strong>' + esc(campText(card, position)) +
    '</strong></div>' + timer + renderUndoButton("Étape précédente", "Retour") + "</aside>";
}

function renderMobilePhaseAction(phase) {
  const label = phase.kind === "prepare" ? "Commencer les prises de parole" : "Tour terminé";
  return '<div class="mobile-phase-action"><button class="primary-action" type="button" data-action="next-phase">' +
    esc(label) + ' <span aria-hidden="true">→</span></button></div>';
}

function renderPreparation(card) {
  return (
    '<div class="phase-layout">' +
      '<section class="phase-main">' +
        '<div class="phase-kicker">Les deux camps préparent en même temps</div>' +
        '<h1 tabindex="-1" data-screen-title>Préparez une idée claire</h1>' +
        '<div class="compact-question"><small>Question</small><strong>' + esc(card.question_centrale) + "</strong></div>" +
        renderTimer() +
        '<div class="prep-positions">' +
          renderHelpPanel("A", true) + renderHelpPanel("B", true) +
        "</div>" +
      "</section>" +
      '<aside class="coach-card"><span class="coach-label">Mission ' + esc(getLevel().code) + "</span><p>" + esc(getLevel().mission) + "</p>" +
        '<ul><li>Notez seulement des mots-clés.</li><li>Les aides ne retirent aucun point.</li><li>' +
          (state.settings.mode === "teams" ? "Préparez " + esc(spokespersonLabel().toLowerCase()) + " et changez de voix à chaque manche." : "Préparez votre première phrase.") +
        '</li></ul><button class="primary-action" type="button" data-action="next-phase">Commencer les prises de parole <span aria-hidden="true">→</span></button></aside>' +
    "</div>"
  );
}

function renderSpeakingTurn(card, phase) {
  const side = phase.side;
  const position = positionForSide(side, phase);
  const isChange = phase.kind === "adapt" && state.twist && state.twist.title === "Change de camp";
  return (
    '<div class="phase-layout">' +
      '<section class="phase-main">' +
        '<div class="speaker-banner"><span class="side-avatar large" aria-hidden="true">' + side + "</span><div><small>" + esc(phase.action) +
          (isChange ? " · camp provisoire" : "") + "</small><strong>" + esc(sideName(side)) + "</strong><p>" +
          esc(positionTitle(position)) + " · " + esc(campText(card, position)) + "</p>" +
          (state.settings.mode === "teams" ? '<b class="speaker-role">' + esc(spokespersonLabel()) + "</b>" : "") + "</div></div>" +
        '<h1 tabindex="-1" data-screen-title>' + esc(promptForPhase(phase)) + "</h1>" +
        '<div class="compact-question"><small>Question</small><strong>' + esc(card.question_centrale) + "</strong></div>" +
        renderTimer() +
        '<div class="expression-bank"><small>Expressions utiles</small><div>' +
          card.expressions_de_debat.slice(0, 4).map((expression) => "<span>" + esc(expression) + "</span>").join("") +
        "</div></div>" +
      "</section>" +
      '<aside class="coach-card">' +
        '<span class="coach-label">Soutien pendant la parole</span>' +
        renderAudioControls("listen-turn", "Écouter la consigne et mon camp") +
        renderHelpPanel(side, true, phase) +
        (state.settings.mode === "teams" ? '<p class="team-tip"><strong>Mode équipes :</strong> changez de porte-parole et limitez le souffle d’équipe à cinq mots.</p>' : "") +
        '<button class="primary-action" type="button" data-action="next-phase">Tour terminé <span aria-hidden="true">→</span></button>' +
      "</aside>" +
    "</div>"
  );
}

function promptForPhase(phase) {
  const level = getLevel().code;
  if (phase.kind === "adapt") return "Respecte le Twist et fais avancer l’échange.";
  if (phase.action === "Affirmer") {
    if (level === "A1") return "Dis ta position et une raison.";
    if (level === "A2") return "Explique ta position et donne un exemple.";
    return "Présente une position structurée et justifiée.";
  }
  if (level === "A1") return "Reprends un mot, puis réponds.";
  if (level === "A2") return "Réponds à une idée de l’autre camp.";
  if (level === "B1") return "Reformule, puis réfute ou concède.";
  return "Réponds précisément, nuance et prépare une conclusion.";
}

function renderTimer() {
  return (
    '<div class="timer-card ' + (state.timer.expired ? "is-expired" : "") + '">' +
      '<div><small>Chronomètre non punitif</small><strong id="timerValue" role="timer" aria-label="Temps restant">' + formatTime(state.timer.remaining) + "</strong>" +
        '<span id="timerStatus">' + esc(timerStatusText()) + "</span></div>" +
      '<div class="timer-actions"><button type="button" data-action="timer-toggle" ' + (state.timer.expired ? "disabled" : "") + '>' +
        (state.timer.expired ? "Terminé" : state.timer.running ? "Pause" : state.timer.started ? "Reprendre" : "Démarrer") +
        '</button><button type="button" data-action="timer-add">+10 s</button><button type="button" data-action="timer-reset" aria-label="Réinitialiser le chronomètre">Réinitialiser</button></div>' +
    "</div>"
  );
}

function timerStatusText() {
  if (state.timer.expired) return "Temps écoulé : terminez la phrase.";
  if (state.timer.running) return "En cours";
  if (state.timer.started) return "En pause";
  return "Prêt";
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
}

function renderHelpPanel(side, allowReveal, phase = null) {
  const card = currentCard();
  const position = positionForSide(side, phase);
  const helpCount = state.helps[position] || 0;
  const revealed = HELP_FIELDS.slice(0, helpCount).map((field, index) => {
    return '<div class="revealed-help"><span>' + (index + 1) + "</span><p><small>" + HELP_LABELS[index] + "</small>" +
      esc(card.aides[position][field]) + "</p></div>";
  }).join("");
  const nextButton = allowReveal && helpCount < 3
    ? '<button type="button" class="help-reveal" data-action="reveal-help" data-value="' + position + '">+ Révéler : ' + HELP_LABELS[helpCount] + "</button>"
    : "";
  return (
    '<div class="help-panel" tabindex="-1" data-help-position="' + position + '"><div class="help-panel-head"><span class="side-avatar" aria-hidden="true">' + side + "</span><p><small>" + esc(sideName(side)) + "</small><strong>" +
      esc(positionTitle(position)) + '</strong><em class="help-camp">' + esc(campText(card, position)) + "</em></p><b>" + helpCount + "/3 aides</b></div>" +
      (revealed || '<p class="no-help">Aucune aide révélée.</p>') + nextButton + "</div>"
  );
}

function selectTwist() {
  const level = state.settings.level;
  const allowedByLevel = level === 1
    ? ["Donne un exemple", "Une seule phrase", "Mot imposé"]
    : level === 2
      ? ["Donne un exemple", "Trouve un compromis", "Une seule phrase", "Mot imposé"]
      : Object.keys(TWISTS);
  const allowed = allowedByLevel.filter((title) => title !== "Change de camp" || !state.twistHistory.includes(title));
  const card = currentCard();
  let title = allowed.includes(card.twist_recommande) ? card.twist_recommande : "Donne un exemple";
  const previous = state.twistHistory[state.twistHistory.length - 1];
  if (title === previous) title = allowed.find((item) => item !== previous) || title;
  const base = TWISTS[title];
  const connector = title === "Mot imposé"
    ? CONNECTORS[level][Math.floor(Math.random() * CONNECTORS[level].length)]
    : null;
  state.twist = { ...base, title, connector };
  state.twistHistory.push(title);
}

function renderTwistPhase() {
  if (!state.twist) {
    selectTwist();
    persistSession();
  }
  const twist = state.twist;
  const connector = twist.connector
    ? '<div class="imposed-word"><small>Connecteur imposé</small><strong>' + esc(twist.connector) + "</strong></div>"
    : "";
  return (
    '<section class="twist-screen">' +
      '<div class="twist-orbit" aria-hidden="true"><span></span><span></span><span></span></div>' +
      '<div class="twist-card">' +
        '<div class="twist-label">' + esc(twist.code) + " · Même contrainte pour les deux camps</div>" +
        '<h1 tabindex="-1" data-screen-title>' + esc(twist.title) + "</h1>" +
        '<p class="twist-instruction">' + esc(twist.instruction) + "</p>" +
        connector +
        '<div class="twist-order"><span class="side-avatar" aria-hidden="true">' + otherSide(state.starter) + "</span><p><small>Commence le Twist</small><strong>" +
          esc(sideName(otherSide(state.starter))) + "</strong></p><i>puis</i><span class=\"side-avatar\" aria-hidden=\"true\">" + state.starter + "</span><p><strong>" + esc(sideName(state.starter)) + "</strong></p></div>" +
        '<div class="twist-success"><small>Réussite observable</small><p>' + esc(twist.success) + "</p></div>" +
        renderUndoButton("Retour au dernier tour") +
        '<div class="twist-actions"><button class="secondary-action" type="button" data-action="skip-twist">Passer sans pénalité</button>' +
          '<button class="primary-action compact" type="button" data-action="next-phase">Relever le défi <span aria-hidden="true">→</span></button></div>' +
      "</div>" +
    "</section>"
  );
}

function advancePhase() {
  captureLastStep();
  state.ui.teacherDeskOpen = false;
  stopTimer();
  state.phaseIndex += 1;
  const phase = currentPhase();
  if (phase.kind === "score") {
    openScore();
    return;
  }
  configureTimer();
  persistSession();
  render(true);
  announce(phase.kind === "twist" ? "Twist révélé." : phase.action + " : " + sideName(phase.side));
}

function skipTwist() {
  captureLastStep();
  state.twistSkipped = true;
  const scoreIndex = state.phases.findIndex((phase) => phase.kind === "score");
  state.phaseIndex = scoreIndex;
  showToast("Twist passé : aucun point retiré.");
  openScore();
}

function blankScore() {
  const debate = {};
  const language = {};
  for (const side of ["A", "B"]) {
    debate[side] = Object.fromEntries(SCORE_CRITERIA.map((criterion) => [criterion.id, false]));
    language[side] = Object.fromEntries(LANGUAGE_CRITERIA.map((criterion) => [criterion.id, false]));
  }
  return { debate, twist: { A: false, B: false }, language };
}

function openScore() {
  stopTimer();
  state.ui.teacherDeskOpen = false;
  state.score = state.score || blankScore();
  state.screen = "score";
  persistSession();
  render(true);
}

function renderScore() {
  const card = currentCard();
  const criteria = activeScoreCriteria();
  const debateRows = criteria.map((criterion) => {
    const descriptionId = "score-description-" + criterion.id;
    return '<div class="score-row"><div><span>' + criterion.short + "</span><p><strong>" + esc(criterion.label) + '</strong><small id="' + descriptionId + '">' +
      esc(criterion.description) + "</small></p></div>" +
      scoreToggle("A", "debate", criterion.id, false, criterion.short + " · " + criterion.label, descriptionId) +
      scoreToggle("B", "debate", criterion.id, false, criterion.short + " · " + criterion.label, descriptionId) + "</div>";
  }).join("");
  const languageRows = LANGUAGE_CRITERIA.map((criterion) => {
    return '<div class="language-row"><span>' + criterion.short + " · " + esc(criterion.label) + "</span>" +
      scoreToggle("A", "language", criterion.id, true, criterion.short + " · " + criterion.label) +
      scoreToggle("B", "language", criterion.id, true, criterion.short + " · " + criterion.label) + "</div>";
  }).join("");
  const twistRow = state.settings.twistEnabled && !state.twistSkipped
    ? '<div class="score-row twist-score"><div><span>T</span><p><strong>Twist réussi</strong><small id="twist-score-description">' +
      esc(state.twist ? state.twist.success : "Contrainte accomplie.") + "</small></p></div>" +
      scoreToggle("A", "twist", "twist", false, "T · Twist réussi", "twist-score-description") +
      scoreToggle("B", "twist", "twist", false, "T · Twist réussi", "twist-score-description") + "</div>"
    : '<div class="twist-skipped-note">Twist non compté pour cette manche.</div>';
  const languagePanel = state.settings.scoreMode === "full"
    ? '<div class="language-panel"><div><strong>Progression linguistique</strong><small>Étoiles personnelles, hors victoire.</small></div>' +
      '<div class="language-head"><span></span><b>' + esc(sideName("A")) + "</b><b>" + esc(sideName("B")) + "</b></div>" + languageRows + "</div>"
    : '<div class="quick-score-note"><strong>Mode essentiel</strong><span>La progression linguistique n’est pas notée pendant cette manche.</span></div>';
  return (
    '<section class="screen-shell score-shell">' +
      '<div class="screen-kicker">Manche ' + state.round + " · " + esc(card.identifiant) + "</div>" +
      '<h1 tabindex="-1" data-screen-title>Observer, cocher, puis avancer</h1>' +
      '<p class="screen-intro">' + criteria.length + ' critères, chacun noté 0 ou 1. Les aides ne retirent aucun point. ' +
        (state.settings.level === 1 ? "En A1, la validation revient à l’adulte." : "") + "</p>" +
      '<div class="score-context"><strong>' + esc(card.question_centrale) + '</strong><span>' + esc(campText(card, state.assignments.A)) + " · " +
        esc(campText(card, state.assignments.B)) + "</span></div>" +
      '<div class="score-table"><div class="score-head"><span>Critère de débat</span><b>' + esc(sideName("A")) + "</b><b>" + esc(sideName("B")) + "</b></div>" +
        debateRows + twistRow + "</div>" +
      renderRecoveryStrip() +
      languagePanel +
      '<div class="score-footer"><p>Le score de débat et le bonus Twist déterminent le résultat. En cas d’égalité, D3 « Trace d’écoute » + D4 « Réponse directe » départagent.</p>' +
        renderUndoButton("Retour au dernier tour") +
        '<button class="primary-action compact" type="button" data-action="submit-score">Valider la manche <span aria-hidden="true">→</span></button></div>' +
    "</section>"
  );
}

function scoreToggle(side, group, id, star = false, criterionLabel = "", descriptionId = "") {
  const checked = group === "twist" ? state.score.twist[side] : state.score[group][side][id];
  const label = star ? (checked ? "Étoile acquise" : "Étoile non cochée") : (checked ? "1 point" : "0 point");
  return '<button type="button" class="score-toggle ' + (checked ? "is-checked" : "") + (star ? " is-star" : "") +
    '" data-action="toggle-score" data-side="' + side + '" data-group="' + group + '" data-value="' + id +
    '" aria-pressed="' + checked + '" aria-label="' + esc(sideName(side) + " : " + criterionLabel + " : " + label) + '" ' +
    (descriptionId ? 'aria-describedby="' + descriptionId + '" ' : "") + '>' +
    (star ? (checked ? "★" : "☆") : checked ? "1" : "0") + "</button>";
}

function recoveryButton(side) {
  const anotherRecoveryIsActive = Boolean(state.recoveryTimer.side && state.recoveryTimer.side !== side);
  const hasEligibleCriterion = activeScoreCriteria().some((criterion) => !state.score.debate[side][criterion.id]);
  const disabled = state.recoveryUsed[side] || anotherRecoveryIsActive || !hasEligibleCriterion;
  return '<button type="button" class="recovery-button ' + (state.recoveryUsed[side] ? "is-used" : "") +
    '" data-action="toggle-recovery" data-value="' + side + '" aria-pressed="' + state.recoveryUsed[side] + '" ' +
    (disabled ? "disabled" : "") + ">" +
    esc(sideName(side)) + (state.recoveryUsed[side] ? " · utilisé" : !hasEligibleCriterion ? " · grille complète" : " · lancer 10 s") + "</button>";
}

function renderRecoveryStrip() {
  const activeSide = state.recoveryTimer.side;
  if (activeSide && state.recoveryTimer.stage === "speaking") {
    return '<div class="recovery-strip is-active" tabindex="-1"><div><strong>Phrase de rattrapage · ' + esc(sideName(activeSide)) +
      '</strong><small>Une seule idée pour compléter un seul critère.</small></div><b id="recoveryValue" class="recovery-countdown" role="timer" aria-label="Temps restant pour la phrase de rattrapage">' +
      state.recoveryTimer.remaining + ' s</b><div class="recovery-timer-actions"><button type="button" data-action="recovery-pause">' +
      (state.recoveryTimer.paused ? "Reprendre" : "Pause") + '</button><button type="button" data-action="recovery-add">+10 s</button></div></div>';
  }
  if (activeSide && state.recoveryTimer.stage === "choose") {
    const choices = activeScoreCriteria().filter((criterion) => !state.score.debate[activeSide][criterion.id]).map((criterion) =>
      '<button type="button" class="recovery-criterion" data-action="recovery-criterion" data-value="' + criterion.id +
      '" data-side="' + activeSide + '">' + criterion.short + " · " + esc(criterion.label) + "</button>"
    ).join("");
    return '<div class="recovery-strip is-choosing" tabindex="-1"><div><strong>Quel critère la phrase vient-elle de compléter ?</strong>' +
      '<small>Choisissez-en un seul. Il sera ajouté automatiquement.</small></div><div class="recovery-choices">' +
      (choices || '<span>Tous les critères étaient déjà acquis.</span>') +
      '<button type="button" class="recovery-skip" data-action="finish-recovery">Aucun critère</button></div></div>';
  }
  const awarded = ["A", "B"].filter((side) => state.recoveryAwarded[side]).map((side) => {
    const criterion = SCORE_CRITERIA.find((item) => item.id === state.recoveryAwarded[side]);
    return '<span class="recovery-award">' + esc(sideName(side)) + " · " + esc(criterion ? criterion.short : "aucun point") + "</span>";
  }).join("");
  return '<div class="recovery-strip" tabindex="-1"><div><strong>Phrase de rattrapage</strong><small>10 secondes, puis un seul critère peut être ajouté par camp.</small>' +
    (awarded ? '<div class="recovery-awards">' + awarded + "</div>" : "") + "</div>" +
    recoveryButton("A") + recoveryButton("B") + "</div>";
}

function startRecovery(side) {
  if (state.recoveryUsed[side] || state.recoveryTimer.side) return;
  stopRecoveryTimer();
  state.recoveryUsed[side] = true;
  state.recoveryTimer = { side, remaining: 10, stage: "speaking", paused: false };
  persistSession();
  render();
  window.requestAnimationFrame(() => app.querySelector('[data-action="recovery-pause"]')?.focus({ preventScroll: true }));
  announce("Phrase de rattrapage pour " + sideName(side) + " : dix secondes.");
  recoveryHandle = window.setInterval(() => {
    if (state.recoveryTimer.paused) return;
    state.recoveryTimer.remaining = Math.max(0, state.recoveryTimer.remaining - 1);
    const value = document.querySelector("#recoveryValue");
    if (value) value.textContent = state.recoveryTimer.remaining + " s";
    if (state.recoveryTimer.remaining === 0) {
      stopRecoveryTimer();
      state.recoveryTimer.stage = "choose";
      persistSession();
      render();
      window.requestAnimationFrame(() => app.querySelector(".recovery-criterion, .recovery-skip")?.focus());
      announce("Temps écoulé. Choisissez au maximum un critère complété.");
      return;
    }
    persistSession();
  }, 1000);
}

function toggleRecoveryPause() {
  if (state.recoveryTimer.stage !== "speaking") return;
  state.recoveryTimer.paused = !state.recoveryTimer.paused;
  persistSession();
  render();
  announce(state.recoveryTimer.paused ? "Phrase de rattrapage en pause." : "Phrase de rattrapage reprise.");
}

function addRecoverySeconds() {
  if (state.recoveryTimer.stage !== "speaking") return;
  state.recoveryTimer.remaining += 10;
  persistSession();
  render();
  showToast("10 secondes ajoutées au rattrapage.");
}

function stopRecoveryTimer() {
  window.clearInterval(recoveryHandle);
  recoveryHandle = null;
}

function finishRecovery(criterionId = null) {
  const side = state.recoveryTimer.side;
  if (!side || state.recoveryTimer.stage !== "choose") return;
  const criterion = SCORE_CRITERIA.find((item) => item.id === criterionId);
  if (criterion && !state.score.debate[side][criterion.id]) {
    state.score.debate[side][criterion.id] = true;
    state.recoveryAwarded[side] = criterion.id;
    announce(sideName(side) + " complète le critère " + criterion.short + ".");
  } else {
    state.recoveryAwarded[side] = "none";
    announce("Aucun critère ajouté pour " + sideName(side) + ".");
  }
  state.recoveryTimer = { side: null, remaining: 0, stage: "idle", paused: false };
  persistSession();
  render();
  window.requestAnimationFrame(() => app.querySelector(".recovery-strip")?.focus({ preventScroll: true }));
}

function submitScore() {
  if (state.recoveryTimer.side) {
    showToast("Terminez d’abord la phrase de rattrapage.");
    return;
  }
  const criterionIds = activeScoreCriteria().map((criterion) => criterion.id);
  if (isScoreEmpty(state.score, criterionIds) &&
      !window.confirm("Aucun critère n’est coché. Valider cette manche avec un score de 0 à 0 ?")) {
    return;
  }
  captureLastStep();
  stopRecoveryTimer();
  const result = calculateRound(state.score, state.settings.twistEnabled, state.twistSkipped, criterionIds);
  for (const side of ["A", "B"]) {
    state.totals[side].base += result[side].base;
    state.totals[side].twist += result[side].twist;
    state.totals[side].language += result[side].language;
    state.totals[side].interaction += result[side].interaction;
  }
  state.history.push({
    round: state.round,
    cardId: state.cardId,
    cardTitle: currentCard().titre,
    result,
    twistTitle: state.twist ? state.twist.title : null,
    twistSkipped: state.twistSkipped,
    helps: { ...state.helps },
  });
  state.playedCardIds.push(state.cardId);
  state.screen = "roundResult";
  persistSession();
  emitIntegrationEvent("round-completed", {
    attemptId: state.integrationAttemptId,
    round: state.round,
    roundsPlanned: state.settings.rounds,
    cardId: state.cardId,
    result,
    totals: integrationTotals(),
  });
  render(true);
  announce("Résultat de la manche " + state.round + ".");
}

function renderRoundResult() {
  const latest = state.history[state.history.length - 1];
  const totalA = latest.result.A.base + latest.result.A.twist;
  const totalB = latest.result.B.base + latest.result.B.twist;
  const winner = decideWinner(totalA, totalB, latest.result.A.interaction, latest.result.B.interaction);
  const decidedByInteraction = totalA === totalB && winner !== "tie";
  const isLast = state.round >= state.settings.rounds;
  const title = winner === "tie" ? "Manche partagée" : sideName(winner) + " remporte la manche";
  return (
    '<section class="result-screen">' +
      '<div class="result-mark" aria-hidden="true">' + (winner === "tie" ? "=" : "✓") + "</div>" +
      '<div class="screen-kicker">Résultat · Manche ' + state.round + "</div>" +
      '<h1 tabindex="-1" data-screen-title>' + esc(title) + "</h1>" +
      '<p class="result-card-title">' + esc(latest.cardTitle) + "</p>" +
      '<div class="round-score-cards">' + roundScoreCard("A", latest.result.A, maxDebateScore()) + roundScoreCard("B", latest.result.B, maxDebateScore()) + "</div>" +
      (decidedByInteraction ? '<p class="tie-break-note">Égalité de points départagée par D3 « Trace d’écoute » + D4 « Réponse directe ».</p>' : "") +
      '<div class="running-total"><span>Total de la partie</span><strong>' + esc(sideName("A")) + " " +
        (state.totals.A.base + state.totals.A.twist) + " — " + (state.totals.B.base + state.totals.B.twist) + " " + esc(sideName("B")) + "</strong></div>" +
      '<div class="result-actions">' + renderUndoButton("Corriger la grille") + '<button class="primary-action compact" type="button" data-action="' +
        (isLast ? "show-summary" : "next-round") + '">' + (isLast ? "Voir le résultat final" : "Passer à la manche suivante") +
        ' <span aria-hidden="true">→</span></button></div>' +
    "</section>"
  );
}

function roundScoreCard(side, result, maxBase) {
  return '<article><span class="side-avatar large" aria-hidden="true">' + side + "</span><strong>" + esc(sideName(side)) + "</strong>" +
    '<div><p><b>' + result.base + "</b><small>/" + maxBase + " débat</small></p><p><b>+" + result.twist + "</b><small>Twist</small></p>" +
    (state.settings.scoreMode === "full" ? '<p><b>' + result.language + '</b><small>★ langue</small></p>' : '<p><b>—</b><small>langue non notée</small></p>') +
    "</div></article>";
}

function nextRound() {
  captureLastStep();
  state.round += 1;
  drawRoundCard();
}

function renderSummary() {
  const totalA = state.totals.A.base + state.totals.A.twist;
  const totalB = state.totals.B.base + state.totals.B.twist;
  const winner = decideWinner(totalA, totalB, state.totals.A.interaction, state.totals.B.interaction);
  const title = winner === "tie" ? "Victoire partagée" : sideName(winner) + " gagne la partie";
  const maxBase = state.settings.rounds * maxDebateScore();
  const maxTwist = state.settings.twistEnabled ? state.settings.rounds : 0;
  const historyRows = state.history.map((entry) => {
    return '<div class="history-row"><span>Manche ' + entry.round + "</span><p>" + esc(entry.cardTitle) + "</p><b>" +
      (entry.result.A.base + entry.result.A.twist) + " — " + (entry.result.B.base + entry.result.B.twist) + "</b></div>";
  }).join("");
  const maxLanguage = state.settings.rounds * 3;
  const learningPanel = state.settings.scoreMode === "full"
    ? '<div class="learning-panel"><strong>Bilan de progression</strong><div>' +
      '<p><span>' + esc(sideName("A")) + '</span><b aria-label="' + state.totals.A.language + ' étoiles sur ' + maxLanguage + '"><span aria-hidden="true">' +
        "★".repeat(state.totals.A.language) + "☆".repeat(Math.max(0, maxLanguage - state.totals.A.language)) + "</span></b></p>" +
      '<p><span>' + esc(sideName("B")) + '</span><b aria-label="' + state.totals.B.language + ' étoiles sur ' + maxLanguage + '"><span aria-hidden="true">' +
        "★".repeat(state.totals.B.language) + "☆".repeat(Math.max(0, maxLanguage - state.totals.B.language)) + "</span></b></p>" +
      '</div><small>Clarté · Connecteur tenté · Réemploi. Ces étoiles restent hors victoire.</small></div>'
    : '<div class="learning-panel"><strong>Bilan de progression</strong><p class="not-evaluated">La progression linguistique n’a pas été notée en mode essentiel.</p></div>';
  return (
    '<section class="summary-screen">' +
      '<div class="summary-hero"><div class="confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' +
        '<div class="screen-kicker">Partie terminée · ' + esc(getLevel().code) + "</div>" +
        '<h1 tabindex="-1" data-screen-title>' + esc(title) + "</h1>" +
        '<p>Le résultat valorise surtout la capacité à écouter et à répondre.</p></div>' +
      '<div class="final-score-grid">' +
        finalScoreCard("A", maxBase, maxTwist, winner === "A") +
        '<div class="final-versus">VS</div>' +
        finalScoreCard("B", maxBase, maxTwist, winner === "B") +
      "</div>" +
      '<div class="summary-details"><div class="history-panel"><strong>Les manches</strong>' + historyRows + "</div>" + learningPanel + "</div>" +
      '<div class="summary-actions">' + renderUndoButton("Revenir au résultat") +
        '<button class="secondary-action" type="button" data-action="print-summary">Imprimer / enregistrer en PDF</button>' +
        '<button class="secondary-action" type="button" data-action="new-setup">Modifier les réglages</button>' +
        '<button class="primary-action compact" type="button" data-action="replay">Rejouer avec les mêmes réglages <span aria-hidden="true">↻</span></button></div>' +
    "</section>"
  );
}

function finalScoreCard(side, maxBase, maxTwist, winner) {
  const total = state.totals[side].base + state.totals[side].twist;
  return '<article class="final-score-card ' + (winner ? "is-winner" : "") + '"><span class="side-avatar large" aria-hidden="true">' + side + "</span><strong>" +
    esc(sideName(side)) + "</strong><b>" + total + "</b><small>points au total</small><div><span>" +
    state.totals[side].base + "/" + maxBase + " débat</span><span>+" + state.totals[side].twist + "/" + maxTwist + " Twist</span></div></article>";
}

function renderError(message) {
  return '<section class="loading-card"><h1 tabindex="-1" data-screen-title>Le jeu ne peut pas continuer</h1><p>' + esc(message) +
    '</p><div class="error-actions"><button class="secondary-action" type="button" data-action="reset-error">Réinitialiser</button>' +
    '<button class="primary-action compact" type="button" data-action="retry-load">Réessayer</button></div></section>';
}

function toggleTimer() {
  if (state.timer.running) {
    stopTimer();
    persistSession();
    updateTimerDisplay();
    return;
  }
  if (state.timer.remaining <= 0) return;
  state.timer.running = true;
  state.timer.started = true;
  timerHandle = window.setInterval(() => {
    state.timer.remaining = Math.max(0, state.timer.remaining - 1);
    if (state.timer.remaining === 0) {
      state.timer.expired = true;
      stopTimer();
      announce("Temps écoulé. Terminez votre phrase, puis avancez manuellement.");
    }
    persistSession();
    updateTimerDisplay();
  }, 1000);
  updateTimerDisplay();
}

function stopTimer() {
  window.clearInterval(timerHandle);
  timerHandle = null;
  state.timer.running = false;
}

function resetTimer() {
  stopTimer();
  state.timer.remaining = state.timer.initial;
  state.timer.started = false;
  state.timer.expired = false;
  persistSession();
  updateTimerDisplay();
}

function addTimerSeconds() {
  state.timer.remaining += 10;
  state.timer.expired = false;
  persistSession();
  updateTimerDisplay();
  showToast("10 secondes ajoutées.");
}

function updateTimerDisplay() {
  const value = document.querySelector("#timerValue");
  const status = document.querySelector("#timerStatus");
  const contextValue = document.querySelector("#contextTimer");
  const projectionValue = document.querySelector("#projectionTimer");
  const projectionStatus = document.querySelector("#projectionTimerStatus");
  const card = value ? value.closest(".timer-card") : null;
  if (value) value.textContent = formatTime(state.timer.remaining);
  if (contextValue) contextValue.textContent = formatTime(state.timer.remaining);
  if (projectionValue) {
    projectionValue.textContent = formatTime(state.timer.remaining);
    projectionValue.classList.toggle("is-expired", state.timer.expired);
    projectionValue.setAttribute("aria-label", state.timer.expired ? "Temps écoulé" : "Temps restant " + formatTime(state.timer.remaining));
  }
  if (projectionStatus) {
    projectionStatus.textContent = state.timer.expired ? "Temps écoulé" : state.timer.running ? "En cours" : "Temps restant";
    projectionStatus.classList.toggle("is-expired", state.timer.expired);
  }
  if (status) status.textContent = timerStatusText();
  if (card) card.classList.toggle("is-expired", state.timer.expired);
  const toggle = document.querySelector('[data-action="timer-toggle"]');
  if (toggle) {
    toggle.disabled = state.timer.expired;
    toggle.textContent = state.timer.expired ? "Terminé" : state.timer.running ? "Pause" : state.timer.started ? "Reprendre" : "Démarrer";
  }
}

function listenCard() {
  const card = currentCard();
  if (!card) return;
  speakText(
    card.titre + ". " + card.situation + ". Question : " + card.question_centrale +
    ". Position 1 : " + card.camp_pour + ". Position 2 : " + card.camp_contre,
    "Lecture de la carte en cours."
  );
}

function listenTurn() {
  const card = currentCard();
  const phase = currentPhase();
  if (!card || !phase.side) return;
  const position = positionForSide(phase.side, phase);
  speakText(
    sideName(phase.side) + ". " + promptForPhase(phase) + ". Question : " + card.question_centrale +
    ". Ton camp : " + campText(card, position) + ".",
    "Lecture de la consigne et du camp en cours."
  );
}

function speakText(text, confirmation) {
  if (!("speechSynthesis" in window)) {
    showToast("La lecture audio n’est pas disponible sur cet appareil.");
    return;
  }
  stopAudio();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
  showToast(confirmation);
}

function stopAudio() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function resetAfterError() {
  stopTimer();
  stopRecoveryTimer();
  stopAudio();
  clearSession();
  state.lastStep = null;
  const audit = validateCardSet(allCards);
  if (audit.valid) {
    state.screen = "setup";
    state.round = 0;
    state.cardId = null;
    render(true);
    announce("Retour à l’accueil.");
    return;
  }
  allCards = [];
  initialize();
}

function returnHome() {
  if (!allCards.length) {
    initialize();
    return;
  }
  const active = !["setup", "summary", "rules"].includes(state.screen);
  if (active && !window.confirm("Quitter la partie en cours ? Les scores et les cartes tirées seront effacés.")) return;
  stopTimer();
  stopRecoveryTimer();
  stopAudio();
  clearSession();
  state.ui.teacherDeskOpen = false;
  state.screen = "setup";
  state.round = 0;
  state.cardId = null;
  state.history = [];
  state.totals = emptyTotals();
  state.lastStep = null;
  render(true);
  announce("Retour à l’accueil.");
}

function setTeacherDeskOpen(open) {
  state.ui.teacherDeskOpen = Boolean(open);
  render();
  window.requestAnimationFrame(() => {
    if (state.ui.teacherDeskOpen) {
      app.querySelector('#teacherDesk [data-action="close-teacher-desk"]')?.focus({ preventScroll: true });
    } else {
      teacherDeskTrigger.focus({ preventScroll: true });
    }
  });
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  const value = button.dataset.value;
  if (action === "home") returnHome();
  else if (action === "toggle-teacher-desk") setTeacherDeskOpen(!state.ui.teacherDeskOpen);
  else if (action === "open-teacher-desk") setTeacherDeskOpen(true);
  else if (action === "close-teacher-desk") setTeacherDeskOpen(false);
  else if (action === "toggle-advanced") {
    state.ui.setupAdvancedOpen = !state.ui.setupAdvancedOpen;
    render();
  } else if (action === "select-preset") {
    applyPreset(value);
  }
  else if (action === "reset-error") resetAfterError();
  else if (action === "select-school") {
    state.settings.schoolLevel = value;
    state.settings.themeFilter = "all";
    state.settings.sensitivityFilter = "all";
    ensureSupportedSelection();
    savePreferences();
    render();
  } else if (action === "select-level") {
    state.settings.level = Number(value);
    state.settings.rounds = state.settings.level === 1 ? 2 : 3;
    state.settings.twistEnabled = state.settings.level !== 1;
    ensureSupportedSelection();
    savePreferences();
    render();
  } else if (action === "select-mode") {
    state.settings.mode = value;
    savePreferences();
    render();
  } else if (action === "select-team-size") {
    state.settings.teamSize = Number(value);
    savePreferences();
    render();
  } else if (action === "select-rounds") {
    state.settings.rounds = Number(value);
    ensureSupportedSelection();
    savePreferences();
    render();
  } else if (action === "select-access") {
    state.settings.accessMode = value;
    savePreferences();
    render();
  } else if (action === "select-score-mode") {
    state.settings.scoreMode = value;
    savePreferences();
    render();
  } else if (action === "select-display-mode") {
    state.settings.displayMode = value;
    savePreferences();
    render();
  } else if (action === "toggle-twist") {
    state.settings.twistEnabled = !state.settings.twistEnabled;
    savePreferences();
    render();
  } else if (action === "show-rules") {
    state.screen = "rules";
    persistSession();
    render(true);
  } else if (action === "back-setup" || action === "new-setup") {
    stopTimer();
    stopRecoveryTimer();
    clearSession();
    state.screen = "setup";
    state.lastStep = null;
    render(true);
  } else if (action === "start-game" || action === "replay") {
    startGame();
  } else if (action === "choose-assignment") {
    const chooser = assignmentChooser() || "A";
    const other = otherSide(chooser);
    state.assignments = { [chooser]: value, [other]: value === "pour" ? "contre" : "pour" };
    persistSession();
    render();
  } else if (action === "change-assignment") {
    if (!canChooseAssignment()) return;
    state.assignments = null;
    persistSession();
    render();
  } else if (action === "set-starter") {
    state.starter = value;
    persistSession();
    render();
  } else if (action === "pass-card") {
    const side = value;
    const remainingFutureRounds = Math.max(0, state.settings.rounds - state.round);
    if (state.deck.length <= remainingFutureRounds) {
      showToast("Les cartes restantes sont réservées aux prochaines manches.");
      return;
    }
    if (state.passUsed[side] && !window.confirm("Ce camp a déjà utilisé son passage libre. Le modérateur autorise-t-il une nouvelle carte ?")) return;
    if (!state.passUsed[side]) state.passUsed[side] = true;
    state.skippedCardIds.push(state.cardId);
    replaceCard();
    showToast(sideName(side) + " a passé la carte sans pénalité.");
  } else if (action === "listen-card") {
    listenCard();
  } else if (action === "listen-turn") {
    listenTurn();
  } else if (action === "stop-audio") {
    stopAudio();
    showToast("Lecture audio arrêtée.");
  } else if (action === "begin-prep") {
    beginPreparation();
  } else if (action === "reveal-help") {
    state.helps[value] = Math.min(3, state.helps[value] + 1);
    persistSession();
    render();
  } else if (action === "timer-toggle") {
    toggleTimer();
  } else if (action === "timer-reset") {
    resetTimer();
  } else if (action === "timer-add") {
    addTimerSeconds();
  } else if (action === "recovery-pause") {
    toggleRecoveryPause();
  } else if (action === "recovery-add") {
    addRecoverySeconds();
  } else if (action === "next-phase") {
    advancePhase();
  } else if (action === "skip-twist") {
    skipTwist();
  } else if (action === "toggle-score") {
    const side = button.dataset.side;
    const group = button.dataset.group;
    if (group === "debate" && state.recoveryTimer.side === side) {
      showToast("Terminez le rattrapage avant de modifier ce score.");
      return;
    }
    if (group === "twist") state.score.twist[side] = !state.score.twist[side];
    else state.score[group][side][value] = !state.score[group][side][value];
    persistSession();
    render();
  } else if (action === "toggle-recovery") {
    startRecovery(value);
  } else if (action === "recovery-criterion") {
    finishRecovery(value);
  } else if (action === "finish-recovery") {
    finishRecovery();
  } else if (action === "submit-score") {
    submitScore();
  } else if (action === "undo-step") {
    undoLastStep();
  } else if (action === "next-round") {
    nextRound();
  } else if (action === "show-summary") {
    captureLastStep();
    state.screen = "summary";
    persistSession();
    emitIntegrationCompletion();
    render(true);
    announce("Résultat final de la partie.");
  } else if (action === "print-summary") {
    window.print();
  } else if (action === "retry-load") {
    initialize();
  }
}

function handleChange(event) {
  const control = event.target.closest("[data-setting]");
  if (!control) return;
  const previousTheme = state.settings.themeFilter;
  if (control.dataset.setting === "theme-filter") state.settings.themeFilter = control.value;
  if (control.dataset.setting === "sensitivity-filter") state.settings.sensitivityFilter = control.value;
  if (control.dataset.setting === "side-a-name") state.settings.playerAName = control.value.trim() || "Joueur A";
  if (control.dataset.setting === "side-b-name") state.settings.playerBName = control.value.trim() || "Joueur B";
  ensureSupportedSelection();
  savePreferences();
  render();
  if (previousTheme !== "all" && state.settings.themeFilter === "all" && control.dataset.setting === "sensitivity-filter") {
    showToast("Ce thème n’a pas de carte légère à ce palier : retour au tirage surprise.");
  }
}

function handleInput(event) {
  const control = event.target.closest("[data-setting]");
  if (!control) return;
  if (control.dataset.setting === "side-a-name") state.settings.playerAName = control.value.trim() || "Joueur A";
  else if (control.dataset.setting === "side-b-name") state.settings.playerBName = control.value.trim() || "Joueur B";
  else return;
  savePreferences();
}

function handleKeydown(event) {
  if (event.key === "Escape" && state.ui.teacherDeskOpen) {
    event.preventDefault();
    setTeacherDeskOpen(false);
    return;
  }
  if (event.key === "Tab" && state.ui.teacherDeskOpen) {
    const desk = app.querySelector("#teacherDesk");
    const focusable = desk
      ? [...desk.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.getClientRects().length > 0)
      : [];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const focusOutside = !desk.contains(document.activeElement);
    if (focusOutside || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey && !focusOutside ? last : first).focus({ preventScroll: true });
    }
    return;
  }
  const radio = event.target.closest('[role="radio"][data-radio-group]');
  if (!radio || !["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const group = radio.closest('[role="radiogroup"]');
  const radios = [...group.querySelectorAll('[role="radio"]')].filter((item) => !item.disabled);
  if (!radios.length) return;
  const currentIndex = Math.max(0, radios.indexOf(radio));
  let nextIndex = currentIndex;
  if (["ArrowRight", "ArrowDown"].includes(event.key)) nextIndex = (currentIndex + 1) % radios.length;
  if (["ArrowLeft", "ArrowUp"].includes(event.key)) nextIndex = (currentIndex - 1 + radios.length) % radios.length;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = radios.length - 1;
  event.preventDefault();
  const next = radios[nextIndex];
  const locator = { action: next.dataset.action, value: next.dataset.value };
  next.click();
  window.requestAnimationFrame(() => {
    app.querySelector('[data-action="' + locator.action + '"][data-value="' + locator.value + '"]')?.focus({ preventScroll: true });
  });
}

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
document.addEventListener("change", handleChange);
document.addEventListener("keydown", handleKeydown);

async function loadCardData() {
  try {
    const response = await fetch("./cards.json", { cache: "default" });
    if (!response.ok) throw new Error("Impossible de charger la base de cartes.");
    const data = await response.json();
    try {
      localStorage.setItem(CARDS_CACHE_KEY, JSON.stringify(data));
    } catch {
      // La copie hors connexion reste optionnelle.
    }
    return { data, fromCache: false };
  } catch (networkError) {
    try {
      const cached = JSON.parse(localStorage.getItem(CARDS_CACHE_KEY) || "null");
      if (cached && Array.isArray(cached.cartes)) return { data: cached, fromCache: true };
    } catch {
      // Le message réseau d’origine reste le plus utile.
    }
    throw networkError;
  }
}

async function initialize() {
  try {
    const { data, fromCache } = await loadCardData();
    allCards = normalizeCards(data.cartes || []);
    const audit = validateCardSet(allCards);
    if (!audit.valid) throw new Error("La base doit contenir 74 cartes valides : 20 cartes générales et 54 cartes du programme.");
    ensureSupportedSelection();
    savePreferences();
    const restored = restoreSession();
    if (restored && state.screen === "phase" && currentPhase().kind !== "twist") {
      state.timer.running = false;
    }
    if (restored && state.recoveryTimer && state.recoveryTimer.stage === "speaking") {
      state.recoveryTimer.remaining = 0;
      state.recoveryTimer.stage = "choose";
      persistSession();
    }
    render(true);
    announce(restored ? "Partie restaurée." : "Projet DÉBAT prêt.");
    emitIntegrationEvent("ready", {
      restored,
      screen: state.screen,
      attemptId: state.integrationAttemptId,
    });
    if (fromCache) showToast("Mode hors connexion : cartes chargées depuis cet appareil.");
  } catch (error) {
    app.innerHTML = renderError(error.message);
    focusScreenTitle();
  }
}

initialize();
