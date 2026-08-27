import assert from "node:assert/strict";
import test from "node:test";

import {
  MISSION_ZELLIGE_TELEMETRY_EVENTS,
  createMissionZelligeTelemetry,
} from "../src/features/games/mission-zellige/missionZelligeTelemetry.js";

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const context = Object.freeze({
  missionId: "bibliotheque-medina",
  dailyKey: "2026-08-27",
  mode: "daily",
  phase: "location",
  elapsedMs: 1240,
});

test("journalise uniquement les événements Mission Zellige autorisés", () => {
  const storage = createMemoryStorage();
  const telemetry = createMissionZelligeTelemetry({
    storage,
    now: () => new Date("2026-08-27T10:00:00.000Z"),
  });

  for (const eventName of MISSION_ZELLIGE_TELEMETRY_EVENTS) {
    assert.equal(telemetry.track(eventName, context)?.event, eventName);
  }
  assert.equal(telemetry.track("student_name", context), null);
  assert.equal(telemetry.getEvents().length, MISSION_ZELLIGE_TELEMETRY_EVENTS.length);

  const restored = createMissionZelligeTelemetry({ storage });
  assert.equal(restored.getEvents().length, MISSION_ZELLIGE_TELEMETRY_EVENTS.length);
});

test("exclut toute donnée personnelle et tout texte libre des métadonnées", () => {
  const telemetry = createMissionZelligeTelemetry({ storage: createMemoryStorage() });
  const record = telemetry.track("location_error", {
    ...context,
    metadata: {
      firstTry: false,
      attempts: 2,
      hotspotId: "cafe-bleu",
      inputMethod: "keyboard",
      audioSource: "speech-synthesis",
      studentName: "Samira",
      email: "samira@example.test",
      freeText: "Je suis perdue",
      reasonCode: "wrong_location",
    },
  });

  assert.deepEqual(record.metadata, {
    firstTry: false,
    attempts: 2,
    hotspotId: "cafe-bleu",
    inputMethod: "keyboard",
    audioSource: "speech-synthesis",
    reasonCode: "wrong_location",
  });
  assert.equal(JSON.stringify(record).includes("Samira"), false);
  assert.equal(JSON.stringify(record).includes("example.test"), false);
  assert.equal(JSON.stringify(record).includes("perdue"), false);
});

test("refuse les contextes incomplets ou hors schéma", () => {
  const telemetry = createMissionZelligeTelemetry({ storage: createMemoryStorage() });
  assert.equal(telemetry.track("view", { ...context, missionId: "Nom avec espaces" }), null);
  assert.equal(telemetry.track("view", { ...context, dailyKey: "27/08/2026" }), null);
  assert.equal(telemetry.track("view", { ...context, mode: "teacher" }), null);
  assert.equal(telemetry.track("view", { ...context, phase: "intro" }), null);
  assert.equal(telemetry.track("view", { ...context, elapsedMs: Number.NaN }), null);
  assert.deepEqual(telemetry.getEvents(), []);
});

test("plafonne l'historique et conserve les événements les plus récents", () => {
  let clock = 0;
  const telemetry = createMissionZelligeTelemetry({
    storage: createMemoryStorage(),
    maxEvents: 3,
    now: () => clock++,
  });

  for (let attempts = 1; attempts <= 5; attempts += 1) {
    telemetry.track("location_error", {
      ...context,
      metadata: { attempts },
    });
  }

  assert.deepEqual(
    telemetry.getEvents().map((event) => event.metadata.attempts),
    [3, 4, 5],
  );
});

test("récupère sans exception un stockage corrompu ou indisponible", () => {
  const corrupted = createMemoryStorage({
    "jde.mission-zellige:telemetry:v1": "{ceci-n-est-pas-du-json",
  });
  const recovered = createMissionZelligeTelemetry({ storage: corrupted });
  assert.doesNotThrow(() => recovered.track("start", context));
  assert.equal(recovered.getEvents().length, 1);

  const unavailable = {
    getItem() {
      throw new Error("storage bloqué");
    },
    setItem() {
      throw new Error("quota dépassé");
    },
    removeItem() {
      throw new Error("storage bloqué");
    },
  };
  const inMemoryFallback = createMissionZelligeTelemetry({ storage: unavailable });
  assert.doesNotThrow(() => inMemoryFallback.track("audio_play", context));
  assert.equal(inMemoryFallback.getEvents().length, 1);
  assert.equal(inMemoryFallback.clear(), false);
  assert.deepEqual(inMemoryFallback.getEvents(), []);
});

test("clear efface le journal local", () => {
  const storage = createMemoryStorage();
  const telemetry = createMissionZelligeTelemetry({ storage });
  telemetry.track("complete", { ...context, phase: "complete" });
  assert.equal(telemetry.clear(), true);
  assert.deepEqual(telemetry.getEvents(), []);
  assert.deepEqual(createMissionZelligeTelemetry({ storage }).getEvents(), []);
});
