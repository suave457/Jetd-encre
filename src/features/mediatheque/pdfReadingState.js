import { clampPdfPage } from "./mediaLibraryCore.js";
import { PDF_MAX_ZOOM, PDF_MIN_ZOOM, PDF_ZOOM_STEP } from "./pdfReaderCore.js";

const VERSION = 1;
const MAX_STORED_LENGTH = 512;

function browserStorage() {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

/** No shared anonymous bookmark, and no persistent identity for temporary files. */
export function getPdfReadingStorageKey(userId, book) {
  const bookId = book?.id;
  const source = book?.src || book?.pdfUrl || book?.sourceUrl || "";
  if (![userId, bookId].every((value) => typeof value === "string" && value.trim() && value.length <= 200)) return null;
  if (typeof source !== "string" || !source || /^(blob|data):/i.test(source)) return null;
  return `jde.pdf-reading.v1:${JSON.stringify([userId, bookId])}`;
}

export function normalizePdfReadingState(value, pageCount) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== VERSION) return null;
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) return null;
  const boundedZoom = typeof value.zoom === "number" && Number.isFinite(value.zoom)
    ? Math.min(PDF_MAX_ZOOM, Math.max(PDF_MIN_ZOOM, value.zoom))
    : 1;
  return {
    version: VERSION,
    page: clampPdfPage(typeof value.page === "number" && Number.isFinite(value.page) ? value.page : 1, pageCount),
    zoom: Math.round(boundedZoom / PDF_ZOOM_STEP) * PDF_ZOOM_STEP,
    fitMode: value.fitMode === "width" ? "width" : "page",
  };
}

export function readPdfReadingState(key, pageCount, storage = browserStorage()) {
  if (!key || !storage) return null;
  try {
    const raw = storage.getItem(key);
    if (typeof raw !== "string" || raw.length > MAX_STORED_LENGTH) return null;
    return normalizePdfReadingState(JSON.parse(raw), pageCount);
  } catch { return null; }
}

export function writePdfReadingState(key, value, pageCount, storage = browserStorage()) {
  if (!key || !storage) return false;
  const safe = normalizePdfReadingState({ ...value, version: VERSION }, pageCount);
  if (!safe) return false;
  try {
    storage.setItem(key, JSON.stringify(safe));
    return true;
  } catch { return false; }
}
