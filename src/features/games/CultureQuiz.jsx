import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  Fire,
  GameController,
  Lightbulb,
  Lightning,
  Medal,
  PlayCircle,
  Sparkle,
  Star,
  Trophy,
  XCircle,
} from "@phosphor-icons/react/ssr";
import { readPublishedGameQuestions } from "./publishedQuestionSource.js";
import {
  XP_PER_CORRECT,
  calculateQuizSummary,
  evaluateAnswer,
  isTimeExpired,
  prepareQuizQuestions,
} from "./quizEngine.js";
import "./culture-quiz.css";

const DEFAULT_DURATION = 10;
const COMFORT_DURATION = 20;
const MAX_QUESTIONS = 10;
const TIMER_SEGMENTS = 10;
const NOOP = () => {};

const DEFAULT_EXPERIENCE = Object.freeze({
  quizId: "culture-generale",
  source: "culture-generale",
  welcomeKicker: "Le défi du jour",
  title: "Le grand quiz de",
  titleEmphasis: " culture générale",
  description:
    "Voyage entre le Maroc, la langue française, les sciences et le monde. Tu as peu de temps pour trouver chaque bonne réponse.",
  previewLabel: "GÉOGRAPHIE",
  previewTitle: "Connais-tu bien le Maroc ?",
  previewCopy: "À toi de jouer !",
  resultKicker: "Quiz terminé",
  resultDescription:
    "Tu as terminé le défi de culture générale. Chaque réponse t’aide à construire de nouveaux repères.",
  completionBonus: 0,
  canRestart: true,
  restartLabel: "Rejouer",
  illustrationSrc: null,
  attemptId: null,
  awardNamespace: null,
  dailyKey: null,
  category: null,
  shuffleQuestions: true,
  shuffleSeed: null,
});

function createAttemptId(quizId = "culture-generale") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${quizId}:${crypto.randomUUID()}`;
  }
  return `${quizId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 9)}`;
}

function QuizTopbar({
  phase,
  questionNumber,
  questionTotal,
  streak,
  xp,
  onExit,
}) {
  const progressLabel =
    phase === "welcome"
      ? `${questionTotal} questions`
      : phase === "results"
        ? "Quiz terminé"
        : `Question ${questionNumber} sur ${questionTotal}`;
  const activeProgress =
    phase === "welcome" ? 0 : phase === "results" ? questionTotal : questionNumber;

  return (
    <header className="cq-topbar">
      <button className="cq-exit" type="button" onClick={onExit}>
        <ArrowLeft weight="bold" aria-hidden="true" />
        <span>Mes jeux</span>
      </button>

      <div className="cq-brand" aria-label="Jet d’Encre">
        <img
          src="/assets/jet-dencre-logo-horizontal-light-400.webp"
          alt="Jet d’Encre Éditions"
        />
        <small>ESPACE ÉLÈVE</small>
      </div>

      <div className="cq-player-meta" aria-label="Progression du quiz">
        <div className="cq-question-progress">
          <span className="cq-question-count">{progressLabel}</span>
          <span className="cq-progress-segments" aria-hidden="true">
            {Array.from({ length: questionTotal }, (_, index) => (
              <i className={index < activeProgress ? "is-active" : ""} key={index} />
            ))}
          </span>
        </div>
        <span className="cq-meta-item cq-meta-streak">
          <Fire weight="fill" aria-hidden="true" />
          <span>
            <small>Série</small>
            <strong>{streak}</strong>
          </span>
        </span>
        <span className="cq-meta-item cq-meta-xp">
          <Sparkle weight="bold" aria-hidden="true" />
          <span>
            <small>XP</small>
            <strong>{xp.toLocaleString("fr-FR")}</strong>
          </span>
        </span>
      </div>
    </header>
  );
}

function ComfortMode({ enabled, onChange }) {
  return (
    <label className="cq-comfort-toggle">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="cq-toggle-track" aria-hidden="true">
        <span />
      </span>
      <span className="cq-toggle-copy">
        <strong>Mode confort</strong>
        <small>20 secondes par question</small>
      </span>
    </label>
  );
}

function Timer({ timeLeft, duration, paused = false }) {
  const activeSegments = Math.ceil((timeLeft / duration) * TIMER_SEGMENTS);
  const urgent = !paused && timeLeft <= 3;

  return (
    <div
      className={`cq-timer${urgent ? " is-urgent" : ""}${paused ? " is-paused" : ""}`}
      role="timer"
      aria-label={
        paused
          ? `Chronomètre arrêté à ${timeLeft} seconde${timeLeft > 1 ? "s" : ""}`
          : `${timeLeft} seconde${timeLeft > 1 ? "s" : ""} restante${timeLeft > 1 ? "s" : ""}`
      }
    >
      <div className="cq-timer-segments" aria-hidden="true">
        {Array.from({ length: TIMER_SEGMENTS }, (_, index) => (
          <span
            className={index < activeSegments ? "is-active" : ""}
            style={{ "--cq-segment": index }}
            key={index}
          />
        ))}
      </div>
      <div className="cq-timer-face">
        <strong>{String(timeLeft).padStart(2, "0")}</strong>
        <small>{paused ? "pause" : "sec"}</small>
      </div>
    </div>
  );
}

function AnswerGrid({
  question,
  phase,
  selectedIndex,
  onSelect,
}) {
  const isFeedback = phase === "feedback";

  return (
    <div className="cq-answers" role="group" aria-label="Propositions de réponse">
      {question.choices.map((choice, index) => {
        const answerLetter = String.fromCharCode(65 + index);
        const isSelected = selectedIndex === index;
        const isCorrect = isFeedback && index === question.correctIndex;
        const isWrong = isFeedback && isSelected && !isCorrect;
        const classes = [
          "cq-answer",
          `cq-answer-${index + 1}`,
          isSelected ? "is-selected" : "",
          isCorrect ? "is-correct" : "",
          isWrong ? "is-wrong" : "",
          isFeedback && !isCorrect && !isWrong ? "is-muted" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            className={classes}
            type="button"
            onClick={() => onSelect(index)}
            disabled={isFeedback}
            aria-label={`Réponse ${answerLetter} : ${choice}`}
            aria-pressed={!isFeedback ? isSelected : undefined}
            key={`${question.id}-${choice}`}
          >
            <span className="cq-answer-number" aria-hidden="true">
              {answerLetter}
            </span>
            <span className="cq-answer-text">{choice}</span>
            <span className="cq-answer-state" aria-hidden="true">
              {isCorrect ? (
                <CheckCircle weight="fill" />
              ) : isWrong ? (
                <XCircle weight="fill" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WelcomeScreen({
  questionTotal,
  comfortMode,
  onComfortChange,
  onStart,
  experience,
}) {
  return (
    <main className="cq-main cq-welcome">
      <section className="cq-welcome-card" aria-labelledby="cq-welcome-title">
        <div className="cq-welcome-copy">
          <span className="cq-kicker">
            <Sparkle weight="fill" aria-hidden="true" />
            {experience.welcomeKicker}
          </span>
          <h1 id="cq-welcome-title">
            {experience.title}
            <em>{experience.titleEmphasis}</em>
          </h1>
          <p>{experience.description}</p>

          <div className="cq-rules" aria-label="Règles du jeu">
            <span>
              <GameController weight="duotone" aria-hidden="true" />
              <strong>{questionTotal}</strong>
              <small>questions</small>
            </span>
            <span>
              <Clock weight="duotone" aria-hidden="true" />
              <strong>{comfortMode ? COMFORT_DURATION : DEFAULT_DURATION} s</strong>
              <small>par question</small>
            </span>
            <span>
              <Lightning weight="duotone" aria-hidden="true" />
              <strong>+{XP_PER_CORRECT} XP</strong>
              <small>bonne réponse</small>
            </span>
          </div>

          <div className="cq-welcome-actions">
            <button className="cq-primary-button" type="button" onClick={onStart}>
              <PlayCircle weight="fill" aria-hidden="true" />
              Commencer le quiz
              <ArrowRight weight="bold" aria-hidden="true" />
            </button>
            <ComfortMode enabled={comfortMode} onChange={onComfortChange} />
          </div>
        </div>

        {experience.illustrationSrc ? (
          <div className="cq-welcome-panel cq-welcome-illustration" aria-hidden="true">
            <img
              src={experience.illustrationSrc}
              alt=""
              width="768"
              height="768"
              loading="eager"
              decoding="async"
            />
            {experience.completionBonus > 0 && (
              <span className="cq-daily-bonus">
                <Sparkle weight="fill" />
                <strong>+{experience.completionBonus} XP</strong>
                <small>bonus de complétion</small>
              </span>
            )}
          </div>
        ) : (
          <div className="cq-welcome-panel" aria-hidden="true">
            <div className="cq-preview-card cq-preview-card-top">
              <span>{experience.previewLabel}</span>
              <strong>{experience.previewTitle}</strong>
              <small>{experience.previewCopy}</small>
            </div>
            <div className="cq-preview-trophy">
              <span><Trophy weight="duotone" /></span>
              <strong>Prêt à battre ton record ?</strong>
              <small>Réfléchis vite, apprends à chaque réponse.</small>
            </div>
            <div className="cq-preview-card cq-preview-card-bottom">
              <Star weight="fill" />
              <span>
                <strong>Objectif</strong>
                <small>{questionTotal} / {questionTotal}</small>
              </span>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function QuestionScreen({
  question,
  questionNumber,
  questionTotal,
  phase,
  timeLeft,
  duration,
  answer,
  onSelect,
  onContinue,
}) {
  const isFeedback = phase === "feedback";
  const isCorrect = answer?.isCorrect;
  const wasTimedOut = answer?.timedOut;
  const feedbackRef = useRef(null);

  useEffect(() => {
    if (!isFeedback || !feedbackRef.current) return;

    const feedbackBounds = feedbackRef.current.getBoundingClientRect();
    if (feedbackBounds.bottom <= window.innerHeight - 12) return;

    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    feedbackRef.current.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [isFeedback, question.id]);

  return (
    <main className="cq-main cq-question-main">
      <section className="cq-question-stage" aria-labelledby="cq-question-title">
        <div className="cq-question-heading">
          <div className="cq-question-copy">
            <span className="cq-theme-pill">{question.theme}</span>
            <p className="cq-level">Niveau {question.level}</p>
            <h1 id="cq-question-title">{question.prompt}</h1>
            {!isFeedback && (
              <p className="cq-keyboard-hint">
                Utilise les touches <kbd>1</kbd> à <kbd>4</kbd> ou choisis une réponse.
              </p>
            )}
          </div>
          <Timer timeLeft={timeLeft} duration={duration} paused={isFeedback} />
        </div>

        <div className="cq-mobile-progress" aria-hidden="true">
          <span style={{ width: `${(questionNumber / questionTotal) * 100}%` }} />
        </div>

        <AnswerGrid
          question={question}
          phase={phase}
          selectedIndex={answer?.selectedIndex ?? null}
          onSelect={onSelect}
        />

        {isFeedback && (
          <div
            ref={feedbackRef}
            className={`cq-feedback ${isCorrect ? "is-correct" : "is-wrong"}`}
            role="status"
          >
            <span className="cq-feedback-icon" aria-hidden="true">
              {isCorrect ? (
                <CheckCircle weight="fill" />
              ) : (
                <Lightbulb weight="fill" />
              )}
            </span>
            <div>
              <span className="cq-feedback-label">
                {isCorrect
                  ? `Bravo ! +${answer.xp} XP`
                  : wasTimedOut
                    ? "Le temps est écoulé"
                    : "Presque ! Regarde la correction"}
              </span>
              <p>{question.explanation}</p>
            </div>
            <button
              className="cq-next-button"
              type="button"
              onClick={onContinue}
            >
              {questionNumber === questionTotal ? "Voir mes résultats" : "Question suivante"}
              <ArrowRight weight="bold" aria-hidden="true" />
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function ResultsScreen({
  summary,
  questionTotal,
  profileXpStart,
  profileXpTotal,
  onRestart,
  onExit,
  experience,
}) {
  const score = Number.isFinite(summary.scorePercent) ? summary.scorePercent : 0;
  const totalXpEarned = summary.xpEarned + experience.completionBonus;
  const title =
    score >= 90
      ? "Quelle performance !"
      : score >= 70
        ? "Bravo, beau parcours !"
        : score >= 50
          ? "Bien joué !"
          : "Tu progresses à chaque essai !";

  return (
    <main className="cq-main cq-results">
      <section className="cq-results-card" aria-labelledby="cq-results-title">
        <div className="cq-result-medal" aria-hidden="true">
          <Medal weight="duotone" />
        </div>
        <span className="cq-kicker">
          <Sparkle weight="fill" aria-hidden="true" />
          {experience.resultKicker}
        </span>
        <h1 id="cq-results-title">{title}</h1>
        <p>{experience.resultDescription}</p>

        {experience.completionBonus > 0 && (
          <div className="cq-completion-reward" role="status">
            <Trophy weight="fill" aria-hidden="true" />
            <span>
              <strong>Défi du jour accompli · +{experience.completionBonus} XP</strong>
              <small>Ce bonus est attribué une seule fois aujourd’hui.</small>
            </span>
          </div>
        )}

        <div className="cq-score" aria-label={`Score : ${score} pour cent`}>
          <strong>{score}<small>%</small></strong>
          <span>Ton score</span>
        </div>

        <div className="cq-result-stats">
          <article>
            <CheckCircle weight="duotone" aria-hidden="true" />
            <span>
              <strong>{summary.correctCount} / {questionTotal}</strong>
              <small>bonnes réponses</small>
            </span>
          </article>
          <article>
            <Lightning weight="duotone" aria-hidden="true" />
            <span>
              <strong>+{totalXpEarned} XP</strong>
              <small>gagnés aujourd’hui</small>
            </span>
          </article>
          <article>
            <Fire weight="duotone" aria-hidden="true" />
            <span>
              <strong>{summary.bestStreak}</strong>
              <small>meilleure série</small>
            </span>
          </article>
        </div>

        <div
          className="cq-profile-balance"
          aria-label={`Profil : ${profileXpStart} points d’expérience au départ, plus ${totalXpEarned}, nouveau total ${profileXpTotal}`}
        >
          <span>XP du profil</span>
          <strong>{profileXpStart.toLocaleString("fr-FR")}</strong>
          <small>+</small>
          <strong className="cq-profile-earned">{totalXpEarned}</strong>
          <small>=</small>
          <strong>{profileXpTotal.toLocaleString("fr-FR")}</strong>
        </div>

        <div className="cq-result-actions">
          {experience.canRestart && (
            <button className="cq-primary-button" type="button" onClick={onRestart}>
              <ArrowCounterClockwise weight="bold" aria-hidden="true" />
              {experience.restartLabel}
            </button>
          )}
          <button className="cq-secondary-button" type="button" onClick={onExit}>
            Retour à mes jeux
            <ArrowRight weight="bold" aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  );
}

export default function CultureQuiz({
  currentXp,
  startingXp,
  totalXp,
  onAwardXp = NOOP,
  onComplete = NOOP,
  onExit,
  questionSet = null,
  questionLimit = MAX_QUESTIONS,
  experience: experienceOptions = DEFAULT_EXPERIENCE,
}) {
  const experience = useMemo(
    () => ({ ...DEFAULT_EXPERIENCE, ...(experienceOptions || {}) }),
    [experienceOptions],
  );
  const publishedQuestions = useMemo(() => readPublishedGameQuestions(), []);
  const sourceQuestions = Array.isArray(questionSet)
    ? questionSet
    : publishedQuestions;
  const initialAttemptIdRef = useRef(
    experience.attemptId || createAttemptId(experience.quizId),
  );
  const [questionOrderSeed, setQuestionOrderSeed] = useState(
    experience.shuffleSeed || initialAttemptIdRef.current,
  );
  const questions = useMemo(
    () => prepareQuizQuestions(sourceQuestions, {
      limit: Math.max(0, Number(questionLimit) || MAX_QUESTIONS),
      seed: questionOrderSeed,
      shuffle: experience.shuffleQuestions !== false,
    }),
    [experience.shuffleQuestions, questionLimit, questionOrderSeed, sourceQuestions],
  );
  const [phase, setPhase] = useState("welcome");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATION);
  const [comfortMode, setComfortMode] = useState(false);
  const [streak, setStreak] = useState(0);
  const externalXp = Number(totalXp ?? currentXp ?? startingXp ?? 0) || 0;
  const [announcement, setAnnouncement] = useState("");
  const answerLockRef = useRef(false);
  const completionSentRef = useRef(false);
  const attemptIdRef = initialAttemptIdRef;
  const questionStartedAtRef = useRef(Date.now());
  const profileXpAtStartRef = useRef(
    Number(startingXp ?? currentXp ?? totalXp ?? 0) || 0,
  );

  const duration = comfortMode ? COMFORT_DURATION : DEFAULT_DURATION;
  const questionTotal = questions.length;
  const currentQuestion = questions[questionIndex];
  const currentAnswer = answers[questionIndex] ?? null;

  const exitQuiz = useCallback(() => {
    if (typeof onExit === "function") {
      onExit();
      return;
    }
    window.history.pushState({}, "", "/eleve/jeux");
    window.dispatchEvent(new Event("jde:navigate"));
  }, [onExit]);

  const submitAnswer = useCallback(
    (selectedIndex, timedOut = false) => {
      if (
        answerLockRef.current ||
        phase !== "question" ||
        !currentQuestion
      ) {
        return;
      }

      answerLockRef.current = true;
      const hasExpired =
        timedOut ||
        timeLeft <= 0 ||
        isTimeExpired(questionStartedAtRef.current, Date.now(), duration);
      const answerIndex = hasExpired ? null : selectedIndex;
      const evaluated = evaluateAnswer(
        currentQuestion,
        answerIndex === null ? -1 : answerIndex,
      );
      const isCorrect = Boolean(evaluated.isCorrect) && !hasExpired;
      const xp = isCorrect ? Number(evaluated.xp ?? XP_PER_CORRECT) : 0;
      const nextStreak = isCorrect ? streak + 1 : 0;
      const answer = {
        questionId: currentQuestion.id,
        selectedIndex: answerIndex,
        correctIndex: currentQuestion.correctIndex,
        isCorrect,
        xp,
        timedOut: hasExpired,
      };

      setAnswers((previousAnswers) => [...previousAnswers, answer]);
      setStreak(nextStreak);
      setPhase("feedback");

      if (xp > 0) {
        onAwardXp(xp, {
          eventId: `${experience.awardNamespace || attemptIdRef.current}:${currentQuestion.id}`,
          attemptId: attemptIdRef.current,
          questionId: currentQuestion.id,
          source: experience.source,
          questionIndex,
          theme: currentQuestion.theme,
          streak: nextStreak,
          dailyKey: experience.dailyKey,
        });
      }

      setAnnouncement(
        isCorrect
          ? `Bonne réponse. ${xp} points d’expérience gagnés.`
          : hasExpired
            ? `Temps écoulé. La bonne réponse était ${currentQuestion.choices[currentQuestion.correctIndex]}.`
            : `Réponse incorrecte. La bonne réponse était ${currentQuestion.choices[currentQuestion.correctIndex]}.`,
      );
    },
    [currentQuestion, duration, experience, onAwardXp, phase, questionIndex, streak, timeLeft],
  );

  useEffect(() => {
    if (phase !== "question") return undefined;

    if (timeLeft <= 0) {
      submitAnswer(null, true);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setTimeLeft((previousTime) => Math.max(0, previousTime - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phase, submitAnswer, timeLeft]);

  useEffect(() => {
    if (phase !== "question") return undefined;

    const handleKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const answerIndex = Number(event.key) - 1;
      if (answerIndex >= 0 && answerIndex < 4) {
        event.preventDefault();
        submitAnswer(answerIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, submitAnswer]);

  const startQuiz = useCallback(() => {
    answerLockRef.current = false;
    completionSentRef.current = false;
    const nextAttemptId = experience.attemptId || createAttemptId(experience.quizId);
    attemptIdRef.current = nextAttemptId;
    setQuestionOrderSeed(experience.shuffleSeed || nextAttemptId);
    profileXpAtStartRef.current =
      Number(startingXp ?? currentXp ?? totalXp ?? 0) || 0;
    questionStartedAtRef.current = Date.now();
    setQuestionIndex(0);
    setAnswers([]);
    setStreak(0);
    setTimeLeft(duration);
    setPhase("question");
    setAnnouncement(
      `Question 1 sur ${questionTotal}. Tu as ${duration} secondes.`,
    );
  }, [currentXp, duration, experience, questionTotal, startingXp, totalXp]);

  const continueQuiz = useCallback(() => {
    if (questionIndex >= questionTotal - 1) {
      setPhase("results");
      setAnnouncement("Quiz terminé. Tes résultats sont affichés.");
      return;
    }

    const nextQuestionIndex = questionIndex + 1;
    answerLockRef.current = false;
    questionStartedAtRef.current = Date.now();
    setQuestionIndex(nextQuestionIndex);
    setTimeLeft(duration);
    setPhase("question");
    setAnnouncement(
      `Question ${nextQuestionIndex + 1} sur ${questionTotal}. Tu as ${duration} secondes.`,
    );
  }, [duration, questionIndex, questionTotal]);

  const summary = useMemo(() => {
    if (!answers.length) {
      return { correctCount: 0, xpEarned: 0, bestStreak: 0, scorePercent: 0 };
    }
    return calculateQuizSummary(
      questions,
      answers.map((answer) => answer.selectedIndex),
    );
  }, [answers, questions]);

  const answerXp = answers.reduce((total, answer) => total + answer.xp, 0);
  const completionXp = phase === "results" ? experience.completionBonus : 0;
  const sessionXp = answerXp + completionXp;
  const profileXpTotal = Math.max(
    externalXp,
    profileXpAtStartRef.current + sessionXp,
  );

  useEffect(() => {
    if (phase !== "results" || completionSentRef.current) return;
    completionSentRef.current = true;
    if (experience.completionBonus > 0) {
      onAwardXp(experience.completionBonus, {
        eventId: `${experience.awardNamespace || attemptIdRef.current}:completion`,
        attemptId: attemptIdRef.current,
        questionId: null,
        source: experience.source,
        dailyKey: experience.dailyKey,
        category: experience.category,
        kind: "completion",
      });
    }
    onComplete({
      ...summary,
      answerXpEarned: summary.xpEarned,
      completionXp: experience.completionBonus,
      xpEarned: summary.xpEarned + experience.completionBonus,
      attemptId: attemptIdRef.current,
      questionCount: questionTotal,
      startingXp: profileXpAtStartRef.current,
      totalXp: profileXpTotal,
      quizId: experience.quizId,
      dailyKey: experience.dailyKey,
      category: experience.category,
      answers: answers.map((answer) => ({ ...answer })),
    });
  }, [answers, experience, onAwardXp, onComplete, phase, profileXpTotal, questionTotal, summary]);

  if (!questionTotal) {
    return (
      <div className="culture-quiz">
        <QuizTopbar
          phase="welcome"
          questionNumber={0}
          questionTotal={0}
          streak={0}
          xp={sessionXp}
          onExit={exitQuiz}
        />
        <main className="cq-main cq-empty">
          <GameController weight="duotone" aria-hidden="true" />
          <h1>Le quiz se prépare</h1>
          <p>Les questions seront bientôt disponibles.</p>
          <button className="cq-secondary-button" type="button" onClick={exitQuiz}>
            Retour à mes jeux
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={`culture-quiz cq-phase-${phase}`}>
      <QuizTopbar
        phase={phase}
        questionNumber={questionIndex + 1}
        questionTotal={questionTotal}
        streak={streak}
        xp={sessionXp}
        onExit={exitQuiz}
      />

      {phase === "welcome" && (
        <WelcomeScreen
          questionTotal={questionTotal}
          comfortMode={comfortMode}
          onComfortChange={setComfortMode}
          onStart={startQuiz}
          experience={experience}
        />
      )}

      {(phase === "question" || phase === "feedback") && currentQuestion && (
        <QuestionScreen
          question={currentQuestion}
          questionNumber={questionIndex + 1}
          questionTotal={questionTotal}
          phase={phase}
          timeLeft={timeLeft}
          duration={duration}
          answer={currentAnswer}
          onSelect={submitAnswer}
          onContinue={continueQuiz}
        />
      )}

      {phase === "results" && (
        <ResultsScreen
          summary={summary}
          questionTotal={questionTotal}
          profileXpStart={profileXpAtStartRef.current}
          profileXpTotal={profileXpTotal}
          onRestart={startQuiz}
          onExit={exitQuiz}
          experience={experience}
        />
      )}

      <p className="cq-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
