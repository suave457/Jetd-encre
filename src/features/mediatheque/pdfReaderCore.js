import { clampPdfPage } from "./mediaLibraryCore.js";

export const INITIAL_PDF_NAVIGATION = Object.freeze({
  page: 1,
  direction: "none",
  turn: 0,
  requestKey: null,
});

/** A table-of-contents request is a command, not a continuously controlled page. */
export function pdfNavigationReducer(state, action) {
  if (action.type === "reset") return { ...INITIAL_PDF_NAVIGATION, turn: state.turn + 1 };
  if (action.type !== "navigate" && action.type !== "request") return state;
  if (!Number.isFinite(Number(action.page)) || !(action.total > 0)) return state;
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
  if (!(pageWidth > 0) || !(pageHeight > 0) || !(viewportWidth > 0)) return 1;
  const widthScale = Math.min(920, viewportWidth) / pageWidth;
  return mode === "width" || !(viewportHeight > 0)
    ? widthScale
    : Math.min(widthScale, viewportHeight / pageHeight);
}
