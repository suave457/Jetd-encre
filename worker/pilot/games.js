import { MOTS_FLECHES_GRIDS } from "../../src/features/games/mots-fleches/motsFlechesData.js";
import { buildGridModel, checkGrid, createEmptyProgress, normalizeComparable } from "../../src/features/games/mots-fleches/motsFlechesEngine.js";
import { all, checkCsrf, fail, first, hash, LIVE_SESSION_SQL, liveValues, now, readInput, reply } from "./session.js";

const GAME_ID = "mots-fleches";
const ROOT = `/api/pilot/games/${GAME_ID}`;
const GRIDS = new Map(MOTS_FLECHES_GRIDS.map((grid) => [grid.id, { grid, model: buildGridModel(grid) }]));
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const INPUT_FIELDS = new Set(["ownerId", "progress", "hintCount", "revision", "requestId"]);

function actorGuard(c) {
  return {
    sql: `EXISTS (SELECT 1 FROM pilot_memberships gm JOIN pilot_schools gs ON gs.id=gm.school_id
      WHERE gm.school_id=? AND gm.user_id=? AND gm.role=? AND gm.active=1 AND gs.active=1) AND ${LIVE_SESSION_SQL}`,
    values: [c.schoolId, c.user.id, c.role, ...liveValues(c.session)],
  };
}

function studentAccess(c, studentId) {
  const actor = actorGuard(c);
  const family = c.role === "parent"
    ? "EXISTS (SELECT 1 FROM pilot_family_links gf WHERE gf.school_id=? AND gf.parent_id=? AND gf.student_id=? AND gf.active=1)"
    : "?=?";
  return {
    sql: `${actor.sql} AND EXISTS (SELECT 1 FROM pilot_memberships child JOIN pilot_users gu ON gu.id=child.user_id
      WHERE child.school_id=? AND child.user_id=? AND child.role='eleve' AND child.active=1 AND gu.active=1
      AND EXISTS (SELECT 1 FROM pilot_class_members gc JOIN pilot_classes cl ON cl.id=gc.class_id AND cl.school_id=gc.school_id
        WHERE gc.school_id=child.school_id AND gc.user_id=child.user_id AND cl.active=1)) AND ${family}`,
    values: [...actor.values, c.schoolId, studentId,
      ...(c.role === "parent" ? [c.schoolId, c.user.id, studentId] : [c.user.id, studentId])],
  };
}

async function assertAccess(db, c, studentId = null) {
  const guard = studentId === null ? actorGuard(c) : studentAccess(c, studentId);
  if (!await first(db, `SELECT 1 allowed WHERE ${guard.sql}`, ...guard.values)) {
    fail(403, "game_access_changed", "Votre accès au jeu a changé. Rechargez la page.");
  }
}

function viewGrid(row) {
  return {
    gridId: row.grid_id, progress: JSON.parse(row.progress_json), hintCount: row.hint_count,
    revision: row.revision, lastRequestId: row.last_request_id,
    completedAt: row.completed_at ?? null, awardedXp: row.awarded_xp ?? 0,
  };
}

async function ownRecords(db, c, gridId = null) {
  const guard = studentAccess(c, c.user.id);
  return all(db, `SELECT p.*, a.completed_at, COALESCE(a.xp,0) awarded_xp
    FROM pilot_game_progress p LEFT JOIN pilot_game_awards a
      ON a.school_id=p.school_id AND a.student_id=p.student_id AND a.game_id=p.game_id AND a.grid_id=p.grid_id
    WHERE p.school_id=? AND p.student_id=? AND p.game_id=? ${gridId ? "AND p.grid_id=?" : ""}
      AND ${guard.sql} ORDER BY p.grid_id`,
  c.schoolId, c.user.id, GAME_ID, ...(gridId ? [gridId] : []), ...guard.values);
}

async function ownXp(db, c) {
  const guard = studentAccess(c, c.user.id);
  const row = await first(db, `SELECT
    (SELECT COALESCE(SUM(xp),0) FROM pilot_game_awards WHERE school_id=? AND student_id=? AND game_id IN ('mots-fleches','mission-zellige')) +
    (SELECT COALESCE(SUM(xp),0) FROM pilot_quiz_awards WHERE school_id=? AND student_id=?) +
    (SELECT COALESCE(SUM(xp),0) FROM pilot_market_awards WHERE school_id=? AND student_id=?) +
    (SELECT COALESCE(SUM(xp),0) FROM pilot_class_awards WHERE school_id=? AND student_id=?) total
    WHERE ${guard.sql}`,
  c.schoolId, c.user.id, c.schoolId, c.user.id, c.schoolId, c.user.id, c.schoolId, c.user.id, ...guard.values);
  return row?.total ?? 0;
}

function emptyGrid(gridId) {
  return { gridId, progress: createEmptyProgress(GRIDS.get(gridId).model), hintCount: 0,
    revision: 0, lastRequestId: null, completedAt: null, awardedXp: 0 };
}

async function conflict(db, c, row, gridId, code) {
  await assertAccess(db, c, c.user.id);
  throw reply({
    error: { code, message: "Cette grille a été modifiée. Retrouvez la version enregistrée avant de continuer." },
    userId: c.user.id, schoolId: c.schoolId, xpTotal: await ownXp(db, c),
    grid: row ? viewGrid(row) : emptyGrid(gridId),
  }, 409);
}

function validateInput(input, c, model) {
  if (Object.keys(input).some((key) => !INPUT_FIELDS.has(key))) fail(422, "invalid_game_field", "La sauvegarde contient un champ inattendu.");
  if (input.ownerId !== c.user.id) fail(403, "game_owner_mismatch", "Cette progression appartient à un autre compte.");
  if (!Number.isSafeInteger(input.revision) || input.revision < 0 || input.revision >= Number.MAX_SAFE_INTEGER) fail(422, "invalid_game_revision", "La version de la grille est invalide.");
  if (!Number.isInteger(input.hintCount) || input.hintCount < 0 || input.hintCount > 10000) fail(422, "invalid_game_hints", "Le nombre d’aides est invalide.");
  if (typeof input.requestId !== "string" || !UUID.test(input.requestId)) fail(422, "invalid_game_request", "La référence de sauvegarde est invalide.");
  if (!input.progress || typeof input.progress !== "object" || Array.isArray(input.progress)) fail(422, "invalid_game_progress", "La progression de la grille est invalide.");
  const progress = createEmptyProgress(model);
  for (const [key, raw] of Object.entries(input.progress)) {
    const cell = model.cells.get(key);
    if (cell?.type !== "letter" || typeof raw !== "string") fail(422, "invalid_game_cell", "Une case de la grille est invalide.");
    const letter = raw.normalize("NFC").toLocaleUpperCase("fr-FR");
    if (letter !== "" && !/^[A-ZÀ-ÖØ-ÞŒ]$/u.test(letter)) fail(422, "invalid_game_letter", "Chaque case doit contenir une seule lettre française.");
    progress[key] = letter && normalizeComparable(letter) === normalizeComparable(cell.solution) ? cell.solution : letter;
  }
  return { ...input, progress, requestId: input.requestId.toLowerCase() };
}

async function saveProgress(request, db, c, gridId, complete) {
  const puzzle = GRIDS.get(gridId);
  if (!puzzle?.model.valid) fail(404, "game_grid_not_found", "Cette grille n’est pas disponible.");
  await assertAccess(db, c, c.user.id);
  const input = validateInput(await readInput(request), c, puzzle.model);
  if (complete && !checkGrid(puzzle.model, input.progress).complete) fail(422, "game_grid_incomplete", "Toutes les lettres doivent être correctes pour terminer la grille.");
  const progressJson = JSON.stringify(input.progress);
  const requestHash = await hash(JSON.stringify([complete ? "complete" : "progress", gridId, input.ownerId, progressJson, input.hintCount, input.revision]));
  const previous = (await ownRecords(db, c, gridId))[0];
  if (previous?.last_request_id === input.requestId) {
    if (previous.last_request_hash !== requestHash) await conflict(db, c, previous, gridId, "game_request_conflict");
    await assertAccess(db, c, c.user.id);
    return reply({ userId: c.user.id, schoolId: c.schoolId, xpTotal: await ownXp(db, c), grid: viewGrid(previous), awarded: false });
  }
  if ((previous?.revision ?? 0) !== input.revision) await conflict(db, c, previous, gridId, "game_revision_conflict");

  const keyValues = [c.schoolId, c.user.id, GAME_ID, gridId];
  const guard = studentAccess(c, c.user.id);
  const time = now();
  const save = db.prepare(`INSERT INTO pilot_game_progress
    (school_id,student_id,game_id,grid_id,progress_json,hint_count,revision,last_request_id,last_request_hash,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${guard.sql}
      AND (?=0 OR EXISTS (SELECT 1 FROM pilot_game_progress current WHERE current.school_id=? AND current.student_id=?
        AND current.game_id=? AND current.grid_id=? AND current.revision=?))
    ON CONFLICT(school_id,student_id,game_id,grid_id) DO UPDATE SET
      progress_json=excluded.progress_json,hint_count=excluded.hint_count,revision=excluded.revision,
      last_request_id=excluded.last_request_id,last_request_hash=excluded.last_request_hash,updated_at=excluded.updated_at
    WHERE pilot_game_progress.revision=? AND pilot_game_progress.last_request_id<>?`)
    .bind(...keyValues, progressJson, input.hintCount, input.revision + 1, input.requestId, requestHash, time,
      ...guard.values, input.revision, ...keyValues, input.revision, input.revision, input.requestId);
  const statements = [save];
  if (complete) {
    const awardGuard = studentAccess(c, c.user.id);
    statements.push(db.prepare(`INSERT INTO pilot_game_awards(school_id,student_id,game_id,grid_id,xp,completed_at)
      SELECT ?,?,?,?,?,? WHERE ${awardGuard.sql} AND EXISTS (SELECT 1 FROM pilot_game_progress saved
        WHERE saved.school_id=? AND saved.student_id=? AND saved.game_id=? AND saved.grid_id=?
          AND saved.revision=? AND saved.last_request_id=? AND saved.last_request_hash=?)
      ON CONFLICT(school_id,student_id,game_id,grid_id) DO NOTHING`)
      .bind(...keyValues, puzzle.grid.xp, time, ...awardGuard.values, ...keyValues, input.revision + 1, input.requestId, requestHash));
  }
  const result = await db.batch(statements);
  await assertAccess(db, c, c.user.id);
  const saved = (await ownRecords(db, c, gridId))[0];
  if (!saved || saved.last_request_id !== input.requestId || saved.last_request_hash !== requestHash) {
    await conflict(db, c, saved, gridId, saved?.last_request_id === input.requestId ? "game_request_conflict" : "game_revision_conflict");
  }
  return reply({ userId: c.user.id, schoolId: c.schoolId, xpTotal: await ownXp(db, c), grid: viewGrid(saved),
    awarded: complete && Boolean(result[1]?.meta?.changes) });
}

export async function readSchoolGameSummary(db, c) {
  const actor = actorGuard(c);
  const relationship = c.role === "parent"
    ? "EXISTS (SELECT 1 FROM pilot_family_links f WHERE f.school_id=m.school_id AND f.student_id=u.id AND f.parent_id=? AND f.active=1)"
    : "u.id=?";
  const rows = await all(db, `SELECT u.id student_id,u.display_name student_name,p.grid_id,p.hint_count,p.updated_at,a.completed_at,a.xp,
    (SELECT COALESCE(SUM(qa.xp),0) FROM pilot_quiz_awards qa WHERE qa.school_id=m.school_id AND qa.student_id=u.id) quiz_xp,
    (SELECT COUNT(*) FROM pilot_quiz_attempts qt WHERE qt.school_id=m.school_id AND qt.student_id=u.id) quiz_started_count,
    (SELECT COUNT(*) FROM pilot_quiz_attempts qt WHERE qt.school_id=m.school_id AND qt.student_id=u.id AND qt.completed_at IS NOT NULL) quiz_completed_count,
    (SELECT json_object('id',qt.id,'gameId',qt.game_id,'completedAt',qt.completed_at,
      'questionCount',json_array_length(qt.question_ids_json),
      'correctCount',(SELECT COUNT(*) FROM json_each(qt.state_json,'$.answers') a WHERE json_extract(a.value,'$.isCorrect')=1),
      'xpEarned',(SELECT COALESCE(SUM(qa.xp),0) FROM pilot_quiz_awards qa WHERE qa.attempt_id=qt.id AND qa.school_id=m.school_id AND qa.student_id=u.id))
      FROM pilot_quiz_attempts qt WHERE qt.school_id=m.school_id AND qt.student_id=u.id AND qt.completed_at IS NOT NULL
      ORDER BY qt.completed_at DESC,qt.id DESC LIMIT 1) latest_quiz,
    (SELECT COALESCE(SUM(za.xp),0) FROM pilot_game_awards za WHERE za.school_id=m.school_id AND za.student_id=u.id AND za.game_id='mission-zellige') zellige_xp,
    (SELECT COUNT(*) FROM pilot_game_awards za WHERE za.school_id=m.school_id AND za.student_id=u.id AND za.game_id='mission-zellige') zellige_completed_count,
    (SELECT json_extract(zp.progress_json,'$.firstCompletion') FROM pilot_game_progress zp JOIN pilot_game_awards za
      ON za.school_id=zp.school_id AND za.student_id=zp.student_id AND za.game_id=zp.game_id AND za.grid_id=zp.grid_id
      WHERE zp.school_id=m.school_id AND zp.student_id=u.id AND zp.game_id='mission-zellige'
      ORDER BY za.completed_at DESC,za.grid_id DESC LIMIT 1) latest_zellige,
    (SELECT COALESCE(SUM(ca.xp),0) FROM pilot_class_awards ca WHERE ca.school_id=m.school_id AND ca.student_id=u.id) class_xp,
    (SELECT COUNT(*) FROM pilot_class_attempts ca WHERE ca.school_id=m.school_id AND ca.student_id=u.id AND ca.completed_at IS NOT NULL) class_completed_count,
    (SELECT COALESCE(SUM(ma.xp),0) FROM pilot_market_awards ma WHERE ma.school_id=m.school_id AND ma.student_id=u.id) market_xp,
    (SELECT COUNT(*) FROM pilot_market_awards ma WHERE ma.school_id=m.school_id AND ma.student_id=u.id AND ma.reward_type='mastery') market_completed_count,
    (SELECT json_extract(r.value,'$.firstCompletion') FROM pilot_game_progress mp,json_each(mp.progress_json,'$.runs') r
      WHERE mp.school_id=m.school_id AND mp.student_id=u.id AND mp.game_id='souk-des-mots' AND mp.grid_id='v1' AND json_type(r.value,'$.firstCompletion')='object'
      ORDER BY json_extract(r.value,'$.firstCompletion.completedAt') DESC,r.key DESC LIMIT 1) latest_market
    FROM pilot_users u JOIN pilot_memberships m ON m.user_id=u.id
    LEFT JOIN pilot_game_progress p ON p.school_id=m.school_id AND p.student_id=u.id AND p.game_id=?
    LEFT JOIN pilot_game_awards a ON a.school_id=p.school_id AND a.student_id=p.student_id AND a.game_id=p.game_id AND a.grid_id=p.grid_id
    WHERE m.school_id=? AND m.role='eleve' AND m.active=1 AND u.active=1 AND ${actor.sql} AND ${relationship}
      AND EXISTS (SELECT 1 FROM pilot_class_members cm JOIN pilot_classes cl ON cl.id=cm.class_id AND cl.school_id=cm.school_id
        WHERE cm.school_id=m.school_id AND cm.user_id=u.id AND cl.active=1)
    ORDER BY u.display_name,u.id,p.grid_id`, GAME_ID, c.schoolId, ...actor.values, c.user.id);
  const children = new Map();
  for (const row of rows) {
    if (!children.has(row.student_id)) children.set(row.student_id, { studentId: row.student_id, studentName: row.student_name,
      xpTotal: row.quiz_xp+row.zellige_xp+row.market_xp+row.class_xp, classCompletedCount: row.class_completed_count, marketCompletedCount: row.market_completed_count,
      latestMarket: row.latest_market ? JSON.parse(row.latest_market) : null, zelligeCompletedCount: row.zellige_completed_count,
      latestZellige: row.latest_zellige ? JSON.parse(row.latest_zellige) : null, quizStartedCount: row.quiz_started_count, quizCompletedCount: row.quiz_completed_count,
      latestQuiz: row.latest_quiz ? JSON.parse(row.latest_quiz) : null, completedCount: 0, startedCount: 0, grids: [] });
    const child = children.get(row.student_id);
    if (row.grid_id) {
      child.startedCount += 1;
      child.completedCount += row.completed_at === null ? 0 : 1;
      child.xpTotal += row.xp ?? 0;
      child.grids.push({ gridId: row.grid_id, completedAt: row.completed_at ?? null, awardedXp: row.xp ?? 0,
        hintCount: row.hint_count, updatedAt: row.updated_at });
    }
  }
  return { userId: c.user.id, schoolId: c.schoolId, children: [...children.values()] };
}

// The caller derives this context from authenticate() and the active membership, never request JSON.
export async function handleGames(request, env, c, path = new URL(request.url).pathname) {
  if (!c?.user?.id || !c.schoolId || c.session?.user_id !== c.user.id || !c.session?.token_hash) fail(401, "session_required", "Connectez-vous pour accéder au jeu.");
  if (c.role !== "eleve" && c.role !== "parent") fail(403, "game_role_required", "Ce parcours est réservé à l’élève et à son parent.");
  if (!env.DB) fail(503, "database_unavailable", "Le serveur de données n’est pas disponible.");
  if (request.method !== "GET") checkCsrf(request, c.session);
  await assertAccess(env.DB, c, c.role === "eleve" ? c.user.id : null);
  if (request.method === "GET" && path === `${ROOT}/summary`) return reply(await readSchoolGameSummary(env.DB, c));
  if (c.role !== "eleve") fail(403, "student_required", "Seul l’élève peut consulter et enregistrer les cases de sa grille.");
  if (request.method === "GET" && path === `${ROOT}/progress`) {
    const grids = (await ownRecords(env.DB, c)).map(viewGrid);
    return reply({ userId: c.user.id, schoolId: c.schoolId, xpTotal: await ownXp(env.DB, c), grids });
  }
  const route = path.match(/^\/api\/pilot\/games\/mots-fleches\/([a-z0-9-]+)\/(progress|complete)$/);
  if (request.method === "POST" && route) return saveProgress(request, env.DB, c, route[1], route[2] === "complete");
  return reply({ error: { code: "not_found", message: "Route inexistante." } }, 404);
}
