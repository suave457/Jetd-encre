export function App() {
  return (
    <main className="prototype-shell">
      <nav className="prototype-mode-switcher" aria-label="Changer de parcours de démonstration">
        <span>Mode prototype</span>
        <a href="#/admin/bibliotheque">Administration</a>
        <a href="#/directeur/tableau-de-bord">Direction</a>
      </nav>
      <iframe
        className="prototype-frame"
        src="/pencil-export.html"
        title="Prototype interactif — Jet d’Encre"
      />
    </main>
  );
}
