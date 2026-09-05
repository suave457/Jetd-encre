import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseRoute } from "../src/routeCore.js";
import { createDemoStore, createMemoryStorage, DEMO_ACCOUNTS } from "../src/demoStoreCore.js";
import { buildParentHomework, getParentLearningSummary, loadParentProfile, saveParentProfile, requestDemoFamilyLink } from "../src/parentDataCore.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("résout les huit interfaces W07 Parent et le paramètre enfant", () => {
  const routes = [
    ["/parent/tableau-de-bord", "parent.dashboard"],
    ["/parent/enfants", "parent.children"],
    ["/parent/enfants/lina-mansouri", "parent.child-detail"],
    ["/parent/devoirs", "parent.assignments"],
    ["/parent/progres", "parent.progress"],
    ["/parent/messages", "parent.messages"],
    ["/parent/parametres", "parent.settings"],
  ];

  for (const [path, screen] of routes) {
    const route = parseRoute(path);
    assert.equal(route.kind, "app", path);
    assert.equal(route.role, "parent", path);
    assert.equal(route.screen, screen, path);
  }

  assert.deepEqual(parseRoute("/parent/enfants/lina-mansouri").params, {
    childId: "lina-mansouri",
  });
});

test("parent reads a submission and its actual correction without putting completed work back in todo", () => {
  const store = createDemoStore({ storage: createMemoryStorage() });
  const studentId = DEMO_ACCOUNTS.eleve.userId;
  const homework = () => buildParentHomework(store.getState().assignments, store.getState().submissions, studentId);
  const assignment = homework()[0];
  assert.equal(assignment.status, "À faire");
  const submission = store.actions.submitAssignment({ assignmentId: assignment.id, studentId, answer: "Mon quartier est calme et les rues sont propres." });
  assert.equal(submission.ok, true);
  assert.equal(homework().find(item => item.id === assignment.id).status, "Remis");
  store.actions.reviewSubmission(submission.submission.id, { score: 0, feedback: "Reprends la consigne et ajoute cinq adjectifs pour décrire le lieu." });
  const reviewed = homework().find(item => item.id === assignment.id);
  assert.equal(reviewed.status, "Corrigé");
  assert.equal(reviewed.submission.score, 0);
  assert.match(reviewed.submission.feedback, /cinq adjectifs/);
  const notificationsBeforeRetry = store.getState().notifications.length;
  const retried = store.actions.submitAssignment({ assignmentId: assignment.id, studentId, answer: submission.submission.answer });
  assert.equal(retried.duplicate, true);
  assert.equal(retried.submission.status, "Corrigé");
  assert.equal(store.getState().notifications.length, notificationsBeforeRetry);
  assert.equal(store.actions.reviewSubmission(submission.submission.id, { score: "", feedback: "Commentaire assez long" }).error, "invalid_score");
  assert.equal(homework().filter(item => item.id === assignment.id && item.status === "À faire").length, 0);
  assert.deepEqual(buildParentHomework([], [], studentId), []);
  assert.deepEqual(buildParentHomework([{ id: "other-school", status: "Publié", classId: "classe-5b" }], [], studentId), []);
  assert.equal(buildParentHomework([{ ...assignment, status: "Publié" }], [{ assignmentId: assignment.id, studentId: "another-child", status: "Corrigé" }], studentId)[0].status, "À faire");
});

test("profile persists every editable field and reports unavailable storage without a fake success", () => {
  const storage = createMemoryStorage();
  const edited = { ...loadParentProfile(storage), name: "Parent test", city: "Rabat", phone: "+212600000000", email: "parent@example.test", relationship: "Tuteur légal", address: "Rue de test", language: "العربية" };
  assert.equal(saveParentProfile(storage, edited).ok, true);
  assert.deepEqual(loadParentProfile(storage), edited);
  assert.equal(saveParentProfile({ setItem() { throw new Error("quota"); } }, edited).ok, false);
  assert.equal(saveParentProfile(null, edited).ok, false);
  assert.equal(saveParentProfile({ setItem() {}, getItem() { return null; } }, edited).ok, false);
  assert.equal(requestDemoFamilyLink("MADE-UP-CODE").ok, false);
  assert.match(requestDemoFamilyLink().message, /aucun rattachement/);
});

test("parent separates replay participation, distinct activities and actual XP events from seeded balances", () => {
  const store = createDemoStore({ storage: createMemoryStorage() });
  const account = DEMO_ACCOUNTS.eleve;
  store.actions.signIn("eleve", { identifier: account.identifier, password: account.password });
  assert.equal(getParentLearningSummary(store.getState(), account.userId).xpEarned, 0);
  store.actions.recordQuizAttempt({ attemptId: "free", correctCount: 0, questionCount: 10 });
  for (const attemptId of ["practice-1", "practice-2"]) store.actions.completeLearningActivity({ activityId: "mots-environnement", attemptId, answers: [1, 2, 0, 3, 1] });
  const summary = getParentLearningSummary(store.getState(), account.userId);
  assert.equal(summary.participationCount, 3);
  assert.equal(summary.completedActivityCount, 1);
  assert.equal(summary.exercises[0].id, "practice-2");
  assert.equal(summary.xpEarned, 50);
});

test("le shell raccorde la connexion et la fiche Parent avant le détail générique", async () => {
  const source = await read("../src/App.jsx");
  assert.match(source, /ParentLoginPage, ParentPages/);
  assert.match(source, /parsed\.role==="parent"\?<ParentLoginPage\/>/);
  assert.match(source, /role==="parent"\?<ParentPages page=\{page\} detail=\{detail\} search=\{search\}\/>:detail\?<RoleDetailPage/);
});

test("le contrat visuel Parent conserve les dimensions W07 ordinateur et tablette", async () => {
  const [pages, styles] = await Promise.all([
    read("../src/ParentPages.jsx"),
    read("../src/parent-pages.css"),
  ]);

  for (const component of [
    "ParentDashboard",
    "ChildrenListPage",
    "ChildDetailPage",
    "HomeworkPage",
    "ProgressPage",
    "MessagesPage",
    "SettingsPage",
    "ParentLoginPage",
  ]) assert.match(pages, new RegExp(`(?:function|export function) ${component}\\b`));

  assert.match(styles, /--sidebar: 248px/);
  assert.match(styles, /grid-template-columns: 88px minmax\(0, 1fr\)/);
  assert.match(styles, /\.role-shell-parent \.app-topbar \{ min-height: 64px/);
  assert.match(styles, /\.parent-login-page \{ grid-template-columns: 300px minmax\(0, 1fr\)/);
});

test("la démo parent n’expose aucun envoi vers un contact non validé et utilise un vrai dialogue modal", async () => {
  const source = await read("../src/ParentPages.jsx");
  assert.doesNotMatch(source, /mailto:|contact@jetdencre\.ma/);
  assert.match(source, /<dialog ref=\{composeDialogRef\}/);
  assert.match(source, /dialog\.showModal\(\)/);
  assert.match(source, /onKeyDown=\{trapComposeFocus\}/);
  assert.match(source, /composeOpenerRef\.current\?\.isConnected/);
  assert.match(source, /onCancel=\{event => \{ event\.preventDefault\(\); closeCompose\(\); \}\}/);
});
