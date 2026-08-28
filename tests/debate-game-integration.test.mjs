import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  createDebateIntegrationChannel,
  DEBATE_EVENT_TYPES,
  DEBATE_INTEGRATION_SOURCE,
  parseDebateIntegrationEvent,
} from "../src/features/games/debate/debateIntegration.js";

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

test("échappe les noms de camp avant le gabarit HTML d’attribution", async () => {
  const runtime = await readFile(new URL("app.js", gameRoot), "utf8");
  const assignmentArea = runtime.match(/function renderAssignmentArea\(card\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(assignmentArea, /esc\(sideName\(chooser\)\)/);
  assert.match(assignmentArea, /esc\(sideName\(other\)\)/);
  assert.doesNotMatch(assignmentArea, /\+ sideName\((?:chooser|other)\) \+/);
  assert.match(runtime, /document\.addEventListener\("input", handleInput\)/);
});

test("le pont d'intégration refuse un autre rôle, canal ou type d'événement", () => {
  const channel = createDebateIntegrationChannel("audit-12345678");
  const event = {
    source: DEBATE_INTEGRATION_SOURCE,
    version: 1,
    type: DEBATE_EVENT_TYPES.XP_EARNED,
    audience: "eleve",
    channel,
    payload: {
      amount: 20,
      eventId: "projet-debat:tentative:completion",
      attemptId: "projet-debat:tentative",
    },
  };

  assert.equal(parseDebateIntegrationEvent(event, { audience: "eleve", channel })?.payload.amount, 20);
  assert.equal(parseDebateIntegrationEvent(event, { audience: "enseignant", channel }), null);
  assert.equal(parseDebateIntegrationEvent(event, { audience: "eleve", channel: "jde-autre-canal" }), null);
  assert.equal(parseDebateIntegrationEvent({ ...event, type: "inconnu" }, { audience: "eleve", channel }), null);
  assert.equal(parseDebateIntegrationEvent({ ...event, payload: { ...event.payload, amount: 1000 } }, { audience: "eleve", channel }), null);

  const round = {
    ...event,
    type: DEBATE_EVENT_TYPES.ROUND_COMPLETED,
    payload: { attemptId: "projet-debat:tentative", round: 1, totals: { A: 4, B: 3 } },
  };
  assert.equal(parseDebateIntegrationEvent(round, { audience: "eleve", channel })?.payload.round, 1);
  assert.equal(parseDebateIntegrationEvent({ ...round, payload: { ...round.payload, round: 0 } }, { audience: "eleve", channel }), null);
});

test("le runtime DÉBAT émet des événements de manche, de fin et d'XP", async () => {
  const runtime = await readFile(new URL("app.js", gameRoot), "utf8");
  assert.match(runtime, /round-completed/);
  assert.match(runtime, /game-completed/);
  assert.match(runtime, /xp-earned/);
  assert.match(runtime, /integrationCompletionSent/);
});
