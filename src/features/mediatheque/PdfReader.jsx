import { useCallback, useEffect, useId, useReducer, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  DownloadSimple,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import pdfWorkerUrl from "./vendor/pdf.worker.min.mjs?url";
import {
  getPdfCanvasSize,
  getPdfFitScale,
  INITIAL_PDF_NAVIGATION,
  PDF_MAX_ZOOM as MAX_ZOOM,
  PDF_MIN_ZOOM as MIN_ZOOM,
  PDF_ZOOM_STEP as ZOOM_STEP,
  pdfNavigationReducer,
} from "./pdfReaderCore.js";
import { getPdfReadingStorageKey, readPdfReadingState, writePdfReadingState } from "./pdfReadingState.js";
import { useTranscriptPreference } from "./useTranscriptPreference.js";
import "./pdf-reader.css";

const PDFJS_WORKER_URL = pdfWorkerUrl;

let pdfJsPromise = null;

function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import("./vendor/pdf.min.mjs")
      .then((module) => {
        const pdfjs = module?.getDocument ? module : module?.default;
        if (!pdfjs?.getDocument || !pdfjs?.GlobalWorkerOptions) {
          throw new Error("Module PDF.js incomplet");
        }
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return pdfjs;
      })
      .catch((error) => {
        pdfJsPromise = null;
        throw error;
      });
  }
  return pdfJsPromise;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function cancelRender(task) {
  try {
    task?.cancel?.();
  } catch {
    // A finished PDF.js render task may reject a late cancellation.
  }
}

function destroyPdfResource(resource) {
  if (!resource?.destroy) return;
  try {
    const result = resource.destroy();
    result?.catch?.(() => {});
  } catch {
    // Cleanup is best-effort when a request was already interrupted.
  }
}

function isCancellation(error) {
  return error?.name === "RenderingCancelledException" || error?.name === "AbortException";
}

function documentErrorMessage(error, allowFileActions=true) {
  if (error?.name === "PasswordException") {
    return "Ce livre est protégé par un mot de passe et ne peut pas être ouvert ici.";
  }
  if (error?.name === "InvalidPDFException") {
    return "Ce fichier ne semble pas être un PDF valide.";
  }
  if (error?.name === "MissingPDFException" || error?.name === "UnexpectedResponseException") {
    return "Le fichier du livre est introuvable ou momentanément indisponible.";
  }
  return allowFileActions ? "Le lecteur PDF n’a pas pu ouvrir ce livre. Tu peux encore l’ouvrir ou le télécharger ci-dessous." : "Le lecteur PDF n’a pas pu ouvrir ce document. Réessaie ou retourne aux documents.";
}

function textFromPageContent(content) {
  const lines = [];
  let currentLine = "";

  for (const item of content?.items || []) {
    if (typeof item?.str !== "string" || !item.str) continue;
    const fragment = item.str.trim();
    if (fragment) {
      const needsSpace = currentLine && !/^[,.;:!?…%)\]}]/u.test(fragment) && !/[('\u2019-]$/u.test(currentLine);
      currentLine += `${needsSpace ? " " : ""}${fragment}`;
    }
    if (item.hasEOL && currentLine.trim()) {
      lines.push(currentLine.trim());
      currentLine = "";
    }
  }

  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines.join("\n").replace(/[ \t]+\n/gu, "\n").trim();
}

function safeLabel(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function PdfReader({ book, onBack, pageRequest, userId = null, backLabel="Retour à la médiathèque", allowFileActions=true, beforeRead, progressive=false, onAccessError }) {
  const transcriptPreference = useTranscriptPreference();
  const headingId = useId();
  const keyboardHintId = useId();
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const pdfDocumentRef = useRef(null);
  const loadingTaskRef = useRef(null);
  const renderTaskRef = useRef(null);
  const documentGenerationRef = useRef(0);
  const renderGenerationRef = useRef(0);

  const source = safeLabel(book?.src || book?.pdfUrl || book?.sourceUrl, "");
  const title = safeLabel(book?.title, "Livre numérique");
  const metadata = safeLabel(book?.meta || book?.author, "Livre PDF");
  const downloadName = safeLabel(book?.downloadName, "");
  const storageKey = getPdfReadingStorageKey(userId, book);

  const [documentState, setDocumentState] = useState("loading");
  const [documentError, setDocumentError] = useState("");
  const [pageState, setPageState] = useState("idle");
  const [pageError, setPageError] = useState("");
  const [navigation, dispatchNavigation] = useReducer(pdfNavigationReducer, INITIAL_PDF_NAVIGATION);
  const pageNumber = navigation.page;
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState("page");
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  const [pageText, setPageText] = useState("");
  const [textState, setTextState] = useState("idle");
  const [announcement, setAnnouncement] = useState("Préparation du lecteur PDF.");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [resumedPage, setResumedPage] = useState(0);
  const [storageAvailable, setStorageAvailable] = useState(null);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;

    const commitSize = (width, height) => {
      const nextWidth = Math.max(0, Math.floor(width));
      setViewportWidth((current) => (Math.abs(current - nextWidth) > 1 ? nextWidth : current));
      const nextHeight = Math.max(0, Math.floor(height));
      setViewportHeight((current) => (Math.abs(current - nextHeight) > 1 ? nextHeight : current));
    };
    const measure = () => {
      const styles = window.getComputedStyle(node);
      const horizontalPadding = Number.parseFloat(styles.paddingLeft || "0")
        + Number.parseFloat(styles.paddingRight || "0");
      const verticalPadding = Number.parseFloat(styles.paddingTop || "0")
        + Number.parseFloat(styles.paddingBottom || "0");
      commitSize(node.clientWidth - horizontalPadding, node.clientHeight - verticalPadding);
    };

    measure();
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) commitSize(entry.contentRect.width, entry.contentRect.height);
      });
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const generation = documentGenerationRef.current + 1;
    documentGenerationRef.current = generation;
    renderGenerationRef.current += 1;

    cancelRender(renderTaskRef.current);
    renderTaskRef.current = null;
    destroyPdfResource(pdfDocumentRef.current);
    pdfDocumentRef.current = null;
    destroyPdfResource(loadingTaskRef.current);
    loadingTaskRef.current = null;

    setDocumentError("");
    setPageError("");
    setDocumentState("loading");
    setPageState("idle");
    dispatchNavigation({ type: "reset" });
    setZoom(1);
    setFitMode("page");
    setNumPages(0);
    setPageText("");
    setTextState("idle");
    setResumedPage(0);
    setStorageAvailable(null);

    if (!source) {
      setDocumentState("error");
      setDocumentError("Aucun fichier PDF n’est associé à ce livre.");
      setAnnouncement("Impossible d’ouvrir le livre : aucun fichier PDF n’est associé.");
      return undefined;
    }

    let disposed = false;
    let ownedLoadingTask = null;
    let ownedDocument = null;
    setAnnouncement(`Chargement de ${title}.`);

    async function openDocument() {
      try {
        const pdfjs = await loadPdfJs();
        if (disposed || generation !== documentGenerationRef.current) return;

        ownedLoadingTask = pdfjs.getDocument({ url: source, wasmUrl: new URL("/assets/pdfjs/5.7.284/wasm/", window.location.origin).href, isEvalSupported: false, enableXfa: false, ...(progressive?{disableAutoFetch:true,disableStream:true,rangeChunkSize:262144,stopAtErrors:true}:{}) });
        loadingTaskRef.current = ownedLoadingTask;
        const pdfDocument = await ownedLoadingTask.promise;
        if (disposed || generation !== documentGenerationRef.current) {
          destroyPdfResource(pdfDocument);
          return;
        }

        ownedDocument = pdfDocument;
        loadingTaskRef.current = null;
        pdfDocumentRef.current = pdfDocument;
        const total = Number(pdfDocument.numPages);
        if (!Number.isSafeInteger(total) || total < 1) {
          throw new Error("PDF sans page");
        }

        const saved = readPdfReadingState(storageKey, total);
        if (saved) {
          dispatchNavigation({ type: "restore", page: saved.page, total });
          setZoom(saved.zoom);
          setFitMode(saved.fitMode);
          setResumedPage(saved.page > 1 ? saved.page : 0);
        }
        setNumPages(total);
        setDocumentState("ready");
        setPageState("rendering");
        setAnnouncement(`${title} chargé : ${total} page${total > 1 ? "s" : ""}.`);
      } catch (error) {
        if (disposed || generation !== documentGenerationRef.current || isCancellation(error)) return;
        if (loadingTaskRef.current === ownedLoadingTask) loadingTaskRef.current = null;
        if (pdfDocumentRef.current === ownedDocument) pdfDocumentRef.current = null;
        if (ownedDocument) destroyPdfResource(ownedDocument);
        else destroyPdfResource(ownedLoadingTask);
        if ([401,403,404].includes(Number(error?.status))) onAccessError?.();
        setDocumentState("error");
        setDocumentError(documentErrorMessage(error, allowFileActions));
        setAnnouncement(`Impossible d’ouvrir ${title}.`);
      }
    }

    openDocument();

    return () => {
      disposed = true;
      if (documentGenerationRef.current === generation) documentGenerationRef.current += 1;
      renderGenerationRef.current += 1;
      cancelRender(renderTaskRef.current);
      renderTaskRef.current = null;

      if (pdfDocumentRef.current === ownedDocument) {
        pdfDocumentRef.current = null;
        destroyPdfResource(ownedDocument);
      } else if (!ownedDocument && loadingTaskRef.current === ownedLoadingTask) {
        loadingTaskRef.current = null;
        destroyPdfResource(ownedLoadingTask);
      }
    };
  }, [loadAttempt, source, title, storageKey]);

  useEffect(() => {
    const pdfDocument = pdfDocumentRef.current;
    if (documentState !== "ready" || !pdfDocument || !viewportWidth || !numPages) return undefined;

    const generation = renderGenerationRef.current + 1;
    renderGenerationRef.current = generation;
    let disposed = false;
    let ownedRenderTask = null;
    let page = null;

    setPageState("rendering");
    setPageError("");
    setPageText("");
    setTextState("loading");

    async function renderPage() {
      const previousTask = renderTaskRef.current;
      if (previousTask) {
        cancelRender(previousTask);
        try {
          await previousTask.promise;
        } catch {
          // Cancellation is expected before the canvas is reused.
        }
        if (renderTaskRef.current === previousTask) renderTaskRef.current = null;
      }

      if (disposed || generation !== renderGenerationRef.current) return;

      try {
        if(beforeRead)await beforeRead();
        if(disposed || generation !== renderGenerationRef.current)return;
        page = await pdfDocument.getPage(pageNumber);
        if (disposed || generation !== renderGenerationRef.current) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const fittedScale = getPdfFitScale({
          pageWidth: baseViewport.width,
          pageHeight: baseViewport.height,
          viewportWidth,
          viewportHeight,
          mode: fitMode,
        });
        const viewport = page.getViewport({ scale: fittedScale * zoom });
        const bitmap = getPdfCanvasSize(viewport, window.devicePixelRatio);
        if (!bitmap) throw new Error("Dimensions de page PDF invalides");
        const { outputScale } = bitmap;

        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas 2D indisponible");

        const textPromise = page
          .getTextContent()
          .then(textFromPageContent)
          .catch(error => { if ([401,403,404].includes(Number(error?.status))) onAccessError?.(); return null; });

        ownedRenderTask = page.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
          background: "rgb(255, 255, 255)",
          intent: "display",
        });
        renderTaskRef.current = ownedRenderTask;
        await ownedRenderTask.promise;

        if (disposed || generation !== renderGenerationRef.current) return;
        setPageState("ready");
        setAnnouncement(`Page ${pageNumber} sur ${numPages} prête. Zoom ${Math.round(zoom * 100)} %.`);
        // Save only the page that actually rendered, never a pending or failed request.
        if (storageKey) setStorageAvailable(writePdfReadingState(
          storageKey, { page: pageNumber, zoom, fitMode }, numPages,
        ));

        const extractedText = await textPromise;
        if (disposed || generation !== renderGenerationRef.current) return;
        if (extractedText === null) {
          setTextState("error");
          setPageText("");
        } else if (extractedText) {
          setTextState("ready");
          setPageText(extractedText);
        } else {
          setTextState("empty");
          setPageText("");
        }
      } catch (error) {
        if (disposed || generation !== renderGenerationRef.current || isCancellation(error)) return;
        if ([401,403,404].includes(Number(error?.status))) onAccessError?.();
        setPageState("error");
        setTextState("error");
        setPageError(allowFileActions ? "Cette page n’a pas pu être affichée. Réessaie ou ouvre le fichier PDF complet." : "Cette page n’a pas pu être affichée. Réessaie ou retourne aux documents.");
        setAnnouncement(`Erreur pendant l’affichage de la page ${pageNumber}.`);
      } finally {
        if (renderTaskRef.current === ownedRenderTask) renderTaskRef.current = null;
        try {
          page?.cleanup?.();
        } catch {
          // The document-level cleanup will release remaining resources.
        }
      }
    }

    renderPage();

    return () => {
      disposed = true;
      if (renderGenerationRef.current === generation) renderGenerationRef.current += 1;
      cancelRender(ownedRenderTask);
    };
  }, [documentState, numPages, pageNumber, renderAttempt, viewportWidth, viewportHeight, fitMode, zoom, storageKey]);

  const goToPage = useCallback((target) => {
    if (documentState !== "ready" || !numPages) return;
    setResumedPage(0);
    dispatchNavigation({ type: "navigate", page: target, total: numPages });
  }, [documentState, numPages]);

  useEffect(() => {
    const requestedPage = Number(pageRequest?.page);
    if (documentState !== "ready" || !numPages || !Number.isFinite(requestedPage)) return;
    dispatchNavigation({
      type: "request", page: requestedPage, total: numPages,
      key: JSON.stringify([source, pageRequest?.page, pageRequest?.token]),
    });
  }, [documentState, numPages, source, pageRequest?.page, pageRequest?.token]);

  useEffect(() => {
    setPageInput(String(pageNumber));
    viewportRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pageNumber, source]);

  const fitPage = (mode) => {
    setFitMode(mode);
    setZoom(1);
    viewportRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };

  const changeZoom = useCallback((delta) => {
    const next = clamp(Math.round((zoom + delta) * 100) / 100, MIN_ZOOM, MAX_ZOOM);
    if (next === zoom) return;
    setZoom(next);
    setAnnouncement(`Zoom ${Math.round(next * 100)} %.`);
  }, [zoom]);

  const handleReaderKeyDown = (event) => {
    if (event.currentTarget !== event.target || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToPage(pageNumber - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goToPage(pageNumber + 1);
    }
  };

  const retry = () => {
    setAnnouncement("Nouvelle tentative de chargement.");
    if (documentState === "error") setLoadAttempt((current) => current + 1);
    else setRenderAttempt((current) => current + 1);
  };

  const readerReady = documentState === "ready" && numPages > 0;
  const zoomPercent = Math.round(zoom * 100);
  const pageAnimationClass = navigation.direction === "next"
    ? " is-turning-next"
    : navigation.direction === "previous"
      ? " is-turning-previous"
      : "";

  return (
    <section className="pdf-reader" aria-labelledby={headingId}>
      <header className="pdf-reader__header">
        <div className="pdf-reader__heading">
          {typeof onBack === "function" && (
            <button className="pdf-reader__back" type="button" onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
              {backLabel}
            </button>
          )}
          <span className="pdf-reader__eyebrow"><BookOpenText aria-hidden="true" /> Liseuse PDF</span>
          <h2 id={headingId}>{title}</h2>
          <p>{metadata}</p>
        </div>
        {source && allowFileActions && (
          <div className="pdf-reader__file-actions" aria-label="Actions sur le fichier PDF">
            <a href={source} target="_blank" rel="noreferrer">
              Ouvrir le PDF <ArrowRight aria-hidden="true" />
            </a>
            <a href={source} download={downloadName || true}>
              Télécharger <DownloadSimple aria-hidden="true" />
            </a>
          </div>
        )}
      </header>

      {readerReady && storageKey && <div className="pdf-reader__reading-status">
        <p role="status">
          {resumedPage > 1 && <strong>Lecture reprise à la page {resumedPage}. </strong>}
          {storageAvailable === false
            ? "La sauvegarde est indisponible. Tu peux continuer à lire ; ta nouvelle position ne sera pas conservée après fermeture."
            : storageAvailable === true
              ? "Ta page et ton affichage sont enregistrés sur cet appareil pour ton profil."
              : "Ta lecture sera enregistrée après l’affichage de la page."}
        </p>
        {pageNumber > 1 && <button type="button" onClick={() => goToPage(1)}>Revenir à la première page</button>}
      </div>}

      <div className="pdf-reader__shell">
        <div className="pdf-reader__toolbar" role="toolbar" aria-label="Commandes de la liseuse PDF">
          <div className="pdf-reader__toolbar-group">
            <button
              type="button"
              onClick={() => goToPage(pageNumber - 1)}
              disabled={!readerReady || pageNumber <= 1}
            >
              <ArrowLeft aria-hidden="true" />
              Précédente
            </button>
            <form className="pdf-reader__page-jump" onSubmit={(event) => {
              event.preventDefault();
              if (!pageInput.trim()) { setPageInput(String(pageNumber)); return; }
              goToPage(Number(pageInput));
              setPageInput(String(clamp(Math.trunc(Number(pageInput)) || pageNumber, 1, numPages)));
            }}>
              <label>Page <input aria-label="Numéro de page" type="number" inputMode="numeric" min="1" max={numPages || 1} value={pageInput} disabled={!readerReady} onChange={(event) => setPageInput(event.target.value)} /></label>
              <span aria-label={readerReady ? `sur ${numPages} pages` : "Nombre de pages indisponible"}>/ {readerReady ? numPages : "–"}</span>
              <button type="submit" disabled={!readerReady} aria-label="Aller à la page saisie">Aller</button>
            </form>
            <button
              type="button"
              onClick={() => goToPage(pageNumber + 1)}
              disabled={!readerReady || pageNumber >= numPages}
            >
              Suivante
              <ArrowRight aria-hidden="true" />
            </button>
          </div>

          <div className="pdf-reader__display" aria-label="Affichage de la page">
            <button type="button" aria-pressed={fitMode === "page" && zoom === 1} onClick={() => fitPage("page")} disabled={!readerReady}>Page entière</button>
            <button type="button" aria-pressed={fitMode === "width" && zoom === 1} onClick={() => fitPage("width")} disabled={!readerReady}>Largeur</button>
          </div>
          <div className="pdf-reader__zoom" aria-label="Réglage du zoom">
            <button
              type="button"
              aria-label="Réduire le zoom"
              onClick={() => changeZoom(-ZOOM_STEP)}
              disabled={!readerReady || zoom <= MIN_ZOOM}
            >
              −
            </button>
            <output aria-label={`Zoom ${zoomPercent} pour cent`}>{zoomPercent} %</output>
            <button
              type="button"
              aria-label="Augmenter le zoom"
              onClick={() => changeZoom(ZOOM_STEP)}
              disabled={!readerReady || zoom >= MAX_ZOOM}
            >
              +
            </button>
          </div>
        </div>

        <div
          ref={viewportRef}
          className="pdf-reader__viewport"
          role="region"
          tabIndex="0"
          aria-label={readerReady ? `Page ${pageNumber} sur ${numPages} de ${title}` : `Chargement de ${title}`}
          aria-describedby={keyboardHintId}
          aria-keyshortcuts="ArrowLeft ArrowRight"
          aria-busy={documentState === "loading" || pageState === "rendering"}
          onKeyDown={handleReaderKeyDown}
        >
          {documentState === "loading" && (
            <div className="pdf-reader__state" role="status">
              <span className="pdf-reader__spinner" aria-hidden="true" />
              <strong>Ouverture du livre…</strong>
              <p>La première page va apparaître dans quelques instants.</p>
            </div>
          )}

          {documentState === "error" && (
            <div className="pdf-reader__state pdf-reader__state--error" role="alert">
              <WarningCircle aria-hidden="true" />
              <strong>Le livre ne peut pas être affiché</strong>
              <p>{documentError}</p>
              {source && <button type="button" onClick={retry}>Réessayer</button>}
            </div>
          )}

          {readerReady && (
            <figure
              key={`${source}-${pageNumber}-${navigation.turn}`}
              className={`pdf-reader__page${pageAnimationClass}`}
            >
              <canvas ref={canvasRef} aria-hidden="true" />
              {pageState === "rendering" && (
                <div className="pdf-reader__page-overlay" role="status">
                  <span className="pdf-reader__spinner" aria-hidden="true" />
                  <span>Préparation de la page {pageNumber}…</span>
                </div>
              )}
              {pageState === "error" && (
                <div className="pdf-reader__page-overlay pdf-reader__page-overlay--error" role="alert">
                  <WarningCircle aria-hidden="true" />
                  <strong>Affichage interrompu</strong>
                  <span>{pageError}</span>
                  <button type="button" onClick={retry}>Réessayer</button>
                </div>
              )}
              <figcaption>Page {pageNumber} sur {numPages}</figcaption>
            </figure>
          )}
        </div>
      </div>

      {readerReady && (
        <details className="pdf-reader__accessible-text" {...transcriptPreference}>
          <summary>Texte accessible de la page {pageNumber}</summary>
          {textState === "loading" && <p role="status">Extraction du texte en cours…</p>}
          {textState === "ready" && <p>{pageText}</p>}
          {textState === "empty" && <p>Cette page est une image sans texte extractible. Utilise « Largeur » ou le zoom pour lire les bulles. Une version avec transcription reste nécessaire pour une lecture au lecteur d’écran.</p>}
          {textState === "error" && <p>{allowFileActions ? "Le texte de cette page n’a pas pu être extrait. Le PDF complet reste disponible avec les liens ci-dessus." : "Le texte de cette page n’a pas pu être extrait. La lecture visuelle reste possible avec le zoom."}</p>}
        </details>
      )}

      <p id={keyboardHintId} className="pdf-reader__keyboard-hint">
        Flèches gauche et droite sur la page pour feuilleter. Choisis « Largeur » ou le zoom pour lire les petits caractères.
      </p>
      <p className="pdf-reader__sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </section>
  );
}

export default PdfReader;
