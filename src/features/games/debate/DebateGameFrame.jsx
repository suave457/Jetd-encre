import { ArrowLeft, GameController, PresentationChart, Student } from "@phosphor-icons/react/ssr";

export default function DebateGameFrame({ role = "eleve" }) {
  const teacher = role === "enseignant";
  const audience = teacher ? "enseignant" : "eleve";

  return (
    <main className="debate-game-frame">
      <header className="debate-game-frame-header">
        <a className="debate-frame-back" href={`#/${role}/jeux`}>
          <ArrowLeft weight="bold" />
          <span>Mes jeux</span>
        </a>
        <div className="debate-frame-brand" aria-label="Projet DÉBAT par Jet d’Encre Éditions">
          <img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions" width="400" height="112" />
          <span>
            <small>JEU D’EXPRESSION ORALE</small>
            <strong>Projet DÉBAT</strong>
          </span>
        </div>
        <span className="debate-frame-role">
          {teacher ? <PresentationChart weight="fill" /> : <Student weight="fill" />}
          <span>{teacher ? "Mode professeur" : "Mode élève"}</span>
        </span>
      </header>
      <iframe
        className="debate-game-iframe"
        src={`/games/projet-debat/index.html?embedded=1&audience=${audience}`}
        title={`Projet DÉBAT — ${teacher ? "préparation et projection professeur" : "jeu élève"}`}
        allow="autoplay"
      />
      <span className="sr-only"><GameController /> Le jeu s’ouvre dans un cadre intégré à votre espace.</span>
    </main>
  );
}
