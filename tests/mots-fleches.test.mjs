import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { MOTS_FLECHES_GRIDS, MOTS_FLECHES_TOTAL_XP } from "../src/features/games/mots-fleches/motsFlechesData.js";
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
  normalizeComparable,
  revealEntryLetter,
  resolveMotsFlechesReward,
} from "../src/features/games/mots-fleches/motsFlechesEngine.js";
import { applyEntryText, getMotsFlechesLetters, isMotsFlechesShortcut } from "../src/features/games/mots-fleches/motsFlechesInput.js";
import { createDemoStore, createMemoryStorage, DEMO_ACCOUNTS } from "../src/demoStoreCore.js";

const fixedClock = () => new Date("2026-09-01T12:00:00.000Z");

function extractGameHandlers(names) {
  const source = readFileSync(new URL("../src/features/games/mots-fleches/MotsFlechesGame.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  return names.map((name) => {
    const start = source.indexOf(`  function ${name}(`);
    const end = source.indexOf("\n  }\n", start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + 5);
  }).join("\n");
}

const CLEAN_MAGAZINE_GRID = {
  rows: 7,
  cols: 7,
  entries: [
    { id: "T01", answer: "TOMATE", clue: "Fruit rouge", direction: "down", clueRow: 0, clueCol: 3, row: 1, col: 3 },
    { id: "T02", answer: "MER", clue: "Grande eau salée", direction: "across", clueRow: 3, clueCol: 2, row: 3, col: 3 },
    { id: "T03", answer: "EAU", clue: "Liquide à boire", direction: "across", clueRow: 6, clueCol: 2, row: 6, col: 3 },
  ],
};

const ORIGINAL_GRIDS = MOTS_FLECHES_GRIDS.filter((grid) => grid.id.endsWith("-01"));
const EXPECTED_GRID_COUNTS = { facile: 6, normal: 6, difficile: 6 };
const EXPECTED_XP = { facile: 20, normal: 35, difficile: 50 };

test("propose six grilles par niveau avec 20, 35 et 50 XP", () => {
  assert.equal(MOTS_FLECHES_GRIDS.length, 18);
  assert.equal(new Set(MOTS_FLECHES_GRIDS.map((grid) => grid.id)).size, 18);
  assert.equal(new Set(MOTS_FLECHES_GRIDS.map((grid) => grid.title)).size, 18);
  for (const [levelId, expectedCount] of Object.entries(EXPECTED_GRID_COUNTS)) {
    const grids = MOTS_FLECHES_GRIDS.filter((grid) => grid.levelId === levelId);
    assert.equal(grids.length, expectedCount, levelId);
    assert.ok(grids.every((grid) => grid.xp === EXPECTED_XP[levelId]), levelId);
    assert.ok(grids.every((grid) => typeof grid.theme === "string" && grid.theme.length >= 20), levelId);
  }
  assert.equal(MOTS_FLECHES_TOTAL_XP, 630);
});

test("les dix-huit grilles sont connectées et sans conflit", () => {
  for (const grid of MOTS_FLECHES_GRIDS) {
    const model = buildGridModel(grid);
    assert.equal(model.valid, true, `${grid.level}: ${model.errors.join(" | ")}`);
  }
});

test("le validateur accepte une matrice magazine sans suite parasite", () => {
  const model = buildGridModel(CLEAN_MAGAZINE_GRID);
  assert.equal(model.valid, true, model.errors.join(" | "));
});

test("le validateur refuse les faux croisements d’accents", () => {
  const grid = {
    ...CLEAN_MAGAZINE_GRID,
    entries: CLEAN_MAGAZINE_GRID.entries.map((entry) => (
      entry.id === "T03" ? { ...entry, answer: "ÉAU" } : entry
    )),
  };
  const model = buildGridModel(grid);
  assert.equal(model.valid, false);
  assert.ok(model.errors.some((error) => error.includes("conflit de lettre")), model.errors.join(" | "));
});

test("le validateur refuse deux mots parallèles qui créent des suites sans indice", () => {
  const grid = {
    ...CLEAN_MAGAZINE_GRID,
    entries: [
      CLEAN_MAGAZINE_GRID.entries[0],
      CLEAN_MAGAZINE_GRID.entries[1],
      { id: "T03", answer: "AMI", clue: "Bon copain", direction: "across", clueRow: 4, clueCol: 2, row: 4, col: 3 },
    ],
  };
  const model = buildGridModel(grid);
  assert.equal(model.valid, false);
  assert.ok(model.errors.some((error) => error.includes("Suite de lettres sans définition")), model.errors.join(" | "));
});

test("les trois grilles originales conservent leur version densifiée", () => {
  assert.deepEqual(ORIGINAL_GRIDS.map((grid) => grid.entries.length), [11, 13, 13]);
  assert.deepEqual(
    ORIGINAL_GRIDS.map((grid) => grid.entries.slice(-3).map((entry) => entry.answer)),
    [
      ["STYLO", "RÈGLE", "CRAIE"],
      ["ROSE", "HAMMAM", "REMPART"],
      ["ÉCOSYSTÈME", "PROPRETÉ", "ÉNERGIE"],
    ],
  );
});

test("les matrices magazine gardent une case-indice distincte et des croisements réels", () => {
  const expectedMetrics = [
    { letters: 37, clues: 11, crossings: 11, blocked: 52 },
    { letters: 57, clues: 13, crossings: 12, blocked: 74 },
    { letters: 66, clues: 13, crossings: 13, blocked: 90 },
  ];

  ORIGINAL_GRIDS.forEach((grid, index) => {
    const model = buildGridModel(grid);
    const cells = [...model.cells.values()];
    const letters = cells.filter((cell) => cell.type === "letter");
    const clues = cells.filter((cell) => cell.type === "clue");
    const metrics = {
      letters: letters.length,
      clues: clues.length,
      crossings: letters.filter((cell) => cell.entryIds.length > 1).length,
      blocked: grid.rows * grid.cols - letters.length - clues.length,
    };
    assert.deepEqual(metrics, expectedMetrics[index], grid.level);
    assert.equal(clues.length, grid.entries.length, `${grid.level}: une case-indice distincte par mot`);
  });
});

test("chaque définition est intégrée dans la grille avec une flèche droite ou bas", () => {
  for (const grid of MOTS_FLECHES_GRIDS) {
    assert.equal(grid.entries.length, grid.levelId === "facile" ? 11 : 13, grid.id);
    for (const entry of grid.entries) {
      assert.ok(["across", "down"].includes(entry.direction));
      assert.ok(Number.isInteger(entry.clueRow));
      assert.ok(Number.isInteger(entry.clueCol));
      assert.ok(entry.clue.length >= 3 && entry.clue.length <= 80, entry.clue);
      assert.ok(entry.cellClue.length >= 3 && entry.cellClue.length <= 32, entry.cellClue);
    }
  }
});

test("chaque couple réponse-indice conserve une source lexicale ou institutionnelle", () => {
  const entries = MOTS_FLECHES_GRIDS.flatMap((grid) => grid.entries);
  assert.equal(entries.length, 222);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 222);
  for (const levelId of Object.keys(EXPECTED_GRID_COUNTS)) {
    const levelEntries = MOTS_FLECHES_GRIDS.filter((grid) => grid.levelId === levelId).flatMap((grid) => grid.entries);
    assert.equal(
      new Set(levelEntries.map((entry) => normalizeComparable(entry.answer))).size,
      levelEntries.length,
      `${levelId}: aucun mot-réponse ne doit être répété dans un même niveau`,
    );
  }
  for (const entry of entries) {
    assert.match(entry.sourceUrl, /^https:\/\//);
    assert.ok(entry.sourceLabel.length > 2);
  }
});

test("le mini-dictionnaire fournit une définition et un exemple lexical pour les 222 réponses", () => {
  const entries = MOTS_FLECHES_GRIDS.flatMap((grid) => grid.entries);
  assert.equal(entries.length, 222);
  for (const entry of entries) {
    assert.ok(entry.answer.length >= 3, entry.id);
    assert.equal(typeof entry.definition, "string", entry.id);
    assert.ok(entry.definition.length >= 30 && entry.definition.length <= 120, `${entry.id}: ${entry.definition}`);
    assert.notEqual(entry.definition, entry.clue, entry.id);
    const definitionWords = normalizeComparable(entry.definition).split(/[^A-Z]+/).filter(Boolean);
    assert.ok(!definitionWords.includes(normalizeComparable(entry.answer)), `${entry.id}: la définition révèle la réponse`);
    const clueWords = normalizeComparable(`${entry.clue} ${entry.cellClue}`).split(/[^A-Z]+/).filter(Boolean);
    assert.ok(!clueWords.includes(normalizeComparable(entry.answer)), `${entry.id}: un indice révèle la réponse`);
    assert.equal(typeof entry.lexicalLabel, "string", entry.id);
    assert.ok(entry.lexicalLabel.length >= 3 && entry.lexicalLabel.length <= 30, `${entry.id}: ${entry.lexicalLabel}`);
    assert.equal(typeof entry.example, "string", entry.id);
    assert.ok(entry.example.length >= 20 && entry.example.length <= 100, `${entry.id}: ${entry.example}`);
  }

  const component = readFileSync(new URL("../src/features/games/mots-fleches/MotsFlechesGame.jsx", import.meta.url), "utf8");
  assert.match(component, /Mini-dictionnaire/);
  assert.match(component, /dictionaryEntry\.definition/);
  assert.match(component, /dictionaryEntry\.found \?/);
  assert.match(component, /MOT TROUVÉ/);
  assert.match(component, /MOT À TROUVER/);
});

test("le mot du mini-dictionnaire ne se débloque qu’après une réponse entièrement correcte", () => {
  const model = buildGridModel(MOTS_FLECHES_GRIDS[0]);
  const entry = model.entries.values().next().value;
  const empty = createEmptyProgress(model);
  assert.equal(getEntryCompletion(entry, empty, model), false);
  assert.deepEqual(getDictionaryEntryState(entry, empty, model), {
    found: false,
    answer: null,
    definition: entry.definition,
  });

  const almostCorrect = { ...empty };
  entry.cells.slice(0, -1).forEach((cell) => {
    almostCorrect[cell.key] = cell.solution;
  });
  assert.equal(getEntryCompletion(entry, almostCorrect, model), false);

  const correct = { ...almostCorrect, [entry.cells.at(-1).key]: entry.cells.at(-1).solution };
  assert.equal(getEntryCompletion(entry, correct, model), true);
  assert.deepEqual(getDictionaryEntryState(entry, correct, model), {
    found: true,
    answer: entry.answer,
    definition: entry.definition,
  });
});

test("une réponse aidée se débloque une fois complète puis se recache si elle est effacée", () => {
  const model = buildGridModel(MOTS_FLECHES_GRIDS[0]);
  const entry = model.entries.values().next().value;
  let guidedProgress = createEmptyProgress(model);

  entry.cells.forEach(() => {
    guidedProgress = revealEntryLetter(guidedProgress, entry, model).progress;
  });
  assert.equal(getEntryCompletion(entry, guidedProgress, model), true);

  const cleared = clearEntry(guidedProgress, entry);
  assert.equal(getEntryCompletion(entry, cleared, model), false);
});

test("la progression compte les mots trouvés et jamais les simples lettres saisies", () => {
  const model = buildGridModel(MOTS_FLECHES_GRIDS[0]);
  const entries = [...model.entries.values()];
  const progress = createEmptyProgress(model);
  entries[0].cells.forEach((cell) => { progress[cell.key] = cell.solution; });
  const unrelatedCell = entries[1].cells.find((cell) => !progress[cell.key]);
  if (unrelatedCell) progress[unrelatedCell.key] = "X";

  const summary = getGridProgress(model, progress);
  assert.equal(summary.found, 1);
  assert.equal(summary.total, model.entries.size);
  assert.equal(summary.percent, Math.round(100 / model.entries.size));
  assert.ok(summary.filledLetters > entries[0].cells.length - 1);
});

test("un mot rempli mais faux est distingué d’un mot incomplet et d’un mot correct", () => {
  const model = buildGridModel(MOTS_FLECHES_GRIDS[0]);
  const entry = model.entries.values().next().value;
  const progress = createEmptyProgress(model);
  assert.equal(getEntryValidation(entry, progress, model).status, "incomplete");

  entry.cells.forEach((cell) => { progress[cell.key] = "X"; });
  assert.equal(getEntryValidation(entry, progress, model).status, "incorrect");
  assert.ok(getEntryValidation(entry, progress, model).incorrectKeys.length > 0);

  entry.cells.forEach((cell) => { progress[cell.key] = cell.solution; });
  assert.equal(getEntryValidation(entry, progress, model).status, "correct");
});

test("effacer un mot conserve les croisements appartenant à un autre mot déjà trouvé", () => {
  const model = buildGridModel(MOTS_FLECHES_GRIDS[0]);
  const crossingCell = [...model.cells.values()].find((cell) => cell.type === "letter" && cell.entryIds.length > 1);
  const [entryId, otherEntryId] = crossingCell.entryIds;
  const entry = model.entries.get(entryId);
  const otherEntry = model.entries.get(otherEntryId);
  const progress = createEmptyProgress(model);
  otherEntry.cells.forEach((cell) => { progress[cell.key] = cell.solution; });
  entry.cells.forEach((cell) => { if (!progress[cell.key]) progress[cell.key] = cell.solution; });

  const cleared = clearEntry(progress, entry, model);
  assert.equal(cleared[cellKey(crossingCell.row, crossingCell.col)], crossingCell.solution);
  assert.equal(getEntryCompletion(otherEntry, cleared, model), true);
  assert.equal(getEntryCompletion(entry, cleared, model), false);
});

test("le bilan distingue une réussite autonome d’une réussite guidée", () => {
  const model = buildGridModel(MOTS_FLECHES_GRIDS[0]);
  const solved = Object.fromEntries([...model.cells].filter(([, cell]) => cell.type === "letter").map(([key, cell]) => [key, cell.solution]));
  const autonomous = getGridLearningSummary(model, solved, 0);
  const guided = getGridLearningSummary(model, solved, 3);
  assert.equal(autonomous.foundCount, model.entries.size);
  assert.equal(autonomous.assistanceLevel, "autonomous");
  assert.equal(guided.assistanceLevel, "guided");
  assert.equal(guided.hintCount, 3);
  assert.equal(guided.words.length, model.entries.size);
});

test("le dossier de recherche confirme les 37 validations indépendantes", () => {
  const research = JSON.parse(readFileSync(new URL("../design-sources/mots-fleches-research/grilles-recherchees.json", import.meta.url), "utf8"));
  assert.equal(research.automatedValidation.status, "passed");
  assert.equal(research.automatedValidation.totals.gridCount, 3);
  assert.equal(research.automatedValidation.totals.entryCount, 37);
  assert.equal(research.independentReview.status, "passedAfterCorrections");
});

test("la comparaison accepte une saisie sans accent", () => {
  assert.equal(normalizeComparable("ecole"), normalizeComparable("ÉCOLE"));
  assert.equal(normalizeComparable("foret"), normalizeComparable("FORÊT"));
  assert.equal(normalizeComparable("mosquee"), normalizeComparable("MOSQUÉE"));
});

test("une lettre juste sans accent reprend la graphie canonique", () => {
  const progress = applyTypedLetter({}, "0:0", "e", "É");
  assert.equal(progress["0:0"], "É");
});

test("une saisie groupée remplit le mot horizontal ou vertical en conservant les accents", () => {
  const model = buildGridModel(MOTS_FLECHES_GRIDS[0]);
  for (const entryId of ["F01", "F02"]) {
    const entry = model.entries.get(entryId);
    const empty = createEmptyProgress(model);
    const typed = entryId === "F01" ? "e\u0301cole" : "livre";
    const result = applyEntryText(empty, model, entry, entry.cells[0].key, typed);
    assert.equal(getEntryValidation(entry, result.progress, model).status, "correct");
    assert.equal(result.nextIndex, entry.cells.length - 1);
    assert.equal(Object.values(empty).some(Boolean), false, "la progression source reste intacte");
  }
});

test("une saisie groupée s'arrête à la fin du mot sans écraser sa dernière lettre", () => {
  const model = buildGridModel(MOTS_FLECHES_GRIDS[0]);
  const entry = model.entries.get("F01");
  const empty = createEmptyProgress(model);
  const result = applyEntryText(empty, model, entry, entry.cells[3].key, "le surplus");
  assert.equal(result.acceptedCount, 2);
  assert.equal(result.progress[entry.cells[3].key], "L");
  assert.equal(result.progress[entry.cells[4].key], "E");
  assert.equal(Object.values(result.progress).filter(Boolean).length, 2);
  assert.equal(applyEntryText(empty, model, entry, "0:0", "EC").progress, empty);
});

test("les raccourcis système et une composition en cours ne deviennent pas des lettres", () => {
  for (const guard of ["ctrlKey", "metaKey", "altKey", "isComposing"]) {
    assert.equal(isMotsFlechesShortcut({ key: "a", [guard]: true }), true, guard);
  }
  assert.equal(isMotsFlechesShortcut({ key: "a", nativeEvent: { isComposing: true } }), true);
  assert.equal(isMotsFlechesShortcut({ key: "a", keyCode: 229 }), true);
  assert.equal(isMotsFlechesShortcut({ key: "É", shiftKey: true }), false);
  assert.deepEqual(getMotsFlechesLetters("e\u0301 ç œ 123 !"), ["é", "ç", "œ"]);
});

test("des frappes consécutives atteignent cinq cases avant toute animation du navigateur", () => {
  const model = buildGridModel(MOTS_FLECHES_GRIDS[0]);
  const entry = model.entries.get("F01");
  const handlers = extractGameHandlers(["focusCell", "goToEntryCell", "typeInEntry", "handleCellKeyDown"]);
  let focusedKey = entry.cells[0].key;
  const frames = [];
  const context = {
    model, activeEntryId: entry.id, progress: createEmptyProgress(model),
    applyEntryText, getMotsFlechesLetters, isMotsFlechesShortcut, cellKey,
    inputCursorRef: { current: { entryId: entry.id, key: focusedKey } },
    window: { requestAnimationFrame: (callback) => frames.push(callback) },
    cellRefs: { current: { get: (key) => ({ focus: () => { focusedKey = key; } }) } },
    setActiveCellKey() {}, setIncorrectKeys() {}, setFeedback() {},
  };
  context.updateProgress = (updater) => { context.progress = updater(context.progress); };
  runInNewContext(handlers, context);
  for (const key of "ECOLE") {
    context.handleCellKeyDown({ key, preventDefault() {} }, model.cells.get(focusedKey));
  }
  assert.equal(getEntryValidation(entry, context.progress, model).status, "correct");
  assert.equal(entry.cells.map(({ key }) => context.progress[key]).join(""), "ÉCOLE");
  assert.equal(focusedKey, entry.cells.at(-1).key);
});

test("une composition tactile est validée une seule fois avec ou sans événement input final", () => {
  const model = buildGridModel(MOTS_FLECHES_GRIDS[0]);
  const entry = model.entries.get("F01");
  const handlers = extractGameHandlers(["commitDirectInput", "handleDirectInput", "handleCompositionEnd"]);
  for (const withFinalInput of [true, false]) {
    const input = { value: "é", isConnected: true };
    const frames = [];
    const committed = [];
    const context = {
      model,
      inputCursorRef: { current: { entryId: entry.id, key: entry.cells[0].key } },
      isComposingRef: { current: true }, compositionFrameRef: { current: null },
      window: { requestAnimationFrame: (callback) => frames.push(callback), cancelAnimationFrame() {} },
      typeInEntry: (text) => committed.push(text),
    };
    runInNewContext(handlers, context);
    context.handleDirectInput({ currentTarget: input, nativeEvent: { isComposing: true } });
    assert.equal(input.value, "é");
    assert.equal(committed.length, 0);
    context.handleCompositionEnd({ currentTarget: input });
    if (withFinalInput) context.handleDirectInput({ currentTarget: input, nativeEvent: { isComposing: false } });
    for (const callback of frames) callback();
    assert.deepEqual(committed, ["é"]);
    assert.equal(input.value, "");
  }
});

test("une grille incomplète ou fautive ne peut pas être terminée", () => {
  const model = buildGridModel(MOTS_FLECHES_GRIDS[0]);
  const empty = createEmptyProgress(model);
  assert.equal(checkGrid(model, empty).complete, false);
  const wrong = Object.fromEntries([...model.cells].filter(([, cell]) => cell.type === "letter").map(([key]) => [key, "X"]));
  assert.equal(checkGrid(model, wrong).complete, false);
  assert.ok(checkGrid(model, wrong).incorrectKeys.length > 0);
});

test("une grille entièrement correcte est reconnue", () => {
  for (const grid of MOTS_FLECHES_GRIDS) {
    const model = buildGridModel(grid);
    const solved = Object.fromEntries([...model.cells].filter(([, cell]) => cell.type === "letter").map(([key, cell]) => [key, cell.solution]));
    assert.equal(checkGrid(model, solved).complete, true, grid.level);
  }
});

test("l’aide révèle une seule lettre du mot actif", () => {
  const model = buildGridModel(MOTS_FLECHES_GRIDS[0]);
  const progress = createEmptyProgress(model);
  const entry = model.entries.values().next().value;
  const result = revealEntryLetter(progress, entry, model);
  assert.ok(result.revealedKey);
  assert.equal(Object.values(result.progress).filter(Boolean).length, 1);
});

test("un échec d’enregistrement ne crédite jamais d’XP", () => {
  assert.deepEqual(resolveMotsFlechesReward({ ok: false }, 50), { ok: false, xpEarned: 0 });
  assert.deepEqual(resolveMotsFlechesReward({}, 50), { ok: false, xpEarned: 0 });
  assert.equal(resolveMotsFlechesReward({ ok: true, awarded: false, totalXp: 1500 }, 50).xpEarned, 0);
  assert.equal(resolveMotsFlechesReward({ ok: true, awarded: true, totalXp: 1550 }, 50).xpEarned, 50);
});

test("l’identifiant XP est stable, mais propre à l’élève et à la grille", () => {
  const first = buildMotsFlechesAwardId("eleve-1", MOTS_FLECHES_GRIDS[0]);
  assert.equal(first, buildMotsFlechesAwardId("eleve-1", MOTS_FLECHES_GRIDS[0]));
  assert.notEqual(first, buildMotsFlechesAwardId("eleve-2", MOTS_FLECHES_GRIDS[0]));
  assert.notEqual(first, buildMotsFlechesAwardId("eleve-1", MOTS_FLECHES_GRIDS[1]));
});

test("une nouvelle disposition efface l’essai local sans réattribuer les XP", () => {
  const grid = MOTS_FLECHES_GRIDS[0];
  const previousLayout = { ...grid, version: 2 };
  assert.equal(buildMotsFlechesAwardId("eleve-1", previousLayout), buildMotsFlechesAwardId("eleve-1", grid));
  assert.notEqual(buildMotsFlechesAttemptId("eleve-1", previousLayout), buildMotsFlechesAttemptId("eleve-1", grid));
});

test("les dix-huit premières réussites ajoutent 630 XP et les rejeux zéro", () => {
  const storage = createMemoryStorage();
  const studentId = DEMO_ACCOUNTS.eleve.userId;
  const store = createDemoStore({ storage, now: fixedClock });
  const before = store.getState().users.find((user) => user.id === studentId).xp;

  for (const grid of MOTS_FLECHES_GRIDS) {
    const result = store.actions.awardStudentXp({
      userId: studentId,
      amount: grid.xp,
      eventId: buildMotsFlechesAwardId(studentId, grid),
      source: "mots-fleches",
      questionId: grid.id,
    });
    assert.equal(result.awarded, true);
  }
  assert.equal(store.getState().users.find((user) => user.id === studentId).xp, before + MOTS_FLECHES_TOTAL_XP);

  const restored = createDemoStore({ storage, now: fixedClock });
  for (const grid of MOTS_FLECHES_GRIDS) {
    const result = restored.actions.awardStudentXp({
      userId: studentId,
      amount: grid.xp,
      eventId: buildMotsFlechesAwardId(studentId, grid),
      source: "mots-fleches",
      questionId: grid.id,
    });
    assert.equal(result.duplicate, true);
    assert.equal(result.amount, 0);
  }
  assert.equal(restored.getState().users.find((user) => user.id === studentId).xp, before + MOTS_FLECHES_TOTAL_XP);
});

test("le catalogue et la route élève utilisent le nouvel identifiant", () => {
  const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(appSource, /MotsFlechesGame/);
  assert.match(appSource, /\/eleve\/jeux\/mots-fleches/);
  assert.match(appSource, /quizId:"mots-fleches"/);
});
