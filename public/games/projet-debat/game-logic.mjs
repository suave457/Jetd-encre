export const LEVELS = [
  {
    id: 1,
    code: "A1",
    name: "Choisir et parler",
    mission: "Une position, une raison et une réaction courte.",
    rounds: [2, 3],
    prepSeconds: 60,
    timers: { affirm: 20, respond: 15, adapt: 15 },
  },
  {
    id: 2,
    code: "A2",
    name: "Expliquer",
    mission: "Deux raisons, un exemple et une réponse liée.",
    rounds: [3],
    prepSeconds: 45,
    timers: { affirm: 30, respond: 20, adapt: 20 },
  },
  {
    id: 3,
    code: "B1",
    name: "Défendre et répondre",
    mission: "Reformuler, justifier et réfuter ou concéder.",
    rounds: [3],
    prepSeconds: 45,
    timers: { affirm: 40, respond: 30, adapt: 30 },
  },
  {
    id: 4,
    code: "B2",
    name: "Nuancer et arbitrer",
    mission: "Hiérarchiser, répondre précisément, nuancer et conclure.",
    rounds: [3],
    prepSeconds: 60,
    timers: { affirm: 55, respond: 40, adapt: 40 },
  },
];

export const SCORE_CRITERIA = [
  { id: "d1", short: "D1", label: "Position + raison", description: "La position est compréhensible et accompagnée d’au moins une raison." },
  { id: "d2", short: "D2", label: "Développement", description: "Un exemple, une conséquence, une comparaison ou une précision est ajouté." },
  { id: "d3", short: "D3", label: "Trace d’écoute", description: "Une idée ou un mot de l’autre camp est repris fidèlement." },
  { id: "d4", short: "D4", label: "Réponse directe", description: "La réponse traite réellement l’idée qui vient d’être exprimée." },
  { id: "d5", short: "D5", label: "Adaptation constructive", description: "Une nuance, une concession, une solution ou une synthèse fait avancer l’échange." },
];

export const LANGUAGE_CRITERIA = [
  { id: "l1", short: "L1", label: "Clarté" },
  { id: "l2", short: "L2", label: "Connecteur tenté" },
  { id: "l3", short: "L3", label: "Réemploi" },
];

export const TWISTS = {
  "Change de camp": {
    code: "T01",
    title: "Change de camp",
    instruction: "Échangez vos camps. Chacun donne une nouvelle raison pour sa nouvelle position.",
    success: "Nouvelle position compréhensible et raison distincte.",
  },
  "Donne un exemple": {
    code: "T02",
    title: "Donne un exemple",
    instruction: "Illustrez votre idée par une situation concrète et plausible.",
    success: "Exemple relié à l’argument, sans contradiction.",
  },
  "Trouve un compromis": {
    code: "T03",
    title: "Trouve un compromis",
    instruction: "Proposez une solution qui protège au moins un intérêt de chaque position.",
    success: "Deux intérêts nommés et une solution applicable.",
  },
  "Reconnais un bon argument": {
    code: "T04",
    title: "Reconnais un bon argument",
    instruction: "Citez une idée valable de l’autre camp, puis expliquez ce que vous maintenez.",
    success: "Idée adverse exacte et maintien nuancé de sa position.",
  },
  "Une seule phrase": {
    code: "T05",
    title: "Une seule phrase",
    instruction: "Répondez en une seule phrase complète et claire.",
    success: "Une phrase, une idée principale et un sens compréhensible.",
  },
  "Mot imposé": {
    code: "T06",
    title: "Mot imposé",
    instruction: "Employez le connecteur affiché sans changer le sens de votre réponse.",
    success: "Connecteur présent et relation logique compréhensible.",
  },
};

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function cardsForLevel(cards, level) {
  return cards.filter((card) => Number(card.niveau) === Number(level));
}

export function cardsForSelection(cards, selection = {}) {
  const level = Number(selection.level);
  const schoolLevel = String(selection.schoolLevel || "GENERAL");
  const sensitivity = String(selection.sensitivity || "all");
  return cards.filter((card) =>
    Number(card.niveau) === level &&
    String(card.code_niveau_scolaire || "GENERAL") === schoolLevel &&
    (sensitivity !== "low" || String(card.risque_sensibilite?.niveau || "").toLowerCase() === "faible")
  );
}

export function buildDeck(cards, selection, random = Math.random) {
  const deck = shuffle(cardsForSelection(cards, selection), random);
  const preferredTheme = String(selection?.theme || "all");
  if (preferredTheme !== "all") {
    const preferredIndex = deck.findIndex((card) => String(card.theme_programme || card.categorie) === preferredTheme);
    if (preferredIndex >= 0) {
      const [preferredCard] = deck.splice(preferredIndex, 1);
      deck.push(preferredCard);
    }
  }
  return deck.map((card) => card.identifiant);
}

export function assignmentChooserForRound(levelId, round) {
  if (Number(levelId) === 1) return Number(round) % 2 === 0 ? "B" : "A";
  if (Number(levelId) === 2 && Number(round) === 1) return "A";
  return null;
}

export function buildPhases(starter, twistEnabled) {
  const second = starter === "A" ? "B" : "A";
  const phases = [
    { kind: "prepare", action: "Préparer", side: null },
    { kind: "speak", action: "Affirmer", side: starter },
    { kind: "speak", action: "Affirmer", side: second },
    { kind: "speak", action: "Répondre", side: starter },
    { kind: "speak", action: "Répondre", side: second },
  ];
  if (twistEnabled) {
    phases.push(
      { kind: "twist", action: "Twist", side: null },
      { kind: "adapt", action: "S’adapter", side: second },
      { kind: "adapt", action: "S’adapter", side: starter },
    );
  }
  phases.push({ kind: "score", action: "Score", side: null });
  return phases;
}

export function durationForPhase(levelId, phase) {
  const level = LEVELS.find((item) => item.id === Number(levelId)) || LEVELS[0];
  if (phase.kind === "prepare") return level.prepSeconds;
  if (phase.kind === "adapt") return level.timers.adapt;
  if (phase.action === "Répondre") return level.timers.respond;
  return level.timers.affirm;
}

export function countChecked(values) {
  return Object.values(values || {}).filter(Boolean).length;
}

export function calculateRound(score, twistEnabled, twistSkipped, criterionIds = SCORE_CRITERIA.map(({ id }) => id)) {
  const baseA = criterionIds.filter((id) => Boolean(score.debate.A[id])).length;
  const baseB = criterionIds.filter((id) => Boolean(score.debate.B[id])).length;
  const twistA = twistEnabled && !twistSkipped && score.twist.A ? 1 : 0;
  const twistB = twistEnabled && !twistSkipped && score.twist.B ? 1 : 0;
  const languageA = countChecked(score.language.A);
  const languageB = countChecked(score.language.B);
  const interactionA = Number(Boolean(score.debate.A.d3)) + Number(Boolean(score.debate.A.d4));
  const interactionB = Number(Boolean(score.debate.B.d3)) + Number(Boolean(score.debate.B.d4));
  return { A: { base: baseA, twist: twistA, language: languageA, interaction: interactionA }, B: { base: baseB, twist: twistB, language: languageB, interaction: interactionB } };
}

export function isScoreEmpty(score, criterionIds = SCORE_CRITERIA.map(({ id }) => id)) {
  return ["A", "B"].every((side) =>
    criterionIds.every((id) => !score.debate?.[side]?.[id]) &&
    !score.twist?.[side] &&
    LANGUAGE_CRITERIA.every(({ id }) => !score.language?.[side]?.[id])
  );
}

export function decideWinner(totalA, totalB, interactionA = 0, interactionB = 0) {
  if (totalA > totalB) return "A";
  if (totalB > totalA) return "B";
  if (interactionA > interactionB) return "A";
  if (interactionB > interactionA) return "B";
  return "tie";
}

export function validateCardSet(cards) {
  const ids = new Set(cards.map((card) => card.identifiant));
  const levels = LEVELS.map((level) => cardsForLevel(cards, level.id).length);
  const expectedSchoolCounts = { GENERAL: 20, "4AP": 18, "5AP": 18, "6AP": 18 };
  const expectedThemeLevels = {
    "4AP": [1, 2, 3],
    "5AP": [2, 3, 4],
    "6AP": [2, 3, 4],
  };
  const schools = Object.fromEntries(Object.keys(expectedSchoolCounts).map((code) => [code, 0]));
  const themeGroups = new Map();
  let schemaOk = true;

  for (const card of cards) {
    const school = String(card.code_niveau_scolaire || "GENERAL");
    if (!(school in schools)) schemaOk = false;
    else schools[school] += 1;

    if (!card.identifiant || !card.titre || !card.question_centrale || !card.camp_pour || !card.camp_contre) {
      schemaOk = false;
    }

    if (school !== "GENERAL") {
      if (!card.theme_programme || !Number.isInteger(Number(card.unite_programme))) schemaOk = false;
      const key = school + "::" + String(card.theme_programme || "");
      if (!themeGroups.has(key)) themeGroups.set(key, []);
      themeGroups.get(key).push(Number(card.niveau));
    }
  }

  const schoolCountsOk = Object.entries(expectedSchoolCounts).every(([code, count]) => schools[code] === count);
  const cardsPerThemeOk = themeGroups.size === 18 && [...themeGroups.values()].every((group) => group.length === 3);
  const progressionOk = cardsPerThemeOk && [...themeGroups.entries()].every(([key, group]) => {
    const school = key.split("::")[0];
    return JSON.stringify([...group].sort()) === JSON.stringify(expectedThemeLevels[school]);
  });
  const generalLevelsOk = LEVELS.every((level) =>
    cards.filter((card) => String(card.code_niveau_scolaire || "GENERAL") === "GENERAL" && Number(card.niveau) === level.id).length === 5
  );

  return {
    total: cards.length,
    uniqueIds: ids.size,
    levels,
    schools,
    themes: themeGroups.size,
    cardsPerThemeOk,
    progressionOk,
    schemaOk,
    valid: cards.length === 74 && ids.size === 74 && schoolCountsOk && generalLevelsOk && cardsPerThemeOk && progressionOk && schemaOk,
  };
}
