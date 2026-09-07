import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  Crown,
  GameController,
  LockKey,
  Medal,
  PlayCircle,
  ShieldCheck,
  Sparkle,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import CultureQuiz from "../CultureQuiz.jsx";
import {
  buildSafeClassLeaderboard,
  canParticipateInClassChallenge,
  getChallengeTimeLabel,
  getClassChallengeStatus,
} from "./classChallengeEngine.js";
import {
  CURRENT_CLASS_PARTICIPANT,
  readQuestionBankQuestions,
  resolveClassChallengeQuestions,
} from "./classChallengeData.js";
import "./class-challenges.css";

const HERO_SRC = "/assets/games/class-challenges/defis-classes-hero.webp";

function StatusPill({ status }) {
  const active = status === "en_cours";
  return <span className={`cc-status ${active ? "is-live" : "is-finished"}`}><i />{active ? "En cours" : "Terminé"}</span>;
}

function PrivacyNotice() {
  return <aside className="cc-privacy-note" aria-label="Protection de l’identité"><ShieldCheck weight="fill"/><div><strong>Ton identité reste privée</strong><p>Le classement montre uniquement un pseudonyme généré au hasard. Il n’utilise ni prénom, ni nom, ni initiales, ni photo.</p></div></aside>;
}

export function ClassLeaderboard({ challenge, results, viewerParticipantId, safeRows }) {
  const rows = safeRows ?? buildSafeClassLeaderboard(challenge, results, viewerParticipantId);
  return <section className="cc-leaderboard" aria-labelledby={`cc-ranking-${challenge.id}`}>
    <div className="cc-section-heading"><div><span>CLASSEMENT DE LA CLASSE</span><h2 id={`cc-ranking-${challenge.id}`}>Les plumes en action</h2></div><span className="cc-scope"><LockKey weight="fill"/> {challenge.classLabel} uniquement</span></div>
    <p className="cc-ranking-rule"><Medal weight="duotone"/> Les rangs dépendent du nombre de bonnes réponses. À score égal, les élèves sont <strong>ex æquo</strong> : la vitesse ne départage personne.</p>
    <div className="cc-ranking-table" role="table" aria-label={`Classement pseudonymisé de ${challenge.classLabel}`}>
      <div className="cc-ranking-head" role="row"><span role="columnheader">Rang</span><span role="columnheader">Pseudonyme</span><span role="columnheader">Progression</span><span role="columnheader">Score</span></div>
      {rows.length ? rows.map((row, index) => <div className={`cc-ranking-row${row.isViewer ? " is-viewer" : ""}`} role="row" key={`${row.pseudonym}-${index}`}>
        <span role="cell" className="cc-rank">{row.rank ? <>{row.rank === 1 ? <Crown weight="fill"/> : `#${row.rank}`}{row.tied&&<small>ex æquo</small>}</> : <small>non classé</small>}</span>
        <span role="cell" className="cc-alias"><i aria-hidden="true">{row.pseudonym.split(" ").map((part)=>part[0]).join("").slice(0,2)}</i><span><strong>{row.pseudonym}</strong>{row.isViewer&&<small>C’est toi</small>}</span></span>
        <span role="cell" className="cc-progress-cell"><span className="cc-mini-track" aria-label={`${row.progressPercent} % terminé`}><i style={{width:`${row.progressPercent}%`}}/></span><small>{row.progressPercent}%</small></span>
        <span role="cell" className="cc-score-cell"><strong>{row.score}</strong><small>points</small></span>
      </div>) : <div className="cc-ranking-empty"><UsersThree weight="duotone"/><p>Le classement apparaîtra dès la première participation.</p></div>}
    </div>
  </section>;
}

export default function ClassChallengesStudent({
  school = null,
  challenges = [],
  results = [],
  currentXp = 0,
  participant = CURRENT_CLASS_PARTICIPANT,
  onAwardXp = () => {},
  onComplete = () => {},
  onExit = () => { window.history.pushState({}, "", "/eleve/jeux"); window.dispatchEvent(new Event("jde:navigate")); },
}) {
  const [tab, setTab] = useState("en_cours");
  const [localMode, setLocalMode] = useState("hub");
  const mode=school?.mode??localMode,setMode=school?.setMode??setLocalMode;
  const [selectedId, setSelectedId] = useState(null);
  const [optimisticResult, setOptimisticResult] = useState(null);
  const questionBank = useMemo(() => school?[]:readQuestionBankQuestions(), [Boolean(school)]);
  const visibleChallenges = useMemo(
    () => school?challenges:challenges.filter((item) => item.classId === participant.classId),
    [challenges, participant.classId,Boolean(school)],
  );
  const selected = school?.detail?.challenge??visibleChallenges.find((item) => item.id === selectedId)??null;
  const statusOf=challenge=>school?challenge.status:getClassChallengeStatus(challenge);
  const active = visibleChallenges.filter((item) => statusOf(item) === "en_cours");
  const finished = visibleChallenges.filter((item) => statusOf(item) === "termine");
  const displayed = tab === "en_cours" ? active : finished;

  useEffect(() => {
    if (mode !== "result") return;
    requestAnimationFrame(() => document.getElementById("cc-result-title")?.focus({ preventScroll: true }));
  }, [mode]);

  const moveTab = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "ArrowLeft" || event.key === "Home" ? "en_cours" : "termine";
    setTab(next);
    const tablist=event.currentTarget;
    requestAnimationFrame(() => tablist.querySelector(`[data-cc-tab="${next}"]`)?.focus());
  };

  const resultFor = (challenge) => school?(challenge.ownResult?.status==="termine"?challenge.ownResult:null):results.find(
    (item) => item.challengeId === challenge.id && item.participantId === participant.participantId && item.status === "termine",
  );

  const openResult = (challenge) => {
    if(school){school.open(challenge.id,"result");return;}
    setSelectedId(challenge.id);
    setOptimisticResult(null);
    setMode("result");
  };

  const start = (challenge) => {
    if(school){school.open(challenge.id,"quiz");return;}
    setSelectedId(challenge.id);
    setOptimisticResult(null);
    setMode("quiz");
  };

  if (school&&mode==="quiz"&&selected)return school.quiz;
  if (mode === "quiz" && selected) {
    const questionSet = resolveClassChallengeQuestions(selected, questionBank);
    return <CultureQuiz
      currentXp={currentXp}
      questionSet={questionSet}
      questionLimit={questionSet.length}
      experience={{
        quizId: `defi-classe:${selected.id}`,
        source: "defi-classe",
        welcomeKicker: `Défi de la classe · ${participant.pseudonym}`,
        title: "Ensemble pour",
        titleEmphasis: ` ${selected.title}`,
        description: `Cinq questions de la banque « ${selected.bankLabel} ». Ton score apparaîtra seulement sous ton pseudonyme, dans ${selected.classLabel}.`,
        resultKicker: "Défi de classe terminé",
        resultDescription: "Ton résultat rejoint maintenant le classement pseudonymisé de ta classe.",
        canRestart: false,
        illustrationSrc: HERO_SRC,
        attemptId: `defi-classe:${selected.id}:${participant.participantId}`,
        awardNamespace: `defi-classe:${selected.id}:${participant.participantId}`,
        category: selected.theme,
        // Même ordre pour toute la classe : la comparaison ne dépend jamais du hasard.
        shuffleSeed: `defi-classe:${selected.id}`,
      }}
      onAwardXp={onAwardXp}
      onComplete={(summary) => {
        const nextResult = {
          id: `${selected.id}:${participant.participantId}`,
          challengeId: selected.id,
          participantId: participant.participantId,
          pseudonym: participant.pseudonym,
          classId: selected.classId,
          status: "termine",
          correctCount: summary.correctCount,
          questionCount: summary.questionCount,
          score: summary.correctCount * 100,
          scorePercent: summary.scorePercent,
          progressPercent: 100,
          xpEarned: summary.xpEarned,
          completedAt: new Date().toISOString(),
        };
        onComplete(summary, selected, participant);
        setOptimisticResult(nextResult);
        setMode("result");
      }}
      onExit={() => setMode("hub")}
    />;
  }

  if (mode === "result" && selected) {
    const storedResult = resultFor(selected);
    const viewerResult = storedResult || optimisticResult;
    const effectiveResults = viewerResult && !results.some((item) => item.id === viewerResult.id)
      ? [...results, viewerResult]
      : results;
    const leaderboard = school?.detail?.leaderboard?.rows??buildSafeClassLeaderboard(selected, effectiveResults, participant.participantId);
    const viewerRow = school?.detail?.leaderboard?.viewerRank??leaderboard.find((row) => row.isViewer);
    const partial=school&&selected.ownResult?.status==="en_cours"?selected.ownResult:null;
    return <div className="cc-student-page cc-result-page">
      <header className="cc-student-topbar"><button type="button" onClick={() => setMode("hub")}><ArrowLeft/> Tous les défis</button><img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions"/><span><LockKey weight="fill"/> Classe privée</span></header>
      <main className="cc-student-main">
        <section className="cc-result-hero" aria-labelledby="cc-result-title"><span className="cc-result-medal"><Trophy weight="duotone"/></span><span className="cc-kicker"><Sparkle weight="fill"/> {viewerResult?"RÉSULTAT ENREGISTRÉ":"CLASSEMENT DE LA CLASSE"}</span><h1 id="cc-result-title" tabIndex="-1">{viewerResult?`Bravo, ${selected.pseudonym??participant.pseudonym} !`:partial?"Participation inachevée":"Les résultats de ma classe"}</h1><p>{viewerResult?"Ton identité réelle n’apparaît nulle part dans ce défi.":partial?`${partial.progressPercent===20?'Ta réponse':`Tes ${partial.progressPercent/20} réponses`} et tes ${partial.xpEarned} XP déjà enregistrés sont conservés. Ta participation reste sans rang.`:"Tu n’as pas participé à ce défi. Aucun résultat personnel n’a été enregistré."}</p>{viewerResult&&<div className="cc-result-stats"><article><strong>{viewerResult?.correctCount ?? 0}/{viewerResult?.questionCount ?? 5}</strong><span>bonnes réponses</span></article><article><strong>{viewerResult?.score ?? 0}</strong><span>points</span></article><article><strong>{viewerRow?.rank ? `#${viewerRow.rank}` : "—"}</strong><span>{viewerRow?.tied ? "rang · ex æquo" : "rang dans la classe"}</span></article><article><strong>+{viewerResult?.xpEarned ?? 0}</strong><span>XP attribués une fois</span></article></div>}<button type="button" className="cc-primary" onClick={() => setMode("hub")}>Retrouver mes défis <ArrowRight/></button></section>
        <ClassLeaderboard challenge={selected} results={effectiveResults} viewerParticipantId={participant.participantId} safeRows={school?.detail?.leaderboard?.rows}/>
        {school?.rankingPages}
        <PrivacyNotice/>
      </main>
    </div>;
  }

  return <div className="cc-student-page">
    <header className="cc-student-topbar"><button type="button" onClick={onExit}><ArrowLeft/> Mes jeux</button><img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions"/><span><LockKey weight="fill"/> Classe privée</span></header>
    <main className="cc-student-main">
      <section className="cc-student-hero" aria-labelledby="cc-student-title">
        <div><span className="cc-kicker"><UsersThree weight="fill"/> DÉFIS ENTRE CAMARADES</span><h1 id="cc-student-title">Notre classe avance ensemble</h1><p>Relève les défis proposés par ton enseignante et compare ta progression avec les pseudonymes de ta classe.</p><div className="cc-hero-facts"><span><GameController weight="duotone"/> 5 questions</span><span><Sparkle weight="duotone"/> 10 XP par bonne réponse</span><span><ShieldCheck weight="duotone"/> Identité protégée</span></div></div>
        <div className="cc-hero-art"><img src={HERO_SRC} alt="Trophée doré entouré de figurines abstraites et de motifs marocains" width="1254" height="1254"/><span>{school?"Identité protégée":participant.pseudonym}<small>{school?"un pseudonyme attribué au départ":"ton pseudonyme"}</small></span></div>
      </section>

      <div className="cc-tabs" role="tablist" aria-label="État des défis" onKeyDown={moveTab}><button role="tab" data-cc-tab="en_cours" aria-selected={tab === "en_cours"} tabIndex={tab === "en_cours" ? 0 : -1} className={tab === "en_cours" ? "is-active" : ""} onClick={() => setTab("en_cours")}>En cours <span>{school?.counts?.active??active.length}</span></button><button role="tab" data-cc-tab="termine" aria-selected={tab === "termine"} tabIndex={tab === "termine" ? 0 : -1} className={tab === "termine" ? "is-active" : ""} onClick={() => setTab("termine")}>Terminés <span>{school?.counts?.finished??finished.length}</span></button></div>

      <section className="cc-challenge-list" aria-live="polite">
        {displayed.map((challenge) => {
          const status = statusOf(challenge);
          const viewerResult = resultFor(challenge);
          const canPlay = school?challenge.canPlay:canParticipateInClassChallenge(challenge, results, participant.participantId);
          const participants = school?challenge.participantCount:buildSafeClassLeaderboard(challenge, results).length;
          return <article className="cc-challenge-card" key={challenge.id}><div className="cc-challenge-icon"><Trophy weight="duotone"/></div><div className="cc-challenge-copy"><div><StatusPill status={status}/><span className="cc-class-label"><LockKey weight="fill"/> {challenge.classLabel}</span></div><h2>{challenge.title}</h2><p>{challenge.theme} · {challenge.level} · Banque publiée</p><div className="cc-card-meta"><span><Clock weight="duotone"/> {getChallengeTimeLabel(challenge)}</span><span><GameController weight="duotone"/> {challenge.questionIds.length} questions</span><span><UsersThree weight="duotone"/> {participants} participation{participants > 1 ? "s" : ""}</span></div></div><div className="cc-card-action">{viewerResult ? <><CheckCircle weight="fill"/><strong>{viewerResult.score} points</strong><button type="button" className="cc-secondary" onClick={() => openResult(challenge)}>Voir mon résultat</button></> : canPlay ? <button type="button" className="cc-primary" onClick={() => start(challenge)}>{school&&challenge.ownResult?"Reprendre":"Participer"} <PlayCircle weight="fill"/></button> : <button type="button" className="cc-secondary" onClick={() => openResult(challenge)}>Voir le classement <ArrowRight/></button>}</div></article>;
        })}
        {!displayed.length&&<div className="cc-empty"><Trophy weight="duotone"/><h2>{school?.listPages?"Aucun défi de cette rubrique parmi ceux affichés":"Aucun défi dans cette rubrique"}</h2><p>{school?.listPages?"Charge la suite pour consulter les autres défis.":<>Les nouveaux défis de {school?"tes classes":participant.classLabel} apparaîtront ici.</>}</p></div>}
      </section>
      {school?.listPages}
      <PrivacyNotice/>
    </main>
  </div>;
}
