import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEMO_MEDIA_CONTENTS,
  MEDIA_LIBRARY_CONTENTS,
  MEDIA_SECTION,
  MEDIA_SECTIONS,
  calculatePdfProgress,
  clampPdfPage,
  filterMediaContents,
  getMediaContentById,
  getPdfReadingProgress,
  normalizeMediaSection,
  normalizeMediaType,
} from "../src/features/mediatheque/mediaLibraryCore.js";
import { getPdfFitScale, INITIAL_PDF_NAVIGATION, pdfNavigationReducer } from "../src/features/mediatheque/pdfReaderCore.js";
import { createLocalPdfBook, getLocalTestBook, MAX_LOCAL_PDF_BYTES, validateLocalPdfFile } from "../src/features/mediatheque/localPdfCore.js";

const localFile = (relativePath) => fileURLToPath(new URL(relativePath, new URL("../", import.meta.url)));

test("normalise les formats éditoriaux dans les trois sections publiques", () => {
  assert.deepEqual(MEDIA_SECTIONS, ["Audio", "Vidéos", "Bouquins"]);

  for (const value of ["Audio", "Podcast", "podcasts", "WAV", "audio/mpeg"]) {
    assert.equal(normalizeMediaType(value), MEDIA_SECTION.AUDIO, value);
  }
  for (const value of ["Vidéo", "videos", "Documentaire", "WEBM", "video/mp4"]) {
    assert.equal(normalizeMediaType(value), MEDIA_SECTION.VIDEOS, value);
  }
  for (const value of ["Bouquin", "livres", "E-book", "eBook", "PDF", "application/pdf"]) {
    assert.equal(normalizeMediaType(value), MEDIA_SECTION.BOOKS, value);
  }

  assert.equal(normalizeMediaType({ type: "Podcast" }), MEDIA_SECTION.AUDIO);
  assert.equal(normalizeMediaType({ mimeType: "video/webm" }), MEDIA_SECTION.VIDEOS);
  assert.strictEqual(normalizeMediaType, normalizeMediaSection);
  assert.equal(normalizeMediaType("Jeu éducatif"), null);
  assert.equal(normalizeMediaType(null), null);
});

test("essaie section, type puis mimeType sans laisser un champ invalide masquer le suivant", () => {
  assert.equal(
    normalizeMediaSection({ section: "", type: "Podcast", mimeType: "video/webm" }),
    MEDIA_SECTION.AUDIO,
  );
  assert.equal(
    normalizeMediaSection({ section: "Ancienne rubrique", type: "Documentaire", mimeType: "audio/wav" }),
    MEDIA_SECTION.VIDEOS,
  );
  assert.equal(
    normalizeMediaSection({ section: "Ressource", type: "Document", mimeType: "application/pdf" }),
    MEDIA_SECTION.BOOKS,
  );
  assert.equal(
    normalizeMediaSection({ section: "Audio", type: "Documentaire", mimeType: "application/pdf" }),
    MEDIA_SECTION.AUDIO,
  );
  assert.equal(
    normalizeMediaSection({ section: null, type: null, mimeType: "image/webp", format: "PDF" }),
    MEDIA_SECTION.BOOKS,
  );
  assert.equal(
    normalizeMediaSection({ section: "Inconnue", type: "Article", mimeType: "text/plain" }),
    null,
  );
});

test("fournit au moins une ressource FLE publiée dans chaque section", () => {
  assert.strictEqual(MEDIA_LIBRARY_CONTENTS, DEMO_MEDIA_CONTENTS);
  assert.ok(DEMO_MEDIA_CONTENTS.length >= MEDIA_SECTIONS.length);

  for (const section of MEDIA_SECTIONS) {
    const resources = filterMediaContents(DEMO_MEDIA_CONTENTS, section);
    assert.ok(resources.length >= 1, section);
    assert.ok(resources.every((resource) => resource.status === "Publié"), section);
    assert.ok(resources.every((resource) => resource.visibility === "Élèves et enseignants"), section);
    assert.ok(resources.every((resource) => resource.level && resource.cefrLevel), section);
    assert.ok(resources.every((resource) => resource.learningGoal && resource.task), section);
    assert.ok(resources.every((resource) => resource.competencies.length >= 2), section);
  }
});

test("référence uniquement les trois médias locaux attendus et leurs aides d'accès", () => {
  const audio = getMediaContentById("audio-les-voix-du-quartier");
  const video = getMediaContentById("video-les-secrets-de-la-medina");
  const book = getMediaContentById("bouquin-petites-histoires-du-maroc");

  assert.equal(audio?.title, "Les voix du quartier");
  assert.equal(audio?.sourceUrl, "/assets/mediatheque/audio/les-voix-du-quartier.mp3");
  assert.equal(audio?.audioUrl, audio?.sourceUrl);
  assert.equal(audio?.mimeType, "audio/mpeg");
  assert.equal(audio?.language, "fr-MA");
  assert.ok(audio?.transcript.includes("Narratrice —"));
  assert.ok(audio?.transcript.split("\n").length >= 6);

  assert.equal(video?.title, "Les secrets de la médina");
  assert.equal(video?.sourceUrl, "/assets/mediatheque/video/les-secrets-de-la-medina.webm");
  assert.equal(video?.videoUrl, video?.sourceUrl);
  assert.equal(video?.mimeType, "video/webm");
  assert.equal(video?.captionsUrl, "/assets/mediatheque/video/les-secrets-de-la-medina.vtt");
  assert.ok(video?.transcriptSegments.length >= 4);
  assert.ok(video?.transcriptSegments.every((segment) => segment.speaker && segment.text));
  assert.ok(Object.isFrozen(video?.transcriptSegments));
  assert.ok(video?.transcript.includes("médina"));

  assert.equal(book?.title, "Petites histoires du Maroc");
  assert.equal(book?.sourceUrl, "/assets/mediatheque/bouquins/petites-histoires-du-maroc.pdf");
  assert.equal(book?.pdfUrl, book?.sourceUrl);
  assert.equal(book?.mimeType, "application/pdf");
  assert.equal(book?.pageCount, 8);
  assert.deepEqual(book?.tableOfContents, [
    { page: 3, title: "Le carnet sous le banc" },
    { page: 5, title: "Au souk des couleurs" },
    { page: 7, title: "Une place plus propre" },
    { page: 8, title: "Deviens le narrateur de ton quartier" },
  ]);
  assert.ok(Object.isFrozen(book?.tableOfContents));
  assert.ok(book?.tableOfContents.every(({ page }) => page >= 1 && page <= book.pageCount));

  for (const content of DEMO_MEDIA_CONTENTS) {
    assert.match(content.sourceUrl, /^\/assets\/mediatheque\//);
    assert.ok(!content.sourceUrl.includes("example"), content.id);
    assert.match(content.mimeType, /^(audio|video|application)\//, content.id);
    assert.equal(content.language, "fr-MA", content.id);
    assert.ok(content.summary && content.learningGoal && content.task, content.id);
    assert.ok(content.coverUrl?.startsWith("/assets/"), content.id);
    assert.ok(content.publisher && content.rights, content.id);
  }
});

test("filtre les contenus par section et écarte les formats hors médiathèque", () => {
  const mixedContents = [
    ...DEMO_MEDIA_CONTENTS,
    { id: "jeu-1", type: "Jeu éducatif", title: "Jeu séparé" },
    { id: "podcast-2", type: "audio/ogg", title: "Autre écoute" },
  ];

  assert.equal(filterMediaContents(mixedContents, "Audio").length, 2);
  assert.deepEqual(
    filterMediaContents(mixedContents, "Vidéos").map(({ id }) => id),
    ["video-les-secrets-de-la-medina"],
  );
  assert.deepEqual(
    filterMediaContents(mixedContents, "Bouquins").map(({ id }) => id),
    ["bouquin-petites-histoires-du-maroc"],
  );
  assert.equal(filterMediaContents(mixedContents, "Tous").length, 4);
  assert.deepEqual(filterMediaContents(mixedContents, "Section inconnue"), []);
  assert.equal(filterMediaContents("Podcast")[0].id, "audio-les-voix-du-quartier");
});

test("retrouve strictement un contenu par identifiant", () => {
  assert.equal(
    getMediaContentById("video-les-secrets-de-la-medina")?.title,
    "Les secrets de la médina",
  );
  assert.equal(getMediaContentById("VIDEO-LES-SECRETS-DE-LA-MEDINA"), null);
  assert.equal(getMediaContentById(""), null);
  assert.equal(getMediaContentById("absent"), null);
  assert.equal(getMediaContentById("audio-les-voix-du-quartier", null), null);
});

test("borne la page PDF et calcule une progression entière", () => {
  assert.equal(clampPdfPage(-3, 8), 1);
  assert.equal(clampPdfPage(0, 8), 1);
  assert.equal(clampPdfPage(3.9, 8), 3);
  assert.equal(clampPdfPage("5", 8), 5);
  assert.equal(clampPdfPage(99, 8), 8);
  assert.equal(clampPdfPage(Number.NaN, 8), 1);
  assert.equal(clampPdfPage(4, 0), 1);

  assert.equal(calculatePdfProgress(1, 8), 13);
  assert.equal(calculatePdfProgress(4, 8), 50);
  assert.equal(calculatePdfProgress(99, 8), 100);
  assert.equal(calculatePdfProgress(-1, 8), 13);
  assert.equal(calculatePdfProgress(3, 0), 0);
  assert.equal(getPdfReadingProgress(6, 8), 75);
});

test("garantit des identifiants, titres et sources uniques", () => {
  const uniqueSize = (values) => new Set(values).size;
  assert.equal(uniqueSize(DEMO_MEDIA_CONTENTS.map(({ id }) => id)), DEMO_MEDIA_CONTENTS.length);
  assert.equal(uniqueSize(DEMO_MEDIA_CONTENTS.map(({ title }) => title)), DEMO_MEDIA_CONTENTS.length);
  assert.equal(uniqueSize(DEMO_MEDIA_CONTENTS.map(({ sourceUrl }) => sourceUrl)), DEMO_MEDIA_CONTENTS.length);
  assert.ok(Object.isFrozen(DEMO_MEDIA_CONTENTS));
  assert.ok(DEMO_MEDIA_CONTENTS.every(Object.isFrozen));
});

test("livre les vrais fichiers audio, vidéo, sous-titres et PDF", () => {
  const expectedFiles = [
    ["public/assets/mediatheque/audio/les-voix-du-quartier.mp3", 500_000],
    ["public/assets/mediatheque/video/les-secrets-de-la-medina.webm", 1_000_000],
    ["public/assets/mediatheque/video/les-secrets-de-la-medina-poster.webp", 50_000],
    ["public/assets/mediatheque/video/les-secrets-de-la-medina.vtt", 100],
    ["public/assets/mediatheque/bouquins/petites-histoires-du-maroc.pdf", 500_000],
    ["src/features/mediatheque/vendor/pdf.min.mjs", 500_000],
    ["src/features/mediatheque/vendor/pdf.worker.min.mjs", 1_000_000],
  ];

  for (const [relativePath, minimumSize] of expectedFiles) {
    assert.ok(statSync(localFile(relativePath)).size > minimumSize, relativePath);
  }

  assert.ok(
    readFileSync(localFile(expectedFiles[0][0]), { encoding: "latin1", flag: "r" }).startsWith("ID3")
      || readFileSync(localFile(expectedFiles[0][0]), { encoding: "latin1", flag: "r" }).charCodeAt(0) === 0xff,
    "signature MP3",
  );
  assert.equal(readFileSync(localFile(expectedFiles[4][0]), { encoding: "latin1", flag: "r" }).slice(0, 4), "%PDF");
  assert.match(readFileSync(localFile(expectedFiles[3][0]), "utf8"), /^WEBVTT/);
});

test("branche la Médiathèque élève avant la fiche générique", () => {
  const appSource = readFileSync(localFile("src/App.jsx"), "utf8");
  assert.match(appSource, /\["mediatheque","Médiathèque",Books\]/);
  assert.match(appSource, /role==="eleve"&&page==="mediatheque"\?<Suspense/);
  assert.match(appSource, /<StudentMediaLibrary detail=\{detail\}/);
  assert.doesNotMatch(appSource, /Audios & vidéos/);
});

test("la navigation PDF ne rejoue pas la demande du sommaire après Suivante", () => {
  let state = pdfNavigationReducer(INITIAL_PDF_NAVIGATION, { type: "request", page: 1, key: "initial", total: 20 });
  state = pdfNavigationReducer(state, { type: "navigate", page: 2, total: 20 });
  assert.equal(state.page, 2);
  state = pdfNavigationReducer(state, { type: "request", page: 1, key: "initial", total: 20 });
  assert.equal(state.page, 2, "une nouvelle exécution de l’effet ne ramène pas à la page 1");
  state = pdfNavigationReducer(state, { type: "navigate", page: 3, total: 20 });
  assert.equal(state.page, 3);
  state = pdfNavigationReducer(state, { type: "request", page: 5, key: "sommaire-1", total: 20 });
  assert.equal(state.page, 5);
  state = pdfNavigationReducer(state, { type: "navigate", page: 6, total: 20 });
  state = pdfNavigationReducer(state, { type: "request", page: 5, key: "sommaire-1", total: 20 });
  assert.equal(state.page, 6);
  state = pdfNavigationReducer(state, { type: "navigate", page: 5, total: 20 });
  assert.equal(state.page, 5);
  assert.equal(state.direction, "previous");
  state = pdfNavigationReducer(state, { type: "navigate", page: 8, total: 20 });
  state = pdfNavigationReducer(state, { type: "request", page: 5, key: "sommaire-2", total: 20 });
  assert.equal(state.page, 5, "un nouveau clic sur la même entrée est accepté");
});

test("borne les commandes et réinitialise la lecture lors du changement de PDF", () => {
  let state = pdfNavigationReducer(INITIAL_PDF_NAVIGATION, { type: "navigate", page: 99, total: 20 });
  assert.equal(state.page, 20);
  state = pdfNavigationReducer(state, { type: "navigate", page: -3, total: 20 });
  assert.equal(state.page, 1);
  assert.strictEqual(pdfNavigationReducer(state, { type: "navigate", page: Number.NaN, total: 20 }), state);
  assert.strictEqual(pdfNavigationReducer(state, { type: "request", page: 5, key: "pending", total: 0 }), state);
  state = pdfNavigationReducer(state, { type: "request", page: 5, key: "pending", total: 20 });
  assert.equal(state.page, 5);
  state = pdfNavigationReducer(state, { type: "reset" });
  assert.equal(state.page, 1);
  assert.equal(state.requestKey, null);
});

test("la page entière tient dans la zone de lecture ; Largeur agrandit un A4", () => {
  const options = { pageWidth: 595, pageHeight: 842, viewportWidth: 900, viewportHeight: 480 };
  const scale = getPdfFitScale(options);
  assert.ok(options.pageWidth * scale <= options.viewportWidth);
  assert.ok(options.pageHeight * scale <= options.viewportHeight);
  assert.ok(getPdfFitScale({ ...options, mode: "width" }) > scale);
  const landscape = getPdfFitScale({ ...options, pageWidth: 842, pageHeight: 595, viewportWidth: 650 });
  assert.ok(842 * landscape <= 650);
  assert.ok(595 * landscape <= 480);
});

test("le PDF fourni reste un document de test local sans attribution scolaire", () => {
  const LOCAL_TEST_BOOK = getLocalTestBook();
  assert.equal(LOCAL_TEST_BOOK.pageCount, 20);
  assert.equal(LOCAL_TEST_BOOK.isLocalTest, true);
  assert.equal(LOCAL_TEST_BOOK.pdfUrl, "/__local-media/momo-chapitre-1.pdf");
  assert.equal(LOCAL_TEST_BOOK.cefrLevel, undefined);
  assert.equal(LOCAL_TEST_BOOK.level, undefined);
  assert.equal(LOCAL_TEST_BOOK.status, undefined);
  assert.ok(!DEMO_MEDIA_CONTENTS.some(({ id }) => id === LOCAL_TEST_BOOK.id));
});

test("valide taille, format et signature avant de créer un PDF local", async () => {
  const valid = new File(["%PDF-1.7\nExample"], "Mon livre.pdf", { type: "application/pdf" });
  assert.equal(await validateLocalPdfFile(valid), null);
  const unnamedType = new File(["%PDF-1.7\nExample"], "document.pdf");
  assert.equal(await validateLocalPdfFile(unnamedType), null);
  assert.match(await validateLocalPdfFile(new File(["NOT PDF"], "fake.pdf", { type: "application/pdf" })), /signature PDF/);
  assert.match(await validateLocalPdfFile(new File(["%PDF-text"], "fake.txt", { type: "text/plain" })), /format PDF/);
  assert.match(await validateLocalPdfFile(new File([], "empty.pdf")), /vide/);
  assert.match(await validateLocalPdfFile({ size: MAX_LOCAL_PDF_BYTES + 1, slice() {} }), /100 Mio/);
  const local = createLocalPdfBook(valid, "blob:local-reader-test");
  assert.equal(local.title, "Mon livre");
  assert.equal(local.sourceUrl, "blob:local-reader-test");
  assert.equal(local.isLocalTest, true);
  assert.equal(local.cefrLevel, undefined);
});
