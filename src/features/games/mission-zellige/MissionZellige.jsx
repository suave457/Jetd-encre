import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
  DiamondsFour,
  Eye,
  EyeSlash,
  Lightbulb,
  MapPin,
  PlayCircle,
  SpeakerHigh,
  Stop,
  Sparkle,
  Trophy,
  X,
} from "@phosphor-icons/react/ssr";
import {
  MISSION_ZELLIGE_COMPLETION_XP,
  MISSION_ZELLIGE_MISSIONS,
  getCompletedMissionZellige,
  getDailyMissionZellige,
} from "./missionZelligeData.js";
import {
  buildMissionZelligeSummary,
  evaluateMissionHotspot,
  evaluateMissionSentence,
  moveSentencePiece,
} from "./missionZelligeEngine.js";
import { createMissionZelligeTelemetry } from "./missionZelligeTelemetry.js";
import "./mission-zellige.css";

const NOOP = () => {};

function readSavedProgress(storageKey, mission) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    if (parsed?.missionId !== mission.id) return null;
    const knownPieceIds = new Set(mission.pieces.map((piece) => piece.id));
    const orderedPieces = Array.isArray(parsed.orderedPieces)
      ? parsed.orderedPieces.filter((pieceId) => knownPieceIds.has(pieceId))
      : [];
    return { ...parsed, orderedPieces };
  } catch {
    return null;
  }
}

function readTranscriptPreference() {
  try {
    return window.localStorage.getItem("jde.mission-zellige:transcript-visible") === "true";
  } catch {
    return false;
  }
}

function formatMissionDate(dateKey) {
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function sentenceFromPieces(mission, orderedIds) {
  return orderedIds
    .map((id) => mission.pieces.find((piece) => piece.id === id)?.text || "")
    .join(" ")
    .replace(/\s+([?.!,])/g, "$1");
}

function ActionFeedback({ feedback }) {
  const Icon = feedback?.kind === "success" ? CheckCircle : Lightbulb;
  return (
    <div
      className={`mz-action-feedback${feedback ? ` is-${feedback.kind}` : " is-empty"}`}
      id="mz-action-feedback"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {feedback && <><Icon weight="fill" aria-hidden="true" /><span>{feedback.text}</span></>}
    </div>
  );
}

export default function MissionZellige({
  currentXp = 0,
  attempts = [],
  userId = null,
  studentName = "Lina",
  onAwardXp = NOOP,
  onComplete = NOOP,
  onExit,
  fragmentCount = 0,
  now = new Date(),
}) {
  const openedAtRef = useRef(now);
  const telemetry = useMemo(() => createMissionZelligeTelemetry(), []);
  const missionStartedAtRef = useRef(Date.now());
  const daily = useMemo(() => getDailyMissionZellige(openedAtRef.current), []);
  const completedToday = useMemo(
    () => getCompletedMissionZellige(attempts, userId, daily.dateKey),
    [attempts, daily.dateKey, userId],
  );
  const storageKey = `jde.mission-zellige:v2:${userId || "eleve"}:${daily.dateKey}`;
  const savedAtOpen = useMemo(
    () => readSavedProgress(storageKey, daily.mission),
    [daily.mission.id, storageKey],
  );

  const [missionIndex, setMissionIndex] = useState(daily.missionIndex);
  const [phase, setPhase] = useState(completedToday ? "complete" : savedAtOpen?.phase || "location");
  const [selectedHotspot, setSelectedHotspot] = useState(savedAtOpen?.selectedHotspot || "");
  const [locationSolved, setLocationSolved] = useState(Boolean(savedAtOpen?.locationSolved));
  const [locationHadError, setLocationHadError] = useState(Boolean(savedAtOpen?.locationHadError));
  const [orderedPieces, setOrderedPieces] = useState(savedAtOpen?.orderedPieces || []);
  const [sentenceSolved, setSentenceSolved] = useState(Boolean(savedAtOpen?.sentenceSolved));
  const [sentenceHadError, setSentenceHadError] = useState(Boolean(savedAtOpen?.sentenceHadError));
  const [locationAttempts, setLocationAttempts] = useState(0);
  const [sentenceAttempts, setSentenceAttempts] = useState(0);
  const [isReplay, setIsReplay] = useState(false);
  const [builderAnnouncement, setBuilderAnnouncement] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [showTranscript, setShowTranscript] = useState(readTranscriptPreference);
  const [result, setResult] = useState(completedToday);
  const finishButtonRef = useRef(null);
  const missionTitleRef = useRef(null);
  const sentenceHeadingRef = useRef(null);
  const completionHeadingRef = useRef(null);
  const pendingFocusRef = useRef(null);
  const completionLockedRef = useRef(false);
  const completionStateRef = useRef(Boolean(completedToday));

  const mission = MISSION_ZELLIGE_MISSIONS[missionIndex];
  const isDailyMission = missionIndex === daily.missionIndex;
  const isRewardEligible = isDailyMission && !completedToday;
  const missionMode = isReplay ? "replay" : isDailyMission ? "daily" : "preview";
  const availablePieces = mission.pieces.filter((piece) => !orderedPieces.includes(piece.id));
  const sentence = sentenceFromPieces(mission, orderedPieces);

  const trackMissionEvent = (event, metadata = {}, overrides = {}) => telemetry.track(event, {
    missionId: overrides.missionId || mission.id,
    dailyKey: daily.dateKey,
    mode: overrides.mode || missionMode,
    phase: overrides.phase || phase,
    elapsedMs: Math.max(0, Date.now() - missionStartedAtRef.current),
    metadata,
  });

  useEffect(() => {
    trackMissionEvent("view", { transcriptVisible: showTranscript });
    if (phase !== "complete") trackMissionEvent("start", { rewardEligible: isRewardEligible });
    return () => {
      if (!completionStateRef.current) trackMissionEvent("abandon", { completed: false });
    };
    // Une seule trace d’entrée; les changements de situation sont gérés par resetForMission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "sentence" && sentenceSolved) finishButtonRef.current?.focus({ preventScroll: true });
  }, [phase, sentenceSolved]);

  useEffect(() => {
    const target = pendingFocusRef.current;
    if (target === "mission") missionTitleRef.current?.focus({ preventScroll: true });
    if (target === "sentence") sentenceHeadingRef.current?.focus({ preventScroll: true });
    if (target === "complete") completionHeadingRef.current?.focus({ preventScroll: true });
    pendingFocusRef.current = null;
  }, [missionIndex, phase]);

  useEffect(() => {
    try {
      window.localStorage.setItem("jde.mission-zellige:transcript-visible", String(showTranscript));
    } catch {
      // La préférence reste active pour la session si le stockage est indisponible.
    }
  }, [showTranscript]);

  useEffect(() => {
    if (!isDailyMission || phase === "complete") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        missionId: mission.id,
        phase,
        selectedHotspot,
        locationSolved,
        locationHadError,
        orderedPieces,
        sentenceSolved,
        sentenceHadError,
      }));
    } catch {
      // La partie reste jouable si le stockage local est indisponible.
    }
  }, [
    isDailyMission,
    locationHadError,
    locationSolved,
    mission.id,
    orderedPieces,
    phase,
    selectedHotspot,
    sentenceHadError,
    sentenceSolved,
    storageKey,
  ]);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const exitMission = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (!completionStateRef.current) trackMissionEvent("abandon", { completed: false });
    completionStateRef.current = true;
    if (typeof onExit === "function") onExit();
    else window.location.hash = "#/eleve/jeux";
  };

  const resetForMission = (index, { replay = false } = {}) => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (!completionStateRef.current) trackMissionEvent("abandon", { completed: false });
    const nextIsCompletedDaily = index === daily.missionIndex && completedToday && !replay;
    const nextMission = MISSION_ZELLIGE_MISSIONS[index];
    const nextMode = replay ? "replay" : index === daily.missionIndex ? "daily" : "preview";
    missionStartedAtRef.current = Date.now();
    completionStateRef.current = Boolean(nextIsCompletedDaily);
    telemetry.track("view", {
      missionId: nextMission.id,
      dailyKey: daily.dateKey,
      mode: nextMode,
      phase: nextIsCompletedDaily ? "complete" : "location",
      elapsedMs: 0,
      metadata: { transcriptVisible: showTranscript },
    });
    if (!nextIsCompletedDaily) telemetry.track("start", {
      missionId: nextMission.id,
      dailyKey: daily.dateKey,
      mode: nextMode,
      phase: "location",
      elapsedMs: 0,
      metadata: { rewardEligible: index === daily.missionIndex && !completedToday },
    });
    pendingFocusRef.current = "mission";
    setMissionIndex(index);
    setPhase(nextIsCompletedDaily ? "complete" : "location");
    setSelectedHotspot("");
    setLocationSolved(false);
    setLocationHadError(false);
    setOrderedPieces([]);
    setSentenceSolved(false);
    setSentenceHadError(false);
    setLocationAttempts(0);
    setSentenceAttempts(0);
    setIsReplay(replay);
    setBuilderAnnouncement("");
    setFeedback(null);
    setSpeaking(false);
    setResult(nextIsCompletedDaily ? completedToday : null);
    completionLockedRef.current = false;
  };

  const toggleTranscript = () => {
    const next = !showTranscript;
    setShowTranscript(next);
    if (next) trackMissionEvent("transcript_show", { transcriptVisible: true });
  };

  const toggleClue = () => {
    if (!("speechSynthesis" in window)) {
      setShowTranscript(true);
      setFeedback({ kind: "info", text: "La lecture audio n’est pas disponible sur cet appareil. Le texte de l’indice est maintenant affiché." });
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      trackMissionEvent("audio_stop", { audioSource: "speech-synthesis" });
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(mission.clue);
    utterance.lang = "fr-MA";
    utterance.rate = 0.9;
    utterance.onend = () => {
      setSpeaking(false);
      trackMissionEvent("audio_stop", { audioSource: "speech-synthesis" });
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setShowTranscript(true);
      setFeedback({ kind: "info", text: "L’audio s’est interrompu. Tu peux lire le texte de l’indice à la place." });
    };
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
    trackMissionEvent("audio_play", { audioAvailable: true, audioSource: "speech-synthesis" });
  };

  const validateLocation = () => {
    if (!selectedHotspot) {
      setFeedback({ kind: "info", text: "Choisis d’abord un repère dans l’image ou dans la liste." });
      return;
    }
    const nextAttempt = locationAttempts + 1;
    setLocationAttempts(nextAttempt);
    const evaluation = evaluateMissionHotspot(mission, selectedHotspot);
    if (!evaluation.correct) {
      setLocationHadError(true);
      setFeedback({ kind: "error", text: `Ce n’est pas encore le bon repère. ${mission.extraHint}` });
      trackMissionEvent("location_error", {
        attempts: nextAttempt,
        firstTry: nextAttempt === 1,
        hotspotId: selectedHotspot,
        reasonCode: "wrong_location",
      });
      return;
    }
    setLocationSolved(true);
    pendingFocusRef.current = "sentence";
    setPhase("sentence");
    setFeedback({ kind: "success", text: `Bien vu ! ${evaluation.hotspot.description}. Construis maintenant ta phrase.` });
    trackMissionEvent("location_success", {
      attempts: nextAttempt,
      firstTry: nextAttempt === 1,
      hotspotId: selectedHotspot,
    }, { phase: "location" });
  };

  const addPiece = (pieceId) => {
    if (sentenceSolved || orderedPieces.includes(pieceId)) return;
    const piece = mission.pieces.find((item) => item.id === pieceId);
    const next = [...orderedPieces, pieceId];
    setOrderedPieces(next);
    setBuilderAnnouncement(`« ${piece?.text || "Groupe de mots"} » ajouté, position ${next.length} sur ${mission.pieces.length}.`);
    setFeedback(null);
  };

  const removePiece = (pieceId) => {
    if (sentenceSolved) return;
    const piece = mission.pieces.find((item) => item.id === pieceId);
    setOrderedPieces((current) => current.filter((id) => id !== pieceId));
    setBuilderAnnouncement(`« ${piece?.text || "Groupe de mots"} » retiré de la phrase.`);
    setFeedback(null);
  };

  const movePiece = (index, direction) => {
    if (sentenceSolved) return;
    const pieceId = orderedPieces[index];
    const next = moveSentencePiece(orderedPieces, index, direction);
    const piece = mission.pieces.find((item) => item.id === pieceId);
    setOrderedPieces(next);
    setBuilderAnnouncement(`« ${piece?.text || "Groupe de mots"} » déplacé en position ${next.indexOf(pieceId) + 1} sur ${next.length}.`);
    setFeedback(null);
  };

  const resetSentence = () => {
    if (sentenceSolved || orderedPieces.length === 0) return;
    setOrderedPieces([]);
    setBuilderAnnouncement("La phrase a été effacée. Recommence avec le premier groupe de mots.");
    setFeedback({ kind: "info", text: "La phrase est vide. Tu peux recommencer tranquillement." });
  };

  const validateSentence = () => {
    const evaluation = evaluateMissionSentence(mission, orderedPieces);
    if (!evaluation.valid) {
      setFeedback({ kind: "info", text: "Ajoute les trois groupes de mots avant de valider." });
      return;
    }
    const nextAttempt = sentenceAttempts + 1;
    setSentenceAttempts(nextAttempt);
    if (!evaluation.correct) {
      setSentenceHadError(true);
      setFeedback({ kind: "error", text: `Presque ! ${mission.sentenceHint}` });
      trackMissionEvent("sentence_error", {
        attempts: nextAttempt,
        firstTry: nextAttempt === 1,
        pieceCount: orderedPieces.length,
        reasonCode: "wrong_order",
      });
      return;
    }
    setSentenceSolved(true);
    setFeedback({ kind: "success", text: mission.success });
    trackMissionEvent("sentence_success", {
      attempts: nextAttempt,
      firstTry: nextAttempt === 1,
      pieceCount: orderedPieces.length,
    });
  };

  const finishMission = () => {
    if (completionLockedRef.current) return;
    completionLockedRef.current = true;
    const summary = buildMissionZelligeSummary({
      daily,
      mission,
      locationFirstTry: !locationHadError,
      sentenceFirstTry: !sentenceHadError,
      awardXp: isRewardEligible,
    });
    if (isRewardEligible) {
      const awardResult = onAwardXp(MISSION_ZELLIGE_COMPLETION_XP, {
        eventId: daily.awardId,
        attemptId: daily.attemptId,
        source: "mission-zellige",
      });
      const attemptResult = onComplete(summary);
      if (attemptResult?.ok === false) {
        completionLockedRef.current = false;
        setFeedback({ kind: "error", text: "La mission est terminée, mais son enregistrement n’a pas abouti. Réessaie pour synchroniser ton résultat." });
        return;
      }
      const awardedNow = awardResult?.awarded !== false && !awardResult?.duplicate;
      const alreadyRecorded = Boolean(awardResult?.duplicate || attemptResult?.duplicate);
      const savedResult = { ...summary, xpEarned: awardedNow ? MISSION_ZELLIGE_COMPLETION_XP : 0, completionXp: awardedNow ? MISSION_ZELLIGE_COMPLETION_XP : 0, alreadyRecorded };
      if (attemptResult?.recorded || attemptResult?.duplicate || attemptResult === undefined) {
        try { window.localStorage.removeItem(storageKey); } catch { /* sans incidence */ }
      }
      completionStateRef.current = true;
      pendingFocusRef.current = "complete";
      setResult(savedResult);
      setPhase("complete");
      setFeedback({
        kind: "success",
        text: alreadyRecorded
          ? "Cette mission était déjà enregistrée aujourd’hui : aucun XP supplémentaire n’a été ajouté."
          : "Ta mission du jour est enregistrée et tes 20 XP ont rejoint ton profil.",
      });
      trackMissionEvent("complete", {
        completed: true,
        rewardEligible: isRewardEligible,
        locationAttempts,
        sentenceAttempts,
        scorePercent: summary.scorePercent,
        xpEarned: savedResult.xpEarned,
      }, { phase: "complete" });
      return;
    }
    const previewResult = { ...summary, preview: !isRewardEligible };
    completionStateRef.current = true;
    pendingFocusRef.current = "complete";
    setResult(previewResult);
    setPhase("complete");
    setFeedback({
      kind: "success",
      text: "Cette situation bêta est terminée. Elle ne donne pas d’XP supplémentaire.",
    });
    trackMissionEvent("complete", {
      completed: true,
      rewardEligible: false,
      locationAttempts,
      sentenceAttempts,
      scorePercent: summary.scorePercent,
      xpEarned: 0,
    }, { phase: "complete" });
  };

  const selectedOption = mission.hotspots.find((hotspot) => hotspot.id === selectedHotspot);
  const phaseLabel = phase === "location" ? "1 · Observer" : phase === "sentence" ? "2 · Construire" : "Mission accomplie";

  const chooseHotspot = (hotspotId) => {
    if (phase !== "location" || locationSolved) return;
    setSelectedHotspot(hotspotId);
    setFeedback(null);
  };

  const handleRadioKeyDown = (event, hotspotId, index) => {
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      chooseHotspot(hotspotId);
      return;
    }
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key)
      ? 1
      : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
    const boundary = event.key === "Home" ? 0 : event.key === "End" ? mission.hotspots.length - 1 : null;
    if (!direction && boundary === null) return;
    event.preventDefault();
    const nextIndex = boundary ?? (index + direction + mission.hotspots.length) % mission.hotspots.length;
    const next = mission.hotspots[nextIndex];
    chooseHotspot(next.id);
    const radios = event.currentTarget.parentElement?.querySelectorAll("[role='radio']");
    radios?.[nextIndex]?.focus();
  };

  return (
    <div className="mission-zellige">
      <a className="mz-skip-link" href="#mz-main">Aller à la mission</a>
      <header className="mz-topbar">
        <button className="mz-back" type="button" onClick={exitMission}>
          <ArrowLeft weight="bold" aria-hidden="true" />
          <span>Mes jeux</span>
        </button>
        <img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions" />
        <div className="mz-top-progress">
          <span><strong>Situation {missionIndex + 1}</strong> sur 4</span>
          <div aria-label={`Situation ${missionIndex + 1} sur 4`}>
            {MISSION_ZELLIGE_MISSIONS.map((item, index) => (
              <button
                className={`${index === missionIndex ? "is-active" : ""}${index === daily.missionIndex ? " is-daily" : ""}`}
                type="button"
                key={item.id}
                onClick={() => resetForMission(index)}
                aria-label={`${item.shortTitle}${index === daily.missionIndex ? ", mission du jour" : ", aperçu bêta"}`}
                aria-current={index === missionIndex ? "step" : undefined}
              >{index + 1}</button>
            ))}
          </div>
        </div>
        <span className="mz-xp-balance">
          <Sparkle weight="fill" aria-hidden="true" />
          <span><small>MON PROFIL</small><strong>{Number(currentXp).toLocaleString("fr-FR")} XP</strong></span>
        </span>
      </header>

      <main className="mz-stage" id="mz-main" tabIndex="-1">
        <section className="mz-scene" aria-labelledby="mz-mission-title">
          <img
            key={mission.imageSrc}
            src={mission.imageSrc}
            srcSet={mission.imageSrcSet}
            sizes="(max-width: 1100px) 65vw, 70vw"
            alt={mission.imageAlt}
            style={{ "--mz-focus": mission.focus }}
            width="1536"
            height="1024"
            loading="eager"
            decoding="async"
          />
          <div className="mz-scene-shade" aria-hidden="true" />
          <span className={`mz-mode-badge${isDailyMission ? " is-daily" : ""}`}>
            {isDailyMission ? <><Sparkle weight="fill" /> Mission du jour</> : <>Aperçu bêta · sans XP</>}
          </span>
          <div className="mz-hotspots" aria-hidden="true">
            {mission.hotspots.map((hotspot, index) => {
              const isSelected = selectedHotspot === hotspot.id;
              const stateClass = locationSolved && hotspot.correct
                ? " is-correct"
                : feedback?.kind === "error" && isSelected ? " is-wrong" : "";
              return (
                <span
                  className={`mz-hotspot${isSelected ? " is-selected" : ""}${stateClass}`}
                  style={{ "--mz-x": `${hotspot.x}%`, "--mz-tablet-x": `${hotspot.tabletX}%`, "--mz-y": `${hotspot.y}%` }}
                  onClick={() => chooseHotspot(hotspot.id)}
                  key={hotspot.id}
                >
                  {locationSolved && hotspot.correct ? <Check weight="bold" /> : index + 1}
                  <span>{hotspot.label}</span>
                </span>
              );
            })}
          </div>
          <div className="mz-scene-caption">
            <span>{mission.eyebrow}</span>
            <strong>{mission.title}</strong>
          </div>
        </section>

        <aside className="mz-mission-panel" aria-labelledby="mz-mission-title">
          <div className="mz-panel-heading">
            <span>MISSION ZELLIGE</span>
            <strong>{phaseLabel}</strong>
          </div>
          <div className="mz-guide">
            <span className="mz-guide-avatar"><MapPin weight="duotone" aria-hidden="true" /></span>
            <div><small>TON GUIDE</small><strong>{mission.guide}</strong><span>{mission.guideRole}</span></div>
            <button type="button" onClick={toggleClue} aria-label={speaking ? "Arrêter la lecture de l’indice" : "Écouter l’indice"}>
              {speaking ? <Stop weight="fill" /> : <SpeakerHigh weight="fill" />}
              <span>{speaking ? "Arrêter" : "Écouter"}</span>
            </button>
          </div>

          <h1 id="mz-mission-title" ref={missionTitleRef} tabIndex="-1">{mission.title}</h1>
          <p className="mz-objective">{mission.objective}</p>

          <section className="mz-clue" aria-labelledby="mz-clue-title">
            <span><Lightbulb weight="duotone" aria-hidden="true" /></span>
            <div>
              <div className="mz-clue-heading">
                <strong id="mz-clue-title">Indice audio</strong>
                <button
                  className="mz-transcript-toggle"
                  type="button"
                  onClick={toggleTranscript}
                  aria-expanded={showTranscript}
                  aria-controls="mz-clue-transcript"
                >
                  {showTranscript ? <EyeSlash weight="bold" /> : <Eye weight="bold" />}
                  <span>{showTranscript ? "Masquer le texte" : "Afficher le texte"}</span>
                </button>
              </div>
              {showTranscript ? (
                <p id="mz-clue-transcript">« {mission.clue} »</p>
              ) : (
                <p className="mz-clue-collapsed" id="mz-clue-transcript">Écoute l’indice, ou affiche son texte si tu en as besoin.</p>
              )}
            </div>
          </section>

          {phase === "location" && (
            <div className="mz-option-list" role="radiogroup" aria-label="Choisir un repère">
              {mission.hotspots.map((hotspot, index) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedHotspot === hotspot.id}
                  tabIndex={selectedHotspot === hotspot.id || (!selectedHotspot && index === 0) ? 0 : -1}
                  className={`${selectedHotspot === hotspot.id ? "is-selected" : ""}${feedback?.kind === "error" && selectedHotspot === hotspot.id ? " is-error" : ""}`}
                  onClick={() => chooseHotspot(hotspot.id)}
                  onKeyDown={(event) => handleRadioKeyDown(event, hotspot.id, index)}
                  disabled={locationSolved}
                  key={hotspot.id}
                >
                  <span>{index + 1}</span><span><strong>{hotspot.label}</strong><small>{hotspot.description}</small></span>
                </button>
              ))}
            </div>
          )}

          {phase === "sentence" && (
            <section className="mz-skill-card">
              <CheckCircle weight="duotone" aria-hidden="true" />
              <div><small>REPÈRE TROUVÉ</small><strong>{selectedOption?.label}</strong><span>À toi de construire une phrase complète.</span></div>
            </section>
          )}

          {phase === "complete" && (
            <section className="mz-result-card">
              <Trophy weight="duotone" aria-hidden="true" />
              <span>{result?.preview ? "SITUATION TESTÉE" : "MISSION DU JOUR RÉUSSIE"}</span>
              <h2 ref={completionHeadingRef} tabIndex="-1">{result?.preview ? "Bien joué !" : `Bravo ${studentName} !`}</h2>
              <p>{result?.preview ? "Tu peux maintenant essayer une autre situation de la bêta." : "Ton profil conserve cette réussite. Une nouvelle situation sera proposée demain."}</p>
              <div className="mz-result-meta">
                <span><CheckCircle weight="fill" aria-hidden="true" /> {result?.masteryLabel || "Mission accompagnée"}</span>
                <span><DiamondsFour weight="fill" aria-hidden="true" /> {mission.fragmentLabel}</span>
              </div>
              <strong>{result?.xpEarned ? `+${result.xpEarned} XP` : result?.alreadyRecorded ? "Déjà récompensée" : "Entraînement libre"}</strong>
            </section>
          )}

          <section className="mz-competency">
            <CheckCircle weight="duotone" aria-hidden="true" />
            <div><small>AUJOURD’HUI, TU APPRENDS À</small><strong>{mission.skill}</strong></div>
          </section>
          <p className="mz-date"><Clock weight="bold" aria-hidden="true" /> 3–5 min · {formatMissionDate(daily.dateKey)}</p>
        </aside>

        <section className={`mz-sentence-dock mz-phase-${phase}`} aria-label="Zone d’action">
          {phase === "location" && (
            <>
              <div className="mz-dock-step"><span>1</span><div><small>ÉTAPE 1</small><strong>Observe et choisis</strong></div></div>
              <div className="mz-location-choice">
                <span>TON CHOIX</span>
                <strong>{selectedOption?.label || "Sélectionne un repère dans la scène"}</strong>
                <small>Tu peux changer de choix avant de valider.</small>
                <ActionFeedback feedback={feedback} />
              </div>
              <button className="mz-primary" type="button" onClick={validateLocation} disabled={!selectedHotspot} aria-describedby="mz-action-feedback">Valider ce repère <MapPin weight="fill" /></button>
            </>
          )}

          {phase === "sentence" && (
            <>
              <div className="mz-dock-step"><span>2</span><div><small>ÉTAPE 2</small><strong ref={sentenceHeadingRef} tabIndex="-1">Construis ta phrase</strong></div></div>
              <div className="mz-builder">
                <span className="mz-sr-only" aria-live="polite">{builderAnnouncement}</span>
                <span className="mz-builder-prompt">{mission.sentencePrompt}</span>
                <div className="mz-ordered" aria-label={`Phrase actuelle : ${sentence || "vide"}`}>
                  {orderedPieces.length === 0 && <span className="mz-empty-sentence">Choisis un premier groupe de mots…</span>}
                  {orderedPieces.map((pieceId, index) => {
                    const piece = mission.pieces.find((item) => item.id === pieceId);
                    return (
                      <span className="mz-ordered-piece" key={pieceId}>
                        <button type="button" onClick={() => removePiece(pieceId)} disabled={sentenceSolved} aria-label={`Retirer « ${piece.text} »`}>
                          {piece.text}<X weight="bold" />
                        </button>
                        {!sentenceSolved && orderedPieces.length > 1 && (
                          <span>
                            <button type="button" disabled={index === 0} onClick={() => movePiece(index, "left")} aria-label={`Déplacer « ${piece.text} » vers la gauche`}><ArrowLeft /></button>
                            <button type="button" disabled={index === orderedPieces.length - 1} onClick={() => movePiece(index, "right")} aria-label={`Déplacer « ${piece.text} » vers la droite`}><ArrowRight /></button>
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
                <div className="mz-piece-bank" aria-label="Groupes de mots disponibles">
                  {availablePieces.map((piece) => <button type="button" onClick={() => addPiece(piece.id)} key={piece.id}>{piece.text}</button>)}
                </div>
                <div className="mz-sentence-tools">
                  <button type="button" onClick={resetSentence} disabled={sentenceSolved || orderedPieces.length === 0}>Effacer ma phrase</button>
                </div>
                <ActionFeedback feedback={feedback} />
              </div>
              {sentenceSolved ? (
                <button className="mz-primary" type="button" onClick={finishMission} ref={finishButtonRef} aria-describedby="mz-action-feedback">Terminer la mission <Trophy weight="fill" /></button>
              ) : (
                <button className="mz-primary" type="button" onClick={validateSentence} disabled={orderedPieces.length !== mission.pieces.length} aria-describedby="mz-action-feedback">Valider ma phrase <CheckCircle weight="fill" /></button>
              )}
            </>
          )}

          {phase === "complete" && (
            <>
              <div className="mz-dock-step is-complete"><Trophy weight="fill" /><div><small>PARCOURS TERMINÉ</small><strong>{mission.shortTitle}</strong></div></div>
              <div className="mz-complete-copy">
                <strong>{mission.answer}</strong>
                <span>{result?.preview ? "Aperçu bêta terminé · aucun XP supplémentaire" : result?.alreadyRecorded ? "Récompense déjà enregistrée aujourd’hui" : "Récompense enregistrée une seule fois aujourd’hui"}</span>
                <span className="mz-transfer-prompt"><Lightbulb weight="fill" aria-hidden="true" /> Pour aller plus loin : {mission.transferPrompt}</span>
                <span className="mz-fragment-progress"><DiamondsFour weight="fill" aria-hidden="true" /> Fragment « {mission.fragmentLabel} » · {fragmentCount}/{MISSION_ZELLIGE_MISSIONS.length} dans ta fresque</span>
                <ActionFeedback feedback={feedback} />
              </div>
              <div className="mz-result-actions">
                <button type="button" className="mz-secondary" onClick={() => resetForMission(missionIndex, { replay: true })}>Rejouer</button>
                <button type="button" className="mz-primary" onClick={() => resetForMission((missionIndex + 1) % MISSION_ZELLIGE_MISSIONS.length)}>Situation suivante <ArrowRight weight="bold" /></button>
              </div>
            </>
          )}
        </section>

      </main>
    </div>
  );
}
