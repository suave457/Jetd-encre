import { MEDIA_SECTION } from "./mediaLibraryCore.js";

export const MAX_LOCAL_PDF_BYTES = 100 * 1024 * 1024;

// Consumed only behind import.meta.env.DEV. The file is ignored and never published.
export function getLocalTestBook() { return Object.freeze({
  id: "test-momo-chapitre-1",
  section: MEDIA_SECTION.BOOKS,
  type: "PDF",
  title: "Momo part à l’aventure ! — Chapitre 1",
  summary: "À ceux qui viendront après. Document fourni pour tester la liseuse, sans validation scolaire.",
  sourceUrl: "/__local-media/momo-chapitre-1.pdf",
  pdfUrl: "/__local-media/momo-chapitre-1.pdf",
  mimeType: "application/pdf",
  pageCount: 20,
  downloadName: "momo-chapitre-1.pdf",
  isLocalTest: true,
  sizeLabel: "42,2 Mio",
  tableOfContents: [],
}); }

export async function validateLocalPdfFile(file) {
  if (!file || typeof file.slice !== "function") return "Choisis un fichier PDF sur ton appareil.";
  if (!Number.isFinite(file.size) || file.size < 5) return "Ce fichier est vide ou n’est pas un PDF valide.";
  if (file.size > MAX_LOCAL_PDF_BYTES) return "Ce PDF dépasse la limite de 100 Mio pour le test local.";
  if (file.type && file.type !== "application/pdf") return "Choisis un document au format PDF.";
  try {
    const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...bytes) !== "%PDF-") return "Ce fichier ne possède pas une signature PDF valide.";
  } catch {
    return "Ce fichier n’a pas pu être lu. Essaie de le sélectionner à nouveau.";
  }
  return null;
}

export function createLocalPdfBook(file, objectUrl) {
  return {
    id: "test-pdf-local",
    section: MEDIA_SECTION.BOOKS,
    type: "PDF",
    title: file.name.replace(/\.pdf$/iu, "") || "PDF local",
    summary: "Document de test ouvert sur cet appareil uniquement. Aucun téléversement ni validation scolaire.",
    pdfUrl: objectUrl,
    sourceUrl: objectUrl,
    mimeType: "application/pdf",
    downloadName: file.name,
    isLocalTest: true,
    tableOfContents: [],
  };
}
