import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseRoute } from "../src/routeCore.js";

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
