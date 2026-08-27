import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CheckCircle,
  ClockCountdown,
  Fire,
  Lightbulb,
  Lightning,
  Medal,
  Play,
  Sparkle,
  Target,
  XCircle,
} from "@phosphor-icons/react/ssr";
import {
  WORD_CHOICE_CATEGORIES,
  WORD_CHOICE_LEVELS,
  wordChoiceItems,
} from "./wordChoiceData.js";
import {
  WORD_CHOICE_DEFAULT_QUESTION_COUNT,
  WORD_CHOICE_DURATION_SECONDS,
  WORD_CHOICE_XP_PER_CORRECT,
  calculateWordChoiceSummary,
  createWordChoiceSession,
  evaluateWordChoiceAnswer,
  isWordChoiceTimeExpired,
} from "./wordChoiceEngine.js";
import "./word-choice.css";

const GAME_ID = "mot-juste";
const DEFAULT_ILLUSTRATION = "/assets/games/word-choice/le-mot-juste-hero.webp";
const NOOP = () => {};

function createAttemptId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${GAME_ID}:${crypto.randomUUID()}`;
  }
  return `${GAME_ID}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 9)}`;
}

function fillPrompt(prompt, answer = null) {
  const [before, after] = prompt.split("___");
  return (
    <>
      {before}
      <span className={`wj-blank${answer ? " is-filled" : ""}`} aria-label={answer || "mot manquant"}>
        {answer || "…"}
      </span>
      {after}
    </>
  );
}

function GameHeader({ phase, questionNumber, total, streak, sessionXp, onExit }) {
  const progress = phase === "results" ? 100 : total ? (questionNumber / total) * 100 : 0;
  return (
    <header className="wj-header">
      <button className="wj-back" type="button" onClick={onExit}>
        <ArrowLeft weight="bold" aria-hidden="true" />
        <span>Mes jeux</span>
      </button>
      <div className="wj-brand" aria-label="Jet d’Encre, espace élève">
        <img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions" />
        <small>ESPACE ÉLÈVE</small>
      </div>
      <div className="wj-header-progress" aria-label={phase === "welcome" ? "Jeu prêt" : `Progression : ${questionNumber} sur ${total}`}>
        <span className="wj-progress-copy">
          <strong>{phase === "welcome" ? "Le Mot juste" : phase === "results" ? "Terminé" : `${questionNumber}/${total}`}</strong>
          <i aria-hidden="true"><b style={{ width: `${phase === "welcome" ? 0 : progress}%` }} /></i>
        </span>
        <span className="wj-header-stat wj-streak"><Fire weight="fill" aria-hidden="true" /><small>Série</small><strong>{streak}</strong></span>
        <span className="wj-header-stat wj-xp"><Sparkle weight="fill" aria-hidden="true" /><small>Gagnés</small><strong>+{sessionXp} XP</strong></span>
      </div>
    </header>
  );
}

function Timer({ timeLeft, paused }) {
  const isUrgent = !paused && timeLeft <= 3;
  return (
    <div
      className={`wj-timer${paused ? " is-paused" : ""}${isUrgent ? " is-urgent" : ""}`}
      role="timer"
      aria-label={paused ? `Chronomètre arrêté à ${timeLeft} secondes` : `${timeLeft} secondes restantes`}
    >
      <ClockCountdown weight="duotone" aria-hidden="true" />
      <strong>{String(timeLeft).padStart(2, "0")}</strong>
      <small>{paused ? "pause" : "secondes"}</small>
      <span aria-hidden="true">
        {Array.from({ length: WORD_CHOICE_DURATION_SECONDS }, (_, index) => (
          <i className={index < timeLeft ? "is-active" : ""} key={index} />
        ))}
      </span>
    </div>
  );
}

function Welcome({ level, category, questionCount, onLevelChange, onCategoryChange, onStart, illustrationSrc }) {
  return (
    <main className="wj-main wj-welcome">
      <section className="wj-welcome-card" aria-labelledby="wj-title">
        <div className="wj-welcome-copy">
          <span className="wj-eyebrow"><BookOpenText weight="fill" aria-hidden="true" /> Français en action</span>
          <h1 id="wj-title">Trouve <em>le mot juste</em></h1>
          <p>
            Complète chaque phrase avant la fin du chrono. Une correction courte
            t’aide à comprendre la règle et chaque bonne réponse te rapporte 10 XP.
          </p>

          <div className="wj-rule-row" aria-label="Règles du jeu">
            <span><Target weight="duotone" /><strong>{questionCount}</strong><small>phrases</small></span>
            <span><ClockCountdown weight="duotone" /><strong>10 s</strong><small>par phrase</small></span>
            <span><Lightning weight="duotone" /><strong>+10 XP</strong><small>bonne réponse</small></span>
          </div>

          <fieldset className="wj-settings">
            <legend>Choisis ton parcours</legend>
            <label>
              <span>Niveau</span>
              <select value={level} onChange={(event) => onLevelChange(event.target.value)}>
                <option value="Tous">Tous les niveaux</option>
                {WORD_CHOICE_LEVELS.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Compétence</span>
              <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
                <option value="Toutes">Toutes les compétences</option>
                {WORD_CHOICE_CATEGORIES.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
          </fieldset>

          <button className="wj-primary" type="button" onClick={onStart} disabled={!questionCount}>
            <Play weight="fill" aria-hidden="true" />
            Commencer
            <ArrowRight weight="bold" aria-hidden="true" />
          </button>
          {!questionCount && <p className="wj-empty-note" role="status">Aucune phrase ne correspond à ces filtres.</p>}
        </div>

        <div className="wj-welcome-art" aria-hidden="true">
          <span className="wj-art-orbit wj-orbit-one">accord</span>
          <span className="wj-art-orbit wj-orbit-two">verbe</span>
          <img src={illustrationSrc} alt="" width="768" height="768" loading="eager" decoding="async" />
          <div className="wj-art-card">
            <span>La phrase du jour</span>
            <strong>Nous ___ au tournoi.</strong>
            <small>participerons</small>
          </div>
        </div>
      </section>
    </main>
  );
}

function AnswerGrid({ item, answer, onAnswer }) {
  const feedback = Boolean(answer);
  return (
    <div className="wj-answers" role="group" aria-label="Quatre mots proposés">
      {item.choices.map((choice, index) => {
        const letter = String.fromCharCode(65 + index);
        const correct = feedback && index === item.correctIndex;
        const wrong = feedback && index === answer.selectedIndex && !correct;
        return (
          <button
            className={`wj-answer${correct ? " is-correct" : ""}${wrong ? " is-wrong" : ""}${feedback && !correct && !wrong ? " is-muted" : ""}`}
            type="button"
            onClick={() => onAnswer(index)}
            disabled={feedback}
            aria-label={`Réponse ${letter} : ${choice}`}
            key={`${item.id}-${choice}`}
          >
            <kbd aria-hidden="true">{index + 1}</kbd>
            <span className="wj-answer-letter" aria-hidden="true">{letter}</span>
            <strong>{choice}</strong>
            <span className="wj-answer-state" aria-hidden="true">
              {correct ? <CheckCircle weight="fill" /> : wrong ? <XCircle weight="fill" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Question({ item, index, total, timeLeft, answer, onAnswer, onContinue }) {
  const feedback = Boolean(answer);
  const correctWord = feedback ? item.choices[item.correctIndex] : null;
  const feedbackRef = useRef(null);

  useEffect(() => {
    if (!feedback || !feedbackRef.current) return;
    feedbackRef.current.focus({ preventScroll: true });
  }, [feedback, item.id]);

  return (
    <main className="wj-main wj-question-main">
      <section className="wj-question-stage" aria-labelledby="wj-question-title">
        <div className="wj-question-meta">
          <span>{item.category}</span>
          <small>{item.level}</small>
        </div>
        <div className="wj-question-row">
          <div className="wj-question-copy">
            <p>Phrase {index + 1} sur {total}</p>
            <h1 id="wj-question-title">{fillPrompt(item.prompt, correctWord)}</h1>
            {!feedback && <small>Choisis avec la souris ou les touches <kbd>1</kbd> à <kbd>4</kbd>.</small>}
          </div>
          <Timer timeLeft={timeLeft} paused={feedback} />
        </div>

        <AnswerGrid item={item} answer={answer} onAnswer={onAnswer} />

        {feedback && (
          <section
            ref={feedbackRef}
            className={`wj-feedback${answer.isCorrect ? " is-correct" : " is-learning"}`}
            aria-labelledby="wj-feedback-title"
            tabIndex="-1"
          >
            <span className="wj-feedback-icon" aria-hidden="true">
              {answer.isCorrect ? <CheckCircle weight="fill" /> : <Lightbulb weight="fill" />}
            </span>
            <div>
              <h2 id="wj-feedback-title">
                {answer.isCorrect
                  ? `Excellent ! +${answer.xp} XP`
                  : answer.timedOut
                    ? "Le temps est écoulé"
                    : "Observe la correction"}
              </h2>
              <p>{item.explanation}</p>
              <small><strong>À retenir :</strong> {item.learningGoal}</small>
            </div>
            <button className="wj-next" type="button" onClick={onContinue}>
              {index + 1 === total ? "Voir mon résultat" : "Phrase suivante"}
              <ArrowRight weight="bold" aria-hidden="true" />
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

function Results({ summary, profileXpStart, profileXpTotal, onRestart, onExit }) {
  const title = summary.scorePercent >= 80
    ? "Tu as le sens du mot juste !"
    : summary.scorePercent >= 50
      ? "Beau travail de langue !"
      : "Chaque phrase te fait progresser !";
  const strongest = Object.entries(summary.categoryResults)
    .filter(([, value]) => value.total > 0)
    .sort(([, left], [, right]) => (right.correct / right.total) - (left.correct / left.total))[0]?.[0];

  return (
    <main className="wj-main wj-results">
      <section className="wj-results-card" aria-labelledby="wj-results-title">
        <div className="wj-medal" aria-hidden="true"><Medal weight="duotone" /></div>
        <span className="wj-eyebrow"><Sparkle weight="fill" /> Parcours terminé</span>
        <h1 id="wj-results-title">{title}</h1>
        <p>Relis les explications qui t’ont aidé : choisir le bon mot devient plus facile avec la pratique.</p>
        <div className="wj-score"><strong>{summary.scorePercent}<small>%</small></strong><span>de réussite</span></div>
        <div className="wj-result-grid">
          <article><CheckCircle weight="duotone" /><strong>{summary.correctCount}/{summary.questionCount}</strong><small>bonnes réponses</small></article>
          <article><Lightning weight="duotone" /><strong>+{summary.xpEarned} XP</strong><small>sans aucune pénalité</small></article>
          <article><Fire weight="duotone" /><strong>{summary.bestStreak}</strong><small>meilleure série</small></article>
          <article><Target weight="duotone" /><strong>{strongest || "À poursuivre"}</strong><small>point fort</small></article>
        </div>
        <div className="wj-profile-total" aria-label={`XP du profil : ${profileXpStart} au départ, ${summary.xpEarned} gagnés, ${profileXpTotal} au total`}>
          <span>Ton profil</span>
          <strong>{profileXpStart.toLocaleString("fr-FR")}</strong>
          <small>+</small>
          <strong className="is-earned">{summary.xpEarned}</strong>
          <small>=</small>
          <strong>{profileXpTotal.toLocaleString("fr-FR")} XP</strong>
        </div>
        <div className="wj-result-actions">
          <button className="wj-primary" type="button" onClick={onRestart}><ArrowCounterClockwise weight="bold" /> Rejouer</button>
          <button className="wj-secondary" type="button" onClick={onExit}>Retour à mes jeux <ArrowRight weight="bold" /></button>
        </div>
      </section>
    </main>
  );
}

export default function WordChoiceGame({
  currentXp = 0,
  itemBank = wordChoiceItems,
  questionLimit = WORD_CHOICE_DEFAULT_QUESTION_COUNT,
  illustrationSrc = DEFAULT_ILLUSTRATION,
  onAwardXp = NOOP,
  onComplete = NOOP,
  onExit,
}) {
  const [phase, setPhase] = useState("welcome");
  const [level, setLevel] = useState("Tous");
  const [category, setCategory] = useState("Toutes");
  const [sessionItems, setSessionItems] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(WORD_CHOICE_DURATION_SECONDS);
  const [streak, setStreak] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const answerLockRef = useRef(false);
  const completionSentRef = useRef(false);
  const attemptIdRef = useRef(createAttemptId());
  const startedAtRef = useRef(Date.now());
  const profileXpStartRef = useRef(Number(currentXp) || 0);

  const availableItems = useMemo(
    () => createWordChoiceSession(itemBank, {
      level,
      category,
      limit: itemBank.length,
      seed: "aperçu",
    }),
    [category, itemBank, level],
  );
  const plannedQuestionCount = Math.min(
    availableItems.length,
    Math.max(0, Math.floor(Number(questionLimit) || 0)),
  );
  const currentItem = sessionItems[questionIndex];
  const currentAnswer = answers[questionIndex] || null;
  const sessionXp = answers.reduce((total, answer) => total + answer.xp, 0);

  const exitGame = useCallback(() => {
    if (typeof onExit === "function") onExit();
    else window.location.hash = "#/eleve/jeux";
  }, [onExit]);

  const startGame = useCallback(() => {
    const attemptId = createAttemptId();
    const selectedItems = createWordChoiceSession(itemBank, {
      level,
      category,
      limit: questionLimit,
      seed: attemptId,
    });
    if (!selectedItems.length) return;
    attemptIdRef.current = attemptId;
    profileXpStartRef.current = Number(currentXp) || 0;
    startedAtRef.current = Date.now();
    answerLockRef.current = false;
    completionSentRef.current = false;
    setSessionItems(selectedItems);
    setQuestionIndex(0);
    setAnswers([]);
    setStreak(0);
    setTimeLeft(WORD_CHOICE_DURATION_SECONDS);
    setPhase("question");
    setAnnouncement(`Phrase 1 sur ${selectedItems.length}. Tu as 10 secondes.`);
  }, [category, currentXp, itemBank, level, questionLimit]);

  const submitAnswer = useCallback((selectedIndex, timedOut = false) => {
    if (answerLockRef.current || phase !== "question" || !currentItem) return;
    answerLockRef.current = true;
    const expired = timedOut
      || timeLeft <= 0
      || isWordChoiceTimeExpired(startedAtRef.current, Date.now());
    const safeIndex = expired ? null : selectedIndex;
    const evaluation = evaluateWordChoiceAnswer(currentItem, safeIndex);
    const nextStreak = evaluation.isCorrect ? streak + 1 : 0;
    const answer = {
      itemId: currentItem.id,
      selectedIndex: safeIndex,
      correctIndex: currentItem.correctIndex,
      isCorrect: evaluation.isCorrect,
      xp: evaluation.xp,
      timedOut: expired,
    };
    setAnswers((previous) => [...previous, answer]);
    setStreak(nextStreak);
    setPhase("feedback");
    if (evaluation.xp > 0) {
      onAwardXp(evaluation.xp, {
        eventId: `${attemptIdRef.current}:${currentItem.id}`,
        attemptId: attemptIdRef.current,
        questionId: currentItem.id,
        source: GAME_ID,
        level: currentItem.level,
        category: currentItem.category,
        streak: nextStreak,
      });
    }
    setAnnouncement(
      evaluation.isCorrect
        ? `Bonne réponse. ${evaluation.xp} points d’expérience gagnés.`
        : expired
          ? `Temps écoulé. Le mot juste était ${currentItem.choices[currentItem.correctIndex]}.`
          : `Réponse incorrecte. Le mot juste était ${currentItem.choices[currentItem.correctIndex]}.`,
    );
  }, [currentItem, onAwardXp, phase, streak, timeLeft]);

  useEffect(() => {
    if (phase !== "question") return undefined;
    if (timeLeft <= 0) {
      submitAnswer(null, true);
      return undefined;
    }
    const timer = window.setTimeout(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, submitAnswer, timeLeft]);

  useEffect(() => {
    if (phase !== "question") return undefined;
    const handleKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const selectedIndex = Number(event.key) - 1;
      if (selectedIndex >= 0 && selectedIndex <= 3) {
        event.preventDefault();
        submitAnswer(selectedIndex);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, submitAnswer]);

  const continueGame = useCallback(() => {
    if (questionIndex >= sessionItems.length - 1) {
      setPhase("results");
      setAnnouncement("Parcours terminé. Ton résultat est affiché.");
      return;
    }
    const nextIndex = questionIndex + 1;
    answerLockRef.current = false;
    startedAtRef.current = Date.now();
    setQuestionIndex(nextIndex);
    setTimeLeft(WORD_CHOICE_DURATION_SECONDS);
    setPhase("question");
    setAnnouncement(`Phrase ${nextIndex + 1} sur ${sessionItems.length}. Tu as 10 secondes.`);
  }, [questionIndex, sessionItems.length]);

  const summary = useMemo(
    () => calculateWordChoiceSummary(sessionItems, answers.map((answer) => answer.selectedIndex)),
    [answers, sessionItems],
  );
  const profileXpTotal = Math.max(
    Number(currentXp) || 0,
    profileXpStartRef.current + summary.xpEarned,
  );

  useEffect(() => {
    if (phase !== "results" || completionSentRef.current) return;
    completionSentRef.current = true;
    onComplete({
      ...summary,
      attemptId: attemptIdRef.current,
      quizId: GAME_ID,
      source: GAME_ID,
      level,
      category,
      startingXp: profileXpStartRef.current,
      totalXp: profileXpTotal,
      answers: answers.map((answer) => ({ ...answer })),
    });
  }, [answers, category, level, onComplete, phase, profileXpTotal, summary]);

  return (
    <div className={`word-choice-game wj-phase-${phase}`}>
      <GameHeader
        phase={phase}
        questionNumber={questionIndex + 1}
        total={sessionItems.length}
        streak={streak}
        sessionXp={sessionXp}
        onExit={exitGame}
      />
      {phase === "welcome" && (
        <Welcome
          level={level}
          category={category}
          questionCount={plannedQuestionCount}
          onLevelChange={setLevel}
          onCategoryChange={setCategory}
          onStart={startGame}
          illustrationSrc={illustrationSrc}
        />
      )}
      {(phase === "question" || phase === "feedback") && currentItem && (
        <Question
          item={currentItem}
          index={questionIndex}
          total={sessionItems.length}
          timeLeft={timeLeft}
          answer={currentAnswer}
          onAnswer={submitAnswer}
          onContinue={continueGame}
        />
      )}
      {phase === "results" && (
        <Results
          summary={summary}
          profileXpStart={profileXpStartRef.current}
          profileXpTotal={profileXpTotal}
          onRestart={startGame}
          onExit={exitGame}
        />
      )}
      <p className="wj-sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </div>
  );
}
