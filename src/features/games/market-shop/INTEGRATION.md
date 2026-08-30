# Intégrer « Le Souk des mots »

Le module propose trois paliers progressifs et douze missions : **Découverte**, **Consolidation** et **Défi**. Il réutilise le système XP de la plateforme et reconstruit la progression à partir des récompenses persistantes.

```jsx
import { MarketShopGame } from "./features/games/market-shop/index.js";

<MarketShopGame
  currentXp={student.xp}
  studentId={student.id}
  awardHistory={quizAwards}
  onAwardXp={(amount, metadata) => {
    return awardStudentXp({ amount, ...metadata, userId: student.id });
  }}
  onComplete={(tierSummary) => {
    return recordQuizAttempt({
      ...tierSummary,
      userId: student.id,
      quizId: "souk-des-mots",
      experienceType: "market-tier",
      fragmentId: tierSummary.tierId,
      fragmentLabel: tierSummary.tierLabel,
    });
  }}
  onExit={() => navigate("/eleve/jeux")}
/>
```

## Progression

- Découverte est disponible immédiatement.
- Consolidation s’ouvre après les quatre maîtrises de Découverte.
- Défi s’ouvre après les quatre maîtrises de Consolidation.
- Une réussite avec aide débloque la suite ; le bonus d’autonomie n’est jamais obligatoire.
- `awardHistory` doit contenir les récompenses du profil. Le module reconnaît `questionId` et les anciens identifiants stables `eventId`.
- Chaque carte de palier affiche l’état verrouillé, disponible, en cours ou terminé et reprend à la première mission non maîtrisée.

## Récompenses

- Première maîtrise d’une mission-version : **10 XP**.
- Première réussite autonome : **5 XP** supplémentaires.
- Une correction chiffrée au troisième échec compte comme aide guidée.
- Un rejeu ne repaie jamais une récompense acquise ; il affiche **Révision réussie**.
- Maximum : **60 XP par palier**, soit **180 XP** pour les douze missions.

Les claims `mastery` et `autonomy` utilisent un identifiant stable par élève, mission, version et type. `metadata.questionId` contient l’identifiant de mission pour permettre la reprise sur un autre appareil.

## Fin d’un palier

`onComplete(tierSummary)` est appelé une seule fois lorsque les quatre missions du palier sont maîtrisées. Le bilan contient notamment `attemptId`, `gameId`, `experienceType`, `tierId`, `tierLabel`, `completedMissionCount`, `missionCount`, `withoutHelpCount`, `xpEarned`, `maxXp`, le badge et le détail des missions.

Les actifs attendus se trouvent sous `/assets/games/market-shop/`. Les chemins de la scène, de l’étal et de Plumi restent remplaçables avec la propriété `assets` (`vendor`, `stall`, `mascot`).

## Tableau enseignant

La route `/enseignant/analyses/souk-des-mots` affiche le suivi pédagogique du jeu. Le composant `TeacherMarketDashboard` reçoit `quizAwards` et `quizAttempts` :

- les maîtrises sont reconstruites mission par mission à partir des récompenses stables ;
- une récompense `autonomy` prouve une réussite sans indice ;
- une maîtrise sans récompense d’autonomie est présentée comme une réussite avec indice ;
- la dernière activité utilise la date la plus récente parmi les récompenses et les bilans de palier ;
- une ancienne tentative qui prouve la maîtrise sans détailler les récompenses porte la mention « donnée partielle ».

Le prototype mélange une cohorte fictive clairement signalée et les données locales réelles de Lina, qui restent prioritaires. Les filtres, la recherche, l’export CSV et les fiches latérales sont calculés localement. Aucune réponse brute, phrase choisie ou donnée audio n’est exposée à l’enseignant.

Le statut « À accompagner » repose uniquement sur deux signaux vérifiables : au moins deux maîtrises dont la moitié avec indice, ou un parcours commencé sans activité depuis sept jours. Il constitue une piste d’observation et jamais une note automatique.
