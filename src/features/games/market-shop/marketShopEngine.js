import { MARKET_TIERS, formatMarketQuantity, getMarketProduct } from "./marketShopData.js";

export const MARKET_MISSION_XP = 10;
export const MARKET_NO_HELP_BONUS_XP = 5;
export const MARKET_MAX_XP = MARKET_TIERS.reduce(
  (total, tier) => total + tier.missionIds.length * (MARKET_MISSION_XP + MARKET_NO_HELP_BONUS_XP),
  0,
);
export const MARKET_MASTERY_REWARD = "mastery";
export const MARKET_AUTONOMY_REWARD = "autonomy";

const freezeList = (items) => Object.freeze([...items]);

const safeQuantity = (value) => {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
};

export function normalizeMarketBasket(basket = {}) {
  return Object.freeze(Object.fromEntries(
    Object.entries(basket)
      .map(([productId, quantity]) => [productId, safeQuantity(quantity)])
      .filter(([, quantity]) => quantity > 0),
  ));
}

export function listSelectedMarketProductIds(productIds = [], basket = {}) {
  const selectedBasket = normalizeMarketBasket(basket);
  return Object.freeze(
    productIds.filter((productId) => selectedBasket[productId] > 0 && getMarketProduct(productId)),
  );
}

export function normalizeCompletedMarketMissionIds(missions = [], missionIds = []) {
  const completed = new Set(Array.isArray(missionIds) ? missionIds : []);
  return freezeList(missions.map((mission) => mission.id).filter((missionId) => completed.has(missionId)));
}

/**
 * Reconstruit la progression à partir du registre XP persistant. Les anciens
 * enregistrements sont reconnus par leur eventId stable, tandis que les futurs
 * peuvent exposer directement questionId.
 */
export function inferCompletedMarketMissionIds(studentId, missions = [], awardRecords = []) {
  const normalizedStudentId = String(studentId || "").trim();
  if (!normalizedStudentId) return freezeList([]);
  const records = Array.isArray(awardRecords) ? awardRecords : [];
  const completed = missions.filter((mission) => {
    const masteryEventId = createMarketRewardClaimId(normalizedStudentId, mission, MARKET_MASTERY_REWARD);
    return records.some((record) => {
      if (!record || (record.userId && String(record.userId) !== normalizedStudentId)) return false;
      if (record.source && record.source !== "souk-des-mots") return false;
      return record.questionId === mission.id || record.id === masteryEventId || record.eventId === masteryEventId;
    });
  }).map((mission) => mission.id);
  return freezeList(completed);
}

/**
 * Migration et secours à partir des tentatives enregistrées. Une ancienne
 * réussite 3/3 équivaut au palier Découverte ; les nouvelles tentatives de
 * palier utilisent fragmentId et rendent leurs quatre missions maîtrisées.
 */
export function inferCompletedMarketMissionIdsFromAttempts(studentId, tiers = MARKET_TIERS, attemptRecords = []) {
  const normalizedStudentId = String(studentId || "").trim();
  if (!normalizedStudentId) return freezeList([]);
  const attempts = (Array.isArray(attemptRecords) ? attemptRecords : []).filter((attempt) => (
    attempt
    && (!attempt.userId || String(attempt.userId) === normalizedStudentId)
    && (!attempt.quizId || attempt.quizId === "souk-des-mots")
  ));
  const completed = new Set();
  const legacyCompleted = attempts.some((attempt) => (
    !attempt.fragmentId
    && Number(attempt.questionCount) === 3
    && Number(attempt.correctCount) >= 3
  ));
  if (legacyCompleted && tiers[0]) tiers[0].missionIds.forEach((missionId) => completed.add(missionId));

  for (const tier of tiers) {
    const tierCompleted = attempts.some((attempt) => (
      attempt.fragmentId === tier.id
      && Number(attempt.questionCount) >= tier.missionIds.length
      && Number(attempt.correctCount) >= tier.missionIds.length
    ));
    if (tierCompleted) tier.missionIds.forEach((missionId) => completed.add(missionId));
  }
  return freezeList(tiers.flatMap((tier) => tier.missionIds).filter((missionId) => completed.has(missionId)));
}

export function buildMarketTierProgress(tiers = MARKET_TIERS, missions = [], completedMissionIds = []) {
  const validMissionIds = new Set(missions.map((mission) => mission.id));
  const completed = new Set(normalizeCompletedMarketMissionIds(missions, completedMissionIds));
  let previousTierCompleted = true;

  return Object.freeze(tiers.map((tier) => {
    const missionIds = tier.missionIds.filter((missionId) => validMissionIds.has(missionId));
    const completedCount = missionIds.filter((missionId) => completed.has(missionId)).length;
    const tierCompleted = missionIds.length > 0 && completedCount === missionIds.length;
    const unlocked = tier.unlock?.kind === "always" || previousTierCompleted;
    const status = tierCompleted
      ? "completed"
      : unlocked
        ? completedCount > 0 ? "in-progress" : "available"
        : "locked";
    const nextMissionId = unlocked
      ? missionIds.find((missionId) => !completed.has(missionId)) || missionIds[0] || null
      : null;
    const state = Object.freeze({
      ...tier,
      missionIds: freezeList(missionIds),
      completedCount,
      missionCount: missionIds.length,
      progressPercent: missionIds.length ? Math.round((completedCount / missionIds.length) * 100) : 0,
      unlocked,
      status,
      nextMissionId,
    });
    previousTierCompleted = previousTierCompleted && tierCompleted;
    return state;
  }));
}

export function buildMarketTierSummary(tier, missions = [], results = [], completedMissionIds = [], attemptId = "") {
  if (!tier?.id) throw new TypeError("Un palier est nécessaire.");
  const tierMissionIds = new Set(tier.missionIds || []);
  const tierMissions = missions.filter((mission) => tierMissionIds.has(mission.id));
  const completed = new Set(normalizeCompletedMarketMissionIds(tierMissions, completedMissionIds));
  const resultByMissionId = new Map(
    results.filter((result) => tierMissionIds.has(result.missionId)).map((result) => [result.missionId, result]),
  );
  const normalizedResults = tierMissions.map((mission) => resultByMissionId.get(mission.id) || (completed.has(mission.id)
    ? {
        missionId: mission.id,
        correct: true,
        // Une maîtrise persistée ne prouve pas à elle seule l’autonomie.
        // Le bilan reste donc volontairement conservateur après reprise.
        helpUsed: true,
        xpEarned: 0,
        rewardStatus: "revision",
      }
    : null)).filter(Boolean);
  const summary = buildMarketSummary(tierMissions, normalizedResults, attemptId);
  return Object.freeze({
    ...summary,
    experienceType: "market-tier",
    tierId: tier.id,
    tierLabel: tier.label,
    badge: tier.badge ? Object.freeze({ ...tier.badge }) : null,
  });
}

export function compareMarketBasket(mission, basket = {}) {
  const expected = normalizeMarketBasket(mission?.expectedBasket);
  const actual = normalizeMarketBasket(basket);
  const productIds = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  const missing = [];
  const extra = [];

  for (const productId of productIds) {
    const expectedQuantity = expected[productId] || 0;
    const actualQuantity = actual[productId] || 0;
    if (actualQuantity < expectedQuantity) {
      missing.push(Object.freeze({
        productId,
        label: getMarketProduct(productId)?.label || productId,
        quantity: expectedQuantity - actualQuantity,
        expected: expectedQuantity,
        actual: actualQuantity,
      }));
    }
    if (actualQuantity > expectedQuantity) {
      extra.push(Object.freeze({
        productId,
        label: getMarketProduct(productId)?.label || productId,
        quantity: actualQuantity - expectedQuantity,
        expected: expectedQuantity,
        actual: actualQuantity,
      }));
    }
  }

  return Object.freeze({
    correct: missing.length === 0 && extra.length === 0,
    missing: Object.freeze(missing),
    extra: Object.freeze(extra),
    expected,
    actual,
  });
}

function listDifferences(items, mode) {
  if (!items.length) return "";
  const descriptions = items.map((item) => formatMarketQuantity(item.productId, item.quantity));
  const list = new Intl.ListFormat("fr", { style: "long", type: "conjunction" }).format(descriptions);
  return mode === "missing" ? `Il manque ${list}.` : `Retire ${list}.`;
}

function getFormulaFeedback(evaluation = {}) {
  if (evaluation.formulaCorrect) return "";
  if (!evaluation.chosenFormulaId) return "Choisis aussi une phrase à dire au vendeur.";
  if (evaluation.formulaFeedback) return evaluation.formulaFeedback;
  return "La phrase choisie ne réalise pas toute la mission. Cherche la formule la plus complète et la plus polie.";
}

function listAffectedProducts(evaluation = {}) {
  const seen = new Set();
  const labels = [];
  for (const item of [...(evaluation.missing || []), ...(evaluation.extra || [])]) {
    if (!item?.productId || seen.has(item.productId)) continue;
    seen.add(item.productId);
    const product = getMarketProduct(item.productId);
    labels.push(product?.pluralLabel || item.label || item.productId);
  }
  return labels;
}

/**
 * Produit un retour progressif sans dévoiler immédiatement la réponse.
 * Les textes éditoriaux des degrés 1 et 2 proviennent de la mission ; l’aide
 * complète reste une action volontaire et séparée dans l’interface.
 */
export function getMarketMissionFeedback(mission, evaluation, attemptNumber = 1) {
  if (!mission || !evaluation) throw new TypeError("La mission et son évaluation sont nécessaires.");
  if (evaluation.correct) return mission.success || "Mission réussie !";

  const degree = Math.min(3, Math.max(1, Number.isInteger(attemptNumber) ? attemptNumber : 1));
  const feedbackParts = [];

  if (!evaluation.basketCorrect) {
    if (degree === 1) {
      feedbackParts.push(
        mission.feedbackSteps?.reread ||
          "Relis la commande et vérifie les produits ainsi que les nombres avant de réessayer.",
      );
    } else if (degree === 2) {
      feedbackParts.push(
        mission.feedbackSteps?.reviewProducts ||
          "Regarde de nouveau les produits que tu as choisis dans le panier.",
      );
      const affectedProducts = listAffectedProducts(evaluation);
      if (affectedProducts.length) {
        const productList = new Intl.ListFormat("fr", { style: "long", type: "conjunction" }).format(affectedProducts);
        feedbackParts.push(`Produits à vérifier : ${productList}.`);
      }
    } else {
      feedbackParts.push(listDifferences(evaluation.missing || [], "missing"));
      feedbackParts.push(listDifferences(evaluation.extra || [], "extra"));
    }
  }

  feedbackParts.push(getFormulaFeedback(evaluation));
  return feedbackParts.filter(Boolean).join(" ");
}

export function evaluateMarketMission(mission, basket = {}, formulaId = "") {
  if (!mission) throw new TypeError("Une mission est nécessaire.");
  const basketResult = compareMarketBasket(mission, basket);
  const chosenFormula = mission.formulas.find((formula) => formula.id === formulaId) || null;
  const formulaCorrect = Boolean(chosenFormula?.correct);
  const correct = basketResult.correct && formulaCorrect;
  const feedbackParts = [];

  if (!basketResult.correct) {
    feedbackParts.push(listDifferences(basketResult.missing, "missing"));
    feedbackParts.push(listDifferences(basketResult.extra, "extra"));
  }
  if (!chosenFormula) feedbackParts.push("Choisis aussi une phrase à dire au vendeur.");
  else if (!formulaCorrect) feedbackParts.push(
    chosenFormula.feedback || "La phrase choisie ne réalise pas toute la mission. Relis la consigne et cherche la formule la plus complète et la plus polie.",
  );

  return Object.freeze({
    correct,
    basketCorrect: basketResult.correct,
    formulaCorrect,
    chosenFormulaId: chosenFormula?.id || null,
    formulaDiagnosticCode: chosenFormula?.diagnosticCode || null,
    formulaFeedback: chosenFormula?.feedback || "",
    missing: basketResult.missing,
    extra: basketResult.extra,
    feedback: correct ? mission.success : feedbackParts.filter(Boolean).join(" "),
  });
}

export function calculateMarketMissionXp({ correct, helpUsed = false } = {}) {
  if (!correct) return 0;
  return MARKET_MISSION_XP + (helpUsed ? 0 : MARKET_NO_HELP_BONUS_XP);
}

function getMissionRewardIdentity(mission) {
  const missionId = String(mission?.id || "").trim();
  if (!missionId) throw new TypeError("L’identifiant de mission est obligatoire.");
  const rawVersion = mission?.version ?? 1;
  const missionVersion = String(rawVersion).trim() || "1";
  return Object.freeze({ missionId, missionVersion });
}

/**
 * Construit un identifiant persistant par élève, mission-version et type de
 * récompense. Il ne dépend jamais de la tentative ou de l’appareil utilisé.
 */
export function createMarketRewardClaimId(studentId, mission, type) {
  const normalizedStudentId = String(studentId || "").trim();
  if (!normalizedStudentId) throw new TypeError("L’identifiant de l’élève est obligatoire.");
  if (![MARKET_MASTERY_REWARD, MARKET_AUTONOMY_REWARD].includes(type)) {
    throw new TypeError("Le type de récompense doit être mastery ou autonomy.");
  }
  const { missionId, missionVersion } = getMissionRewardIdentity(mission);
  return [
    "souk-des-mots",
    encodeURIComponent(normalizedStudentId),
    encodeURIComponent(missionId),
    `v${encodeURIComponent(missionVersion)}`,
    type,
  ].join(":");
}

/**
 * Retourne les claims indépendants à soumettre au registre XP persistant.
 * Le registre déduplique leurs eventId stables : une maîtrise aidée peut ainsi
 * recevoir son bonus d’autonomie lors d’un rejeu ultérieur sans repayer la base.
 */
export function buildMarketRewardClaims({
  studentId,
  mission,
  correct,
  helpUsed = false,
} = {}) {
  if (!correct) return Object.freeze([]);
  const normalizedStudentId = String(studentId || "").trim();
  if (!normalizedStudentId) throw new TypeError("L’identifiant de l’élève est obligatoire.");
  const { missionId, missionVersion } = getMissionRewardIdentity(mission);
  const createClaim = (type, amount) => Object.freeze({
    eventId: createMarketRewardClaimId(normalizedStudentId, mission, type),
    type,
    amount,
    source: "souk-des-mots",
    studentId: normalizedStudentId,
    missionId,
    questionId: missionId,
    missionVersion,
  });
  const claims = [createClaim(MARKET_MASTERY_REWARD, MARKET_MISSION_XP)];
  if (!helpUsed) claims.push(createClaim(MARKET_AUTONOMY_REWARD, MARKET_NO_HELP_BONUS_XP));
  return Object.freeze(claims);
}

/**
 * Réclame une récompense à partir d’un registre fourni par le composant.
 * La fonction reste pure : un même identifiant de mission ne peut produire qu’un versement.
 */
export function claimMarketMissionAward(awardedMissionIds = [], missionId, options = {}) {
  const ledger = new Set(Array.isArray(awardedMissionIds) ? awardedMissionIds : []);
  if (!options.correct || !missionId || ledger.has(missionId)) {
    return Object.freeze({ awarded: false, xp: 0, awardedMissionIds: Object.freeze([...ledger]) });
  }
  ledger.add(missionId);
  return Object.freeze({
    awarded: true,
    xp: calculateMarketMissionXp(options),
    awardedMissionIds: Object.freeze([...ledger]),
  });
}

export function createMarketAttemptId(randomValue = null) {
  const suffix = randomValue || (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  return `souk-des-mots:${suffix}`;
}

export function createMarketAwardEventId(attemptId, missionId) {
  if (!attemptId || !missionId) throw new TypeError("L’identifiant de tentative et la mission sont requis.");
  return `${attemptId}:${missionId}:reward`;
}

export function buildMarketSummary(missions = [], results = [], attemptId = "") {
  const byMissionId = new Map(results.map((result) => [result.missionId, result]));
  const orderedResults = missions
    .map((mission) => byMissionId.get(mission.id))
    .filter(Boolean)
    .map((result) => Object.freeze({ ...result }));
  const rawXp = orderedResults.reduce((total, result) => total + safeQuantity(result.xpEarned), 0);
  const maxXp = missions.length * (MARKET_MISSION_XP + MARKET_NO_HELP_BONUS_XP);
  const xpEarned = Math.min(maxXp, rawXp);
  const withoutHelpCount = orderedResults.filter((result) => !result.helpUsed && result.correct).length;

  return Object.freeze({
    attemptId,
    gameId: "souk-des-mots",
    completed: orderedResults.length === missions.length,
    completedMissionCount: orderedResults.length,
    missionCount: missions.length,
    withoutHelpCount,
    xpEarned,
    maxXp,
    results: Object.freeze(orderedResults),
  });
}

export function validateMarketMission(mission) {
  if (!mission?.id || !mission?.title || !mission?.instruction) throw new TypeError("Mission incomplète.");
  if (!mission.tierId || !Number.isInteger(mission.order) || mission.order < 1) throw new TypeError("Le palier et l’ordre de la mission sont obligatoires.");
  if (!Array.isArray(mission.productIds) || mission.productIds.length < 3) throw new TypeError("Une mission doit proposer au moins trois produits.");
  const visibleProductCount = mission.difficulty?.visibleProductCount;
  if (!Number.isInteger(visibleProductCount) || visibleProductCount < 3 || visibleProductCount > mission.productIds.length) {
    throw new TypeError("Le nombre de produits visibles est invalide.");
  }
  if (!mission.expectedBasket || Object.keys(mission.expectedBasket).length === 0) throw new TypeError("Le panier attendu est vide.");
  const visibleProductIds = new Set(mission.productIds.slice(0, visibleProductCount));
  for (const [productId, quantity] of Object.entries(mission.expectedBasket)) {
    if (!mission.productIds.includes(productId)) throw new TypeError(`Le produit attendu ${productId} n’est pas proposé.`);
    if (!visibleProductIds.has(productId)) throw new TypeError(`Le produit attendu ${productId} n’est pas visible.`);
    if (safeQuantity(quantity) !== quantity) throw new TypeError(`Quantité invalide pour ${productId}.`);
  }
  if (!Array.isArray(mission.formulas) || mission.formulas.length < 2) throw new TypeError("Deux formules au moins sont requises.");
  if (mission.formulas.filter((formula) => formula.correct).length !== 1) throw new TypeError("Une seule formule doit être correcte.");
  if (new Set(mission.formulas.map((formula) => formula.id)).size !== mission.formulas.length) throw new TypeError("Les formules doivent avoir des identifiants distincts.");
  const maxSelectableQuantity = mission.difficulty?.maxSelectableQuantity;
  if (!Number.isInteger(maxSelectableQuantity) || maxSelectableQuantity < 1) throw new TypeError("La quantité maximale sélectionnable est invalide.");
  if (Object.values(mission.expectedBasket).some((quantity) => quantity > maxSelectableQuantity)) {
    throw new TypeError("Une quantité attendue dépasse la limite sélectionnable.");
  }
  if (mission.difficulty?.targetProductCount !== Object.keys(mission.expectedBasket).length) {
    throw new TypeError("Le nombre de produits cibles est incohérent.");
  }
  if (mission.difficulty?.formulaChoiceCount !== mission.formulas.length) {
    throw new TypeError("Le nombre de formules annoncé est incohérent.");
  }
  return true;
}
