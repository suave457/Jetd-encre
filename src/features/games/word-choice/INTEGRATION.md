# Intégrer « Le Mot juste »

Le module reste volontairement autonome : il n’ajoute ni route, ni entrée au catalogue, ni mutation au store global.

```jsx
import { WordChoiceGame } from "./features/games/word-choice/index.js";

<WordChoiceGame
  currentXp={student.xp}
  onAwardXp={(amount, metadata) => {
    awardStudentXp({ amount, ...metadata, userId: student.id });
  }}
  onComplete={(attempt) => {
    recordQuizAttempt({ ...attempt, userId: student.id });
  }}
  onExit={() => navigate("/eleve/jeux")}
/>
```

## Contrat des événements

- `onAwardXp(amount, metadata)` est appelé immédiatement pour une bonne réponse, avec `amount = 10` et un `eventId` stable pour la tentative. Une réponse fausse ou hors délai ne déclenche jamais cet événement.
- `onComplete(attempt)` est appelé une seule fois sur l’écran de résultat. L’objet contient `attemptId`, `quizId: "mot-juste"`, `correctCount`, `questionCount`, `xpEarned`, `bestStreak`, `scorePercent`, `level`, `category` et le détail des réponses.
- `onExit()` ramène l’élève au catalogue. Sans fonction fournie, le module utilise `#/eleve/jeux`.

## Personnalisation sûre

- `itemBank` accepte une banque conforme au contrat de `wordChoiceData.js`.
- `questionLimit` vaut 10 par défaut.
- `illustrationSrc` permet de remplacer l’actif d’accueil sans toucher au composant.
- Les filtres de niveau et de compétence sont gérés dans le jeu ; la sélection est stable pour une tentative donnée.
