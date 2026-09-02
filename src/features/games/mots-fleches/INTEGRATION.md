# Intégrer « Mots fléchés »

Le jeu expose une collection de **18 grilles de magazine**, soit 6 grilles par niveau : **Facile** (+20 XP par grille), **Normal** (+35 XP) et **Difficile** (+50 XP). Les trois niveaux restent visibles en permanence et des commandes précédent/suivant permettent de parcourir les six grilles du niveau choisi. Les définitions sont placées dans les cases-indices, avec des flèches uniquement vers la droite ou vers le bas.

```jsx
<MotsFlechesGame
  currentXp={student.xp}
  studentId={student.id}
  studentName={student.name.split(" ")[0]}
  awardHistory={quizAwards}
  onAwardXp={(amount, metadata) => awardStudentXp({
    userId: student.id,
    amount,
    ...metadata,
  })}
  onComplete={(summary) => recordQuizAttempt({
    userId: student.id,
    quizId: "mots-fleches",
    experienceType: "arrowword-grid",
    ...summary,
  })}
  onExit={() => navigate("/eleve/jeux")}
/>
```

## Récompense

L’identifiant de récompense associe l’élève, la grille et sa version. Une grille déjà réussie reste rejouable, mais ne crédite jamais une seconde fois les XP. Les aides ne réduisent pas la récompense : elles sont seulement enregistrées comme niveau d’accompagnement.

La collection complète représente **630 XP** : 120 XP en Facile, 210 XP en Normal et 300 XP en Difficile.

## Saisie

- Un clic sur une définition sélectionne tout le mot.
- Un clic répété sur une intersection alterne horizontal et vertical.
- Une lettre saisie avance automatiquement.
- Retour arrière efface et recule ; les flèches du clavier déplacent le focus.
- Une lettre non accentuée est acceptée et affichée avec l’accent correct lorsqu’elle correspond à la solution.
- La progression est sauvegardée localement par élève et par grille.
