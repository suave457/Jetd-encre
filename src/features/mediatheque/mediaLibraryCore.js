export const MEDIA_SECTION = Object.freeze({
  AUDIO: "Audio",
  VIDEOS: "Vidéos",
  BOOKS: "Bouquins",
});

export const MEDIA_SECTIONS = Object.freeze(Object.values(MEDIA_SECTION));

const ALL_SECTIONS = new Set(["", "all", "tous", "toutes"]);

const TYPE_ALIASES = Object.freeze({
  audio: MEDIA_SECTION.AUDIO,
  audios: MEDIA_SECTION.AUDIO,
  podcast: MEDIA_SECTION.AUDIO,
  podcasts: MEDIA_SECTION.AUDIO,
  mp3: MEDIA_SECTION.AUDIO,
  wav: MEDIA_SECTION.AUDIO,
  ogg: MEDIA_SECTION.AUDIO,
  video: MEDIA_SECTION.VIDEOS,
  videos: MEDIA_SECTION.VIDEOS,
  documentaire: MEDIA_SECTION.VIDEOS,
  documentaires: MEDIA_SECTION.VIDEOS,
  mp4: MEDIA_SECTION.VIDEOS,
  webm: MEDIA_SECTION.VIDEOS,
  bouquin: MEDIA_SECTION.BOOKS,
  bouquins: MEDIA_SECTION.BOOKS,
  livre: MEDIA_SECTION.BOOKS,
  livres: MEDIA_SECTION.BOOKS,
  ebook: MEDIA_SECTION.BOOKS,
  ebooks: MEDIA_SECTION.BOOKS,
  pdf: MEDIA_SECTION.BOOKS,
});

function comparable(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function normalizeMediaCandidate(candidate) {
  const raw = String(candidate ?? "").trim().toLowerCase();
  if (raw.startsWith("audio/")) return MEDIA_SECTION.AUDIO;
  if (raw.startsWith("video/")) return MEDIA_SECTION.VIDEOS;
  if (raw === "application/pdf") return MEDIA_SECTION.BOOKS;
  return TYPE_ALIASES[comparable(candidate)] ?? null;
}

/**
 * Ramène les libellés éditoriaux, extensions et types MIME aux trois sections
 * publiques de la médiathèque. Pour une fiche, chaque champ est essayé jusqu'à
 * trouver une valeur reconnue : une section vide ou obsolète ne masque donc
 * pas un `type` ou un `mimeType` exploitable.
 */
export function normalizeMediaSection(value) {
  if (!value || typeof value !== "object") return normalizeMediaCandidate(value);

  const candidates = [
    value.section,
    value.type,
    value.mimeType,
    value.category,
    value.mediaType,
    value.format,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeMediaCandidate(candidate);
    if (normalized !== null) return normalized;
  }
  return null;
}

// Compatibilité avec le premier contrat public du module.
export const normalizeMediaType = normalizeMediaSection;

const audioUrl = "/assets/mediatheque/audio/les-voix-du-quartier.mp3";
const videoUrl = "/assets/mediatheque/video/les-secrets-de-la-medina.webm";
const bookUrl = "/assets/mediatheque/bouquins/petites-histoires-du-maroc.pdf";

const videoTranscript = Object.freeze([
  Object.freeze({
    id: "entree",
    speaker: "Narration",
    text: "Au cœur de la ville, la médina est un quartier ancien entouré de remparts.",
  }),
  Object.freeze({
    id: "ruelles",
    speaker: "Narration",
    text: "Ses ruelles étroites permettent de marcher entre les maisons, les fontaines et les petits commerces.",
  }),
  Object.freeze({
    id: "artisan",
    speaker: "Artisane",
    text: "Dans mon atelier, je dessine d’abord le motif, puis je choisis les couleurs avant de commencer mon travail.",
  }),
  Object.freeze({
    id: "patrimoine",
    speaker: "Narration",
    text: "Les habitants, les artisans et les visiteurs contribuent tous à faire vivre ce patrimoine.",
  }),
  Object.freeze({
    id: "mission",
    speaker: "Consigne",
    text: "Après la vidéo, cite deux lieux de la médina et explique pourquoi il faut les préserver.",
  }),
]);

function freezeContent(content) {
  return Object.freeze({
    ...content,
    competencies: Object.freeze([...(content.competencies ?? [])]),
    ...(content.transcriptSegments
      ? { transcriptSegments: Object.freeze([...content.transcriptSegments]) }
      : {}),
    ...(content.tableOfContents
      ? {
          tableOfContents: Object.freeze(
            content.tableOfContents.map((entry) => Object.freeze({ ...entry })),
          ),
        }
      : {}),
  });
}

/**
 * Trois ressources éditoriales autonomes. Leurs fichiers sont servis par la
 * même origine afin de rester utilisables hors d'un service média externe.
 */
export const DEMO_MEDIA_CONTENTS = Object.freeze([
  freezeContent({
    id: "audio-les-voix-du-quartier",
    section: MEDIA_SECTION.AUDIO,
    type: "Podcast",
    title: "Les voix du quartier",
    summary: "Une promenade sonore pour reconnaître les lieux et les sons d’un quartier marocain.",
    level: "5e AEP",
    cefrLevel: "A1–A2",
    unit: "Unité 3 · Mon quartier",
    competencies: ["Compréhension orale", "Lexique des lieux", "Prise de parole"],
    learningGoal: "Repérer des lieux et raconter un trajet simple au présent.",
    task: "Présente trois lieux de ton quartier dans l’ordre où tu les rencontres.",
    coverUrl: "/assets/generated-1774007681359-1024.webp",
    sourceUrl: audioUrl,
    audioUrl,
    mimeType: "audio/mpeg",
    durationLabel: "55 s",
    language: "fr-MA",
    transcript: [
      "Narratrice — Bonjour ! Aujourd’hui, nous allons écouter les voix d’un quartier marocain.",
      "Yasmine — Je quitte l’école et je marche jusqu’à la place. Devant la boulangerie, le vendeur salue ses clients.",
      "Vendeur — Bonjour Yasmine ! Le pain vient de sortir du four.",
      "Yasmine — Je continue tout droit. À gauche, des enfants lisent à la bibliothèque. Plus loin, le marchand de fruits range des oranges.",
      "Marchand — Bonjour ! Tu peux goûter cette orange, elle vient de Berkane.",
      "Yasmine — Enfin, je traverse le petit jardin avant de rentrer chez moi. Dans mon quartier, chacun connaît les lieux et prend le temps de saluer les autres.",
      "Narratrice — À ton tour : nomme trois lieux de ton quartier et explique le chemin pour aller de l’un à l’autre.",
    ].join("\n"),
    publisher: "Jet d’Encre Éditions",
    rights: "Utilisation pédagogique autorisée sur la plateforme Jet d’Encre.",
    status: "Publié",
    visibility: "Élèves et enseignants",
  }),
  freezeContent({
    id: "video-les-secrets-de-la-medina",
    section: MEDIA_SECTION.VIDEOS,
    type: "Documentaire",
    title: "Les secrets de la médina",
    summary: "Une visite guidée pour observer les ruelles, les métiers et les gestes qui font vivre la médina.",
    level: "5e AEP",
    cefrLevel: "A1–A2",
    unit: "Unité 3 · Patrimoine et ville",
    competencies: ["Compréhension audiovisuelle", "Description", "Culture marocaine"],
    learningGoal: "Décrire un lieu patrimonial avec un vocabulaire précis et accessible.",
    task: "Cite deux éléments observés et propose un geste pour préserver la médina.",
    coverUrl: "/assets/mediatheque/video/les-secrets-de-la-medina-poster.webp",
    sourceUrl: videoUrl,
    videoUrl,
    captionsUrl: "/assets/mediatheque/video/les-secrets-de-la-medina.vtt",
    mimeType: "video/webm",
    durationLabel: "36 s",
    language: "fr-MA",
    transcriptSegments: videoTranscript,
    transcript: videoTranscript.map(({ speaker, text }) => `${speaker} — ${text}`).join("\n"),
    publisher: "Jet d’Encre Éditions",
    rights: "Utilisation pédagogique autorisée sur la plateforme Jet d’Encre.",
    status: "Publié",
    visibility: "Élèves et enseignants",
  }),
  freezeContent({
    id: "bouquin-petites-histoires-du-maroc",
    section: MEDIA_SECTION.BOOKS,
    type: "E-book",
    format: "PDF",
    title: "Petites histoires du Maroc",
    summary: "Trois récits courts pour lire, comprendre et raconter des scènes de la vie quotidienne au Maroc.",
    level: "5e AEP",
    cefrLevel: "A1–A2",
    unit: "Lecture plaisir",
    competencies: ["Lecture autonome", "Compréhension écrite", "Récit"],
    learningGoal: "Comprendre un récit court et en reformuler les étapes essentielles.",
    task: "Choisis une histoire, résume-la en quatre phrases puis raconte une scène semblable de ton quotidien.",
    coverUrl: "/assets/generated-1773971894915-1024.webp",
    sourceUrl: bookUrl,
    pdfUrl: bookUrl,
    mimeType: "application/pdf",
    language: "fr-MA",
    pageCount: 8,
    author: "Collection Jet d’Encre",
    downloadName: "petites-histoires-du-maroc.pdf",
    tableOfContents: [
      { page: 3, title: "Le carnet sous le banc" },
      { page: 5, title: "Au souk des couleurs" },
      { page: 7, title: "Une place plus propre" },
      { page: 8, title: "Deviens le narrateur de ton quartier" },
    ],
    publisher: "Jet d’Encre Éditions",
    rights: "Utilisation pédagogique autorisée sur la plateforme Jet d’Encre.",
    status: "Publié",
    visibility: "Élèves et enseignants",
  }),
]);

// Nom descriptif conservé pour les consommateurs qui ne souhaitent pas
// distinguer les ressources de démonstration des futurs contenus éditoriaux.
export const MEDIA_LIBRARY_CONTENTS = DEMO_MEDIA_CONTENTS;

/**
 * Filtre une collection sur une section. « Tous » conserve uniquement les
 * types appartenant à la médiathèque et écarte, par exemple, les jeux.
 */
export function filterMediaContents(contents = DEMO_MEDIA_CONTENTS, section = "Tous") {
  let source = contents;
  let requestedSection = section;
  if (!Array.isArray(source)) {
    requestedSection = source;
    source = DEMO_MEDIA_CONTENTS;
  }

  const normalizedSection = normalizeMediaType(requestedSection);
  const showAll = ALL_SECTIONS.has(comparable(requestedSection));
  if (!showAll && normalizedSection === null) return [];

  return source.filter((content) => {
    const contentSection = normalizeMediaType(content);
    return contentSection !== null && (showAll || contentSection === normalizedSection);
  });
}

export function getMediaContentById(id, contents = DEMO_MEDIA_CONTENTS) {
  if (!Array.isArray(contents) || id == null || String(id).trim() === "") return null;
  const expectedId = String(id);
  return contents.find((content) => content && String(content.id) === expectedId) ?? null;
}

function normalizePageCount(pageCount) {
  const numeric = Number(pageCount);
  if (!Number.isFinite(numeric) || numeric < 1) return 0;
  return Math.max(1, Math.trunc(numeric));
}

/** Retourne toujours une page entière comprise entre 1 et le total. */
export function clampPdfPage(page, pageCount) {
  const total = normalizePageCount(pageCount);
  if (total === 0) return 1;
  const numeric = Number(page);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(total, Math.max(1, Math.trunc(numeric)));
}

/**
 * Pourcentage entier de pages atteintes. La première page compte comme lue ;
 * une pagination inconnue retourne 0 plutôt qu'une progression trompeuse.
 */
export function calculatePdfProgress(page, pageCount) {
  const total = normalizePageCount(pageCount);
  if (total === 0) return 0;
  return Math.round((clampPdfPage(page, total) / total) * 100);
}

export const getPdfReadingProgress = calculatePdfProgress;
