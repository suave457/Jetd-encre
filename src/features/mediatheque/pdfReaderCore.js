import { clampPdfPage } from "./mediaLibraryCore.js";

export const PDF_MIN_ZOOM = 0.75;
export const PDF_MAX_ZOOM = 1.75;
export const PDF_ZOOM_STEP = 0.25;
const MAX_CANVAS_PIXELS = 6_000_000;
const MAX_CANVAS_DIMENSION = 4096;

export const INITIAL_PDF_NAVIGATION = Object.freeze({
  page: 1,
  direction: "none",
  turn: 0,
  requestKey: null,
});

/** A table-of-contents request is a command, not a continuously controlled page. */
export function pdfNavigationReducer(state, action) {
  if (action.type === "reset") return { ...INITIAL_PDF_NAVIGATION, turn: state.turn + 1 };
  if (!["navigate", "request", "restore"].includes(action.type)) return state;
  if (!Number.isFinite(Number(action.page)) || !Number.isSafeInteger(action.total) || action.total < 1) return state;
  if (action.type === "restore") return {
    ...INITIAL_PDF_NAVIGATION,
    page: clampPdfPage(action.page, action.total),
    turn: state.turn + 1,
  };
  if (action.type === "request" && action.key === state.requestKey) return state;

  const page = clampPdfPage(action.page, action.total);
  const requestKey = action.type === "request" ? action.key : state.requestKey;
  if (page === state.page) return requestKey === state.requestKey ? state : { ...state, requestKey };
  return {
    page,
    direction: page > state.page ? "next" : "previous",
    turn: state.turn + 1,
    requestKey,
  };
}

/** Fit the actual PDF dimensions, including landscape pages, into its reading area. */
export function getPdfFitScale({ pageWidth, pageHeight, viewportWidth, viewportHeight, mode = "page" }) {
  if (![pageWidth, pageHeight, viewportWidth].every((value) => Number.isFinite(value) && value > 0)) return 1;
  const widthScale = Math.min(920, viewportWidth) / pageWidth;
  return mode === "width" || !Number.isFinite(viewportHeight) || !(viewportHeight > 0)
    ? widthScale
    : Math.min(widthScale, viewportHeight / pageHeight);
}

/** Keep the bitmap bounded even for unusually tall or malformed page dimensions. */
export function getPdfCanvasSize(viewport, devicePixelRatio = 1) {
  const width = viewport?.width;
  const height = viewport?.height;
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) return null;
  const deviceScale = Number.isFinite(devicePixelRatio) ? Math.min(2, Math.max(1, devicePixelRatio)) : 1;
  const outputScale = Math.min(
    deviceScale,
    Math.sqrt(MAX_CANVAS_PIXELS / width) / Math.sqrt(height),
    MAX_CANVAS_DIMENSION / width,
    MAX_CANVAS_DIMENSION / height,
  );
  return {
    width: Math.max(1, Math.floor(width * outputScale)),
    height: Math.max(1, Math.floor(height * outputScale)),
    outputScale,
  };
}
