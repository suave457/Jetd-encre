import { useEffect, useRef, useState } from "react";
import { ArrowLeft, GameController, PresentationChart, Student } from "@phosphor-icons/react/ssr";
import {
  createDebateIntegrationChannel,
  DEBATE_EVENT_TYPES,
  normalizeDebateAudience,
  parseDebateIntegrationEvent,
} from "./debateIntegration.js";

const NOOP = () => {};

export default function DebateGameFrame({
  role = "eleve",
  userId = null,
  onAwardXp = NOOP,
  onRoundComplete = NOOP,
  onComplete = NOOP,
}) {
  const audience = normalizeDebateAudience(role);
  const teacher = audience === "enseignant";
  const iframeRef = useRef(null);
  const channelRef = useRef(null);
  const [integrationStatus, setIntegrationStatus] = useState("Chargement du jeu");
  if (!channelRef.current) channelRef.current = createDebateIntegrationChannel();

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const parsed = parseDebateIntegrationEvent(event.data, {
        audience,
        channel: channelRef.current,
      });
      if (!parsed) return;

      if (parsed.type === DEBATE_EVENT_TYPES.READY) {
        setIntegrationStatus("Jeu prêt");
      } else if (parsed.type === DEBATE_EVENT_TYPES.ROUND_COMPLETED) {
        onRoundComplete(parsed.payload);
      } else if (parsed.type === DEBATE_EVENT_TYPES.XP_EARNED) {
        onAwardXp(parsed.payload.amount, {
          ...parsed.payload,
          source: "projet-debat",
          userId,
        });
      } else if (parsed.type === DEBATE_EVENT_TYPES.GAME_COMPLETED) {
        setIntegrationStatus("Partie terminée");
        onComplete({ ...parsed.payload, userId });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [audience, onAwardXp, onComplete, onRoundComplete, userId]);

  return (
    <main className="debate-game-frame">
      <header className="debate-game-frame-header">
        <a className="debate-frame-back" href={`/${audience}/jeux`} onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          window.history.pushState({}, "", `/${audience}/jeux`);
          window.dispatchEvent(new Event("jde:navigate"));
        }}>
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
        ref={iframeRef}
        className="debate-game-iframe"
        src={`/games/projet-debat/index.html?embedded=1&audience=${audience}&channel=${encodeURIComponent(channelRef.current)}`}
        title={`Projet DÉBAT — ${teacher ? "préparation et projection professeur" : "jeu élève"}`}
        allow="autoplay"
        sandbox="allow-scripts allow-same-origin allow-modals allow-downloads"
      />
      <span className="sr-only" aria-live="polite"><GameController /> {integrationStatus}. Le jeu s’ouvre dans un cadre intégré à votre espace.</span>
    </main>
  );
}
