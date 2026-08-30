import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  Basket,
  CheckCircle,
  Coins,
  LockKey,
  Minus,
  Plus,
  Question,
  SpeakerHigh,
  SpeakerSlash,
  Sparkle,
  Storefront,
  Trophy,
  XCircle,
} from "@phosphor-icons/react/ssr";
import {
  MARKET_MISSIONS,
  MARKET_TIERS,
  formatMarketLexicalLabel,
  getMarketProduct,
} from "./marketShopData.js";
import {
  buildMarketRewardClaims,
  buildMarketTierProgress,
  buildMarketTierSummary,
  createMarketAttemptId,
  evaluateMarketMission,
  getMarketMissionFeedback,
  inferCompletedMarketMissionIds,
  inferCompletedMarketMissionIdsFromAttempts,
  listSelectedMarketProductIds,
} from "./marketShopEngine.js";
import "./market-shop.css";

const NOOP = () => {};
const EMPTY_AWARD_HISTORY = Object.freeze([]);
const EMPTY_ATTEMPT_HISTORY = Object.freeze([]);
const DEFAULT_ASSETS = Object.freeze({
  mascot: "/assets/games/market-shop/plumi.webp",
  vendor: "/assets/games/market-shop/market-vendor-scene.webp",
  stall: "/assets/games/market-shop/market-stall-backdrop.webp",
});

function MarketHeader({ progressLabel, progressValue, progressCount, sessionXp, profileXp, backLabel = "Mes jeux", onBack }) {
  const safeProgressCount = Math.max(1, Number(progressCount) || 1);
  const safeProgressValue = Math.min(safeProgressCount, Math.max(0, Number(progressValue) || 0));
  return (
    <header className="ms-header">
      <button className="ms-back" type="button" onClick={onBack}>
        <ArrowLeft weight="bold" aria-hidden="true" />
        <span>{backLabel}</span>
      </button>

      <div className="ms-brand" aria-label="Jet d’Encre, espace élève">
        <img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions" />
        <small>ESPACE ÉLÈVE</small>
      </div>

      <div className="ms-header-status">
        <div className="ms-progress-copy">
          <strong>{progressLabel}</strong>
          <span aria-hidden="true">
            {Array.from({ length: safeProgressCount }, (_, index) => (
              <i className={index < safeProgressValue ? "is-active" : ""} key={index} />
            ))}
          </span>
        </div>
        <span className="ms-session-xp">
          <Sparkle weight="fill" aria-hidden="true" />
          <span><small>GAGNÉS</small><strong>+{sessionXp} XP</strong></span>
        </span>
        <span className="ms-profile-xp" aria-label={`${profileXp} points d’expérience sur le profil`}>
          {profileXp.toLocaleString("fr-FR")} XP
        </span>
      </div>
    </header>
  );
}

const TIER_ICONS = Object.freeze({ Sparkle, Basket, Trophy });
const TIER_GUIDE_ITEMS = Object.freeze({
  discovery: Object.freeze(["J’observe", "J’écoute", "Je compose"]),
  consolidation: Object.freeze(["Quantités", "Accords", "Phrase complète"]),
  challenge: Object.freeze(["Commande complète", "Peu d’indices", "Je vérifie"]),
});

function MarketTierStatus({ status, reviewing }) {
  if (reviewing) {
    return <span className="ms-tier-status"><ArrowCounterClockwise weight="bold" aria-hidden="true" /> Révision en cours</span>;
  }
  if (status === "completed") {
    return <span className="ms-tier-status"><CheckCircle weight="fill" aria-hidden="true" /> Terminé</span>;
  }
  if (status === "in-progress") {
    return <span className="ms-tier-status"><Storefront weight="fill" aria-hidden="true" /> En cours</span>;
  }
  if (status === "locked") {
    return <span className="ms-tier-status"><LockKey weight="fill" aria-hidden="true" /> À débloquer</span>;
  }
  return <span className="ms-tier-status"><Sparkle weight="fill" aria-hidden="true" /> Disponible</span>;
}

function MarketTierCard({ tier, prerequisiteLabel, mascotSrc, celebrating, reviewing, onOpen }) {
  const TierIcon = TIER_ICONS[tier.icon] || Sparkle;
  const isLocked = tier.status === "locked";
  const isCompleted = tier.status === "completed";
  const displayedCompletedCount = isLocked ? 0 : tier.completedCount;
  const displayedProgressPercent = isLocked ? 0 : tier.progressPercent;
  const guideItems = isLocked
    ? ["Termine le palier précédent pour l’ouvrir"]
    : TIER_GUIDE_ITEMS[tier.id] || ["J’observe", "Je compose", "Je vérifie"];
  const actionLabel = isLocked
    ? `Termine « ${prerequisiteLabel || "le palier précédent"} »`
    : reviewing
      ? "Continuer la révision"
    : isCompleted
      ? "Réviser ce palier"
      : tier.status === "in-progress"
        ? "Reprendre"
        : tier.actionLabel;
  const milestoneCount = Math.max(4, tier.missionCount || 0);
  const style = {
    "--ms-tier-accent": tier.theme?.accent || "#0a6d70",
    "--ms-tier-surface": tier.theme?.surface || "#dff3ef",
    "--ms-tier-text": tier.theme?.text || "#034d50",
    "--ms-tier-detail": tier.theme?.detail || tier.theme?.accent || "#e7a91d",
  };

  return (
    <article className={`ms-tier-card is-${tier.status}${celebrating ? " is-celebrating" : ""}${reviewing ? " is-reviewing" : ""}`} style={style}>
      <div className="ms-tier-card-top">
        <span className="ms-tier-medallion"><TierIcon weight="fill" aria-hidden="true" /></span>
        <div>
          <span className="ms-tier-eyebrow">Palier {tier.order}</span>
          <h2>{tier.cardTitle}</h2>
        </div>
        <MarketTierStatus status={tier.status} reviewing={reviewing} />
      </div>

      <p className="ms-tier-description">{tier.description}</p>

      <div
        className="ms-tier-milestones"
        role="img"
        aria-label={`${displayedCompletedCount} mission${displayedCompletedCount > 1 ? "s" : ""} réussie${displayedCompletedCount > 1 ? "s" : ""} sur ${milestoneCount}`}
      >
        {Array.from({ length: milestoneCount }, (_, index) => {
          const complete = index < displayedCompletedCount;
          const current = tier.unlocked && !isCompleted && index === displayedCompletedCount;
          return (
            <span className={`${complete ? "is-complete" : ""}${current ? " is-current" : ""}`} key={index}>
              <i>{complete ? <CheckCircle weight="fill" aria-hidden="true" /> : index + 1}</i>
              <small>Mission {index + 1}</small>
            </span>
          );
        })}
      </div>

      <div className="ms-tier-progress-copy">
        <span>{isLocked
          ? "Termine le palier précédent pour continuer"
          : isCompleted
            ? "Toutes les missions sont réussies"
            : `${displayedCompletedCount} sur ${milestoneCount} réussie${displayedCompletedCount > 1 ? "s" : ""}`}</span>
        <strong>{displayedProgressPercent}%</strong>
      </div>
      <div
        className="ms-tier-progress"
        role="progressbar"
        aria-label={`Progression du palier ${tier.label}`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={displayedProgressPercent}
      >
        <i style={{ width: `${displayedProgressPercent}%` }} />
      </div>

      <div className="ms-tier-plumi">
        <img src={mascotSrc} alt="" aria-hidden="true" />
        <div>
          <p>{celebrating
            ? `Palier réussi ! Tu gagnes le badge « ${tier.badge?.label || tier.label} ».`
            : reviewing
              ? "Ta révision est en cours. Reprends là où tu t’es arrêté."
              : tier.plumiCopy}</p>
          <ul aria-label={`Repères du palier ${tier.label}`}>
            {guideItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>

      {celebrating && (
        <span className="ms-tier-celebration" role="status" aria-live="polite">
          <Trophy weight="fill" aria-hidden="true" /> Nouveau badge : {tier.badge?.label || tier.label}
        </span>
      )}

      <button className="ms-primary ms-tier-action" type="button" onClick={() => onOpen(tier)} disabled={isLocked}>
        {isLocked ? <LockKey weight="fill" aria-hidden="true" /> : <TierIcon weight="fill" aria-hidden="true" />}
        <span>{actionLabel}</span>
        {!isLocked && <ArrowRight weight="bold" aria-hidden="true" />}
      </button>
    </article>
  );
}

function MarketTierJourney({ tiers, mascotSrc, celebratingTierId, reviewingTierId, onOpen }) {
  const completedTierCount = tiers.filter((tier) => tier.status === "completed").length;
  const tierById = new Map(tiers.map((tier) => [tier.id, tier]));
  return (
    <main className="ms-tier-stage" id="ms-main">
      <section className="ms-tier-intro" aria-labelledby="ms-tier-title">
        <span><Storefront weight="fill" aria-hidden="true" /></span>
        <div>
          <small>LE SOUK DES MOTS</small>
          <h1 id="ms-tier-title">Choisis ton parcours</h1>
          <p>Avance à ton rythme : quatre petites missions t’attendent dans chaque palier.</p>
        </div>
        <strong>{completedTierCount}/{tiers.length} paliers terminés</strong>
      </section>

      <section className="ms-tier-grid" aria-label="Les trois paliers du Souk des mots">
        {tiers.map((tier) => (
          <MarketTierCard
            key={tier.id}
            tier={tier}
            prerequisiteLabel={tierById.get(tier.unlock?.tierId)?.label}
            mascotSrc={mascotSrc}
            celebrating={celebratingTierId === tier.id}
            reviewing={reviewingTierId === tier.id}
            onOpen={onOpen}
          />
        ))}
      </section>
    </main>
  );
}

function MissionPanel({ mission, selectedFormulaId, helpUsed, speaking, locked, onFormulaChange, onListen, onHelp, vendorSrc, mascotSrc }) {
  return (
    <aside className="ms-mission-panel" aria-labelledby="ms-mission-title">
      <div className="ms-panel-heading">
        <Storefront weight="fill" aria-hidden="true" />
        <span>Le Souk des mots</span>
      </div>

      <figure className="ms-vendor-card">
        <img src={vendorSrc} alt="Un vendeur souriant devant son étal au souk" />
        <figcaption>Bonjour ! Que veux-tu acheter ?</figcaption>
      </figure>

      <button className="ms-listen" type="button" onClick={onListen} aria-pressed={speaking}>
        {speaking ? <SpeakerSlash weight="fill" aria-hidden="true" /> : <SpeakerHigh weight="fill" aria-hidden="true" />}
        {speaking ? "Arrêter l’écoute" : "Écouter la mission"}
      </button>

      <div className="ms-panel-guide">
        <img src={mascotSrc} alt="Plumi, le petit oiseau-plume turquoise et doré" />
        <p>Observe les nombres et complète ton panier. Tu peux prendre ton temps.</p>
      </div>

      <div className="ms-instruction" id="ms-instruction">
        <small>{mission.title}</small>
        <h1 id="ms-mission-title">Ta commande</h1>
        <p>{mission.instruction}</p>
      </div>

      <fieldset className="ms-formulas">
        <legend>{mission.formulaPrompt || "Que dis-tu au vendeur ?"}</legend>
        {mission.formulas.map((formula) => (
          <label className={selectedFormulaId === formula.id ? "is-selected" : ""} key={formula.id}>
            <input
              type="radio"
              name={`formula-${mission.id}`}
              value={formula.id}
              checked={selectedFormulaId === formula.id}
              disabled={locked}
              onChange={() => onFormulaChange(formula.id)}
            />
            <span>{formula.text}</span>
            <i aria-hidden="true" />
          </label>
        ))}
      </fieldset>

      <button className={`ms-help${helpUsed ? " is-used" : ""}`} type="button" onClick={onHelp} aria-expanded={helpUsed} disabled={locked}>
        <Question weight="fill" aria-hidden="true" />
        {helpUsed ? "Aide affichée" : "J’ai besoin d’un indice"}
      </button>
      {helpUsed && <p className="ms-help-text" role="note">{mission.help}</p>}
    </aside>
  );
}

function ProductCard({ product, quantity, expectedQuantity, maxSelectableQuantity, locked, onChange }) {
  const maxQuantity = Number.isInteger(maxSelectableQuantity)
    ? maxSelectableQuantity
    : Math.max(5, expectedQuantity + 2);
  const matched = locked && quantity === expectedQuantity && expectedQuantity > 0;
  const lexicalLabel = formatMarketLexicalLabel(product.id, quantity);
  const [lexicalMarker, ...lexicalWords] = lexicalLabel.split(" ");
  const quantityLabel = /^[aeiouyàâäéèêëîïôöùûü]/i.test(product.pluralLabel)
    ? `Quantité d’${product.pluralLabel}`
    : `Quantité de ${product.pluralLabel}`;
  return (
    <article className={`ms-product-card${matched ? " is-matched" : ""}`}>
      <div className="ms-product-visual">
        <img src={product.image} alt="" width="260" height="220" loading="eager" decoding="async" />
        {matched && (
          <span className="ms-product-check" aria-label="Quantité correcte">
            <CheckCircle weight="fill" aria-hidden="true" />
          </span>
        )}
      </div>
      <h2 className={quantity > 0 ? "is-selected" : ""} aria-label={lexicalLabel}>
        <b aria-hidden="true">{lexicalMarker}</b>
        <span aria-hidden="true">{lexicalWords.join(" ")}</span>
      </h2>
      <div className="ms-stepper" role="group" aria-label={quantityLabel}>
        <button
          type="button"
          onClick={() => onChange(product.id, -1)}
          disabled={locked || quantity === 0}
          aria-label={`Retirer un article du panier : ${product.label}`}
        >
          <Minus weight="bold" aria-hidden="true" />
        </button>
        <output aria-live="polite" aria-label={`${quantity} ${quantity === 1 ? product.label : product.pluralLabel} dans le panier`}>
          {quantity}
        </output>
        <button
          type="button"
          onClick={() => onChange(product.id, 1)}
          disabled={locked || quantity >= maxQuantity}
          aria-label={`Ajouter un article au panier : ${product.label}`}
        >
          <Plus weight="bold" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function BasketDock({ mission, basket, feedback, solved, missionXp, nextLabel, onValidate, onNext }) {
  const selectedProductIds = listSelectedMarketProductIds(mission.productIds, basket);
  const chosenCount = Object.values(basket).reduce((sum, quantity) => sum + quantity, 0);
  return (
    <section className="ms-basket-dock" aria-label="Ton panier et validation">
      <div className="ms-basket-title">
        <Basket weight="fill" aria-hidden="true" />
        <span><strong>Mon panier</strong><small>{chosenCount} article{chosenCount === 1 ? "" : "s"}</small></span>
      </div>

      <div className="ms-basket-items" aria-label="Articles ajoutés au panier">
        {selectedProductIds.map((productId) => {
          const product = getMarketProduct(productId);
          const quantity = basket[productId] || 0;
          return (
            <span key={productId} aria-label={`${quantity} ${quantity === 1 ? product.label : product.pluralLabel}`}>
              <img src={product.image} alt="" />
              <b>{quantity}</b>
            </span>
          );
        })}
      </div>

      <div className={`ms-dock-feedback${feedback ? ` is-${feedback.kind}` : ""}`} role="status" aria-live="polite" aria-atomic="true">
        {feedback ? (
          <>
            {feedback.kind === "success" && <CheckCircle weight="fill" aria-hidden="true" />}
            {feedback.kind === "error" && <XCircle weight="fill" aria-hidden="true" />}
            {feedback.kind === "info" && <Question weight="fill" aria-hidden="true" />}
            <span className="ms-feedback-copy">
              {feedback.tag && <b>{feedback.tag}</b>}
              <span>{feedback.text}</span>
            </span>
          </>
        ) : (
          <>
            <Sparkle weight="fill" aria-hidden="true" />
            <span className="ms-feedback-copy">
              <span>{chosenCount > 0 ? "Ton panier se remplit. Vérifie la commande avant de valider." : "Ajoute les articles demandés pour remplir ton panier."}</span>
            </span>
          </>
        )}
      </div>

      {solved ? (
        <button className="ms-primary ms-next" type="button" onClick={onNext}>
          <strong className={missionXp === 0 ? "is-revision" : ""}>{missionXp > 0 ? `+${missionXp} XP` : "Révision"}</strong>
          {nextLabel}
          <ArrowRight weight="bold" aria-hidden="true" />
        </button>
      ) : (
        <button className="ms-primary" type="button" onClick={onValidate}>
          Valider mon panier
          <ArrowRight weight="bold" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

function Results({ summary, profileXp, mascotSrc, onReplay, onExit }) {
  const revisionOnly = summary.results.length > 0
    && summary.results.every((result) => result.rewardStatus === "revision");
  const revisionExperience = summary.runMode === "revision" || revisionOnly;
  const tierLabel = summary.tierLabel || "Défi";
  return (
    <main className="ms-results" id="ms-main">
      <section className="ms-results-card" aria-labelledby="ms-results-title">
        <div className="ms-results-art">
          <span><Trophy weight="fill" aria-hidden="true" /></span>
          <img src={mascotSrc} alt="Plumi, le petit oiseau-plume turquoise et doré, célèbre la réussite" />
        </div>
        <span className="ms-results-kicker"><Storefront weight="fill" aria-hidden="true" /> {tierLabel} · {revisionExperience ? "Révision terminée" : "Marché conclu"}</span>
        <h1 id="ms-results-title">{revisionExperience ? "Révision réussie !" : "Bravo, marchand de mots !"}</h1>
        <p>{revisionExperience
          ? summary.xpEarned > 0
            ? `Tu as revu les ${summary.missionCount} commandes avec succès et renforcé ton autonomie.`
            : `Tu as revu les ${summary.missionCount} commandes avec succès. Leurs récompenses étaient déjà enregistrées sur ton profil.`
          : `Tu as réussi les ${summary.missionCount} commandes du palier ${tierLabel} et utilisé des phrases adaptées à chaque situation.`}</p>

        <div className="ms-results-stats">
          <article><CheckCircle weight="fill" aria-hidden="true" /><strong>{summary.completedMissionCount}/{summary.missionCount}</strong><span>missions réussies</span></article>
          <article><Sparkle weight="fill" aria-hidden="true" /><strong>+{summary.xpEarned} XP</strong><span>{revisionExperience ? summary.xpEarned > 0 ? "bonus d’autonomie" : "supplémentaires" : `sur ${summary.maxXp} possibles`}</span></article>
          <article><Question weight="fill" aria-hidden="true" /><strong>{summary.withoutHelpCount}</strong><span>sans utiliser l’aide</span></article>
        </div>

        <div className="ms-profile-total">
          <Coins weight="fill" aria-hidden="true" />
          <span>Ton profil affiche maintenant</span>
          <strong>{profileXp.toLocaleString("fr-FR")} XP</strong>
        </div>

        <div className="ms-result-actions">
          <button className="ms-secondary" type="button" onClick={onReplay}>
            {summary.runMode === "revision"
              ? <ArrowLeft weight="bold" aria-hidden="true" />
              : <ArrowCounterClockwise weight="bold" aria-hidden="true" />}
            {summary.runMode === "revision" ? "Retour aux paliers" : "Rejouer"}
          </button>
          <button className="ms-primary" type="button" onClick={onExit}>
            Retour à mes jeux
            <ArrowRight weight="bold" aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  );
}

export default function MarketShopGame({
  currentXp = 0,
  studentId = "eleve",
  onAwardXp = NOOP,
  onComplete = NOOP,
  onExit,
  missions = MARKET_MISSIONS,
  tiers = MARKET_TIERS,
  awardHistory = EMPTY_AWARD_HISTORY,
  attemptHistory = EMPTY_ATTEMPT_HISTORY,
  assets = DEFAULT_ASSETS,
}) {
  const [screen, setScreen] = useState("journey");
  const [activeTierId, setActiveTierId] = useState(null);
  const [reviewTierId, setReviewTierId] = useState(null);
  const [missionIndex, setMissionIndex] = useState(0);
  const [basket, setBasket] = useState({});
  const [selectedFormulaId, setSelectedFormulaId] = useState("");
  const [helpUsed, setHelpUsed] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [solved, setSolved] = useState(false);
  const [missionXp, setMissionXp] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [profileXp, setProfileXp] = useState(Number(currentXp) || 0);
  const [summary, setSummary] = useState(null);
  const [celebratingTierId, setCelebratingTierId] = useState(null);
  const [completedMissionIds, setCompletedMissionIds] = useState(() => ([
    ...new Set([
      ...inferCompletedMarketMissionIds(studentId, missions, awardHistory),
      ...inferCompletedMarketMissionIdsFromAttempts(studentId, tiers, attemptHistory),
    ]),
  ]));
  const [speaking, setSpeaking] = useState(false);
  const [audioNotice, setAudioNotice] = useState("");
  const attemptIdRef = useRef(createMarketAttemptId());
  const missionResultsRef = useRef([]);
  const missionLockRef = useRef(false);
  const completionLockRef = useRef(false);
  const pendingTierSummaryRef = useRef(null);

  const tierProgress = useMemo(
    () => buildMarketTierProgress(tiers, missions, completedMissionIds),
    [tiers, missions, completedMissionIds],
  );
  const activeTier = tierProgress.find((tier) => tier.id === activeTierId) || null;
  const tierMissions = useMemo(() => (
    activeTier
      ? activeTier.missionIds.map((missionId) => missions.find((item) => item.id === missionId)).filter(Boolean)
      : []
  ), [activeTier, missions]);
  const mission = missions[missionIndex] || tierMissions[0] || missions[0];
  const activeTierMissionIndex = activeTier?.missionIds.indexOf(mission?.id) ?? -1;
  const isReviewMode = Boolean(activeTier && reviewTierId === activeTier.id);
  const isLastTierMission = Boolean(activeTier && activeTierMissionIndex === activeTier.missionCount - 1);
  const isFinalTier = Boolean(activeTier && activeTier.id === tierProgress[tierProgress.length - 1]?.id);
  const completedTierCount = tierProgress.filter((tier) => tier.status === "completed").length;
  const products = useMemo(
    () => mission
      ? mission.productIds
        .slice(0, mission.difficulty?.visibleProductCount || mission.productIds.length)
        .map(getMarketProduct)
        .filter(Boolean)
      : [],
    [mission],
  );

  useEffect(() => {
    const inferredMissionIds = [
      ...new Set([
        ...inferCompletedMarketMissionIds(studentId, missions, awardHistory),
        ...inferCompletedMarketMissionIdsFromAttempts(studentId, tiers, attemptHistory),
      ]),
    ];
    setCompletedMissionIds((current) => {
      const merged = [...new Set([...current, ...inferredMissionIds])];
      return merged.length === current.length && merged.every((missionId, index) => missionId === current[index])
        ? current
        : merged;
    });
  }, [attemptHistory, awardHistory, missions, studentId, tiers]);

  useEffect(() => {
    setProfileXp(Number(currentXp) || 0);
  }, [currentXp]);

  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const cancelSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setAudioNotice("");
  };

  const resetMissionUi = () => {
    cancelSpeech();
    setBasket({});
    setSelectedFormulaId("");
    setHelpUsed(false);
    setFailureCount(0);
    setFeedback(null);
    setSolved(false);
    setMissionXp(0);
    missionLockRef.current = false;
  };

  const exitGame = () => {
    cancelSpeech();
    if (typeof onExit === "function") {
      onExit();
      return;
    }
    if (typeof window !== "undefined") {
      window.location.hash = "#/eleve/jeux";
      window.dispatchEvent(new Event("jde:navigate"));
    }
  };

  const showJourney = () => {
    cancelSpeech();
    setSummary(null);
    setScreen("journey");
  };

  const openTier = (tier) => {
    if (!tier?.unlocked || !tier.nextMissionId) return;
    const continuesReview = reviewTierId === tier.id && activeTierId === tier.id;
    if (continuesReview && solved && activeTierMissionIndex === tier.missionCount - 1 && pendingTierSummaryRef.current) {
      setSummary(pendingTierSummaryRef.current);
      setScreen("results");
      return;
    }
    const targetMissionId = continuesReview
      ? solved
        ? tier.missionIds[activeTierMissionIndex + 1] || mission?.id
        : mission?.id
      : tier.nextMissionId;
    const nextMissionIndex = missions.findIndex((item) => item.id === targetMissionId);
    if (nextMissionIndex < 0) return;

    const canResumeDraft = activeTierId === tier.id
      && mission?.id === targetMissionId
      && !solved;
    const startsNewTierRun = activeTierId !== tier.id || (tier.status === "completed" && !continuesReview);
    if (startsNewTierRun) {
      attemptIdRef.current = createMarketAttemptId();
      missionResultsRef.current = [];
      completionLockRef.current = false;
      pendingTierSummaryRef.current = null;
      setSessionXp(0);
      setReviewTierId(tier.status === "completed" ? tier.id : null);
    }
    if (!canResumeDraft || startsNewTierRun) resetMissionUi();

    setActiveTierId(tier.id);
    setMissionIndex(nextMissionIndex);
    setSummary(null);
    setCelebratingTierId(null);
    setScreen("game");
  };

  const changeQuantity = (productId, delta) => {
    if (solved) return;
    setBasket((current) => {
      const quantityLimit = Number.isInteger(mission.difficulty?.maxSelectableQuantity)
        ? mission.difficulty.maxSelectableQuantity
        : Number.POSITIVE_INFINITY;
      const nextQuantity = Math.min(quantityLimit, Math.max(0, (current[productId] || 0) + delta));
      const next = { ...current };
      if (nextQuantity === 0) delete next[productId];
      else next[productId] = nextQuantity;
      return next;
    });
    setFeedback(null);
  };

  const listenToMission = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setAudioNotice("La lecture audio n’est pas disponible sur cet appareil. La consigne complète reste affichée à l’écran.");
      setFeedback({ kind: "info", text: "Tu peux lire la consigne complète dans le panneau de gauche." });
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setAudioNotice("Lecture arrêtée.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(mission.audioInstruction);
    utterance.lang = "fr-MA";
    utterance.rate = 0.88;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setAudioNotice("La lecture s’est interrompue. La consigne complète reste affichée à l’écran.");
    };
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
    setAudioNotice("Lecture de la consigne en cours.");
  };

  const revealHelp = () => {
    if (!helpUsed) setHelpUsed(true);
    setFeedback({ kind: "info", tag: "Indice", text: mission.help });
  };

  const validateMission = async () => {
    if (missionLockRef.current || solved) return;
    const evaluation = evaluateMarketMission(mission, basket, selectedFormulaId);
    if (!evaluation.correct) {
      const nextFailureCount = failureCount + 1;
      const feedbackDegree = helpUsed ? Math.max(3, nextFailureCount) : nextFailureCount;
      setFailureCount(nextFailureCount);
      setFeedback({
        kind: "error",
        tag: feedbackDegree >= 3 ? "Correction guidée" : `Essai ${nextFailureCount}`,
        text: getMarketMissionFeedback(mission, evaluation, feedbackDegree),
      });
      return;
    }

    missionLockRef.current = true;
    const effectiveHelpUsed = helpUsed || failureCount >= 3;
    const claims = buildMarketRewardClaims({
      studentId,
      mission,
      correct: true,
      helpUsed: effectiveHelpUsed,
    });

    const claimResults = [];
    for (const claim of claims) {
      try {
        const response = await Promise.resolve(onAwardXp(claim.amount, {
          ...claim,
          attemptId: attemptIdRef.current,
          questionId: mission.id,
        }));
        const awarded = response === undefined || (response?.awarded !== false && response?.ok !== false);
        claimResults.push({ claim, response, awarded, failed: response?.ok === false });
      } catch {
        claimResults.push({ claim, response: null, awarded: false, failed: true });
      }
    }

    const awardedClaims = claimResults.filter((item) => item.awarded).map((item) => item.claim);
    const awardedXp = awardedClaims.reduce((total, claim) => total + claim.amount, 0);
    const reportedTotalXp = [...claimResults]
      .reverse()
      .map((item) => Number(item.response?.totalXp))
      .find(Number.isFinite);
    const allClaimsDuplicate = claims.length > 0
      && awardedXp === 0
      && claimResults.every((item) => item.response?.duplicate || (item.response?.awarded === false && item.response?.ok !== false));
    const rewardStatus = allClaimsDuplicate
      ? "revision"
      : claimResults.some((item) => item.failed) ? "pending" : "awarded";

    if (awardedXp > 0) setSessionXp((value) => value + awardedXp);
    if (reportedTotalXp !== undefined) setProfileXp(reportedTotalXp);
    else if (awardedXp > 0) setProfileXp((value) => value + awardedXp);

    let rewardMessage = `+${awardedXp} XP.`;
    if (awardedXp === 15) rewardMessage = "+15 XP : maîtrise +10 et autonomie +5.";
    else if (awardedXp === 10) rewardMessage = "+10 XP de maîtrise. Tu as réussi avec un coup de pouce ; tu pourras viser les +5 XP d’autonomie lors d’un prochain essai.";
    else if (awardedXp === 5) rewardMessage = "+5 XP d’autonomie : tu as progressé sans aide.";
    else if (allClaimsDuplicate) rewardMessage = "+0 XP : révision réussie, ces récompenses étaient déjà acquises.";
    else if (awardedXp === 0) rewardMessage = "+0 XP pour l’instant : la réussite est validée, mais la récompense n’a pas pu être enregistrée.";

    const result = Object.freeze({
      missionId: mission.id,
      correct: true,
      helpUsed: effectiveHelpUsed,
      helpRequested: helpUsed,
      xpEarned: awardedXp,
      eventId: claims[0]?.eventId || null,
      eventIds: Object.freeze(claims.map((claim) => claim.eventId)),
      awardedClaimTypes: Object.freeze(awardedClaims.map((claim) => claim.type)),
      rewardStatus,
      validationAttempts: failureCount + 1,
      basket: Object.freeze({ ...basket }),
      formulaId: selectedFormulaId,
    });
    const nextResults = [...missionResultsRef.current.filter((item) => item.missionId !== mission.id), result];
    missionResultsRef.current = nextResults;
    const nextCompletedMissionIds = [...new Set([...completedMissionIds, mission.id])];
    setCompletedMissionIds(nextCompletedMissionIds);

    if (isLastTierMission && activeTier && !completionLockRef.current) {
      completionLockRef.current = true;
      const baseTierSummary = buildMarketTierSummary(
        activeTier,
        missions,
        nextResults,
        nextCompletedMissionIds,
        attemptIdRef.current,
      );
      const tierSummary = isReviewMode
        ? Object.freeze({ ...baseTierSummary, runMode: "revision" })
        : baseTierSummary;
      pendingTierSummaryRef.current = tierSummary;
      if (!isReviewMode) setCelebratingTierId(activeTier.id);
      try {
        const completion = onComplete(tierSummary);
        if (completion && typeof completion.catch === "function") completion.catch(NOOP);
      } catch {
        // La réussite reste visible même si la persistance externe est momentanément indisponible.
      }
    }

    setMissionXp(awardedXp);
    setSolved(true);
    setFeedback({
      kind: "success",
      tag: awardedXp > 0 ? `+${awardedXp} XP` : "+0 XP",
      text: `${mission.success} ${rewardMessage}`,
    });
  };

  const advance = () => {
    if (!solved) return;
    cancelSpeech();
    if (isReviewMode && !isLastTierMission) {
      const nextMissionId = activeTier.missionIds[activeTierMissionIndex + 1];
      const nextMissionIndex = missions.findIndex((item) => item.id === nextMissionId);
      if (nextMissionIndex < 0) return;
      setMissionIndex(nextMissionIndex);
      resetMissionUi();
      return;
    }
    if (isLastTierMission && (isReviewMode || isFinalTier)) {
      const finalSummary = pendingTierSummaryRef.current || (() => {
        const baseTierSummary = buildMarketTierSummary(
          activeTier,
          missions,
          missionResultsRef.current,
          [...new Set([...completedMissionIds, mission.id])],
          attemptIdRef.current,
        );
        return isReviewMode
          ? Object.freeze({ ...baseTierSummary, runMode: "revision" })
          : baseTierSummary;
      })();
      setSummary(finalSummary);
      setScreen("results");
      return;
    }
    setScreen("journey");
  };

  const replay = () => {
    attemptIdRef.current = createMarketAttemptId();
    missionResultsRef.current = [];
    completionLockRef.current = false;
    pendingTierSummaryRef.current = null;
    setActiveTierId(null);
    setReviewTierId(null);
    resetMissionUi();
    setSessionXp(0);
    setSummary(null);
    setCelebratingTierId(null);
    setScreen("journey");
  };

  if (screen === "results" && summary) {
    return (
      <div className="market-shop-game">
        <a className="ms-skip-link" href="#ms-main">Aller au bilan</a>
        <MarketHeader
          progressLabel={`${summary.tierLabel || "Défi"} · ${summary.missionCount} missions réussies`}
          progressValue={summary.missionCount}
          progressCount={summary.missionCount}
          sessionXp={summary.xpEarned}
          profileXp={profileXp}
          backLabel="Paliers"
          onBack={replay}
        />
        <Results summary={summary} profileXp={profileXp} mascotSrc={assets.mascot} onReplay={replay} onExit={exitGame} />
      </div>
    );
  }

  if (screen === "journey") {
    return (
      <div className="market-shop-game">
        <a className="ms-skip-link" href="#ms-main">Aller aux paliers</a>
        <MarketHeader
          progressLabel={`${completedTierCount} palier${completedTierCount > 1 ? "s" : ""} sur ${tierProgress.length}`}
          progressValue={completedTierCount}
          progressCount={tierProgress.length}
          sessionXp={sessionXp}
          profileXp={profileXp}
          onBack={exitGame}
        />
        <MarketTierJourney
          tiers={tierProgress}
          mascotSrc={assets.mascot}
          celebratingTierId={celebratingTierId}
          reviewingTierId={reviewTierId}
          onOpen={openTier}
        />
      </div>
    );
  }

  if (!mission || !activeTier) return null;

  return (
    <div className="market-shop-game">
      <a className="ms-skip-link" href="#ms-main">Aller à la mission</a>
      <MarketHeader
        progressLabel={`${activeTier.label} · Mission ${activeTierMissionIndex + 1} sur ${activeTier.missionCount}`}
        progressValue={activeTierMissionIndex + 1}
        progressCount={activeTier.missionCount}
        sessionXp={sessionXp}
        profileXp={profileXp}
        backLabel="Paliers"
        onBack={showJourney}
      />

      <main className="ms-stage" id="ms-main">
        <MissionPanel
          mission={mission}
          selectedFormulaId={selectedFormulaId}
          helpUsed={helpUsed}
          speaking={speaking}
          locked={solved}
          onFormulaChange={(formulaId) => {
            if (solved) return;
            setSelectedFormulaId(formulaId);
            setFeedback(null);
          }}
          onListen={listenToMission}
          onHelp={revealHelp}
          vendorSrc={assets.vendor}
          mascotSrc={assets.mascot}
        />

        <section
          className="ms-market"
          aria-labelledby="ms-market-title"
          style={{ backgroundImage: `url("${assets.stall || DEFAULT_ASSETS.stall}")` }}
        >
          <div className="ms-market-heading">
            <div>
              <span>{activeTier.label} · Mission {activeTierMissionIndex + 1} sur {activeTier.missionCount}</span>
              <h2 id="ms-market-title">Choisis tes produits</h2>
            </div>
            <p>{mission.context}</p>
          </div>

          <div className={`ms-product-grid${products.length === 4 ? " is-four" : ""}`}>
            {products.map((product) => (
              <ProductCard
                product={product}
                quantity={basket[product.id] || 0}
                expectedQuantity={mission.expectedBasket[product.id] || 0}
                maxSelectableQuantity={mission.difficulty?.maxSelectableQuantity}
                locked={solved}
                onChange={changeQuantity}
                key={product.id}
              />
            ))}
          </div>

        </section>

        <BasketDock
          mission={mission}
          basket={basket}
          feedback={feedback}
          solved={solved}
          missionXp={missionXp}
          nextLabel={isReviewMode
            ? isLastTierMission ? "Voir mon bilan de révision" : "Mission suivante"
            : isLastTierMission && isFinalTier ? "Voir mon bilan" : "Retour aux paliers"}
          onValidate={validateMission}
          onNext={advance}
        />
        <p className="ms-sr-only" role="status" aria-live="polite">{audioNotice}</p>
      </main>
    </div>
  );
}
