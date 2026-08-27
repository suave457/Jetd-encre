import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Fire,
  Lightning,
  Medal,
  Sparkle,
  XCircle,
} from "@phosphor-icons/react/ssr";
import { cultureQuizQuestions } from "./features/games/cultureQuizData.js";
import {
  QUESTION_DURATION_SECONDS,
  XP_PER_CORRECT,
  calculateQuizSummary,
  evaluateAnswer,
  getRemainingSeconds,
  isTimeExpired,
} from "./features/games/quizEngine.js";
import "./student-quiz.css";

const DEFAULT_QUESTION_COUNT = 10;
const TIMER_SEGMENTS = QUESTION_DURATION_SECONDS;
const ANSWER_LABELS = ["A", "B", "C", "D"];
const NOOP = () => {};

function formatSeconds(seconds) {
  return `${seconds} seconde${seconds > 1 ? "s" : ""}`;
}

function SegmentedTimer({ seconds, paused }) {
  const activeSegments = paused ? 0 : seconds;
  const urgent = !paused && seconds <= 3;

  return (
    <div
      className={`sq-timer${paused ? " is-paused" : ""}${urgent ? " is-urgent" : ""}`}
      role="timer"
      aria-label={paused ? "Chronomètre en pause pendant la correction" : `${formatSeconds(seconds)} restante${seconds > 1 ? "s" : ""}`}
    >
      <div className="sq-timer-ring" aria-hidden="true">
        {Array.from({ length: TIMER_SEGMENTS }, (_, index) => (
          <span
            className={index < activeSegments ? "is-active" : ""}
            style={{ "--sq-segment": index }}
            key={index}
          />
        ))}
      </div>
      <div className="sq-timer-value" aria-hidden="true">
        <strong>{paused ? "—" : seconds}</strong>
        <small>{paused ? "pause" : "sec"}</small>
      </div>
    </div>
  );
}

function QuizHeader({ questionNumber, questionTotal, streak, xp, onQuit }) {
  return (
    <header className="sq-header">
      <button className="sq-quiet-button" type="button" onClick={onQuit}>
        <ArrowLeft weight="bold" aria-hidden="true" />
        <span>Quitter le quiz</span>
      </button>

      <div className="sq-brand" aria-label="Jet d’Encre Éditions">
        <img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions" />
      </div>

      <div className="sq-header-stats" aria-label="Progression actuelle">
        <span className="sq-header-progress">
          Question <strong>{questionNumber}</strong> / {questionTotal}
        </span>
        <span className="sq-stat sq-streak">
          <Fire weight="fill" aria-hidden="true" />
          <span><small>Série</small><strong>{streak}</strong></span>
        </span>
        <span className="sq-stat sq-xp">
          <Lightning weight="fill" aria-hidden="true" />
          <span><small>XP</small><strong>{xp.toLocaleString("fr-FR")}</strong></span>
        </span>
      </div>
    </header>
  );
}

function Answers({ question, feedback, onChoose }) {
  return (
    <div className="sq-answer-grid" role="group" aria-label="Choisis une réponse">
      {question.choices.map((choice, index) => {
        const isSelected = feedback?.selectedIndex === index;
        const isCorrect = Boolean(feedback) && question.correctIndex === index;
        const isWrong = Boolean(feedback) && isSelected && !isCorrect;
        const stateClass = isCorrect
          ? " is-correct"
          : isWrong
            ? " is-wrong"
            : feedback
              ? " is-muted"
              : "";

        return (
          <button
            className={`sq-answer${stateClass}`}
            type="button"
            disabled={Boolean(feedback)}
            onClick={() => onChoose(index)}
            aria-label={`Réponse ${ANSWER_LABELS[index]} : ${choice}`}
            key={`${question.id}-${index}`}
          >
            <span className="sq-answer-index" aria-hidden="true">{ANSWER_LABELS[index]}</span>
            <span className="sq-answer-copy">{choice}</span>
            <span className="sq-answer-icon" aria-hidden="true">
              {isCorrect ? (
                <CheckCircle weight="fill" />
              ) : isWrong ? (
                <XCircle weight="fill" />
              ) : (
                <ArrowRight weight="bold" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Feedback({ feedback, explanation, isLast, onContinue }) {
  const correct = feedback.isCorrect;

  return (
    <section
      className={`sq-feedback ${correct ? "is-correct" : "is-wrong"}`}
      aria-labelledby="sq-feedback-title"
      role="status"
    >
      <span className="sq-feedback-symbol" aria-hidden="true">
        {correct ? <CheckCircle weight="fill" /> : <XCircle weight="fill" />}
      </span>
      <div className="sq-feedback-copy">
        <strong id="sq-feedback-title">
          {correct
            ? `Bravo ! +${XP_PER_CORRECT} XP`
            : feedback.timedOut
              ? "Le temps est écoulé"
              : "Pas tout à fait"}
        </strong>
        <p>{explanation}</p>
      </div>
      <button className="sq-primary-button sq-continue" type="button" onClick={onContinue} autoFocus>
        {isLast ? "Voir mon score" : "Question suivante"}
        <ArrowRight weight="bold" aria-hidden="true" />
      </button>
    </section>
  );
}

function Results({ summary, questionTotal, onRestart, onQuit }) {
  const title = summary.scorePercent >= 80
    ? "Superbe parcours !"
    : summary.scorePercent >= 50
      ? "Bravo, tu progresses !"
      : "Chaque essai te fait avancer !";

  return (
    <main className="sq-results" aria-labelledby="sq-results-title">
      <section className="sq-results-card">
        <span className="sq-results-medal" aria-hidden="true"><Medal weight="duotone" /></span>
        <span className="sq-kicker"><Sparkle weight="fill" aria-hidden="true" /> Quiz terminé</span>
        <h1 id="sq-results-title" tabIndex="-1">{title}</h1>
        <p>Relis tes résultats, puis rejoue pour battre ton record.</p>

        <div className="sq-score" aria-label={`Score ${summary.scorePercent} pour cent`}>
          <strong>{summary.scorePercent}<small>%</small></strong>
          <span>ton score</span>
        </div>

        <div className="sq-result-stats">
          <article>
            <CheckCircle weight="duotone" aria-hidden="true" />
            <strong>{summary.correctCount} / {questionTotal}</strong>
            <span>bonnes réponses</span>
          </article>
          <article>
            <Lightning weight="duotone" aria-hidden="true" />
            <strong>+{summary.xpEarned} XP</strong>
            <span>gagnés</span>
          </article>
          <article>
            <Fire weight="duotone" aria-hidden="true" />
            <strong>{summary.bestStreak}</strong>
            <span>meilleure série</span>
          </article>
        </div>

        <div className="sq-result-actions">
          <button className="sq-primary-button" type="button" onClick={onRestart}>
            <ArrowCounterClockwise weight="bold" aria-hidden="true" /> Recommencer
          </button>
          <button className="sq-secondary-button" type="button" onClick={onQuit}>
            Quitter le quiz <ArrowRight weight="bold" aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  );
}

/**
 * Quiz autonome à intégrer dans l’espace élève.
 * Les données et le moteur restent séparés afin de faciliter leur remplacement
 * par une API sans modifier l’expérience visuelle.
 */
export default function StudentCultureQuiz({
  questions: suppliedQuestions = cultureQuizQuestions,
  questionCount = DEFAULT_QUESTION_COUNT,
  initialXp = 0,
  onXpEarned = NOOP,
  onComplete = NOOP,
  onRestart = NOOP,
  onQuit = NOOP,
}) {
  const questions = useMemo(
    () => suppliedQuestions.slice(0, Math.max(1, questionCount)),
    [questionCount, suppliedQuestions],
  );
  const [phase, setPhase] = useState("question");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_DURATION_SECONDS);
  const [earnedXp, setEarnedXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const startedAtRef = useRef(Date.now());
  const answerLockRef = useRef(false);
  const completionSentRef = useRef(false);
  const titleRef = useRef(null);

  const currentQuestion = questions[questionIndex];
  const questionTotal = questions.length;
  const summary = useMemo(
    () => calculateQuizSummary(questions, answers),
    [answers, questions],
  );

  const beginQuestion = useCallback((nextIndex) => {
    answerLockRef.current = false;
    startedAtRef.current = Date.now();
    setQuestionIndex(nextIndex);
    setFeedback(null);
    setTimeLeft(QUESTION_DURATION_SECONDS);
    setPhase("question");
    setAnnouncement(`Question ${nextIndex + 1} sur ${questionTotal}. ${QUESTION_DURATION_SECONDS} secondes.`);
  }, [questionTotal]);

  const submitAnswer = useCallback((selectedIndex, forcedTimeout = false) => {
    if (answerLockRef.current || phase !== "question" || !currentQuestion) return;

    const timedOut = forcedTimeout || isTimeExpired(startedAtRef.current, Date.now());
    const finalSelection = timedOut ? null : selectedIndex;
    const evaluation = evaluateAnswer(currentQuestion, finalSelection);
    const isCorrect = !timedOut && evaluation.isCorrect;
    const xp = isCorrect ? evaluation.xp : 0;

    answerLockRef.current = true;
    setAnswers((previous) => {
      const next = [...previous];
      next[questionIndex] = finalSelection;
      return next;
    });
    setFeedback({ selectedIndex: finalSelection, isCorrect, timedOut });
    setStreak((previous) => (isCorrect ? previous + 1 : 0));
    setPhase("feedback");

    if (xp > 0) {
      setEarnedXp((previous) => previous + xp);
      onXpEarned(xp, { questionId: currentQuestion.id, questionIndex });
    }

    const correctChoice = currentQuestion.choices[currentQuestion.correctIndex];
    setAnnouncement(
      isCorrect
        ? `Bonne réponse. ${XP_PER_CORRECT} points d’expérience gagnés.`
        : timedOut
          ? `Temps écoulé. La bonne réponse était ${correctChoice}.`
          : `Réponse incorrecte. La bonne réponse était ${correctChoice}.`,
    );
  }, [currentQuestion, onXpEarned, phase, questionIndex]);

  useEffect(() => {
    if (phase !== "question") return undefined;

    const updateTimer = () => {
      const remaining = getRemainingSeconds(startedAtRef.current, Date.now());
      setTimeLeft(remaining);
      if (remaining === 0) submitAnswer(null, true);
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 200);
    return () => window.clearInterval(interval);
  }, [phase, questionIndex, submitAnswer]);

  useEffect(() => {
    if (phase !== "question") return undefined;

    const handleKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const normalizedKey = event.key.toLowerCase();
      const selectedIndex = /^[1-4]$/.test(normalizedKey)
        ? Number(normalizedKey) - 1
        : ANSWER_LABELS.map((label) => label.toLowerCase()).indexOf(normalizedKey);
      if (selectedIndex >= 0 && selectedIndex < 4) {
        event.preventDefault();
        submitAnswer(selectedIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, submitAnswer]);

  useEffect(() => {
    if (phase === "question") titleRef.current?.focus();
  }, [phase, questionIndex]);

  useEffect(() => {
    if (phase !== "results" || completionSentRef.current) return;
    completionSentRef.current = true;
    onComplete(summary);
    window.requestAnimationFrame(() => {
      document.getElementById("sq-results-title")?.focus();
    });
  }, [onComplete, phase, summary]);

  const continueQuiz = useCallback(() => {
    if (questionIndex >= questionTotal - 1) {
      setPhase("results");
      setAnnouncement("Quiz terminé. Tes résultats sont affichés.");
      return;
    }
    beginQuestion(questionIndex + 1);
  }, [beginQuestion, questionIndex, questionTotal]);

  const restartQuiz = useCallback(() => {
    completionSentRef.current = false;
    setAnswers([]);
    setEarnedXp(0);
    setStreak(0);
    onRestart();
    beginQuestion(0);
  }, [beginQuestion, onRestart]);

  if (!questionTotal || !currentQuestion) {
    return (
      <section className="student-culture-quiz sq-empty" aria-labelledby="sq-empty-title">
        <h1 id="sq-empty-title">Le quiz se prépare</h1>
        <p>Les questions seront bientôt disponibles.</p>
        <button className="sq-secondary-button" type="button" onClick={onQuit}>Quitter</button>
      </section>
    );
  }

  if (phase === "results") {
    return (
      <div className="student-culture-quiz">
        <Results summary={summary} questionTotal={questionTotal} onRestart={restartQuiz} onQuit={onQuit} />
        <p className="sq-sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      </div>
    );
  }

  return (
    <div className="student-culture-quiz">
      <QuizHeader
        questionNumber={questionIndex + 1}
        questionTotal={questionTotal}
        streak={streak}
        xp={(Number(initialXp) || 0) + earnedXp}
        onQuit={onQuit}
      />

      <main className="sq-main" aria-labelledby="sq-question-title">
        <div
          className="sq-progress"
          role="progressbar"
          aria-label="Progression dans le quiz"
          aria-valuemin="1"
          aria-valuemax={questionTotal}
          aria-valuenow={questionIndex + 1}
          aria-valuetext={`Question ${questionIndex + 1} sur ${questionTotal}`}
        >
          <span style={{ width: `${((questionIndex + 1) / questionTotal) * 100}%` }} />
        </div>

        <section className="sq-question-card">
          <div className="sq-question-heading">
            <div className="sq-question-copy">
              <span className="sq-theme">{currentQuestion.theme}</span>
              <span className="sq-level">Niveau {currentQuestion.level}</span>
              <h1 id="sq-question-title" ref={titleRef} tabIndex="-1">{currentQuestion.prompt}</h1>
              {phase === "question" && (
                <p className="sq-hint">Choisis une réponse ou utilise les touches <kbd>1</kbd> à <kbd>4</kbd> (ou A à D).</p>
              )}
            </div>
            <SegmentedTimer seconds={timeLeft} paused={phase === "feedback"} />
          </div>

          <Answers question={currentQuestion} feedback={feedback} onChoose={submitAnswer} />

          {phase === "feedback" && feedback && (
            <Feedback
              feedback={feedback}
              explanation={currentQuestion.explanation}
              isLast={questionIndex === questionTotal - 1}
              onContinue={continueQuiz}
            />
          )}
        </section>
      </main>

      <p className="sq-sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </div>
  );
}
