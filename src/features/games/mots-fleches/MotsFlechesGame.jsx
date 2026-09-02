import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Check,
  CheckCircle,
  Eraser,
  Keyboard,
  Lightbulb,
  Sparkle,
  Trophy,
  X,
} from "@phosphor-icons/react/ssr";
import { MOTS_FLECHES_GRIDS, MOTS_FLECHES_TOTAL_XP } from "./motsFlechesData.js";
import {
  applyTypedLetter,
  buildGridModel,
  buildMotsFlechesAttemptId,
  buildMotsFlechesAwardId,
  cellKey,
  checkGrid,
  clearEntry,
  createEmptyProgress,
  getDictionaryEntryState,
  getEntryCompletion,
  getEntryValidation,
  getGridLearningSummary,
  getGridProgress,
  isGridReward,
  parseCellKey,
  revealEntryLetter,
  resolveMotsFlechesReward,
  sanitizeProgress,
} from "./motsFlechesEngine.js";
import "./mots-fleches.css";

const STORAGE_VERSION = 3;
const LEVEL_ORDER = Object.freeze(["facile", "normal", "difficile"]);
const LEVEL_GRIDS = new Map(LEVEL_ORDER.map((levelId) => [
  levelId,
  MOTS_FLECHES_GRIDS.filter((grid) => grid.levelId === levelId),
]));
const LEVEL_OPTIONS = Object.freeze(LEVEL_ORDER.map((levelId) => {
  const grids = LEVEL_GRIDS.get(levelId) || [];
  const reference = grids[0];
  return reference ? {
    levelId,
    level: reference.level,
    cefr: reference.cefr,
    xp: reference.xp,
    grids,
  } : null;
}).filter(Boolean));

function defaultExit() {
  window.history.pushState({}, "", "/eleve/jeux");
  window.dispatchEvent(new Event("jde:navigate"));
}

function readSavedProgress(studentId) {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`jde.mots-fleches:v${STORAGE_VERSION}:${studentId || "eleve"}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readSavedHintCounts(studentId) {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`jde.mots-fleches:hints:v${STORAGE_VERSION}:${studentId || "eleve"}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function ArrowIcon({ direction, ...props }) {
  return direction === "down" ? <ArrowDown {...props} /> : <ArrowRight {...props} />;
}

export default function MotsFlechesGame({
  currentXp = 0,
  studentId = "eleve-demo",
  studentName = "Lina Mansouri",
  awardHistory = [],
  onAwardXp = () => ({ ok: true, awarded: true }),
  onComplete = () => ({ ok: true, recorded: true }),
  onExit = defaultExit,
}) {
  const completedGridIds = useMemo(
    () => new Set(MOTS_FLECHES_GRIDS.filter((grid) => awardHistory.some((award) => isGridReward(award, studentId, grid))).map((grid) => grid.id)),
    [awardHistory, studentId],
  );
  const [selectedGridId, setSelectedGridId] = useState(() => MOTS_FLECHES_GRIDS.find((grid) => !completedGridIds.has(grid.id))?.id || MOTS_FLECHES_GRIDS[0].id);
  const [progressByGrid, setProgressByGrid] = useState(() => readSavedProgress(studentId));
  const [activeEntryId, setActiveEntryId] = useState(null);
  const [activeCellKey, setActiveCellKey] = useState(null);
  const [incorrectKeys, setIncorrectKeys] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [hintCounts, setHintCounts] = useState(() => readSavedHintCounts(studentId));
  const [completion, setCompletion] = useState(null);
  const cellRefs = useRef(new Map());
  const levelTabRefs = useRef(new Map());
  const shellRef = useRef(null);
  const completionRef = useRef(null);
  const completionPrimaryRef = useRef(null);
  const previousFocusRef = useRef(null);
  const directInputRef = useRef(null);
  const pendingLevelFocusRef = useRef(null);

  const grid = MOTS_FLECHES_GRIDS.find((item) => item.id === selectedGridId) || MOTS_FLECHES_GRIDS[0];
  const activeLevelGrids = LEVEL_GRIDS.get(grid.levelId) || [grid];
  const currentLevelGridIndex = Math.max(0, activeLevelGrids.findIndex((item) => item.id === grid.id));
  const model = useMemo(() => buildGridModel(grid), [grid]);
  const progress = useMemo(() => sanitizeProgress(model, progressByGrid[grid.id]), [grid.id, model, progressByGrid]);
  const activeEntry = model.entries.get(activeEntryId) || model.entries.values().next().value || null;
  const activeEntryCells = useMemo(() => new Set(activeEntry?.cells.map((item) => item.key) || []), [activeEntry]);
  const progressSummary = getGridProgress(model, progress);
  const dictionaryEntry = getDictionaryEntryState(activeEntry, progress, model);
  const activeEntryValidation = getEntryValidation(activeEntry, progress, model);
  const activeCell = model.cells.get(activeCellKey);
  const activeCellIsCrossing = activeCell?.type === "letter" && activeCell.entryIds.length > 1;
  const currentHintCount = Number(hintCounts[grid.id] || 0);
  const foundEntries = [...model.entries.values()].filter((entry) => getEntryCompletion(entry, progress, model));
  const gridCheck = checkGrid(model, progress);
  const verifyLabel = gridCheck.emptyKeys.length === 0 ? "Terminer la grille" : "Vérifier ce mot";
  const currentGridIndex = MOTS_FLECHES_GRIDS.findIndex((item) => item.id === grid.id);
  const alreadyCompleted = completedGridIds.has(grid.id);
  const studentInitials = String(studentName)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase("fr-FR") || "")
    .join("") || "ÉL";

  useEffect(() => {
    const firstEntry = model.entries.values().next().value || null;
    const firstCell = firstEntry?.cells.find((item) => !progress[item.key]) || firstEntry?.cells[0] || null;
    setActiveEntryId(firstEntry?.id || null);
    setActiveCellKey(firstCell?.key || null);
    setIncorrectKeys([]);
    setFeedback(null);
    setCompletion(null);
    if (pendingLevelFocusRef.current === grid.levelId) {
      pendingLevelFocusRef.current = null;
      window.requestAnimationFrame(() => levelTabRefs.current.get(grid.levelId)?.focus());
    }
  }, [grid.id, grid.levelId, model]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `jde.mots-fleches:v${STORAGE_VERSION}:${studentId || "eleve"}`,
        JSON.stringify(progressByGrid),
      );
    } catch {
      // Le jeu continue en mémoire si le stockage local est bloqué.
    }
  }, [progressByGrid, studentId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `jde.mots-fleches:hints:v${STORAGE_VERSION}:${studentId || "eleve"}`,
        JSON.stringify(hintCounts),
      );
    } catch {
      // Le jeu continue en mémoire si le stockage local est bloqué.
    }
  }, [hintCounts, studentId]);

  useEffect(() => {
    if (!completion) return undefined;
    const shell = shellRef.current;
    previousFocusRef.current = document.activeElement;
    shell?.setAttribute("inert", "");
    shell?.setAttribute("aria-hidden", "true");
    const focusFrame = window.requestAnimationFrame(() => completionPrimaryRef.current?.focus());

    function keepFocusInDialog(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setCompletion(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(completionRef.current?.querySelectorAll("button:not([disabled])") || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", keepFocusInDialog);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", keepFocusInDialog);
      shell?.removeAttribute("inert");
      shell?.removeAttribute("aria-hidden");
      const previous = previousFocusRef.current;
      window.requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus();
      });
    };
  }, [completion]);

  function updateProgress(updater) {
    setProgressByGrid((previous) => {
      const current = sanitizeProgress(model, previous[grid.id]);
      return { ...previous, [grid.id]: updater(current) };
    });
  }

  function focusCell(key) {
    if (!key) return;
    window.requestAnimationFrame(() => cellRefs.current.get(key)?.focus());
  }

  function selectEntry(entryId, preferredKey = null, options = {}) {
    const entry = model.entries.get(entryId);
    if (!entry) return;
    const nextKey = preferredKey || entry.cells.find((item) => !progress[item.key])?.key || entry.cells[0]?.key;
    const { clearMessages = true, focusTarget = "cell" } = options;
    setActiveEntryId(entryId);
    setActiveCellKey(nextKey || null);
    if (clearMessages) {
      setIncorrectKeys([]);
      setFeedback(null);
    }
    if (focusTarget === "input") {
      window.requestAnimationFrame(() => directInputRef.current?.focus({ preventScroll: true }));
    } else if (focusTarget === "cell") {
      focusCell(nextKey);
    }
  }

  function selectLetterCell(cell, focusTarget = "cell") {
    const entryIds = cell.entryIds || [];
    let entryId = entryIds.includes(activeEntryId) ? activeEntryId : entryIds[0];
    if (activeCellKey === cellKey(cell.row, cell.col) && entryIds.length > 1) {
      entryId = entryIds.find((id) => id !== activeEntryId) || entryId;
    }
    selectEntry(entryId, cellKey(cell.row, cell.col), { focusTarget });
  }

  function handleLevelKeyDown(event, index) {
    const offsets = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let nextIndex = index;
    if (Object.prototype.hasOwnProperty.call(offsets, event.key)) {
      nextIndex = (index + offsets[event.key] + LEVEL_OPTIONS.length) % LEVEL_OPTIONS.length;
    } else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = LEVEL_OPTIONS.length - 1;
    else return;
    event.preventDefault();
    const nextLevel = LEVEL_OPTIONS[nextIndex];
    selectLevel(nextLevel.levelId);
    window.requestAnimationFrame(() => levelTabRefs.current.get(nextLevel.levelId)?.focus());
  }

  function goToEntryCell(entry, index, focusTarget = "cell") {
    const bounded = Math.max(0, Math.min(entry.cells.length - 1, index));
    const key = entry.cells[bounded]?.key;
    if (!key) return;
    setActiveCellKey(key);
    if (focusTarget === "input") {
      window.requestAnimationFrame(() => directInputRef.current?.focus({ preventScroll: true }));
    } else if (focusTarget === "cell") {
      focusCell(key);
    }
  }

  function goToAdjacentCell(key, rowDelta, colDelta, preferredDirection = null) {
    const position = parseCellKey(key);
    const next = model.cells.get(cellKey(position.row + rowDelta, position.col + colDelta));
    if (next?.type !== "letter") return;
    const preferred = next.entryIds.find((id) => model.entries.get(id)?.direction === preferredDirection);
    selectEntry(preferred || next.entryIds[0], cellKey(next.row, next.col));
  }

  function handleCellKeyDown(event, cell) {
    const entry = model.entries.get(activeEntryId) || model.entries.get(cell.entryIds[0]);
    if (!entry) return;
    const index = entry.cells.findIndex((item) => item.key === cellKey(cell.row, cell.col));

    if (/^[a-zA-ZÀ-ÖØ-öø-ÿŒœÇç]$/u.test(event.key)) {
      event.preventDefault();
      updateProgress((current) => applyTypedLetter(current, cellKey(cell.row, cell.col), event.key, cell.solution));
      setIncorrectKeys([]);
      setFeedback(null);
      goToEntryCell(entry, Math.min(entry.cells.length - 1, index + 1));
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      updateProgress((current) => {
        const next = { ...current };
        if (next[cellKey(cell.row, cell.col)]) next[cellKey(cell.row, cell.col)] = "";
        else if (index > 0) next[entry.cells[index - 1].key] = "";
        return next;
      });
      goToEntryCell(entry, progress[cellKey(cell.row, cell.col)] ? index : index - 1);
      setIncorrectKeys([]);
      setFeedback(null);
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      updateProgress((current) => ({ ...current, [cellKey(cell.row, cell.col)]: "" }));
      setIncorrectKeys([]);
      setFeedback(null);
      return;
    }

    if (event.key === " " && cell.entryIds.length > 1) {
      event.preventDefault();
      const otherEntry = cell.entryIds.find((id) => id !== activeEntryId);
      if (otherEntry) selectEntry(otherEntry, cellKey(cell.row, cell.col));
      return;
    }

    const navigation = {
      ArrowRight: [0, 1, "across"],
      ArrowLeft: [0, -1, "across"],
      ArrowDown: [1, 0, "down"],
      ArrowUp: [-1, 0, "down"],
    }[event.key];
    if (navigation) {
      event.preventDefault();
      goToAdjacentCell(cellKey(cell.row, cell.col), ...navigation);
    }
  }

  function handleDirectInput(event) {
    const typedLetters = Array.from(event.currentTarget.value || "").filter((letter) => /^[a-zA-ZÀ-ÖØ-öø-ÿŒœÇç]$/u.test(letter));
    event.currentTarget.value = "";
    const typed = typedLetters.at(-1);
    if (!typed || !activeEntry || activeCell?.type !== "letter") return;
    const index = activeEntry.cells.findIndex((item) => item.key === activeCellKey);
    if (index < 0) return;
    updateProgress((current) => applyTypedLetter(current, activeCellKey, typed, activeCell.solution));
    setIncorrectKeys([]);
    setFeedback(null);
    goToEntryCell(activeEntry, Math.min(activeEntry.cells.length - 1, index + 1), "input");
  }

  function handleDirectInputKeyDown(event) {
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    event.preventDefault();
    if (!activeEntry || activeCell?.type !== "letter") return;
    const index = activeEntry.cells.findIndex((item) => item.key === activeCellKey);
    if (index < 0) return;
    const currentKey = activeCellKey;
    const currentHasLetter = Boolean(progress[currentKey]);
    const targetIndex = event.key === "Backspace" && !currentHasLetter ? Math.max(0, index - 1) : index;
    const targetKey = activeEntry.cells[targetIndex]?.key;
    if (!targetKey) return;
    updateProgress((current) => ({ ...current, [targetKey]: "" }));
    setIncorrectKeys([]);
    setFeedback(null);
    goToEntryCell(activeEntry, targetIndex, "input");
  }

  function focusValidationCell(key, preferredEntryId = activeEntry?.id) {
    const cell = model.cells.get(key);
    if (cell?.type !== "letter") return;
    const nextEntryId = cell.entryIds.includes(preferredEntryId) ? preferredEntryId : cell.entryIds[0];
    if (nextEntryId) setActiveEntryId(nextEntryId);
    setActiveCellKey(key);
    focusCell(key);
  }

  function eraseActiveEntry() {
    if (!activeEntry) return;
    updateProgress((current) => clearEntry(current, activeEntry, model));
    const firstKey = activeEntry.cells[0]?.key;
    setActiveCellKey(firstKey || null);
    setIncorrectKeys([]);
    setFeedback({ tone: "neutral", text: "Le mot a été effacé. Les lettres validées aux croisements sont conservées." });
    focusCell(firstKey);
  }

  function revealLetter() {
    if (!activeEntry) return;
    const result = revealEntryLetter(progress, activeEntry, model);
    if (!result.revealedKey) {
      setFeedback({ tone: "success", text: "Ce mot est déjà correct." });
      return;
    }
    updateProgress(() => result.progress);
    setHintCounts((previous) => ({ ...previous, [grid.id]: Number(previous[grid.id] || 0) + 1 }));
    setActiveCellKey(result.revealedKey);
    setIncorrectKeys([]);
    setFeedback({ tone: "neutral", text: "Une lettre a été placée. La récompense de la grille ne change pas." });
    focusCell(result.revealedKey);
  }

  function verifyGrid() {
    if (!activeEntry) return;

    if (activeEntryValidation.status === "incomplete") {
      setIncorrectKeys([]);
      const missingCount = activeEntryValidation.emptyKeys.length;
      setFeedback({ tone: "warning", text: `Il manque ${missingCount} lettre${missingCount > 1 ? "s" : ""} dans ce mot.` });
      focusValidationCell(activeEntryValidation.emptyKeys[0], activeEntry.id);
      return;
    }

    if (activeEntryValidation.status === "incorrect") {
      setIncorrectKeys(activeEntryValidation.incorrectKeys);
      setFeedback({ tone: "warning", text: `Ce mot contient ${activeEntryValidation.incorrectKeys.length} lettre${activeEntryValidation.incorrectKeys.length > 1 ? "s" : ""} à revoir.` });
      focusValidationCell(activeEntryValidation.incorrectKeys[0], activeEntry.id);
      return;
    }

    if (!gridCheck.complete) {
      if (gridCheck.emptyKeys.length) {
        const remainingWords = model.entries.size - progressSummary.found;
        setIncorrectKeys([]);
        setFeedback({ tone: "success", text: `Bravo, ce mot est correct. Il reste ${remainingWords} mot${remainingWords > 1 ? "s" : ""} à trouver.` });
        return;
      }
      setIncorrectKeys(gridCheck.incorrectKeys);
      setFeedback({ tone: "warning", text: `${gridCheck.incorrectKeys.length} lettre${gridCheck.incorrectKeys.length > 1 ? "s sont" : " est"} à revoir dans la grille.` });
      focusValidationCell(gridCheck.incorrectKeys[0]);
      return;
    }

    const attemptId = buildMotsFlechesAttemptId(studentId, grid);
    const eventId = buildMotsFlechesAwardId(studentId, grid);
    const reward = onAwardXp(grid.xp, {
      eventId,
      attemptId,
      questionId: grid.id,
      source: "mots-fleches",
    }) || {};
    const rewardOutcome = resolveMotsFlechesReward(reward, grid.xp, alreadyCompleted);
    if (!rewardOutcome.ok) {
      setFeedback({ tone: "warning", text: "Les XP n’ont pas pu être enregistrés. Vérifie la connexion, puis réessaie." });
      return;
    }
    const xpEarned = rewardOutcome.xpEarned;
    const learningSummary = getGridLearningSummary(model, progress, currentHintCount);
    onComplete({
      attemptId,
      puzzleId: grid.id,
      puzzleTitle: grid.title,
      level: grid.level,
      assistanceLevel: learningSummary.assistanceLevel,
      hintCount: learningSummary.hintCount,
      correctCount: grid.entries.length,
      questionCount: grid.entries.length,
      xpEarned,
      completionXp: xpEarned,
      scorePercent: 100,
    });
    const completedAfter = new Set([...completedGridIds, grid.id]);
    const orderedGrids = [
      ...MOTS_FLECHES_GRIDS.slice(currentGridIndex + 1),
      ...MOTS_FLECHES_GRIDS.slice(0, currentGridIndex + 1),
    ];
    const nextGrid = orderedGrids.find((item) => !completedAfter.has(item.id)) || null;
    setIncorrectKeys([]);
    setFeedback(null);
    setCompletion({
      ...learningSummary,
      xpEarned,
      totalXp: rewardOutcome.totalXp ?? currentXp + xpEarned,
      allCompleted: completedAfter.size === MOTS_FLECHES_GRIDS.length,
      nextGridId: nextGrid?.id || null,
    });
  }

  function resetGrid() {
    previousFocusRef.current = null;
    setProgressByGrid((previous) => ({ ...previous, [grid.id]: createEmptyProgress(model) }));
    setHintCounts((previous) => ({ ...previous, [grid.id]: 0 }));
    setIncorrectKeys([]);
    setFeedback(null);
    setCompletion(null);
    const firstEntry = model.entries.values().next().value;
    selectEntry(firstEntry?.id, firstEntry?.cells[0]?.key);
  }

  function selectGrid(nextGridId) {
    setSelectedGridId(nextGridId);
  }

  function selectLevel(levelId) {
    if (grid.levelId === levelId) return;
    const grids = LEVEL_GRIDS.get(levelId) || [];
    const nextGrid = grids.find((item) => !completedGridIds.has(item.id)) || grids[0];
    if (nextGrid) selectGrid(nextGrid.id);
  }

  function moveWithinLevel(offset) {
    if (activeLevelGrids.length < 2) return;
    const nextIndex = (currentLevelGridIndex + offset + activeLevelGrids.length) % activeLevelGrids.length;
    selectGrid(activeLevelGrids[nextIndex].id);
  }

  function selectNextGrid() {
    if (!completion?.nextGridId) {
      previousFocusRef.current = null;
      setCompletion(null);
      onExit();
      return;
    }
    const nextGridId = completion.nextGridId;
    const nextGrid = MOTS_FLECHES_GRIDS.find((item) => item.id === nextGridId);
    previousFocusRef.current = null;
    pendingLevelFocusRef.current = nextGrid?.levelId || null;
    setCompletion(null);
    selectGrid(nextGridId);
  }

  function renderGridCell(row, col) {
    const key = cellKey(row, col);
    const cell = model.cells.get(key);
    const positionProps = { "aria-rowindex": row + 1, "aria-colindex": col + 1 };

    if (!cell) {
      return <span className="mf-void-cell" role="gridcell" aria-label="Case bloquée" {...positionProps} key={key}/>;
    }

    if (cell.type === "clue") {
      return (
        <div className={`mf-clue-cell${cell.clues.length > 1 ? " is-split" : ""}`} role="gridcell" {...positionProps} key={key}>
          {cell.clues.map((entryId) => {
            const entry = model.entries.get(entryId);
            const cellClue = entry.cellClue || entry.clue;
            const entryComplete = getEntryCompletion(entry, progress, model);
            return (
              <button
                type="button"
                className={`${entryId === activeEntry?.id ? "is-active" : ""}${entryComplete ? " is-complete" : ""}${cellClue.length > 16 ? " is-long" : ""}${cellClue.length > 25 ? " is-very-long" : ""}`}
                onClick={() => selectEntry(entryId)}
                aria-label={`${entry.clue}, ${Array.from(entry.answer).length} lettres, vers ${entry.direction === "down" ? "le bas" : "la droite"}${entryComplete ? ", mot trouvé" : ""}`}
                tabIndex={entryId === activeEntry?.id ? 0 : -1}
                key={entryId}
              >
                <span>{cellClue}</span>
                {entryComplete && <CheckCircle className="mf-clue-status" weight="fill" aria-hidden="true"/>}
                <ArrowIcon direction={entry.direction} weight="bold" aria-hidden="true"/>
              </button>
            );
          })}
        </div>
      );
    }

    const isActive = activeEntryCells.has(key);
    const isCurrent = activeCellKey === key;
    const isIncorrect = incorrectKeys.includes(key);
    const isComplete = cell.entryIds.some((entryId) => getEntryCompletion(model.entries.get(entryId), progress, model));
    return (
      <button
        type="button"
        role="gridcell"
        {...positionProps}
        ref={(node) => node ? cellRefs.current.set(key, node) : cellRefs.current.delete(key)}
        className={`mf-letter-cell${isActive ? " is-active" : ""}${isCurrent ? " is-current" : ""}${isIncorrect ? " is-incorrect" : ""}${isComplete ? " is-complete" : ""}`}
        aria-selected={isCurrent}
        aria-invalid={isIncorrect || undefined}
        aria-describedby={isIncorrect ? "mf-feedback" : undefined}
        aria-label={`Ligne ${row + 1}, colonne ${col + 1}${progress[key] ? `, lettre ${progress[key]}` : ", vide"}`}
        tabIndex={isCurrent ? 0 : -1}
        onClick={() => {
          const hasCoarsePointer = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;
          selectLetterCell(cell, hasCoarsePointer ? "input" : "cell");
        }}
        onKeyDown={(event) => handleCellKeyDown(event, cell)}
        key={key}
      >
        {progress[key] || ""}
      </button>
    );
  }

  if (!model.valid) {
    return (
      <section className="mots-fleches-game mf-data-error" role="alert">
        <h1>Cette grille doit être corrigée</h1>
        <p>{model.errors[0]}</p>
        <button type="button" onClick={onExit}>Retour aux jeux</button>
      </section>
    );
  }

  return (
    <div className="mots-fleches-game">
      <div className="mf-shell" ref={shellRef}>
      <header className="mf-topbar">
        <button type="button" className="mf-brand" onClick={onExit} aria-label="Retour à mes jeux">
          <img src="/assets/jet-dencre-monogram-light.png" alt="" width="48" height="48" />
          <span><strong>Jet d’Encre</strong><small>ÉDITIONS</small></span>
        </button>
        <span className="mf-space-label">ESPACE ÉLÈVE</span>
        <div className="mf-profile-tools">
          <span className="mf-xp"><Sparkle weight="fill"/><strong>{currentXp} XP</strong></span>
          <span className="mf-school-year">Année scolaire 2026–2027</span>
          <span className="mf-avatar" aria-hidden="true">{studentInitials}</span>
          <span className="mf-student"><strong>{studentName}</strong><small>Élève</small></span>
        </div>
      </header>

      <main className="mf-main">
        <div className="mf-heading-row">
          <button type="button" className="mf-back" onClick={onExit}><ArrowLeft weight="bold"/> Mes jeux</button>
          <div className="mf-heading-copy">
            <h1>Mots fléchés</h1>
            <div className="mf-heading-meta">
              <strong title={grid.title}>{grid.title}</strong>
              <span className="mf-heading-divider" aria-hidden="true"/>
              <div className="mf-grid-nav" role="group" aria-label={`Choisir une grille du niveau ${grid.level}`}>
                <button type="button" onClick={() => moveWithinLevel(-1)} disabled={activeLevelGrids.length < 2} aria-label="Grille précédente"><ArrowLeft weight="bold"/></button>
                <b>Grille {currentLevelGridIndex + 1}/{activeLevelGrids.length}</b>
                <button type="button" onClick={() => moveWithinLevel(1)} disabled={activeLevelGrids.length < 2} aria-label="Grille suivante"><ArrowRight weight="bold"/></button>
              </div>
            </div>
            <p>Sélectionne un indice, lis le mini-dictionnaire, puis écris le mot dans le sens de la flèche.</p>
            <span className="mf-sr-only" id="mf-keyboard-help">Au clavier, utilise les flèches pour changer de case, la barre d’espace pour changer de direction à un croisement, et Retour arrière pour effacer.</span>
          </div>
          <div className="mf-progress-card" aria-label={`${progressSummary.found} mots trouvés sur ${progressSummary.total}`}>
            <small>{progressSummary.filledLetters > 0 && progressSummary.found < progressSummary.total ? "PARTIE REPRISE" : "MOTS TROUVÉS"}</small>
            <strong>{progressSummary.found}/{progressSummary.total}</strong>
            <span><i style={{ width: `${progressSummary.percent}%` }}/></span>
          </div>
        </div>

        <div className="mf-levels" role="tablist" aria-label="Niveau de la grille">
          {LEVEL_OPTIONS.map((item, index) => {
            const selected = item.levelId === grid.levelId;
            const completedCount = item.grids.filter((candidate) => completedGridIds.has(candidate.id)).length;
            const allCompleted = completedCount === item.grids.length;
            return (
              <button
                type="button"
                role="tab"
                id={`mf-level-tab-${item.levelId}`}
                aria-controls="mf-level-panel"
                aria-selected={selected}
                aria-label={`${item.level}, ${item.cefr}, ${item.grids.length} grilles, ${completedCount} terminées, ${item.xp} XP par grille`}
                className={selected ? "is-selected" : ""}
                key={item.levelId}
                onClick={() => selectLevel(item.levelId)}
                onKeyDown={(event) => handleLevelKeyDown(event, index)}
                ref={(node) => node ? levelTabRefs.current.set(item.levelId, node) : levelTabRefs.current.delete(item.levelId)}
                tabIndex={selected ? 0 : -1}
              >
                {allCompleted ? <CheckCircle weight="fill"/> : <span className={`mf-level-dot is-${item.levelId}`}/>}
                <span><strong>{item.level}</strong><small>{item.cefr} · {completedCount}/{item.grids.length} grilles</small></span>
                <b>{allCompleted ? "Niveau terminé" : `${item.grids.length} × ${item.xp} XP`}</b>
              </button>
            );
          })}
        </div>

        <section className="mf-active-clue" aria-live="polite">
          <span>INDICE SÉLECTIONNÉ</span>
          <strong>{activeEntry?.clue || "Choisis une définition dans la grille"}</strong>
          {activeEntry && <small>{Array.from(activeEntry.answer).length} lettres <ArrowIcon direction={activeEntry.direction} weight="bold"/></small>}
        </section>

        <section
          className="mf-learning-layout"
          id="mf-level-panel"
          role="tabpanel"
          aria-labelledby={`mf-level-tab-${grid.levelId}`}
          aria-label={`${grid.level} : ${grid.title}`}
        >
          <div className="mf-puzzle-area">
            <div
              className={`mf-grid mf-grid-${grid.rows}`}
              role="grid"
              aria-label={`Grille de mots fléchés ${grid.level}, ${grid.rows} lignes et ${grid.cols} colonnes`}
              aria-describedby="mf-keyboard-help"
              aria-rowcount={grid.rows}
              aria-colcount={grid.cols}
              style={{ "--mf-rows": grid.rows, "--mf-cols": grid.cols }}
            >
              {Array.from({ length: grid.rows }, (_, row) => (
                <div className="mf-grid-row" role="row" aria-rowindex={row + 1} key={`row-${row}`}>
                  {Array.from({ length: grid.cols }, (_, col) => renderGridCell(row, col))}
                </div>
              ))}
            </div>

            <div className="mf-toolbar">
              <button type="button" className="mf-check" onClick={verifyGrid}><CheckCircle weight="fill"/> {verifyLabel}</button>
              <button type="button" onClick={eraseActiveEntry}><Eraser/> Effacer</button>
              <button type="button" onClick={revealLetter}><Lightbulb weight="fill"/> Révéler une lettre{currentHintCount > 0 ? ` (${currentHintCount})` : ""}</button>
              <span><Sparkle weight="fill"/> {alreadyCompleted ? "XP déjà gagnés" : `+${grid.xp} XP à la fin`}</span>
            </div>
          </div>

          <aside className="mf-dictionary" aria-labelledby="mf-dictionary-title">
            <header>
              <span className="mf-dictionary-icon" aria-hidden="true"><BookOpenText weight="duotone"/></span>
              <div>
                <small>AIDE AU VOCABULAIRE</small>
                <h2 id="mf-dictionary-title">Mini-dictionnaire</h2>
              </div>
              <span className={`mf-assistance-badge${currentHintCount > 0 ? " is-guided" : ""}`}>
                {currentHintCount > 0 ? `${currentHintCount} aide${currentHintCount > 1 ? "s" : ""}` : "Sans aide"}
              </span>
            </header>

            {activeEntry ? (
              <div className="mf-dictionary-content" key={activeEntry.id}>
                <div className="mf-dictionary-definition">
                  <small>DÉFINITION SIMPLE</small>
                  <p>{dictionaryEntry.definition}</p>
                  {activeEntry.lexicalLabel && <span className="mf-lexical-label">{activeEntry.lexicalLabel}</span>}
                </div>
                {dictionaryEntry.found ? (
                  <div className="mf-dictionary-answer is-found" role="status">
                    <CheckCircle weight="fill" aria-hidden="true"/>
                    <div>
                      <small>MOT TROUVÉ</small>
                      <strong>{dictionaryEntry.answer}</strong>
                      {activeEntry.example && <p>{activeEntry.example}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="mf-dictionary-pending">
                    <small>MOT À TROUVER</small>
                    <p>La réponse apparaîtra ici quand toutes les lettres seront correctes.</p>
                  </div>
                )}

                <label className="mf-direct-input">
                  <span><Keyboard weight="duotone" aria-hidden="true"/><strong>Saisie sur tablette</strong></span>
                  <small>Touche une case, puis écris ici. Le curseur avance tout seul.</small>
                  <input
                    ref={directInputRef}
                    type="text"
                    defaultValue=""
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck="false"
                    enterKeyHint="next"
                    maxLength={2}
                    disabled={dictionaryEntry.found}
                    aria-label={`Écrire une lettre dans le mot sélectionné, ${Array.from(activeEntry.answer).length} lettres`}
                    placeholder={dictionaryEntry.found ? "Mot trouvé" : "Écris une lettre"}
                    onInput={handleDirectInput}
                    onKeyDown={handleDirectInputKeyDown}
                  />
                </label>

                {foundEntries.length > 0 && (
                  <div className="mf-word-notebook" aria-label={`${foundEntries.length} mots dans le carnet`}>
                    <small>CARNET DE MOTS · {foundEntries.length}</small>
                    <div>{foundEntries.slice(-4).map((entry) => <span key={entry.id}>{entry.answer}</span>)}</div>
                  </div>
                )}

                <p className="mf-dictionary-tip"><Lightbulb weight="fill"/> {activeCellIsCrossing ? "Croisement : clique encore ou appuie sur Espace pour changer de sens." : "Utilise la définition pour compléter les cases sélectionnées."}</p>
              </div>
            ) : (
              <p className="mf-dictionary-empty">Choisis un indice dans la grille pour afficher le mot et sa définition.</p>
            )}
          </aside>
        </section>

        <div
          id="mf-feedback"
          className={`mf-feedback${feedback ? ` is-${feedback.tone}` : ""}`}
          role={feedback?.tone === "warning" ? "alert" : "status"}
          aria-live={feedback?.tone === "warning" ? "assertive" : "polite"}
        >
          {feedback && <>{feedback.tone === "warning" ? <Lightbulb weight="fill"/> : <Check weight="bold"/>}{feedback.text}</>}
        </div>
      </main>
      </div>

      {completion && (
        <section
          className="mf-completion"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mf-completion-title"
          aria-describedby="mf-completion-description"
          ref={completionRef}
        >
          <div className="mf-completion-card">
            <button type="button" className="mf-completion-close" onClick={() => setCompletion(null)} aria-label="Fermer le bilan"><X weight="bold"/></button>
            <span className="mf-trophy"><Trophy weight="fill"/></span>
            <small>{grid.level.toUpperCase()} · {grid.title}</small>
            <h2 id="mf-completion-title">{completion.allCompleted ? "Collection terminée !" : "Grille terminée !"}</h2>
            <p id="mf-completion-description">
              {completion.allCompleted
                ? <>Tu as terminé les {MOTS_FLECHES_GRIDS.length} grilles et débloqué les <strong>{MOTS_FLECHES_TOTAL_XP} XP</strong> de la collection.</>
                : completion.xpEarned > 0
                  ? <>Tu gagnes <strong>+{completion.xpEarned} XP</strong>. Ton profil atteint {completion.totalXp} XP.</>
                  : <>Cette grille était déjà réussie. Tu peux la rejouer sans regagner ses XP.</>}
            </p>

            <div className="mf-completion-stats" aria-label="Bilan de la grille">
              <span><strong>{completion.foundCount}/{completion.totalCount}</strong><small>MOTS TROUVÉS</small></span>
              <span><strong>{completion.hintCount || "0"}</strong><small>{completion.hintCount === 0 ? "SANS AIDE" : completion.hintCount > 1 ? "AIDES UTILISÉES" : "AIDE UTILISÉE"}</small></span>
              <span><strong>+{completion.xpEarned}</strong><small>XP GAGNÉS</small></span>
            </div>

            <div className="mf-completion-review">
              <h3>Trois mots à retenir</h3>
              <div>
                {completion.words.slice(0, 3).map((word) => (
                  <article key={word.id}>
                    <span><strong>{word.answer}</strong>{word.lexicalLabel && <small>{word.lexicalLabel}</small>}</span>
                    <p>{word.definition}</p>
                    {word.example && <em>{word.example}</em>}
                  </article>
                ))}
              </div>
            </div>

            <div className="mf-completion-actions">
              <button type="button" onClick={resetGrid}>Rejouer</button>
              <button type="button" className="mf-next" onClick={selectNextGrid} ref={completionPrimaryRef}>
                {completion.allCompleted ? "Retour à mes jeux" : "Grille suivante"} <ArrowRight weight="bold"/>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
