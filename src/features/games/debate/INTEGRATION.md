# Projet DÉBAT dans Jet d’Encre

Le moteur autonome est embarqué dans `public/games/projet-debat/` puis chargé dans une iframe de même origine par `DebateGameFrame.jsx`. Cette isolation protège le site React et le jeu de leurs styles globaux homonymes.

La copie embarquée reprend le dossier `web/` du prototype Projet DÉBAT. Trois fichiers contiennent toutefois des adaptations propres à la plateforme et doivent être préservés lors d’une future mise à jour :

- `app.js` sépare les préférences et la session locale des profils élève et enseignant ;
- `index.html` détecte le mode intégré ;
- `styles.css` masque l’en-tête redondant pendant la configuration et compacte les commandes pendant la partie.

Les routes d’entrée sont `#/eleve/jeux/debat` et `#/enseignant/jeux/debat`. Les contrôles dans `tests/debate-game-integration.test.mjs` vérifient la présence du moteur, les 74 cartes, les 18 thèmes et le cloisonnement des sessions.
