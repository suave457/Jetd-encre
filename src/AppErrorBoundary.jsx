import { Component } from "react";

export class AppErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (!this.state.hasError) return this.props.children;
    return <main className="app-recovery" role="alert">
      <span className="eyebrow">Jet d’Encre</span>
      <h1>Cette page n’a pas pu s’afficher.</h1>
      <p>Vous pouvez réessayer ou revenir à l’accueil. Les données enregistrées ne sont pas effacées par ces boutons.</p>
      <p>La dernière action peut ne pas avoir été sauvegardée : vérifiez-la après avoir rouvert la page.</p>
      <div className="hero-actions">
        <button className="button button-dark" onClick={() => window.location.reload()}>Réessayer</button>
        <a className="button button-light" href="/">Retour à l’accueil</a>
      </div>
    </main>;
  }
}

