import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKET_MISSIONS,
  MARKET_PRODUCTS,
  MARKET_TIERS,
  formatMarketQuantity,
  getMarketProduct,
} from "../src/features/games/market-shop/marketShopData.js";
import {
  MARKET_MAX_XP,
  MARKET_AUTONOMY_REWARD,
  MARKET_MASTERY_REWARD,
  MARKET_MISSION_XP,
  MARKET_NO_HELP_BONUS_XP,
  buildMarketTierProgress,
  buildMarketTierSummary,
  buildMarketSummary,
  buildMarketRewardClaims,
  calculateMarketMissionXp,
  claimMarketMissionAward,
  compareMarketBasket,
  createMarketAwardEventId,
  createMarketRewardClaimId,
  evaluateMarketMission,
  getMarketMissionFeedback,
  inferCompletedMarketMissionIds,
  inferCompletedMarketMissionIdsFromAttempts,
  listSelectedMarketProductIds,
  normalizeCompletedMarketMissionIds,
  normalizeMarketBasket,
  validateMarketMission,
} from "../src/features/games/market-shop/marketShopEngine.js";

const missionById = new Map(MARKET_MISSIONS.map((mission) => [mission.id, mission]));

test("les douze missions suivent les trois paliers pédagogiques validés", () => {
  assert.equal(MARKET_TIERS.length, 3);
  assert.equal(MARKET_MISSIONS.length, 12);
  assert.deepEqual(MARKET_TIERS.map((tier) => tier.missionIds.length), [4, 4, 4]);
  assert.deepEqual(MARKET_TIERS.map((tier) => tier.id), ["discovery", "consolidation", "challenge"]);
  assert.equal(new Set(MARKET_MISSIONS.map((mission) => mission.id)).size, 12);
  assert.equal(new Set(MARKET_TIERS.flatMap((tier) => tier.missionIds)).size, 12);
  assert.deepEqual(missionById.get("mission-fruits").expectedBasket, { apple: 1, orange: 2 });
  assert.deepEqual(missionById.get("mission-legumes").expectedBasket, { tomato: 3, cucumber: 1, carrot: 2 });
  assert.deepEqual(missionById.get("mission-prix").expectedBasket, { "bread-roll": 2, apple: 3, "water-bottle": 1 });
  assert.match(missionById.get("mission-prix").instruction, /demande le prix/i);
  assert.match(missionById.get("mission-prix").formulas.find((formula) => formula.correct).text, /Combien cela coûte/i);
  assert.ok(MARKET_MISSIONS.every((mission) => MARKET_TIERS.some((tier) => tier.id === mission.tierId)));
  assert.ok(MARKET_MISSIONS.every((mission) => validateMarketMission(mission)));
});

test("chaque niveau de difficulté reste jouable avec les produits réellement affichés", () => {
  for (const mission of MARKET_MISSIONS) {
    const visibleCount = mission.difficulty.visibleProductCount;
    const visibleProductIds = mission.productIds.slice(0, visibleCount);
    assert.ok(visibleCount >= 3 && visibleCount <= mission.productIds.length);
    assert.equal(mission.difficulty.targetProductCount, Object.keys(mission.expectedBasket).length);
    assert.equal(mission.difficulty.formulaChoiceCount, mission.formulas.length);
    assert.ok(Object.keys(mission.expectedBasket).every((productId) => visibleProductIds.includes(productId)));
  }
});

test("l’audio guide la mission sans réciter la bonne réponse", () => {
  for (const mission of MARKET_MISSIONS) {
    const correctFormula = mission.formulas.find((formula) => formula.correct);
    assert.ok(correctFormula);
    assert.notEqual(mission.audioInstruction, correctFormula.text);
    assert.ok(mission.audioInstruction.length > 40);
  }
  assert.match(missionById.get("mission-legumes").instruction, /choisis la formule/i);
});

test("la banque contient chaque produit utile avec un actif dédié", () => {
  const ids = MARKET_PRODUCTS.map((product) => product.id);
  assert.deepEqual(new Set(ids), new Set([
    "apple",
    "orange",
    "tomato",
    "cucumber",
    "carrot",
    "bread-roll",
    "water-bottle",
  ]));
  assert.ok(MARKET_PRODUCTS.every((product) => product.image.endsWith(`${product.id}.webp`)));
  assert.equal(getMarketProduct("apple").label, "pomme");
  assert.equal(getMarketProduct("inconnu"), null);
  assert.equal(formatMarketQuantity("orange", 1), "1 orange");
  assert.equal(formatMarketQuantity("orange", 2), "2 oranges");
});

test("le panier exact réussit et les écarts sont expliqués précisément", () => {
  const mission = missionById.get("mission-legumes");
  const exact = compareMarketBasket(mission, { tomato: 3, cucumber: 1, carrot: 2 });
  assert.equal(exact.correct, true);
  assert.deepEqual(exact.missing, []);
  assert.deepEqual(exact.extra, []);

  const wrong = compareMarketBasket(mission, { tomato: 1, cucumber: 2, apple: 1 });
  assert.equal(wrong.correct, false);
  assert.deepEqual(
    wrong.missing.map(({ productId, quantity }) => [productId, quantity]),
    [["tomato", 2], ["carrot", 2]],
  );
  assert.deepEqual(
    wrong.extra.map(({ productId, quantity }) => [productId, quantity]),
    [["cucumber", 1], ["apple", 1]],
  );

  const feedback = evaluateMarketMission(mission, wrong.actual, "legumes-sans-quantites");
  assert.equal(feedback.correct, false);
  assert.match(feedback.feedback, /Il manque 2 tomates rouges et 2 carottes/);
  assert.match(feedback.feedback, /Retire 1 concombre et 1 pomme/);
  assert.match(feedback.feedback, /polie, mais elle ne reprend pas les produits/i);
});

test("le panier et la formule polie doivent être corrects ensemble", () => {
  const mission = missionById.get("mission-fruits");
  const basket = { apple: 1, orange: 2 };
  assert.equal(evaluateMarketMission(mission, basket, "fruits-polie").correct, true);
  assert.equal(evaluateMarketMission(mission, basket, "fruits-directe").correct, false);
  assert.equal(evaluateMarketMission(mission, basket, "").formulaCorrect, false);
  assert.equal(evaluateMarketMission(mission, { apple: 1 }, "fruits-polie").basketCorrect, false);
});

test("le feedback révèle progressivement la correction sur trois échecs", () => {
  const mission = {
    ...missionById.get("mission-legumes"),
    feedbackSteps: {
      reread: "Relis calmement la commande et repère les mots importants.",
      reviewProducts: "Compare maintenant les produits choisis avec la commande.",
    },
  };
  const evaluation = evaluateMarketMission(
    mission,
    { tomato: 1, cucumber: 2, apple: 1 },
    "legumes-sans-quantites",
  );

  const first = getMarketMissionFeedback(mission, evaluation, 1);
  assert.match(first, /Relis calmement la commande/);
  assert.match(first, /polie, mais elle ne reprend pas les produits/i);
  assert.doesNotMatch(first, /\b[0-9]+\b/);
  assert.doesNotMatch(first, /tomat|carott|concombre|pomme/i);

  const second = getMarketMissionFeedback(mission, evaluation, 2);
  assert.match(second, /Compare maintenant les produits/);
  assert.match(second, /Produits à vérifier/);
  assert.match(second, /tomates rouges/);
  assert.match(second, /carottes/);
  assert.match(second, /concombres/);
  assert.match(second, /pommes/);
  assert.doesNotMatch(second, /\b[0-9]+\b/);
  assert.match(second, /polie, mais elle ne reprend pas les produits/i);

  const third = getMarketMissionFeedback(mission, evaluation, 3);
  assert.match(third, /Il manque 2 tomates rouges et 2 carottes/);
  assert.match(third, /Retire 1 concombre et 1 pomme/);
  assert.match(third, /polie, mais elle ne reprend pas les produits/i);
  assert.equal(getMarketMissionFeedback(mission, evaluation, 8), third);
});

test("le feedback distingue clairement une formule absente, incorrecte ou réussie", () => {
  const mission = missionById.get("mission-fruits");
  const exactBasket = { apple: 1, orange: 2 };

  const missingFormula = evaluateMarketMission(mission, exactBasket, "");
  assert.equal(
    getMarketMissionFeedback(mission, missingFormula, 1),
    "Choisis aussi une phrase à dire au vendeur.",
  );

  const wrongFormula = evaluateMarketMission(mission, exactBasket, "fruits-directe");
  assert.match(
    getMarketMissionFeedback(mission, wrongFormula, 2),
    /ajoute une salutation et une formule de politesse/i,
  );
  assert.equal(wrongFormula.formulaDiagnosticCode, "missing-politeness");

  const success = evaluateMarketMission(mission, exactBasket, "fruits-polie");
  assert.equal(getMarketMissionFeedback(mission, success, 1), mission.success);
  assert.throws(() => getMarketMissionFeedback(null, success, 1), /nécessaires/);
});

test("une mission rapporte 10 XP et le parcours sans aide ajoute 5 XP", () => {
  assert.equal(MARKET_MISSION_XP, 10);
  assert.equal(MARKET_NO_HELP_BONUS_XP, 5);
  assert.equal(calculateMarketMissionXp({ correct: true, helpUsed: false }), 15);
  assert.equal(calculateMarketMissionXp({ correct: true, helpUsed: true }), 10);
  assert.equal(calculateMarketMissionXp({ correct: false, helpUsed: false }), 0);
  assert.equal(calculateMarketMissionXp({ correct: false, helpUsed: true }), 0);
});

test("la récompense est idempotente dans le module", () => {
  const first = claimMarketMissionAward([], "mission-fruits", { correct: true, helpUsed: false });
  assert.equal(first.awarded, true);
  assert.equal(first.xp, 15);
  assert.deepEqual(first.awardedMissionIds, ["mission-fruits"]);

  const duplicate = claimMarketMissionAward(first.awardedMissionIds, "mission-fruits", { correct: true, helpUsed: false });
  assert.equal(duplicate.awarded, false);
  assert.equal(duplicate.xp, 0);
  assert.deepEqual(duplicate.awardedMissionIds, ["mission-fruits"]);

  const failed = claimMarketMissionAward(duplicate.awardedMissionIds, "mission-legumes", { correct: false, helpUsed: false });
  assert.equal(failed.awarded, false);
  assert.equal(failed.xp, 0);
  assert.deepEqual(failed.awardedMissionIds, ["mission-fruits"]);
});

test("les claims de maîtrise et d’autonomie sont séparés et stables par élève et mission-version", () => {
  const mission = { ...missionById.get("mission-fruits"), version: 2 };
  const helped = buildMarketRewardClaims({
    studentId: "user-eleve-lina",
    mission,
    correct: true,
    helpUsed: true,
  });
  assert.deepEqual(helped, [{
    eventId: "souk-des-mots:user-eleve-lina:mission-fruits:v2:mastery",
    type: MARKET_MASTERY_REWARD,
    amount: 10,
    source: "souk-des-mots",
    studentId: "user-eleve-lina",
    missionId: "mission-fruits",
    questionId: "mission-fruits",
    missionVersion: "2",
  }]);

  const autonomous = buildMarketRewardClaims({
    studentId: "user-eleve-lina",
    mission,
    correct: true,
    helpUsed: false,
  });
  assert.deepEqual(autonomous.map(({ type, amount }) => [type, amount]), [
    [MARKET_MASTERY_REWARD, 10],
    [MARKET_AUTONOMY_REWARD, 5],
  ]);
  assert.equal(autonomous[0].eventId, helped[0].eventId);
  assert.equal(autonomous[1].eventId, "souk-des-mots:user-eleve-lina:mission-fruits:v2:autonomy");
  assert.ok(autonomous.every((claim) => !claim.eventId.includes("attempt")));
  assert.ok(Object.isFrozen(autonomous));
  assert.ok(autonomous.every(Object.isFrozen));

  assert.equal(
    createMarketRewardClaimId("user-eleve-lina", missionById.get("mission-fruits"), MARKET_MASTERY_REWARD),
    "souk-des-mots:user-eleve-lina:mission-fruits:v1:mastery",
  );
  assert.notEqual(
    createMarketRewardClaimId("user-eleve-nour", mission, MARKET_MASTERY_REWARD),
    helped[0].eventId,
  );
  assert.throws(
    () => createMarketRewardClaimId("user-eleve-lina", mission, "practice"),
    /mastery ou autonomy/,
  );
});

test("un rejeu ne repaie pas la maîtrise mais peut débloquer l’autonomie plus tard", () => {
  const mission = { ...missionById.get("mission-prix"), version: "2026.1" };
  const persistedEventIds = new Set();
  const persist = (claims) => claims.reduce((xp, claim) => {
    if (persistedEventIds.has(claim.eventId)) return xp;
    persistedEventIds.add(claim.eventId);
    return xp + claim.amount;
  }, 0);

  const firstHelpedAttempt = buildMarketRewardClaims({
    studentId: "user-eleve-lina",
    mission,
    correct: true,
    helpUsed: true,
  });
  assert.equal(persist(firstHelpedAttempt), 10);

  const laterAutonomousAttempt = buildMarketRewardClaims({
    studentId: "user-eleve-lina",
    mission,
    correct: true,
    helpUsed: false,
  });
  assert.equal(persist(laterAutonomousAttempt), 5);
  assert.equal(persist(laterAutonomousAttempt), 0);
  assert.equal(persistedEventIds.size, 2);

  assert.deepEqual(buildMarketRewardClaims({ correct: false }), []);
  assert.throws(
    () => buildMarketRewardClaims({ mission, correct: true }),
    /identifiant de l’élève/,
  );
});

test("le bilan atteint au maximum 180 XP et conserve le détail des aides", () => {
  const results = MARKET_MISSIONS.map((mission) => ({
    missionId: mission.id,
    correct: true,
    helpUsed: false,
    xpEarned: 15,
  }));
  const summary = buildMarketSummary(MARKET_MISSIONS, results, "tentative-1");
  assert.equal(MARKET_MAX_XP, 180);
  assert.equal(summary.completed, true);
  assert.equal(summary.completedMissionCount, 12);
  assert.equal(summary.withoutHelpCount, 12);
  assert.equal(summary.xpEarned, 180);
  assert.equal(summary.maxXp, 180);
  assert.ok(Object.isFrozen(summary.results));

  const capped = buildMarketSummary(MARKET_MISSIONS, results.map((result) => ({ ...result, xpEarned: 99 })), "tentative-2");
  assert.equal(capped.xpEarned, 180);
});

test("les paliers se débloquent uniquement après la maîtrise des quatre missions précédentes", () => {
  const initial = buildMarketTierProgress(MARKET_TIERS, MARKET_MISSIONS, []);
  assert.deepEqual(initial.map(({ status }) => status), ["available", "locked", "locked"]);
  assert.equal(initial[0].nextMissionId, "mission-fruits");

  const discoveryIds = MARKET_TIERS[0].missionIds;
  const afterDiscovery = buildMarketTierProgress(MARKET_TIERS, MARKET_MISSIONS, discoveryIds);
  assert.deepEqual(afterDiscovery.map(({ status }) => status), ["completed", "available", "locked"]);
  assert.equal(afterDiscovery[1].nextMissionId, "mission-legumes");

  const partialConsolidation = [...discoveryIds, MARKET_TIERS[1].missionIds[0]];
  const inProgress = buildMarketTierProgress(MARKET_TIERS, MARKET_MISSIONS, partialConsolidation);
  assert.equal(inProgress[1].status, "in-progress");
  assert.equal(inProgress[1].completedCount, 1);
  assert.equal(inProgress[1].progressPercent, 25);

  const allIds = MARKET_TIERS.flatMap((tier) => tier.missionIds);
  assert.deepEqual(
    buildMarketTierProgress(MARKET_TIERS, MARKET_MISSIONS, allIds).map(({ status }) => status),
    ["completed", "completed", "completed"],
  );
});

test("la progression se reconstruit depuis les récompenses persistantes de maîtrise", () => {
  const studentId = "user-eleve-lina";
  const fruits = missionById.get("mission-fruits");
  const collations = missionById.get("mission-collation");
  const awardRecords = [
    { id: createMarketRewardClaimId(studentId, fruits, MARKET_MASTERY_REWARD), userId: studentId, source: "souk-des-mots" },
    { id: "award-direct", userId: studentId, source: "souk-des-mots", questionId: collations.id },
    { id: "other-user", userId: "user-eleve-nour", source: "souk-des-mots", questionId: "mission-duo-legumes" },
    { id: "other-game", userId: studentId, source: "culture-generale", questionId: "mission-panier-simple" },
  ];
  assert.deepEqual(
    inferCompletedMarketMissionIds(studentId, MARKET_MISSIONS, awardRecords),
    ["mission-fruits", "mission-collation"],
  );
  assert.deepEqual(normalizeCompletedMarketMissionIds(MARKET_MISSIONS, ["unknown", "mission-fruits", "mission-fruits"]), ["mission-fruits"]);
});

test("une ancienne réussite 3 sur 3 est migrée vers le palier Découverte", () => {
  const studentId = "user-eleve-lina";
  const attempts = [
    { userId: studentId, quizId: "souk-des-mots", correctCount: 3, questionCount: 3, fragmentId: null },
    { userId: studentId, quizId: "souk-des-mots", correctCount: 4, questionCount: 4, fragmentId: "consolidation" },
    { userId: "user-eleve-nour", quizId: "souk-des-mots", correctCount: 4, questionCount: 4, fragmentId: "challenge" },
  ];
  assert.deepEqual(
    inferCompletedMarketMissionIdsFromAttempts(studentId, MARKET_TIERS, attempts),
    [...MARKET_TIERS[0].missionIds, ...MARKET_TIERS[1].missionIds],
  );
});

test("le bilan d’un palier complète les maîtrises antérieures sans repayer leur XP", () => {
  const tier = MARKET_TIERS[0];
  const previousIds = tier.missionIds.slice(0, 3);
  const finalMissionId = tier.missionIds[3];
  const summary = buildMarketTierSummary(
    tier,
    MARKET_MISSIONS,
    [{ missionId: finalMissionId, correct: true, helpUsed: false, xpEarned: 15, rewardStatus: "awarded" }],
    [...previousIds, finalMissionId],
    "attempt-discovery",
  );
  assert.equal(summary.tierId, "discovery");
  assert.equal(summary.completed, true);
  assert.equal(summary.completedMissionCount, 4);
  assert.equal(summary.xpEarned, 15);
  assert.equal(summary.maxXp, 60);
  assert.equal(summary.withoutHelpCount, 1);
  assert.equal(summary.results.filter((result) => result.rewardStatus === "revision").length, 3);
});

test("les quantités invalides sont neutralisées et les identifiants de récompense restent stables", () => {
  assert.deepEqual(normalizeMarketBasket({ apple: 2, orange: -1, carrot: 1.5, tomato: "3", cucumber: 0 }), { apple: 2 });
  assert.equal(
    createMarketAwardEventId("souk-des-mots:abc", "mission-fruits"),
    "souk-des-mots:abc:mission-fruits:reward",
  );
  assert.throws(() => createMarketAwardEventId("", "mission-fruits"), /requis/);
});

test("le résumé visuel du panier ne contient que les articles réellement ajoutés", () => {
  const productIds = missionById.get("mission-fruits").productIds;
  assert.deepEqual(listSelectedMarketProductIds(productIds, {}), []);
  assert.deepEqual(listSelectedMarketProductIds(productIds, { apple: 1 }), ["apple"]);
  assert.deepEqual(listSelectedMarketProductIds(productIds, { apple: 0, orange: 2 }), ["orange"]);
  assert.deepEqual(listSelectedMarketProductIds(productIds, { tomato: -1, unknown: 3 }), []);
});

test("le validateur refuse une mission ambiguë ou incohérente", () => {
  const valid = missionById.get("mission-fruits");
  assert.throws(() => validateMarketMission({ ...valid, productIds: ["apple"] }), /au moins trois produits/);
  assert.throws(() => validateMarketMission({ ...valid, expectedBasket: { banana: 1 } }), /n’est pas proposé/);
  assert.throws(() => validateMarketMission({ ...valid, formulas: valid.formulas.map((formula) => ({ ...formula, correct: true })) }), /Une seule formule/);
  assert.throws(() => validateMarketMission({ ...valid, tierId: "" }), /palier/);
  assert.throws(() => validateMarketMission({ ...valid, difficulty: { ...valid.difficulty, maxSelectableQuantity: 1 } }), /dépasse/);
});
