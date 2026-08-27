import { getMoroccoDateKey } from "../dailyChallengeData.js";

export const MISSION_ZELLIGE_ID = "mission-zellige";
export const MISSION_ZELLIGE_COMPLETION_XP = 20;
export const MISSION_ZELLIGE_LEVEL = "5e AEP";

const missions = [
  {
    id: "retrouver-la-bibliotheque",
    shortTitle: "La bibliothèque",
    title: "Retrouve la bibliothèque",
    eyebrow: "REPÉRAGE DANS LE QUARTIER",
    guide: "Si Ahmed",
    guideRole: "Habitant du quartier",
    imageSrc: "/assets/games/mission-zellige/mission-bibliotheque-v1-1280.webp",
    imageSrcSet: "/assets/games/mission-zellige/mission-bibliotheque-v1-640.webp 640w, /assets/games/mission-zellige/mission-bibliotheque-v1-1280.webp 1280w",
    cardImageSrc: "/assets/games/mission-zellige/mission-bibliotheque-v1-640.webp",
    imageAlt: "Lina demande son chemin sur une place avec un café, une bibliothèque et une fontaine.",
    objective: "Écoute l’indice, repère le bon lieu puis explique sa position.",
    clue: "La bibliothèque est près de la fontaine, à droite du café. On voit des livres derrière sa grande fenêtre bleue.",
    extraHint: "Cherche la porte bleue avec des livres visibles, au fond de la place.",
    skill: "Comprendre et utiliser les repères dans l’espace",
    focus: "55% 50%",
    hotspots: [
      { id: "cafe", label: "Le café", description: "La terrasse sous l’auvent turquoise", x: 19, y: 46, tabletX: 7 },
      { id: "bibliotheque", label: "La bibliothèque", description: "La porte bleue avec des livres visibles", x: 76, y: 30, tabletX: 86, correct: true },
      { id: "fontaine", label: "La fontaine", description: "Le bassin décoré de zellige", x: 72, y: 65, tabletX: 81 },
    ],
    sentencePrompt: "Explique où se trouve la bibliothèque.",
    sentenceHint: "Commence par le lieu, ajoute « se trouve », puis le repère « à droite du café ».",
    transferPrompt: "Regarde autour de toi et situe un autre lieu par rapport à un repère.",
    fragmentLabel: "Le livre bleu",
    pieces: [
      { id: "right", text: "à droite du café." },
      { id: "library", text: "La bibliothèque" },
      { id: "is", text: "se trouve" },
    ],
    correctOrder: ["library", "is", "right"],
    answer: "La bibliothèque se trouve à droite du café.",
    success: "Bravo ! Tu as utilisé « à droite de » pour situer un lieu avec précision.",
  },
  {
    id: "demander-son-chemin",
    shortTitle: "Le chemin",
    title: "Demande ton chemin",
    eyebrow: "PARLER AVEC POLITESSE",
    guide: "Mme Amina",
    guideRole: "Médiatrice du quartier",
    imageSrc: "/assets/games/mission-zellige/mission-chemin-v1-1280.webp",
    imageSrcSet: "/assets/games/mission-zellige/mission-chemin-v1-640.webp 640w, /assets/games/mission-zellige/mission-chemin-v1-1280.webp 1280w",
    cardImageSrc: "/assets/games/mission-zellige/mission-chemin-v1-640.webp",
    imageAlt: "Lina demande son chemin à une dame devant trois directions : un jardin, une école et une boulangerie.",
    objective: "Repère le jardin et formule une question polie pour demander ton chemin.",
    clue: "Le jardin est à gauche de l’école, juste après l’arrêt de bus. Il y a des bancs et beaucoup de fleurs.",
    extraHint: "Observe le côté gauche de l’intersection, derrière l’arrêt de bus.",
    skill: "Demander un renseignement et comprendre une direction",
    focus: "54% 48%",
    hotspots: [
      { id: "jardin", label: "Le jardin", description: "L’espace fleuri à gauche", x: 24, y: 33, tabletX: 12, correct: true },
      { id: "ecole", label: "L’école", description: "Le bâtiment au bout de la rue", x: 55, y: 23, tabletX: 57 },
      { id: "boulangerie", label: "La boulangerie", description: "La boutique bleue à droite", x: 87, y: 43, tabletX: 94 },
    ],
    sentencePrompt: "Demande poliment où se trouve le jardin.",
    sentenceHint: "Commence par « Excusez-moi », pose ta question, puis termine par « s’il vous plaît ».",
    transferPrompt: "Demande oralement le chemin vers un lieu de ton école ou de ton quartier.",
    fragmentLabel: "Le jardin fleuri",
    pieces: [
      { id: "please", text: "s’il vous plaît ?" },
      { id: "where", text: "où se trouve le jardin," },
      { id: "excuse", text: "Excusez-moi," },
    ],
    correctOrder: ["excuse", "where", "please"],
    answer: "Excusez-moi, où se trouve le jardin, s’il vous plaît ?",
    success: "Très bien ! Ta question est claire, complète et respectueuse.",
  },
  {
    id: "aider-au-marche",
    shortTitle: "Le marché",
    title: "Aide au marché",
    eyebrow: "ACHETER ET ÉCHANGER",
    guide: "Khadija",
    guideRole: "Marchande du quartier",
    imageSrc: "/assets/games/mission-zellige/mission-marche-v1-1280.webp",
    imageSrcSet: "/assets/games/mission-zellige/mission-marche-v1-640.webp 640w, /assets/games/mission-zellige/mission-marche-v1-1280.webp 1280w",
    cardImageSrc: "/assets/games/mission-zellige/mission-marche-v1-640.webp",
    imageAlt: "Lina se tient devant trois groupes de produits sur l’étal d’un marché marocain contemporain.",
    objective: "Choisis la bonne commande puis adresse une demande polie à la marchande.",
    clue: "Pour le goûter de l’équipe, il faut exactement deux oranges et un pain rond.",
    extraHint: "Compte les fruits et cherche le pain rond, pas les baguettes.",
    skill: "Exprimer une quantité et formuler une demande",
    focus: "50% 50%",
    hotspots: [
      { id: "oranges-pain-rond", label: "Deux oranges et un pain rond", description: "Le plateau à gauche du comptoir", x: 22, y: 56, tabletX: 9, correct: true },
      { id: "pommes", label: "Des pommes", description: "Le panier au centre", x: 42, y: 50, tabletX: 38 },
      { id: "tomates", label: "Des tomates et des baguettes", description: "Le plateau à droite", x: 60, y: 50, tabletX: 65 },
    ],
    sentencePrompt: "Passe la commande avec politesse.",
    sentenceHint: "Commence par saluer, formule la commande exacte, puis ajoute la formule de politesse.",
    transferPrompt: "Change la quantité ou le produit et formule une nouvelle commande polie.",
    fragmentLabel: "Le pain rond",
    pieces: [
      { id: "order", text: "je voudrais deux oranges et un pain rond," },
      { id: "hello", text: "Bonjour madame," },
      { id: "please", text: "s’il vous plaît." },
    ],
    correctOrder: ["hello", "order", "please"],
    answer: "Bonjour madame, je voudrais deux oranges et un pain rond, s’il vous plaît.",
    success: "Parfait ! Tu as indiqué la quantité et utilisé une formule de politesse.",
  },
  {
    id: "une-idee-pour-le-quartier",
    shortTitle: "Le quartier",
    title: "Imagine une action utile",
    eyebrow: "AGIR ENSEMBLE",
    guide: "L’équipe des voisins",
    guideRole: "Jeunes citoyens",
    imageSrc: "/assets/games/mission-zellige/mission-quartier-v1-1280.webp",
    imageSrcSet: "/assets/games/mission-zellige/mission-quartier-v1-640.webp 640w, /assets/games/mission-zellige/mission-quartier-v1-1280.webp 1280w",
    cardImageSrc: "/assets/games/mission-zellige/mission-quartier-v1-640.webp",
    imageAlt: "Lina et ses amis observent un point de tri, un parterre sec et un espace à nettoyer dans un jardin public.",
    objective: "Choisis une action utile et propose-la à ton équipe avec une raison.",
    clue: "Les jeunes plantes ont besoin d’aide aujourd’hui. Choisis l’action qui leur apportera directement de l’eau.",
    extraHint: "Cherche l’arrosoir posé près du parterre sec.",
    skill: "Proposer une action et expliquer son utilité",
    focus: "52% 50%",
    hotspots: [
      { id: "tri", label: "Trier les déchets", description: "Les trois bacs de recyclage", x: 16, y: 42, tabletX: 3 },
      { id: "arroser", label: "Arroser les plantes", description: "Le parterre sec avec l’arrosoir", x: 52, y: 47, tabletX: 53, correct: true },
      { id: "nettoyer", label: "Nettoyer près du banc", description: "Les papiers à ramasser", x: 78, y: 64, tabletX: 91 },
    ],
    sentencePrompt: "Propose l’action choisie et explique son but.",
    sentenceHint: "Commence par « Nous pouvons », nomme l’action, puis explique son but avec « pour ».",
    transferPrompt: "Propose une autre action utile pour ton quartier et justifie-la.",
    fragmentLabel: "La goutte solidaire",
    pieces: [
      { id: "plants", text: "arroser les plantes" },
      { id: "purpose", text: "pour leur apporter de l’eau." },
      { id: "can", text: "Nous pouvons" },
    ],
    correctOrder: ["can", "plants", "purpose"],
    answer: "Nous pouvons arroser les plantes pour leur apporter de l’eau.",
    success: "Mission réussie ! Tu as proposé une action concrète et expliqué son objectif.",
  },
];

export const MISSION_ZELLIGE_MISSIONS = Object.freeze(
  missions.map((mission, index) => Object.freeze({
    ...mission,
    index,
    hotspots: Object.freeze(mission.hotspots.map((hotspot) => Object.freeze({ ...hotspot }))),
    pieces: Object.freeze(mission.pieces.map((piece) => Object.freeze({ ...piece }))),
    correctOrder: Object.freeze([...mission.correctOrder]),
  })),
);

function dayNumberFromKey(dateKey) {
  const timestamp = Date.parse(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) throw new TypeError("La date de Mission Zellige est invalide.");
  return Math.floor(timestamp / 86_400_000);
}

export function getDailyMissionZellige(value = new Date()) {
  const dateKey = getMoroccoDateKey(value);
  const dayNumber = dayNumberFromKey(dateKey);
  const index = ((dayNumber % MISSION_ZELLIGE_MISSIONS.length) + MISSION_ZELLIGE_MISSIONS.length)
    % MISSION_ZELLIGE_MISSIONS.length;
  const mission = MISSION_ZELLIGE_MISSIONS[index];
  return Object.freeze({
    id: MISSION_ZELLIGE_ID,
    dateKey,
    mission,
    missionIndex: index,
    completionXp: MISSION_ZELLIGE_COMPLETION_XP,
    attemptId: `${MISSION_ZELLIGE_ID}:${dateKey}`,
    awardId: `${MISSION_ZELLIGE_ID}:${dateKey}:completion`,
  });
}

export function getMissionZelligeHistory(attempts = [], userId = null) {
  if (!Array.isArray(attempts)) return [];
  return attempts
    .filter((attempt) => attempt?.quizId === MISSION_ZELLIGE_ID
      && (!userId || attempt.userId === userId)
      && typeof attempt.dailyKey === "string")
    .sort((left, right) => String(right.dailyKey).localeCompare(String(left.dailyKey)));
}

export function getCompletedMissionZellige(attempts, userId, value = new Date()) {
  const dateKey = getMoroccoDateKey(value);
  return getMissionZelligeHistory(attempts, userId)
    .find((attempt) => attempt.dailyKey === dateKey) || null;
}

export function validateMissionZellige(mission) {
  if (!mission || typeof mission !== "object") return false;
  const correctHotspots = mission.hotspots?.filter((hotspot) => hotspot.correct) || [];
  const pieceIds = new Set((mission.pieces || []).map((piece) => piece.id));
  return Boolean(
    mission.id
    && mission.title
    && mission.imageSrc
    && mission.clue
    && mission.sentenceHint
    && mission.transferPrompt
    && mission.fragmentLabel
    && correctHotspots.length === 1
    && mission.hotspots.length === 3
    && mission.correctOrder.length === mission.pieces.length
    && mission.correctOrder.every((id) => pieceIds.has(id)),
  );
}
