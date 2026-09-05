import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEMO_ACCOUNTS,
  DEMO_ROLES,
  DEMO_SCHEMA_VERSION,
  createDemoStore,
  createMemoryStorage,
  createSafeStorage,
  migrateDemoState,
  validateDemoCredentials,
  isPublicDemoContent,
} from "../src/demoStoreCore.js";

const reactStoreSource = await readFile(new URL("../src/demoStore.jsx", import.meta.url), "utf8");

function testClock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 7, 26, 12, 0, tick++));
}

function demoCredentials(role) {
  const account = DEMO_ACCOUNTS[role];
  return { identifier: account.identifier, password: account.password };
}

function signInAs(store, role) {
  return store.actions.signIn(role, demoCredentials(role));
}

test("exports the React provider, hook and integration constants", () => {
  assert.match(reactStoreSource, /export function DemoProvider\(/);
  assert.match(reactStoreSource, /export function useDemoStore\(/);
  assert.match(reactStoreSource, /export const DemoStoreContext/);
  for (const exportedName of [
    "DEMO_SCHEMA_VERSION",
    "DEMO_STORAGE_KEY",
    "DEMO_ROLES",
    "DEMO_ACCOUNTS",
    "ACTIVATION_CODE_PATTERN",
    "createDemoStore",
  ]) {
    assert.match(reactStoreSource, new RegExp(`\\b${exportedName}\\b`), exportedName);
  }
});

test("publication does not make an audience-restricted demo content public", () => {
  assert.equal(isPublicDemoContent({ status: "Publié", visibility: "Élèves et enseignants" }), false);
  assert.equal(isPublicDemoContent({ status: "Publié" }), false);
  assert.equal(isPublicDemoContent({ status: "Brouillon", visibility: "Public" }), false);
  assert.equal(isPublicDemoContent({ status: "Publié", visibility: "Public", archivedAt: "2026-09-04" }), false);
  assert.equal(isPublicDemoContent({ status: "Publié", visibility: "Public" }), true);
});

test("exposes one working demo session for every role", () => {
  const store = createDemoStore({ storage: createMemoryStorage(), now: testClock() });
  assert.deepEqual(DEMO_ROLES, ["eleve", "parent", "enseignant", "directeur", "admin"]);

  for (const role of DEMO_ROLES) {
    const result = signInAs(store, role);
    assert.equal(result.ok, true, role);
    assert.equal(store.getState().session.role, role);
    assert.equal(store.getState().session.authenticated, true);
  }
  assert.equal(store.actions.signIn("superadmin").error, "unknown_role");
  assert.equal(
    store.actions.signIn("admin", {
      identifier: DEMO_ACCOUNTS.admin.identifier,
      password: "incorrect",
    }).error,
    "invalid_credentials",
  );
});

test("requires the exact demo identifier and password without mutating the session on failure", () => {
  const store = createDemoStore({ storage: createMemoryStorage(), now: testClock() });
  const initialRevision = store.getState().meta.revision;
  const admin = DEMO_ACCOUNTS.admin;

  assert.equal(validateDemoCredentials("admin").error, "credentials_required");
  assert.equal(validateDemoCredentials("admin", {}).error, "credentials_required");
  assert.equal(
    validateDemoCredentials("admin", { identifier: admin.identifier }).error,
    "credentials_required",
  );
  assert.equal(
    validateDemoCredentials("admin", { password: admin.password }).error,
    "credentials_required",
  );
  assert.equal(
    validateDemoCredentials("admin", { identifier: admin.identifier, password: "incorrect" }).error,
    "invalid_credentials",
  );
  assert.equal(
    validateDemoCredentials("admin", {
      identifier: DEMO_ACCOUNTS.parent.identifier,
      password: admin.password,
    }).error,
    "invalid_credentials",
  );
  assert.equal(
    validateDemoCredentials("admin", {
      identifier: `  ${admin.identifier.toUpperCase()}  `,
      password: admin.password,
    }).ok,
    true,
  );
  assert.equal(
    validateDemoCredentials("admin", {
      identifier: admin.identifier,
      password: ` ${admin.password}`,
    }).error,
    "invalid_credentials",
  );
  assert.equal(
    validateDemoCredentials("admin", { email: admin.identifier, password: admin.password }).ok,
    true,
  );

  assert.equal(store.actions.signIn("admin").error, "credentials_required");
  assert.equal(store.getState().session.authenticated, false);
  assert.equal(store.getState().meta.revision, initialRevision);
});

test("returns strict invalid, already_used and valid activation states", () => {
  const store = createDemoStore({ storage: createMemoryStorage(), now: testClock() });

  assert.equal(store.actions.activateCode("ABC").status, "invalid");
  assert.equal(store.actions.activateCode("JDE-26-FR5-42").status, "invalid");
  assert.equal(store.actions.activateCode("JDE-26-FR5-9999").status, "invalid");
  assert.equal(store.actions.activateCode("JDE-26-FR5-0041").status, "already_used");

  const activation = store.actions.activateCode(" jde-26-fr5-0042 ");
  assert.equal(activation.ok, true);
  assert.equal(activation.status, "valid");
  assert.equal(activation.level, "5e AEP");
  assert.equal(store.actions.activateCode("JDE-26-FR5-0042").status, "already_used");
});

test("links a pending activation to the student profile at sign-in", () => {
  const storage = createMemoryStorage();
  const now = testClock();
  const store = createDemoStore({ storage, now });

  const activated = store.actions.activateCode("JDE-26-FR5-0042");
  assert.equal(activated.ok, true);
  assert.equal(store.getState().session.pendingActivation.id, activated.activation.id);
  assert.equal(activated.activation.userId, "activation-en-attente");

  const signedIn = signInAs(store, "eleve");
  assert.equal(signedIn.ok, true);
  assert.equal(signedIn.activationLinked, true);
  assert.equal(signedIn.activation.userId, "user-eleve-lina");
  assert.equal(store.getState().session.pendingActivation, null);
  assert.equal(store.getState().manualActivations.find((item) => item.id === activated.activation.id).userId, "user-eleve-lina");
  assert.equal(store.getState().activationCodes.find((item) => item.code === activated.code).usedBy, "user-eleve-lina");
  assert.ok(store.getState().manualProgress.some((item) => item.activationId === activated.activation.id));
  assert.ok(store.getState().notifications.some((item) => item.type === "activation" && item.userId === "user-eleve-lina"));

  const restored = createDemoStore({ storage, now });
  assert.equal(restored.getState().manualActivations.find((item) => item.id === activated.activation.id).userId, "user-eleve-lina");
});

test("persists CRUD operations for assignments, contents and articles", () => {
  const storage = createMemoryStorage();
  const now = testClock();
  const firstStore = createDemoStore({ storage, now });

  const assignment = firstStore.actions.createAssignment({ title: "Dialogue au marché", level: "4e AEP" });
  assert.equal(assignment.ok, true);
  assert.equal(firstStore.actions.updateAssignment(assignment.item.id, { status: "Publié" }).item.status, "Publié");
  assert.match(firstStore.actions.duplicateAssignment(assignment.item.id).item.title, /\(copie\)$/);
  assert.equal(firstStore.actions.archiveAssignment(assignment.item.id).item.status, "Archivé");

  const content = firstStore.actions.createContent({ title: "La place Jemaa el-Fna", type: "Podcast" });
  const article = firstStore.actions.createArticle({ title: "Apprendre en racontant son quartier" });
  assert.equal(content.ok, true);
  assert.equal(article.item.slug, "apprendre-en-racontant-son-quartier");

  const restoredStore = createDemoStore({ storage, now });
  assert.ok(restoredStore.getState().assignments.some((item) => item.id === assignment.item.id));
  assert.ok(restoredStore.getState().contents.some((item) => item.id === content.item.id));
  assert.ok(restoredStore.getState().articles.some((item) => item.id === article.item.id));
  assert.equal(restoredStore.actions.deleteContent(content.item.id).ok, true);
  assert.equal(restoredStore.actions.updateContent("absent", {}).error, "not_found");
});

test("persists the complete assignment submission and correction loop", () => {
  const storage = createMemoryStorage();
  const now = testClock();
  const store = createDemoStore({ storage, now });
  signInAs(store, "eleve");

  assert.equal(store.actions.submitAssignment({
    assignmentId: "devoir-decrire-ville",
    answer: "Trop court",
  }).error, "answer_too_short");

  const submitted = store.actions.submitAssignment({
    assignmentId: "devoir-decrire-ville",
    answer: "La médina est animée, lumineuse, accueillante, ancienne et colorée.",
  });
  assert.equal(submitted.ok, true);
  assert.equal(submitted.submission.status, "À corriger");
  assert.equal(store.getState().assignments.find((item) => item.id === "devoir-decrire-ville").submissions, 1);
  assert.ok(store.getState().notifications.some((item) => item.role === "enseignant" && item.type === "remise"));

  signInAs(store, "enseignant");
  assert.equal(store.actions.reviewSubmission(submitted.submission.id, { score: 25, feedback: "À revoir." }).error, "invalid_score");
  const reviewed = store.actions.reviewSubmission(submitted.submission.id, {
    score: 17,
    feedback: "Très bonne description. Pense à varier les connecteurs.",
  });
  assert.equal(reviewed.ok, true);
  assert.equal(reviewed.submission.status, "Corrigé");
  assert.equal(reviewed.submission.score, 17);
  assert.ok(store.getState().notifications.some((item) => item.role === "eleve" && item.type === "correction"));

  const restored = createDemoStore({ storage, now });
  assert.equal(restored.getState().submissions[0].feedback, "Très bonne description. Pense à varier les connecteurs.");
});

test("handles notifications and resets the demo", () => {
  const store = createDemoStore({ storage: createMemoryStorage(), now: testClock() });
  signInAs(store, "parent");
  const notification = store.actions.notify({ title: "Nouveau bilan", message: "Le bilan de Lina est prêt." });
  assert.equal(notification.notification.role, "parent");
  assert.equal(store.actions.markNotificationRead(notification.notification.id).notification.read, true);
  assert.equal(store.actions.removeNotification(notification.notification.id).ok, true);

  store.actions.createArticle({ title: "Article temporaire" });
  const reset = store.actions.reset();
  assert.equal(reset.ok, true);
  assert.equal(store.getState().session.authenticated, false);
  assert.equal(store.getState().articles.some((item) => item.title === "Article temporaire"), false);
});

test("awards quiz XP once per question and persists the student total", () => {
  const storage = createMemoryStorage();
  const now = testClock();
  const store = createDemoStore({ storage, now });
  signInAs(store, "eleve");

  const studentId = store.getState().session.userId;
  const startingStudent = store.getState().users.find((user) => user.id === studentId);
  assert.equal(startingStudent.xp, 1240);

  const award = store.actions.awardStudentXp({
    amount: 10,
    eventId: "culture-generale:attempt-1:culture-01",
    attemptId: "attempt-1",
    questionId: "culture-01",
    source: "culture-generale",
  });
  assert.equal(award.ok, true);
  assert.equal(award.awarded, true);
  assert.equal(award.totalXp, 1250);

  const duplicate = store.actions.awardStudentXp({
    amount: 10,
    eventId: "culture-generale:attempt-1:culture-01",
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.awarded, false);
  assert.equal(duplicate.totalXp, 1250);
  assert.equal(store.getState().quizAwards.length, 1);
  assert.equal(store.actions.awardStudentXp({ amount: 0, eventId: "invalid" }).error, "invalid_amount");

  const attempt = store.actions.recordQuizAttempt({
    attemptId: "attempt-1",
    quizId: "culture-generale",
    correctCount: 1,
    questionCount: 10,
    xpEarned: 10,
    bestStreak: 1,
    scorePercent: 10,
  });
  assert.equal(attempt.ok, true);
  assert.equal(attempt.recorded, true);
  assert.equal(store.actions.recordQuizAttempt({ attemptId: "attempt-1" }).recorded, false);
  assert.equal(store.getState().quizAttempts.length, 1);
  assert.equal(store.getState().quizAttempts[0].activationId, "activation-lina-fr5");
  assert.equal(store.getState().manualProgress.find((item) => item.activationId === "activation-lina-fr5").percent, 50);

  const restoredStore = createDemoStore({ storage, now });
  assert.equal(restoredStore.getState().users.find((user) => user.id === studentId).xp, 1250);
  assert.equal(restoredStore.getState().quizAttempts.length, 1);
  restoredStore.actions.reset();
  assert.equal(restoredStore.getState().users.find((user) => user.id === studentId).xp, 1240);
  assert.equal(restoredStore.getState().quizAwards.length, 0);
  assert.equal(restoredStore.getState().quizAttempts.length, 0);
});

test("free games, including five failed attempts, never complete an unrelated manual unit", () => {
  const store = createDemoStore({ storage: createMemoryStorage(), now: testClock() });
  signInAs(store, "eleve");
  const before = structuredClone(store.getState().manualProgress);
  for (let index = 0; index < 5; index += 1) {
    const result = store.actions.recordQuizAttempt({ attemptId: `failed-${index}`, quizId: "culture-generale", unitId: "unite-3", lessonId: "lecon-2", correctCount: 0, questionCount: 10, xpEarned: 0 });
    assert.equal(result.ok, true);
    assert.equal(result.attempt.unitId, null);
  }
  store.actions.recordQuizAttempt({ attemptId: "perfect-free-game", quizId: "mots-fleches", correctCount: 11, questionCount: 11, scorePercent: 100 });
  assert.deepEqual(store.getState().manualProgress, before);
  assert.equal(store.getState().quizAttempts.length, 6);
  assert.equal(store.getState().users.find(item => item.role === "eleve").xp, 1240);
});

test("learning activity grades actual answers, exposes the correction and awards only newly correct questions", () => {
  const storage = createMemoryStorage();
  const store = createDemoStore({ storage, now: testClock() });
  assert.equal(store.actions.completeLearningActivity({ activityId: "mots-environnement", attemptId: "learning-1", answers: [0, 0, 1, 0, 0] }).error, "student_session_required");
  signInAs(store, "eleve");
  const before = structuredClone(store.getState().manualProgress);
  const wrong = store.actions.completeLearningActivity({ activityId: "mots-environnement", attemptId: "learning-1", answers: [0, 0, 1, 0, 0], xpEarned: 9999, scorePercent: 100 });
  assert.equal(wrong.attempt.correctCount, 0);
  assert.equal(wrong.attempt.scorePercent, 0);
  assert.equal(wrong.attempt.xpEarned, 0);
  assert.equal(wrong.attempt.corrections[0].correctIndex, 1);
  assert.match(wrong.attempt.corrections[0].explanation, /Ramasser les déchets/);
  const incomplete = store.actions.completeLearningActivity({ activityId: "mots-environnement", attemptId: "missing", answers: [1] });
  assert.equal(incomplete.error, "incomplete_answers");
  assert.equal(store.getState().quizAttempts.length, 1);
  const partial = store.actions.completeLearningActivity({ activityId: "mots-environnement", attemptId: "learning-2", answers: [1, 2, 1, 0, 0] });
  assert.equal(partial.attempt.correctCount, 2);
  assert.equal(partial.attempt.xpEarned, 20);
  const correct = store.actions.completeLearningActivity({ activityId: "mots-environnement", attemptId: "learning-3", answers: [1, 2, 0, 3, 1] });
  assert.equal(correct.attempt.correctCount, 5);
  assert.equal(correct.attempt.xpEarned, 30);
  assert.equal(store.actions.completeLearningActivity({ activityId: "mots-environnement", attemptId: "learning-3", answers: [1, 2, 0, 3, 1] }).duplicate, true);
  assert.equal(store.getState().quizAttempts.length, 3);
  const replay = createDemoStore({ storage, now: testClock() });
  assert.equal(replay.actions.completeLearningActivity({ activityId: "mots-environnement", attemptId: "learning-4", answers: [1, 2, 0, 3, 1] }).attempt.xpEarned, 0);
  assert.equal(replay.getState().users.find(item => item.role === "eleve").xp, 1290);
  assert.equal(replay.getState().quizAwards.length, 5);
  assert.deepEqual(replay.getState().manualProgress, before);
});

test("migrates legacy collections and falls back to memory when localStorage fails", () => {
  const migrated = migrateDemoState({
    version: 1,
    devoirs: [{ id: "legacy", title: "Ancien devoir" }],
    contentItems: [{ id: "legacy-content", title: "Ancien contenu" }],
    blogArticles: [{ id: "legacy-article", title: "Ancien article" }],
  });
  assert.equal(migrated.schemaVersion, DEMO_SCHEMA_VERSION);
  assert.equal(migrated.assignments[0].id, "legacy");
  assert.equal(migrated.contents[0].id, "legacy-content");
  assert.equal(migrated.articles[0].id, "legacy-article");
  assert.ok(migrated.sessions.parent);
  assert.equal(migrated.users.find((user) => user.role === "eleve").xp, 1240);
  assert.deepEqual(migrated.quizAwards, []);
  assert.deepEqual(migrated.manualProgress, []);

  const forgedRole = migrateDemoState({
    schemaVersion: DEMO_SCHEMA_VERSION,
    session: {
      authenticated: true,
      role: "superadmin",
      userId: "intrus",
      signedInAt: "2026-08-26T12:00:00.000Z",
    },
  });
  assert.equal(forgedRole.session.authenticated, false);
  assert.equal(forgedRole.session.role, null);
  assert.equal(forgedRole.session.userId, null);

  const mismatchedIdentity = migrateDemoState({
    schemaVersion: DEMO_SCHEMA_VERSION,
    session: {
      authenticated: true,
      role: "parent",
      userId: DEMO_ACCOUNTS.admin.userId,
      signedInAt: "2026-08-26T12:00:00.000Z",
    },
  });
  assert.equal(mismatchedIdentity.session.authenticated, false);

  const validSession = migrateDemoState({
    schemaVersion: DEMO_SCHEMA_VERSION,
    session: {
      authenticated: true,
      role: "parent",
      userId: DEMO_ACCOUNTS.parent.userId,
      signedInAt: "2026-08-26T12:00:00.000Z",
    },
  });
  assert.equal(validSession.session.authenticated, true);
  assert.equal(validSession.session.role, "parent");
  assert.equal(validSession.session.userId, DEMO_ACCOUNTS.parent.userId);

  const brokenStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  const safeStorage = createSafeStorage(brokenStorage, createMemoryStorage());
  safeStorage.setItem("demo", "persisted in memory");
  assert.equal(safeStorage.backend, "memory");
  assert.equal(safeStorage.getItem("demo"), "persisted in memory");
});
