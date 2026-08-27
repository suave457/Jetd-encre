# Banque de questions · contrat d’intégration

Ce module est autonome. Il n’écrit ni dans `App.jsx` ni dans le store de démonstration partagé tant que l’intégration globale n’est pas autorisée.

## Point d’entrée visuel

```jsx
import { QuestionBankAdmin } from "./features/question-bank/index.js";

<QuestionBankAdmin />
```

Le bandeau éditorial `assets/question-bank-preview-banner-1050.webp` est utilisé par défaut dans l’aperçu. Il peut être remplacé avec la propriété `artworkSrc`.

Le composant crée par défaut une banque persistée dans `localStorage` sous la clé `jde.question-bank.v1`. Il accepte aussi une banque injectée :

```jsx
import {
  createQuestionBank,
  QuestionBankAdmin,
} from "./features/question-bank/index.js";

const bank = createQuestionBank({ storage: window.localStorage });

<QuestionBankAdmin
  bank={bank}
  artworkSrc="/assets/question-bank-editorial.png"
  onQuestionsChange={(state) => console.info(state.questions.length)}
/>
```

## API métier

`createQuestionBank()` retourne :

- `getState()` : copie sérialisable de `{ schemaVersion, questions, updatedAt }` ;
- `getSnapshot()` et `subscribe(listener)` : contrat compatible avec `useSyncExternalStore` ;
- `actions.createQuestion(input)` ;
- `actions.updateQuestion(id, patch)` ;
- `actions.transitionQuestionStatus(id, status)` ;
- `actions.duplicateQuestion(id)` ;
- `actions.deleteQuestion(id)` ;
- `actions.replaceQuestions(collection)` ;
- `actions.reset()`.

Toutes les mutations retournent `{ ok: true, ... }` ou `{ ok: false, error, fieldErrors? }`. Les statuts utilisent des valeurs stables : `brouillon`, `valide`, `publie`.

## Raccordement au quiz

```js
import {
  selectPublishedQuizQuestions,
} from "./features/question-bank/index.js";

const quizQuestions = selectPublishedQuizQuestions(
  bank.getState().questions,
  { level: "5e AEP" },
);
```

Cette projection ne renvoie que les questions publiées et produit le format attendu par `CultureQuiz` : `id`, `theme`, `level`, `targetLevel`, `prompt`, `choices`, `correctIndex`, `explanation`.

Pour reprendre les douze questions historiques sans ressaisie :

```js
import { cultureQuizQuestions } from "../games/cultureQuizData.js";
import { fromCultureQuizQuestion } from "./index.js";

const imported = cultureQuizQuestions
  .map((question) => fromCultureQuizQuestion(question))
  .filter((result) => result.ok)
  .map((result) => result.item);
```

## Raccordement recommandé dans l’espace Admin

1. Ajouter une entrée « Questions » à la navigation Admin et une route `/admin/questions`.
2. Afficher `QuestionBankAdmin` pour cette page.
3. Une fois les travaux parallèles terminés, déplacer l’état de la banque dans `demoStoreCore.js` ou injecter une instance partagée créée au niveau d’`App`.
4. Alimenter le quiz via `selectPublishedQuizQuestions` et conserver `cultureQuizData.js` comme repli jusqu’à validation de la migration.

## Garanties éditoriales

- exactement quatre propositions distinctes ;
- une réponse correcte parmi les quatre ;
- question et explication de longueur contrôlée ;
- catégories, niveaux, difficultés et statuts fermés ;
- image facultative avec texte alternatif obligatoire ;
- cycle éditorial `brouillon → validé → publié` ;
- recherche sans sensibilité aux accents et filtres combinables ;
- données marocaines et situations FLE adaptées au primaire.
