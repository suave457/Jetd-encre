import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const gameRoot = new URL("../public/games/projet-debat/", import.meta.url);

test("embarque le moteur Projet DÉBAT et ses ressources essentielles", async () => {
  await Promise.all([
    "index.html",
    "app.js",
    "styles.css",
    "game-logic.mjs",
    "cards.json",
    "assets/brand/jet-dencre-logo-horizontal.webp",
    "assets/illustrations/welcome-debat.webp",
  ].map((relativePath) => access(new URL(relativePath, gameRoot))));
});

test("conserve les 74 cartes et les 18 thèmes du programme", async () => {
  const data = JSON.parse(await readFile(new URL("cards.json", gameRoot), "utf8"));
  assert.equal(data.cartes.length, 74);
  assert.equal(data.audit.nombre_themes_officiels, 18);
  assert.equal(data.audit.controles.trois_cartes_graduees_par_theme, true);
});

test("sépare les sessions locales élève et enseignant", async () => {
  const runtime = await readFile(new URL("app.js", gameRoot), "utf8");
  assert.match(runtime, /integrationAudience/);
  assert.match(runtime, /projet-debat-v01-session\$\{storageScope\}/);
  assert.match(runtime, /projet-debat-v01-preferences\$\{storageScope\}/);
});
