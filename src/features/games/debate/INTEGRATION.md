# Projet DÉBAT dans Jet d’Encre

Le moteur autonome est embarqué dans `public/games/projet-debat/` puis chargé dans une iframe de même origine par `DebateGameFrame.jsx`. Cette isolation protège le site React et le jeu de leurs styles globaux homonymes.

La copie embarquée reprend le dossier `web/` du prototype Projet DÉBAT. Les adaptations propres à la plateforme doivent être préservées lors d’une future mise à jour :

- `app.js` sépare les préférences et la session locale des profils élève et enseignant et publie les événements de manche, de fin et d’XP ;
- `index.html` détecte le mode intégré ;
- `styles.css` masque l’en-tête redondant pendant la configuration et compacte les commandes pendant la partie.

`DebateGameFrame` crée un canal éphémère par iframe. Il n’accepte un message que si son origine, sa fenêtre source, son canal, sa version et son rôle correspondent tous à l’intégration ouverte. Un jeu Élève terminé rapporte 10 XP par manche, en un événement de récompense idempotent ; le mode Enseignant ne rapporte jamais d’XP.

Le raccordement au compte se fait avec les propriétés suivantes :

- `userId` : compte destinataire ;
- `onAwardXp(amount, metadata)` : récompense de fin avec `eventId`, `attemptId` et `source: "projet-debat"` ;
- `onRoundComplete(payload)` : score d’une manche ;
- `onComplete(payload)` : bilan final, vainqueur, totaux et nombre de manches.

Les routes d’entrée sont `#/eleve/jeux/debat` et `#/enseignant/jeux/debat`. Les contrôles dans `tests/debate-game-integration.test.mjs` vérifient la présence du moteur, les 74 cartes, les 18 thèmes et le cloisonnement des sessions.
