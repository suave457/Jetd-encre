import { useMemo, useRef } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle,
  ClockCountdown,
  Sparkle,
  Trophy,
} from "@phosphor-icons/react/ssr";
import CultureQuiz from "./CultureQuiz.jsx";
import {
  DAILY_CHALLENGE_ID,
  getCompletedDailyChallenge,
  getDailyChallenge,
  getDailyChallengeHistory,
} from "./dailyChallengeData.js";
import { readPublishedGameQuestions } from "./publishedQuestionSource.js";
import "./daily-challenge.css";

const NOOP = () => {};

function formatChallengeDate(dateKey, options = {}) {
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    day: "numeric",
    month: "long",
    ...(options.includeWeekday ? { weekday: "long" } : {}),
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function DailyCompletedScreen({ challenge, completion, history, currentXp, onExit }) {
  const recentHistory = history.slice(0, 7);
  return (
    <div className="culture-quiz daily-challenge-completed">
      <header className="cq-topbar daily-completed-topbar">
        <button className="cq-exit" type="button" onClick={onExit}>
          <ArrowLeft weight="bold" aria-hidden="true" />
          <span>Mes jeux</span>
        </button>
        <div className="cq-brand" aria-label="Jet d’Encre">
          <img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions" />
          <small>ESPACE ÉLÈVE</small>
        </div>
        <span className="daily-profile-xp">
          <Sparkle weight="fill" aria-hidden="true" />
          <span><small>MON PROFIL</small><strong>{currentXp.toLocaleString("fr-FR")} XP</strong></span>
        </span>
      </header>

      <main className="daily-completed-main">
        <section className="daily-completed-card" aria-labelledby="daily-completed-title">
          <div className="daily-completed-copy">
            <span className="cq-kicker"><CheckCircle weight="fill" /> Défi relevé</span>
            <h1 id="daily-completed-title">Bravo, ton défi du jour est terminé !</h1>
            <p>
              Tu as déjà joué le {formatChallengeDate(challenge.dateKey)}. Ta récompense
              est enregistrée dans ton profil ; une nouvelle série de questions arrivera demain.
            </p>
            <div className="daily-completed-stats">
              <article><strong>{completion.correctCount}/{completion.questionCount}</strong><small>bonnes réponses</small></article>
              <article><strong>+{completion.xpEarned} XP</strong><small>gagnés au total</small></article>
              <article><strong>{completion.category || challenge.category}</strong><small>catégorie vedette</small></article>
            </div>
            <button className="cq-primary-button" type="button" onClick={onExit}>
              Retour à mes jeux
              <ArrowLeft weight="bold" aria-hidden="true" />
            </button>
          </div>
          <div className="daily-completed-art" aria-hidden="true">
            <img src="/assets/defi-du-jour-hero.webp" alt="" width="768" height="768" />
            <span><ClockCountdown weight="fill" /><strong>À demain !</strong></span>
          </div>
        </section>

        <section className="daily-history" aria-labelledby="daily-history-title">
          <div className="daily-history-heading">
            <span><CalendarCheck weight="duotone" /></span>
            <div><h2 id="daily-history-title">Ton historique</h2><p>Tes sept derniers défis terminés.</p></div>
          </div>
          <div className="daily-history-list">
            {recentHistory.map((attempt) => (
              <article key={attempt.id}>
                <span>{formatChallengeDate(attempt.dailyKey, { includeWeekday: true })}</span>
                <strong>{attempt.correctCount}/{attempt.questionCount}</strong>
                <small>{attempt.category || "Culture générale"}</small>
                <b>+{attempt.xpEarned} XP</b>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function DailyChallenge({
  currentXp = 0,
  attempts = [],
  userId = null,
  onAwardXp = NOOP,
  onComplete = NOOP,
  onExit,
  now = new Date(),
}) {
  const openedAtRef = useRef(now);
  const questionSource = useMemo(() => readPublishedGameQuestions(), []);
  const challenge = useMemo(
    () => getDailyChallenge(openedAtRef.current, questionSource),
    [questionSource],
  );
  const history = useMemo(
    () => getDailyChallengeHistory(attempts, userId),
    [attempts, userId],
  );
  const completion = useMemo(
    () => getCompletedDailyChallenge(attempts, userId, challenge.dateKey),
    [attempts, challenge.dateKey, userId],
  );
  const wasCompletedWhenOpened = useRef(completion);
  const exitChallenge = () => {
    if (typeof onExit === "function") onExit();
    else {
      window.history.pushState({}, "", "/eleve/jeux");
      window.dispatchEvent(new Event("jde:navigate"));
    }
  };

  const experience = useMemo(() => ({
    quizId: DAILY_CHALLENGE_ID,
    source: DAILY_CHALLENGE_ID,
    welcomeKicker: `Défi du ${formatChallengeDate(challenge.dateKey)}`,
    title: "Cinq questions pour",
    titleEmphasis: " illuminer ta journée",
    description: `Aujourd’hui, la catégorie vedette est « ${challenge.category} ». Réponds aux ${challenge.questionCount} questions publiées, découvre une explication après chaque réponse et gagne un bonus en allant jusqu’au bout.`,
    resultKicker: "Défi du jour accompli",
    resultDescription:
      "Tes réponses sont enregistrées dans ton historique. Reviens demain pour découvrir une nouvelle catégorie vedette.",
    completionBonus: challenge.completionXp,
    canRestart: false,
    illustrationSrc: "/assets/defi-du-jour-hero.webp",
    attemptId: challenge.attemptId,
    awardNamespace: challenge.awardNamespace,
    dailyKey: challenge.dateKey,
    category: challenge.category,
    shuffleSeed: challenge.attemptId,
  }), [challenge]);

  if (wasCompletedWhenOpened.current) {
    return (
      <DailyCompletedScreen
        challenge={challenge}
        completion={wasCompletedWhenOpened.current}
        history={history}
        currentXp={Number(currentXp) || 0}
        onExit={exitChallenge}
      />
    );
  }

  return (
    <CultureQuiz
      currentXp={currentXp}
      questionSet={challenge.questions}
      questionLimit={challenge.questionCount}
      experience={experience}
      onAwardXp={onAwardXp}
      onComplete={onComplete}
      onExit={exitChallenge}
    />
  );
}
