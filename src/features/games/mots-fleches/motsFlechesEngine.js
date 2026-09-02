export const MOTS_FLECHES_GAME_ID = "mots-fleches";

export const DIRECTION_VECTORS = Object.freeze({
  across: Object.freeze({ row: 0, col: 1, arrow: "right" }),
  down: Object.freeze({ row: 1, col: 0, arrow: "down" }),
});

export function cellKey(row, col) {
  return `${row}:${col}`;
}

export function parseCellKey(key) {
  const [row, col] = String(key).split(":").map(Number);
  return { row, col };
}

export function normalizeComparable(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Œ/g, "OE")
    .replace(/œ/g, "oe")
    .toUpperCase();
}

export function normalizeAnswer(value = "") {
  return String(value).trim().toLocaleUpperCase("fr-FR");
}

export function getEntryCells(entry) {
  const vector = DIRECTION_VECTORS[entry.direction];
  if (!vector) return [];
  return Array.from(normalizeAnswer(entry.answer)).map((solution, index) => ({
    row: entry.row + vector.row * index,
    col: entry.col + vector.col * index,
    key: cellKey(entry.row + vector.row * index, entry.col + vector.col * index),
    solution,
    index,
  }));
}

export function getClueCell(entry) {
  const vector = DIRECTION_VECTORS[entry.direction];
  if (!vector) return null;
  const row = Number.isInteger(entry.clueRow) ? entry.clueRow : entry.row - vector.row;
  const col = Number.isInteger(entry.clueCol) ? entry.clueCol : entry.col - vector.col;
  return { row, col, key: cellKey(row, col) };
}

function isInside(grid, row, col) {
  return row >= 0 && col >= 0 && row < grid.rows && col < grid.cols;
}

function getMaximalLetterRuns(grid, cells, direction) {
  const runs = [];
  const outerSize = direction === "across" ? grid.rows : grid.cols;
  const innerSize = direction === "across" ? grid.cols : grid.rows;

  for (let outer = 0; outer < outerSize; outer += 1) {
    let start = null;
    for (let inner = 0; inner <= innerSize; inner += 1) {
      const row = direction === "across" ? outer : inner;
      const col = direction === "across" ? inner : outer;
      const isLetter = inner < innerSize && cells.get(cellKey(row, col))?.type === "letter";
      if (isLetter && start === null) start = inner;
      if ((!isLetter || inner === innerSize) && start !== null) {
        const length = inner - start;
        if (length >= 2) {
          runs.push(Array.from({ length }, (_, index) => (
            direction === "across"
              ? cellKey(outer, start + index)
              : cellKey(start + index, outer)
          )));
        }
        start = null;
      }
    }
  }

  return runs;
}

function runSignature(direction, keys) {
  return `${direction}:${keys.join(",")}`;
}

export function buildGridModel(grid) {
  const errors = [];
  const cells = new Map();
  const entries = new Map();

  if (!grid || !Number.isInteger(grid.rows) || !Number.isInteger(grid.cols)) {
    return { valid: false, errors: ["Dimensions de grille invalides."], cells, entries };
  }

  for (const entry of grid.entries || []) {
    if (!entry?.id || entries.has(entry.id)) {
      errors.push(`Identifiant d’entrée invalide ou dupliqué : ${entry?.id || "absent"}.`);
      continue;
    }
    const answer = normalizeAnswer(entry.answer);
    if (!answer || !/^[A-ZÀ-ÖØ-ÝŒÇ]+$/u.test(answer)) {
      errors.push(`${entry.id} : la réponse doit contenir uniquement des lettres françaises.`);
    }
    if (!entry.clue?.trim()) errors.push(`${entry.id} : définition absente.`);
    if (!DIRECTION_VECTORS[entry.direction]) errors.push(`${entry.id} : direction invalide.`);

    const clueCell = getClueCell(entry);
    const answerCells = getEntryCells(entry);
    if (!clueCell || !isInside(grid, clueCell.row, clueCell.col)) {
      errors.push(`${entry.id} : case-indice hors de la grille.`);
    }
    if (answerCells.some((cell) => !isInside(grid, cell.row, cell.col))) {
      errors.push(`${entry.id} : réponse hors de la grille.`);
    }
    const vector = DIRECTION_VECTORS[entry.direction];
    if (clueCell && vector && (clueCell.row + vector.row !== entry.row || clueCell.col + vector.col !== entry.col)) {
      errors.push(`${entry.id} : la flèche ne mène pas à la première lettre.`);
    }

    entries.set(entry.id, { ...entry, answer, clueCell, cells: answerCells });

    if (clueCell && isInside(grid, clueCell.row, clueCell.col)) {
      const existing = cells.get(clueCell.key);
      if (existing?.type === "letter") {
        errors.push(`${entry.id} : la case-indice recouvre une lettre.`);
      } else {
        const clues = existing?.clues || [];
        cells.set(clueCell.key, { type: "clue", row: clueCell.row, col: clueCell.col, clues: [...clues, entry.id] });
      }
    }

    for (const answerCell of answerCells) {
      if (!isInside(grid, answerCell.row, answerCell.col)) continue;
      const existing = cells.get(answerCell.key);
      if (existing?.type === "clue") {
        errors.push(`${entry.id} : une lettre recouvre une case-indice.`);
        continue;
      }
      if (existing?.type === "letter" && existing.solution !== answerCell.solution) {
        errors.push(`${entry.id} : conflit de lettre en ${answerCell.key}.`);
        continue;
      }
      const entryIds = existing?.entryIds || [];
      if (entryIds.some((entryId) => entries.get(entryId)?.direction === entry.direction)) {
        errors.push(`${entry.id} : deux réponses de même direction se chevauchent en ${answerCell.key}.`);
        continue;
      }
      cells.set(answerCell.key, {
        type: "letter",
        row: answerCell.row,
        col: answerCell.col,
        solution: existing?.solution || answerCell.solution,
        entryIds: [...new Set([...entryIds, entry.id])],
      });
    }
  }

  const entryList = [...entries.values()];
  if (entryList.length < 3) errors.push("La grille doit contenir au moins trois réponses.");
  for (const entry of entryList) {
    const hasCrossing = entry.cells.some((item) => (cells.get(item.key)?.entryIds || []).length > 1);
    if (!hasCrossing) errors.push(`${entry.id} : la réponse ne croise aucun autre mot.`);
  }
  for (const cell of cells.values()) {
    if (cell.type === "clue" && cell.clues.length > 2) errors.push(`La case-indice ${cellKey(cell.row, cell.col)} contient plus de deux définitions.`);
    if (cell.type === "clue" && cell.clues.length > 1) {
      const directions = new Set(cell.clues.map((entryId) => entries.get(entryId)?.direction));
      if (directions.size !== cell.clues.length) errors.push(`La case-indice ${cellKey(cell.row, cell.col)} répète la même direction.`);
    }
  }

  const declaredRuns = new Map(entryList.map((entry) => [
    runSignature(entry.direction, entry.cells.map((item) => item.key)),
    entry.id,
  ]));
  const maximalRuns = [
    ...getMaximalLetterRuns(grid, cells, "across").map((keys) => ({ direction: "across", keys })),
    ...getMaximalLetterRuns(grid, cells, "down").map((keys) => ({ direction: "down", keys })),
  ];
  const maximalRunSignatures = new Set(maximalRuns.map(({ direction, keys }) => runSignature(direction, keys)));

  for (const { direction, keys } of maximalRuns) {
    if (!declaredRuns.has(runSignature(direction, keys))) {
      errors.push(`Suite de lettres sans définition (${direction}) : ${keys.join(" → ")}.`);
    }
  }
  for (const entry of entryList) {
    const signature = runSignature(entry.direction, entry.cells.map((item) => item.key));
    if (!maximalRunSignatures.has(signature)) {
      errors.push(`${entry.id} : la réponse est prolongée ou interrompue par des lettres étrangères.`);
    }
  }

  if (entryList.length) {
    const visited = new Set();
    const queue = [entryList[0].id];
    while (queue.length) {
      const entryId = queue.shift();
      if (visited.has(entryId)) continue;
      visited.add(entryId);
      const entry = entries.get(entryId);
      for (const item of entry?.cells || []) {
        for (const neighbourId of cells.get(item.key)?.entryIds || []) {
          if (!visited.has(neighbourId)) queue.push(neighbourId);
        }
      }
    }
    if (visited.size !== entryList.length) errors.push("Toutes les réponses doivent appartenir à la même grille connectée.");
  }

  return { valid: errors.length === 0, errors, cells, entries };
}

export function createEmptyProgress(model) {
  return Object.fromEntries(
    [...model.cells.entries()]
      .filter(([, cell]) => cell.type === "letter")
      .map(([key]) => [key, ""]),
  );
}

export function sanitizeProgress(model, candidate = {}) {
  const empty = createEmptyProgress(model);
  for (const key of Object.keys(empty)) {
    const value = Array.from(normalizeAnswer(candidate?.[key] || ""))[0] || "";
    empty[key] = value;
  }
  return empty;
}

export function applyTypedLetter(progress, key, typed, solution) {
  const next = { ...progress };
  const letter = Array.from(normalizeAnswer(typed))[0] || "";
  next[key] = normalizeComparable(letter) === normalizeComparable(solution) ? solution : letter;
  return next;
}

export function getGridProgress(model, progress = {}) {
  const letters = [...model.cells.entries()].filter(([, cell]) => cell.type === "letter");
  const filledLetters = letters.filter(([key]) => Boolean(progress[key])).length;
  const entries = [...model.entries.values()];
  const found = entries.filter((entry) => getEntryCompletion(entry, progress, model)).length;
  return {
    found,
    total: entries.length,
    percent: entries.length ? Math.round((found / entries.length) * 100) : 0,
    filledLetters,
    totalLetters: letters.length,
  };
}

export function getEntryValidation(entry, progress = {}, model) {
  if (!entry || !model) {
    return { status: "incomplete", filled: false, correct: false, emptyKeys: [], incorrectKeys: [] };
  }
  const emptyKeys = [];
  const incorrectKeys = [];
  for (const cell of entry.cells) {
    const value = progress[cell.key] || "";
    if (!value) emptyKeys.push(cell.key);
    else if (normalizeComparable(value) !== normalizeComparable(model.cells.get(cell.key)?.solution || "")) incorrectKeys.push(cell.key);
  }
  const filled = emptyKeys.length === 0;
  const correct = filled && incorrectKeys.length === 0;
  return {
    status: correct ? "correct" : filled ? "incorrect" : "incomplete",
    filled,
    correct,
    emptyKeys,
    incorrectKeys,
  };
}

export function checkGrid(model, progress = {}) {
  const emptyKeys = [];
  const incorrectKeys = [];
  for (const [key, cell] of model.cells.entries()) {
    if (cell.type !== "letter") continue;
    const value = progress[key] || "";
    if (!value) emptyKeys.push(key);
    else if (normalizeComparable(value) !== normalizeComparable(cell.solution)) incorrectKeys.push(key);
  }
  return {
    complete: emptyKeys.length === 0 && incorrectKeys.length === 0,
    emptyKeys,
    incorrectKeys,
  };
}

export function clearEntry(progress, entry, model = null) {
  const next = { ...progress };
  for (const cell of entry.cells) {
    const crossing = model?.cells.get(cell.key);
    const belongsToCompletedCrossing = (crossing?.entryIds || [])
      .filter((entryId) => entryId !== entry.id)
      .some((entryId) => getEntryCompletion(model.entries.get(entryId), progress, model));
    if (!belongsToCompletedCrossing) next[cell.key] = "";
  }
  return next;
}

export function revealEntryLetter(progress, entry, model) {
  const target = entry.cells.find((cell) => normalizeComparable(progress[cell.key] || "") !== normalizeComparable(model.cells.get(cell.key)?.solution || ""));
  if (!target) return { progress, revealedKey: null };
  return {
    progress: { ...progress, [target.key]: model.cells.get(target.key).solution },
    revealedKey: target.key,
  };
}

export function getEntryCompletion(entry, progress, model) {
  return entry.cells.every((cell) => normalizeComparable(progress[cell.key] || "") === normalizeComparable(model.cells.get(cell.key)?.solution || ""));
}

export function getGridLearningSummary(model, progress = {}, hintCount = 0) {
  const foundEntries = [...model.entries.values()].filter((entry) => getEntryCompletion(entry, progress, model));
  const safeHintCount = Math.max(0, Number(hintCount) || 0);
  return {
    foundCount: foundEntries.length,
    totalCount: model.entries.size,
    hintCount: safeHintCount,
    assistanceLevel: safeHintCount > 0 ? "guided" : "autonomous",
    words: foundEntries.map((entry) => ({
      id: entry.id,
      answer: entry.answer,
      definition: entry.definition || entry.clue || "",
      lexicalLabel: entry.lexicalLabel || "",
      example: entry.example || "",
    })),
  };
}

export function getDictionaryEntryState(entry, progress, model) {
  if (!entry) return { found: false, answer: null, definition: "" };
  const found = getEntryCompletion(entry, progress, model);
  return {
    found,
    answer: found ? entry.answer : null,
    definition: entry.definition || entry.clue || "",
  };
}

export function buildMotsFlechesAwardId(studentId, grid) {
  return `${MOTS_FLECHES_GAME_ID}:${studentId || "eleve"}:${grid.id}:v${grid.rewardVersion || grid.version || 1}:completion`;
}

export function buildMotsFlechesAttemptId(studentId, grid) {
  return `${MOTS_FLECHES_GAME_ID}:${studentId || "eleve"}:${grid.id}:v${grid.version || 1}:attempt`;
}

export function isGridReward(award, studentId, grid) {
  return Boolean(
    award
      && (!studentId || award.userId === studentId)
      && award.id === buildMotsFlechesAwardId(studentId, grid),
  );
}

export function resolveMotsFlechesReward(reward, gridXp, alreadyCompleted = false) {
  if (!reward || reward.ok !== true) return { ok: false, xpEarned: 0 };
  return {
    ok: true,
    xpEarned: reward.awarded === true && !alreadyCompleted ? Math.max(0, Number(gridXp) || 0) : 0,
    totalXp: Number.isFinite(Number(reward.totalXp)) ? Number(reward.totalXp) : null,
  };
}
