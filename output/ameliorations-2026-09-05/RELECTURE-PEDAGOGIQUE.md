# Relecture pédagogique — Mots fléchés

**Date : 5 septembre 2026. Statut : relecture éditoriale par l’assistant, patch proposé hors du dépôt. Cette relecture ne constitue pas une validation par un enseignant ni une expérimentation auprès d’apprenants.**

## Intégration confirmée le 6 septembre 2026

La tâche principale a appliqué les 30 corrections proposées (45 champs). La définition d’OSMOSE a été ramenée à 114 caractères pour respecter l’espace du mini-dictionnaire, sans changer le phénomène défini. Le registre historique ci-dessous décrit la proposition initiale et reste conservé pour comparaison.

Un contrôle visuel complémentaire a ensuite conduit à raccourcir **57 indices de case**, avec des recoupements parmi les 30 entrées précédentes : ces nombres ne s’additionnent pas pour compter les mots modifiés. Exemples : « Entrelacement de fils » devient « Croiser des fils », « Représentation visuelle » devient « Photo ou dessin », « Petit contenant souple » devient « Petit sac ». Les indices complets et définitions restent disponibles à la sélection. Le registre exact est `INDICES-COURTS-APPLIQUES.json`, dans ce dossier. Quelques propositions y ont été ajustées par la tâche principale pour préserver le sens ou le rendu ; son champ `newCellClue` fait foi.

**Vérification finale :** 18 grilles × 3 formats (1024 × 768, 1366 × 768, 1440 × 900), soit 54 vues contrôlées dans le navigateur, sans texte d’indice sortant des cases et sans débordement de page détecté. Les captures scientifiques à 1024 et 1366 pixels ont été inspectées visuellement. Le contrôle mesure les limites réelles des glyphes par rapport à la case ; le dépassement de l’interligne interne seul n’est pas considéré comme une coupure. Résultats : `output/playwright/launch/clue-fit-results.json`.

Les 32 tests des grilles et les 321 tests du projet passent après intégration. Réponses, géométrie, identifiants et récompenses sont inchangés. Cette intégration est **locale, non déployée** ; la validation enseignante reste nécessaire, notamment pour la charge lexicale et scientifique du niveau difficile.

## 1. Résultat et périmètre

Les **222 entrées des 18 grilles ont été relues**, sans échantillonnage : 66 entrées « Facile », 78 « Normal » et 78 « Difficile ». La lecture a porté sur la réponse attendue, les deux indices, la définition, l’étiquette grammaticale et l’exemple de chaque entrée. **30 entrées appellent 45 ajustements éditoriaux proposés**. Les 192 autres entrées sont conservées dans ce patch ; « conservée » signifie absence de correction prioritaire relevée, pas certification sans réserve.

Les propositions corrigent notamment le genre d’AGAVE, l’étiquette de POTIER, des formulations peu naturelles, le chevauchement BUS/CAR et quelques approximations scientifiques. Aucun changement de réponse, d’identifiant, de coordonnées, de direction, de dimensions, de niveau, de version, de montant de récompense ou de version de récompense n’est proposé.

### Fichiers de données examinés

- `src/features/games/mots-fleches/motsFlechesData.js`
- `src/features/games/mots-fleches/motsFlechesExtraFacile.js`
- `src/features/games/mots-fleches/motsFlechesExtraNormal.js`
- `src/features/games/mots-fleches/motsFlechesExtraDifficile.js`

### Patch prêt à intégrer

- Emplacement hors du dépôt : `C:/Users/mouat/AppData/Local/Temp/jetdencre-pedagogie-20260905-7tXPjH/corrections-pedagogiques.patch`.
- SHA-256 : `ef98f51223ac43ebd4167c67b7242cb3e88753ae4d92db65eb6ebd25606cdc7d`.
- Le patch contient uniquement les champs `clue`, `cellClue`, `definition`, `example` et les deux corrections autorisées de `lexicalLabel`.
- L’applicabilité a été vérifiée sans appliquer le patch aux fichiers de données du dépôt. Les constats et formulations ci-dessous décrivent cette proposition, pas un déploiement.

## 2. Couverture des 18 grilles

| Grille | Intitulé | Niveau affiché | Entrées relues | Entrées à corriger |
|---|---|---|---:|---:|
| jet-encre-mf-facile-01 | À l’école et au quotidien | Facile — A1 | 11 | 0 |
| jet-encre-mf-facile-02 | Ma journée en classe | Facile — A1 | 11 | 6 |
| jet-encre-mf-facile-03 | Chez moi, en famille | Facile — A1 | 11 | 3 |
| jet-encre-mf-facile-04 | Au marché du quartier | Facile — A1 | 11 | 1 |
| jet-encre-mf-facile-05 | En ville et en chemin | Facile — A1 | 11 | 1 |
| jet-encre-mf-facile-06 | Paysages du Maroc | Facile — A1 | 11 | 2 |
| jet-encre-mf-normal-01 | Le Maroc en mots | Normal — A1–A2 | 13 | 0 |
| jet-encre-mf-normal-02 | Au marché et en cuisine | Normal — A1–A2 | 13 | 0 |
| jet-encre-mf-normal-03 | Du village au littoral | Normal — A1–A2 | 13 | 1 |
| jet-encre-mf-normal-04 | Les artisans de la médina | Normal — A1–A2 | 13 | 1 |
| jet-encre-mf-normal-05 | Musiques, fêtes et habits | Normal — A1–A2 | 13 | 0 |
| jet-encre-mf-normal-06 | Notre classe au Maroc | Normal — A1–A2 | 13 | 2 |
| jet-encre-mf-difficile-01 | Planète et citoyenneté | Difficile — A2–B1 | 13 | 2 |
| jet-encre-mf-difficile-02 | Le laboratoire des sciences | Difficile — A2–B1 | 13 | 6 |
| jet-encre-mf-difficile-03 | Citoyens en action | Difficile — A2–B1 | 13 | 1 |
| jet-encre-mf-difficile-04 | Équilibres de la planète | Difficile — A2–B1 | 13 | 1 |
| jet-encre-mf-difficile-05 | Patrimoine en partage | Difficile — A2–B1 | 13 | 2 |
| jet-encre-mf-difficile-06 | Médias et territoires | Difficile — A2–B1 | 13 | 1 |

## 3. Réponse cachée et cohérence des indices

Le composant affiche la définition et l’étiquette grammaticale avant la découverte du mot. L’exemple reste dans la branche conditionnée par `dictionaryEntry.found`, avec la réponse trouvée. Cette distinction a été contrôlée dans `src/features/games/mots-fleches/MotsFlechesGame.jsx` autour des lignes 779 à 801 ; le moteur `getDictionaryEntryState`, dans `motsFlechesEngine.js` à partir de la ligne 334, ne renvoie la réponse que si le mot est trouvé.

**Aucune occurrence littérale de la réponse attendue n’a été détectée dans ses propres champs d’aide visibles avant découverte**, sur les 222 entrées initiales puis sur les 222 entrées corrigées. La vérification automatique compare les mots complets après normalisation des accents et de la casse ; elle complète la lecture humaine de l’assistant. Elle ne prouve pas l’absence de toute ambiguïté sémantique ou de tout indice dérivationnel possible.

Un indice de mots fléchés n’est pas toujours univoque hors de sa grille : nombre de lettres et croisements participent à la résolution. Le cas BUS/CAR méritait une précision parce que les deux réponses de trois lettres figurent dans la même grille. SAPIN gagne un caractère distinctif, sans prétendre constituer à lui seul une clé de détermination botanique. SALON conserve un seul sens culturel cohérent avec son exemple.

## 4. Corrections proposées, textes exacts

Les anciennes formulations sont conservées ici pour faciliter la décision éditoriale. Les nouveaux textes ont été rédigés pour le jeu ; les sources citées servent à vérifier le sens ou le genre, sans reprise de leurs définitions mot à mot.

### 01. F02-04 — NOTE

Grille : `jet-encre-mf-facile-02`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

Définition allégée ; évite la coordination maladroite « Nombre ou appréciation donné ».

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Définition | Nombre ou appréciation donné après l’évaluation d’un exercice ou d’un travail. | Résultat chiffré attribué à un exercice ou à un travail scolaire. |

### 02. F02-05 — COPIE

Grille : `jet-encre-mf-facile-02`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

Supprime le sujet implicite incorrect de « après avoir écrit » rattaché à une feuille.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Définition | Feuille remise à l’enseignant après avoir écrit les réponses demandées. | Feuille sur laquelle un élève écrit ses réponses à un exercice ou à un devoir. |

### 03. F02-06 — OUI

Grille : `jet-encre-mf-facile-02`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

Donne une situation de réponse affirmative explicite, plutôt qu’une réponse ambiguë lors de l’appel.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Exemple | Nora répond oui quand la maîtresse l’appelle. | « Tu as ton cahier ? — Oui, il est dans mon sac. » |

### 04. F02-07 — MOT

Grille : `jet-encre-mf-facile-02`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

Évite de présenter un é comme un E sans préciser l’accent dans un exemple destiné aux débutants.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Exemple | Le mot « école » commence par la lettre E. | Je lis le mot « école » sur l’affiche. |

### 05. F02-09 — JEUDI

Grille : `jet-encre-mf-facile-02`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

L’ordre des jours ne dépend pas de l’emploi du temps scolaire.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Définition | Quatrième jour de la semaine scolaire, situé après mercredi et avant vendredi. | Jour de la semaine situé après mercredi et avant vendredi. |

### 06. F02-10 — MATIN

Grille : `jet-encre-mf-facile-02`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

La période ne commence pas au réveil particulier de chaque personne.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Définition | Première partie de la journée, depuis le réveil jusqu’au milieu du jour. | Partie de la journée comprise entre le lever du jour et midi. |

### 07. F03-03 — MAMAN

Grille : `jet-encre-mf-facile-03`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

Définit le mot familier recherché au lieu de donner seulement une définition du rôle parental.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Définition | Femme qui a un ou plusieurs enfants et prend soin d’eux au quotidien. | Mot familier employé pour parler de sa mère ou pour l’appeler. |

### 08. F03-04 — PAPA

Grille : `jet-encre-mf-facile-03`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

Même précision de registre que pour MAMAN.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Définition | Homme qui a un ou plusieurs enfants et prend soin d’eux au quotidien. | Mot familier employé pour parler de son père ou pour l’appeler. |

### 09. F03-05 — FILLE

Grille : `jet-encre-mf-facile-03`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

Remplace la formulation peu naturelle « Jeune personne féminine ».

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Indice dans la case | Jeune personne féminine | Féminin de « garçon » |

### 10. F04-10 — RAYON

Grille : `jet-encre-mf-facile-04`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

Indice compact et idiomatique à la place d’« Espace de produits en magasin ».

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Indice dans la case | Espace de produits en magasin | Partie d’un magasin |

### 11. F05-08 — BUS

Grille : `jet-encre-mf-facile-05`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

Distingue BUS de CAR, présents dans la même grille et comportant tous deux trois lettres.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Indice complet | Grand véhicule qui transporte plusieurs personnes | Grand véhicule de transport en commun qui circule surtout en ville |
| Indice dans la case | Transport collectif | Transport collectif en ville |
| Définition | Grand véhicule routier qui transporte de nombreux passagers sur un trajet régulier. | Grand véhicule qui transporte des passagers sur un trajet régulier, notamment en ville. |

### 12. F06-04 — TUBA

Grille : `jet-encre-mf-facile-06`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

Évite de laisser croire que le tube fournit de l’air lorsqu’il est entièrement immergé. Vérification : [entrée de dictionnaire correspondante](https://www.dictionnaire-academie.fr/article/A9T2606).

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Indice dans la case | Tube pour respirer dans l’eau | Tube pour respirer en surface |
| Définition | Tube courbé que le nageur garde en bouche pour respirer près de la surface. | Tube dont un bout reste hors de l’eau pour permettre au nageur de respirer. |

### 13. F06-09 — SAPIN

Grille : `jet-encre-mf-facile-06`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraFacile.js`.

Ajoute un trait distinctif utile face à d’autres arbres à aiguilles, notamment CÈDRE qui compte aussi cinq lettres. Vérification : [entrée de dictionnaire correspondante](https://www.larousse.fr/encyclopedie/divers/sapin/90048).

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Indice complet | Arbre vert portant des aiguilles | Arbre toujours vert aux aiguilles plates |
| Indice dans la case | Arbre vert à aiguilles | Arbre aux aiguilles plates |
| Définition | Grand arbre résineux dont les feuilles fines restent vertes toute l’année. | Arbre qui garde des aiguilles plates toute l’année et porte des cônes dressés vers le haut. |

### 14. N03-09 — AGAVE

Grille : `jet-encre-mf-normal-03`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraNormal.js`.

Corrige le genre grammatical et l’accord de l’article. Vérification : [entrée de dictionnaire correspondante](https://dictionnaire.lerobert.com/definition/agave).

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Étiquette grammaticale | nom féminin | nom masculin |
| Exemple | Une agave pousse au bord de la route côtière. | Un agave pousse au bord de la route côtière. |

### 15. N04-13 — POTIER

Grille : `jet-encre-mf-normal-04`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraNormal.js`.

La réponse POTIER est masculine ; la forme féminine est POTIÈRE, qui ne doit pas remplacer la réponse. Vérification : [entrée de dictionnaire correspondante](https://www.dictionnaire-academie.fr/article/A9P3684).

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Étiquette grammaticale | nom masculin ou féminin | nom masculin |

### 16. N06-05 — QUIZ

Grille : `jet-encre-mf-normal-06`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraNormal.js`.

La rapidité n’est pas une propriété nécessaire d’un quiz ; laisse la priorité à la compréhension.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Définition | Jeu ou exercice formé de questions brèves auxquelles il faut répondre rapidement. | Jeu ou exercice formé de questions courtes pour vérifier ou enrichir ses connaissances. |

### 17. N06-09 — FILLE

Grille : `jet-encre-mf-normal-06`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraNormal.js`.

Harmonise la formulation naturelle avec F03-05.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Indice dans la case | Jeune personne féminine | Féminin de « garçon » |

### 18. D03 — NATURE

Grille : `jet-encre-mf-difficile-01`. Fichier : `src/features/games/mots-fleches/motsFlechesData.js`.

Ne réduit plus la nature au seul monde vivant ; l’indice rejoint la définition déjà présente.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Indice complet | Monde vivant non fabriqué par les humains | Êtres vivants et éléments du monde non fabriqués par les humains |

### 19. D05 — OZONE

Grille : `jet-encre-mf-difficile-01`. Fichier : `src/features/games/mots-fleches/motsFlechesData.js`.

Précise où le rôle protecteur s’exerce, sans généraliser à l’ozone proche du sol. Vérification : [entrée de dictionnaire correspondante](https://www.dictionnaire-academie.fr/article/A9O1105).

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Exemple | L’ozone protège la Terre d’une partie des rayons UV. | Dans la haute atmosphère, l’ozone absorbe une partie des rayons UV. |

### 20. D02-02 — SPHÈRE

Grille : `jet-encre-mf-difficile-02`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraDifficile.js`.

Distingue la surface en trois dimensions d’une simple figure ronde et harmonise l’exemple géométrique. Vérification : [entrée de dictionnaire correspondante](https://www.larousse.fr/dictionnaires/college/boule/5138).

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Indice complet | Surface ronde autour d’un centre | Surface d’une boule |
| Indice dans la case | Surface parfaitement ronde | Surface d’une boule |
| Définition | Surface fermée dont tous les points sont à égale distance d’un même centre. | Surface d’une boule : tous ses points sont à la même distance de son centre. |
| Exemple | La balle forme une sphère presque parfaite. | La surface d’une balle a la forme d’une sphère. |

### 21. D02-04 — ION

Grille : `jet-encre-mf-difficile-02`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraDifficile.js`.

N’exclut plus les ions constitués de plusieurs atomes. Vérification : [entrée de dictionnaire correspondante](https://www.dictionnaire-academie.fr/article/A9I1992).

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Indice complet | Atome portant une charge électrique | Atome ou groupe d’atomes portant une charge électrique |
| Indice dans la case | Atome chargé | Particule chargée |
| Définition | Particule formée lorsqu’un atome gagne ou perd un ou plusieurs électrons. | Particule chargée électriquement, formée par un atome ou par un groupe d’atomes. |

### 22. D02-06 — OSMOSE

Grille : `jet-encre-mf-difficile-02`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraDifficile.js`.

Ajoute les propriétés essentielles de la membrane et le sens du passage, absents de la définition initiale. Vérification : [entrée de dictionnaire correspondante](https://www.dictionnaire-academie.fr/article/A9O0856).

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Définition | Déplacement d’un solvant à travers une membrane qui sépare deux solutions. | Passage de l’eau à travers une membrane qui retient certaines substances dissoutes, du milieu le moins concentré vers le plus concentré. |

### 23. D02-08 — BOBINE

Grille : `jet-encre-mf-difficile-02`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraDifficile.js`.

Précise la condition de fonctionnement et un matériau pertinent, au lieu de généraliser à tout objet métallique.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Exemple | La bobine attire un petit objet métallique pendant l’essai. | Quand le courant passe, la bobine attire un petit clou en fer. |

### 24. D02-10 — LASER

Grille : `jet-encre-mf-difficile-02`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraDifficile.js`.

Harmonise l’indice avec le sens d’appareil retenu dans la définition ; remplace « lumière étroite » par « faisceau ». Vérification : [entrée de dictionnaire correspondante](https://www.larousse.fr/dictionnaires/francais/laser/46344).

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Indice complet | Faisceau lumineux très concentré | Appareil qui produit un faisceau lumineux très étroit |
| Indice dans la case | Faisceau concentré | Produit un faisceau lumineux |
| Définition | Dispositif produisant une lumière étroite, intense et très régulière. | Appareil qui produit un faisceau lumineux très étroit et dirigé. |

### 25. D02-13 — VITESSES

Grille : `jet-encre-mf-difficile-02`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraDifficile.js`.

L’indice compact désigne désormais des rapports au pluriel, comme la réponse VITESSES.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Indice dans la case | Distance parcourue en un temps | Rapports distance-durée |

### 26. D03-07 — VOTER

Grille : `jet-encre-mf-difficile-03`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraDifficile.js`.

Remplace le mot plus difficile « suffrage » par des actions observables en classe.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Définition | Choisir un candidat ou une proposition au moyen d’un suffrage. | Exprimer son choix lors d’une décision collective, par exemple en déposant un bulletin ou en levant la main. |

### 27. D04-12 — DUNES

Grille : `jet-encre-mf-difficile-04`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraDifficile.js`.

Ne présente plus toutes les dunes comme nécessairement mobiles.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Définition | Reliefs mobiles constitués de grains accumulés dans les déserts ou sur les côtes. | Collines de sable formées par le vent, dans les déserts ou sur les côtes. |

### 28. D05-03 — CARTONS

Grille : `jet-encre-mf-difficile-05`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraDifficile.js`.

Garde le sens de matériau-support défini, plutôt que de suggérer le sens spécialisé de dessin préparatoire de fresque.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Exemple | Les artistes préparent leurs cartons avant de peindre la fresque. | Les élèves découpent des cartons pour préparer une maquette. |

### 29. D05-09 — SALON

Grille : `jet-encre-mf-difficile-05`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraDifficile.js`.

Retient le sens culturel de l’exemple « salon du livre », au lieu de mêler pièce d’habitation et manifestation. Vérification : [entrée de dictionnaire correspondante](https://www.dictionnaire-academie.fr/article/A9S0276).

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Indice complet | Pièce de réception ou lieu d’exposition culturelle | Exposition consacrée à un domaine, par exemple aux livres |
| Indice dans la case | Lieu de réception | Exposition spécialisée |
| Définition | Lieu où l’on reçoit des visiteurs ou organise une rencontre consacrée aux arts. | Manifestation où l’on présente au public des livres, des œuvres ou des produits autour d’un thème commun. |

### 30. D06-13 — ADRESSES

Grille : `jet-encre-mf-difficile-06`. Fichier : `src/features/games/mots-fleches/motsFlechesExtraDifficile.js`.

Ne rend plus obligatoires le numéro et le nom de voie, notamment pour les lieux ruraux.

| Champ | Texte initial | Texte proposé |
|---|---|---|
| Définition | Informations composées d’un nom de voie et d’un numéro pour situer des bâtiments. | Indications précises, comme le nom d’une rue, un numéro et une localité, qui permettent de trouver un lieu. |

## 5. Niveau et adaptation au public marocain

Les étiquettes A1, A1–A2 et A2–B1 sont celles du produit ; cette relecture n’établit pas une équivalence certifiée entre chaque mot et le CECRL. La difficulté dépend aussi de la connaissance du thème, du lexique des définitions, du nombre de croisements et des aides disponibles. Les niveaux et les réponses restent inchangés pour respecter le périmètre du lot.

### Facile — A1 : apprentissage accompagné à prévoir

Le vocabulaire de l’école, de la famille, des achats et des déplacements répond largement à des besoins quotidiens. SAPIN et TUBA ne sont pas nécessairement disponibles chez tous les débutants ; certains mots des aides, notamment « anse », « brindilles » et « gradué », peuvent eux-mêmes freiner la compréhension. Prévoir une présentation orale avec objet réel, geste ou visuel existant, puis une reformulation très courte. Le critère pédagogique est la compréhension du mot en contexte, sans course de vitesse.

Réemploi possible après une grille : en binôme, un élève décrit où se trouve un objet dans la classe ou à la maison ; son partenaire le nomme puis inverse les rôles. Pour le marché, faire demander un produit et sa quantité. Les élèves plus autonomes ajoutent une raison ou une précision ; ceux qui en ont besoin disposent d’amorces de phrases.

### Normal — A1–A2 : familiarité culturelle et maîtrise du français

Les références à Rabat, Salé, Fès, Casablanca, Essaouira, Agadir, à l’Atlas, à la médina, au souk et aux pratiques culturelles donnent des points d’appui locaux. Cette familiarité ne suffit pas à supposer le mot français connu. AGAVE, TRAME, ÉTOFFE, GNAOUA, NOUBA et ENCENS gagnent à être introduits au sein d’un thème, avec prononciation, sens retenu et mise en situation.

Une courte comparaison avec les langues déjà parlées en classe peut soutenir la compréhension, suivie d’une reformulation en français. Après la grille, demander de conseiller une visite ou de décrire un objet artisanal en deux phrases. Éviter de présenter une pratique culturelle ou familiale comme commune à tous les élèves.

### Difficile — A2–B1 : vigilance particulière sur la grille scientifique

La grille « Difficile 02 » mobilise PHYSICIENS, SPHÈRE, PISTONS, ION, ASTRES, OSMOSE, OPALE, BOBINE, IMAGE, LASER, AMPÈRES, FORCE et VITESSES. **OSMOSE, ION et AMPÈRES supposent des connaissances disciplinaires qui ne découlent pas d’un niveau A2–B1 en français.** Les corrections améliorent la précision, mais ne rendent pas ces notions accessibles sans préparation. La définition d’OSMOSE retient le cas de l’eau pour une première approche ; elle doit être présentée avec un schéma ou une explication adaptée, pas comme un exercice autonome de découverte scientifique.

BIOMASSE, ÉCOSYSTÈME, LAGUNES et CRÉDITS demandent aussi un contexte explicite. Avant de proposer ces grilles, faire reformuler quelques définitions sans montrer les réponses afin de repérer les prérequis manquants. Pour les thèmes environnement et citoyenneté, prolonger par un choix collectif argumenté : proposer une action utile à l’école, comparer deux propositions, puis voter et expliquer le choix. Ne pas attribuer un échec à une faiblesse en français lorsque l’obstacle est scientifique.

### Formes grammaticales à signaler

Certaines réponses sont au pluriel (notamment RECYCLAGES, PHYSICIENS, PISTONS, AMPÈRES, VITESSES, VENTS et DUNES), d’autres sont des formes conjuguées ou adjectivales comme ENTRE, LIBÉRÉ et RÉUNI. Ces formes sont conservées. « Recyclages » est moins usuel que l’emploi massif au singulier ; expliciter qu’il peut s’agir de plusieurs procédés ou opérations. Lors de la préparation, rappeler que la forme attendue suit l’indice et son nombre, sans changer les réponses ni les longueurs de la grille.

## 6. Vérifications réalisées et limites

| Vérification | Résultat |
|---|---|
| Lecture éditoriale de chaque entrée | 222/222, réparties sur 18/18 grilles |
| Décompte du patch | 30 entrées, 45 champs modifiés |
| Champs protégés | Comparaison profonde identique pour tous les champs hors des cinq champs éditoriaux autorisés |
| Géométrie après patch dans la copie temporaire | 18 modèles de grille valides |
| Identifiants de récompense | Identiques avant/après pour les 18 grilles avec le même élève de test |
| Réponse littérale dans les aides avant découverte | 0 occurrence détectée, corpus initial et proposé |
| Applicabilité du patch | Contrôle local réussi, sans application aux données du dépôt |
| Déploiement, validation enseignante, essai en classe | Non réalisés dans ce lot |

Ces vérifications bornées ne remplacent pas les tests globaux d’intégration menés séparément. Elles ne valident pas le rendu des nouveaux indices sur écran : contrôler après intégration les cases à 1440 × 900 et 1024 × 768, en particulier TUBA, SAPIN, BUS, LASER et VITESSES. Aucun audit exhaustif des liens documentaires ou des droits de publication n’a été mené ; les références ont été consultées sélectivement pour les points incertains. Aucun visuel n’a été généré.

Cette relecture de contenu n’est pas un scan de sécurité. Elle ne modifie pas le périmètre ni les conclusions des scans scellés ; les 84 chemins non examinés dans l’audit de sécurité restent non examinés.

### Validation enseignante attendue avant qualification éditoriale finale

1. Faire relire les 30 propositions, notamment les notions scientifiques et les deux étiquettes grammaticales corrigées.
2. Vérifier avec un groupe représentatif le lexique des indices, en distinguant difficulté linguistique, connaissance culturelle et prérequis disciplinaire.
3. Observer les hésitations sur les mots de même longueur et recueillir les reformulations orales ; adapter les aides de préparation si nécessaire.
4. Contrôler la lisibilité des indices en case après intégration, puis confirmer ou revoir les annonces de niveau dans un lot distinct si les essais le justifient.

## 7. Registre exhaustif des entrées relues

Chaque ligne ci-dessous correspond à une entrée effectivement relue. « Conservée » signifie qu’aucune modification prioritaire n’est proposée dans ce patch. Les remarques transversales de niveau ci-dessus restent applicables.

### jet-encre-mf-facile-01 — À l’école et au quotidien

11 entrées relues ; niveau affiché : Facile — A1.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| F01 | ÉCOLE | Conservée |
| F02 | LIVRE | Conservée |
| F03 | POMME | Conservée |
| F04 | CHAT | Conservée |
| F05 | TABLE | Conservée |
| F06 | AMI | Conservée |
| F07 | EAU | Conservée |
| F08 | SAC | Conservée |
| F09 | STYLO | Conservée |
| F10 | RÈGLE | Conservée |
| F11 | CRAIE | Conservée |

### jet-encre-mf-facile-02 — Ma journée en classe

11 entrées relues ; niveau affiché : Facile — A1.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| F02-01 | DOIGT | Conservée |
| F02-02 | GOMME | Conservée |
| F02-03 | ÉLÈVE | Conservée |
| F02-04 | NOTE | Correction proposée : définition |
| F02-05 | COPIE | Correction proposée : définition |
| F02-06 | OUI | Correction proposée : exemple |
| F02-07 | MOT | Correction proposée : exemple |
| F02-08 | JUS | Conservée |
| F02-09 | JEUDI | Correction proposée : définition |
| F02-10 | MATIN | Correction proposée : définition |
| F02-11 | SPORT | Conservée |

### jet-encre-mf-facile-03 — Chez moi, en famille

11 entrées relues ; niveau affiché : Facile — A1.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| F03-01 | PRISE | Conservée |
| F03-02 | SALON | Conservée |
| F03-03 | MAMAN | Correction proposée : définition |
| F03-04 | PAPA | Correction proposée : définition |
| F03-05 | FILLE | Correction proposée : indice dans la case |
| F03-06 | MUR | Conservée |
| F03-07 | LIT | Conservée |
| F03-08 | BOL | Conservée |
| F03-09 | BALAI | Conservée |
| F03-10 | ONCLE | Conservée |
| F03-11 | LAMPE | Conservée |

### jet-encre-mf-facile-04 — Au marché du quartier

11 entrées relues ; niveau affiché : Facile — A1.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| F04-01 | HERBE | Conservée |
| F04-02 | BOIRE | Conservée |
| F04-03 | OLIVE | Conservée |
| F04-04 | FÈVE | Conservée |
| F04-05 | SIROP | Conservée |
| F04-06 | SEL | Conservée |
| F04-07 | RIZ | Conservée |
| F04-08 | POT | Conservée |
| F04-09 | PESER | Conservée |
| F04-10 | RAYON | Correction proposée : indice dans la case |
| F04-11 | TASSE | Conservée |

### jet-encre-mf-facile-05 — En ville et en chemin

11 entrées relues ; niveau affiché : Facile — A1.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| F05-01 | ENTRE | Conservée |
| F05-02 | ROUTE | Conservée |
| F05-03 | VILLE | Conservée |
| F05-04 | TOUR | Conservée |
| F05-05 | RADIO | Conservée |
| F05-06 | AIR | Conservée |
| F05-07 | CAR | Conservée |
| F05-08 | BUS | Correction proposée : indice complet, indice dans la case, définition |
| F05-09 | BRUIT | Conservée |
| F05-10 | TRAIN | Conservée |
| F05-11 | STADE | Conservée |

### jet-encre-mf-facile-06 — Paysages du Maroc

11 entrées relues ; niveau affiché : Facile — A1.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| F06-01 | VENTS | Conservée |
| F06-02 | TERRE | Conservée |
| F06-03 | PLAGE | Conservée |
| F06-04 | TUBA | Correction proposée : indice dans la case, définition |
| F06-05 | VACHE | Conservée |
| F06-06 | NID | Conservée |
| F06-07 | LAC | Conservée |
| F06-08 | SUD | Conservée |
| F06-09 | SAPIN | Correction proposée : indice complet, indice dans la case, définition |
| F06-10 | ROCHE | Conservée |
| F06-11 | DUNES | Conservée |

### jet-encre-mf-normal-01 — Le Maroc en mots

13 entrées relues ; niveau affiché : Normal — A1–A2.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| N01 | MOSQUÉE | Conservée |
| N02 | ATLAS | Conservée |
| N03 | ARGAN | Conservée |
| N04 | OASIS | Conservée |
| N05 | TAJINE | Conservée |
| N06 | SOUK | Conservée |
| N07 | THÉ | Conservée |
| N08 | DÉSERT | Conservée |
| N09 | MÉDINA | Conservée |
| N10 | MAROC | Conservée |
| N11 | ROSE | Conservée |
| N12 | HAMMAM | Conservée |
| N13 | REMPART | Conservée |

### jet-encre-mf-normal-02 — Au marché et en cuisine

13 entrées relues ; niveau affiché : Normal — A1–A2.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| N02-01 | AMANDE | Conservée |
| N02-02 | MIXER | Conservée |
| N02-03 | BLÉ | Conservée |
| N02-04 | LÉGUME | Conservée |
| N02-05 | LAIT | Conservée |
| N02-06 | MENU | Conservée |
| N02-07 | MERGUEZ | Conservée |
| N02-08 | TARTINE | Conservée |
| N02-09 | SOUPE | Conservée |
| N02-10 | PÂTES | Conservée |
| N02-11 | MELON | Conservée |
| N02-12 | PIMENT | Conservée |
| N02-13 | CITRON | Conservée |

### jet-encre-mf-normal-03 — Du village au littoral

13 entrées relues ; niveau affiché : Normal — A1–A2.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| N03-01 | CHEMIN | Conservée |
| N03-02 | HÔTEL | Conservée |
| N03-03 | SOL | Conservée |
| N03-04 | PLAINE | Conservée |
| N03-05 | RIAD | Conservée |
| N03-06 | TAXI | Conservée |
| N03-07 | TERRAIN | Conservée |
| N03-08 | VILLAGE | Conservée |
| N03-09 | AGAVE | Correction proposée : étiquette grammaticale, exemple |
| N03-10 | VAGUE | Conservée |
| N03-11 | PISTE | Conservée |
| N03-12 | FLEUVE | Conservée |
| N03-13 | RIVAGE | Conservée |

### jet-encre-mf-normal-04 — Les artisans de la médina

13 entrées relues ; niveau affiché : Normal — A1–A2.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| N04-01 | ÉTOFFE | Conservée |
| N04-02 | TAPIS | Conservée |
| N04-03 | FIL | Conservée |
| N04-04 | CLOUER | Conservée |
| N04-05 | ÉTAL | Conservée |
| N04-06 | PEAU | Conservée |
| N04-07 | PEINTRE | Conservée |
| N04-08 | TISSAGE | Conservée |
| N04-09 | TENUE | Conservée |
| N04-10 | USINE | Conservée |
| N04-11 | TRAME | Conservée |
| N04-12 | BONNET | Conservée |
| N04-13 | POTIER | Correction proposée : étiquette grammaticale |

### jet-encre-mf-normal-05 — Musiques, fêtes et habits

13 entrées relues ; niveau affiché : Normal — A1–A2.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| N05-01 | GNAOUA | Conservée |
| N05-02 | NOUBA | Conservée |
| N05-03 | SON | Conservée |
| N05-04 | ENCENS | Conservée |
| N05-05 | FÊTE | Conservée |
| N05-06 | CAPE | Conservée |
| N05-07 | CRAVATE | Conservée |
| N05-08 | CHANTER | Conservée |
| N05-09 | PERLE | Conservée |
| N05-10 | LAINE | Conservée |
| N05-11 | STYLE | Conservée |
| N05-12 | SONNER | Conservée |
| N05-13 | SACHET | Conservée |

### jet-encre-mf-normal-06 — Notre classe au Maroc

13 entrées relues ; niveau affiché : Normal — A1–A2.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| N06-01 | CRAYON | Conservée |
| N06-02 | RADIO | Conservée |
| N06-03 | OUI | Conservée |
| N06-04 | DICTÉE | Conservée |
| N06-05 | QUIZ | Correction proposée : définition |
| N06-06 | TEST | Conservée |
| N06-07 | TRAVAIL | Conservée |
| N06-08 | ÉCOLIER | Conservée |
| N06-09 | FILLE | Correction proposée : indice dans la case |
| N06-10 | LOCAL | Conservée |
| N06-11 | BILLE | Conservée |
| N06-12 | ENFANT | Conservée |
| N06-13 | POÉSIE | Conservée |

### jet-encre-mf-difficile-01 — Planète et citoyenneté

13 entrées relues ; niveau affiché : Difficile — A2–B1.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| D01 | CLIMAT | Conservée |
| D02 | LÉGAL | Conservée |
| D03 | NATURE | Correction proposée : indice complet |
| D04 | DÉCHET | Conservée |
| D05 | OZONE | Correction proposée : exemple |
| D06 | OCÉAN | Conservée |
| D07 | DROIT | Conservée |
| D08 | DEVOIR | Conservée |
| D09 | TRI | Conservée |
| D10 | RESPECT | Conservée |
| D11 | ÉCOSYSTÈME | Conservée |
| D12 | PROPRETÉ | Conservée |
| D13 | ÉNERGIE | Conservée |

### jet-encre-mf-difficile-02 — Le laboratoire des sciences

13 entrées relues ; niveau affiché : Difficile — A2–B1.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| D02-01 | PHYSICIENS | Conservée |
| D02-02 | SPHÈRE | Correction proposée : indice complet, indice dans la case, définition, exemple |
| D02-03 | PISTONS | Conservée |
| D02-04 | ION | Correction proposée : indice complet, indice dans la case, définition |
| D02-05 | ASTRES | Conservée |
| D02-06 | OSMOSE | Correction proposée : définition |
| D02-07 | OPALE | Conservée |
| D02-08 | BOBINE | Correction proposée : exemple |
| D02-09 | IMAGE | Conservée |
| D02-10 | LASER | Correction proposée : indice complet, indice dans la case, définition |
| D02-11 | AMPÈRES | Conservée |
| D02-12 | FORCE | Conservée |
| D02-13 | VITESSES | Correction proposée : indice dans la case |

### jet-encre-mf-difficile-03 — Citoyens en action

13 entrées relues ; niveau affiché : Difficile — A2–B1.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| D03-01 | SOLIDARITÉ | Conservée |
| D03-02 | ESPRIT | Conservée |
| D03-03 | OPINION | Conservée |
| D03-04 | RUE | Conservée |
| D03-05 | LIBÉRÉ | Conservée |
| D03-06 | PUBLIC | Conservée |
| D03-07 | VOTER | Correction proposée : définition |
| D03-08 | LIBRES | Conservée |
| D03-09 | RÉUNI | Conservée |
| D03-10 | CIVIL | Conservée |
| D03-11 | USAGERS | Conservée |
| D03-12 | AGENT | Conservée |
| D03-13 | RÉPONSES | Conservée |

### jet-encre-mf-difficile-04 — Équilibres de la planète

13 entrées relues ; niveau affiché : Difficile — A2–B1.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| D04-01 | RECYCLAGES | Conservée |
| D04-02 | ARIDES | Conservée |
| D04-03 | PAYSAGE | Conservée |
| D04-04 | AXE | Conservée |
| D04-05 | PLUIES | Conservée |
| D04-06 | JUNGLE | Conservée |
| D04-07 | ÉPINE | Conservée |
| D04-08 | DANGER | Conservée |
| D04-09 | GALET | Conservée |
| D04-10 | VENTS | Conservée |
| D04-11 | LAGUNES | Conservée |
| D04-12 | DUNES | Correction proposée : définition |
| D04-13 | BIOMASSE | Conservée |

### jet-encre-mf-difficile-05 — Patrimoine en partage

13 entrées relues ; niveau affiché : Difficile — A2–B1.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| D05-01 | PATRIMOINE | Conservée |
| D05-02 | ÉPOQUE | Conservée |
| D05-03 | CARTONS | Correction proposée : exemple |
| D05-04 | OUI | Conservée |
| D05-05 | LANGUE | Conservée |
| D05-06 | CAFTAN | Conservée |
| D05-07 | SCÈNE | Conservée |
| D05-08 | POÉSIE | Conservée |
| D05-09 | SALON | Correction proposée : indice complet, indice dans la case, définition |
| D05-10 | CHANT | Conservée |
| D05-11 | LETTRES | Conservée |
| D05-12 | ÉCRIT | Conservée |
| D05-13 | FANTASIA | Conservée |

### jet-encre-mf-difficile-06 — Médias et territoires

13 entrées relues ; niveau affiché : Difficile — A2–B1.

| Identifiant | Réponse inchangée | Décision de cette relecture |
|---|---|---|
| D06-01 | TÉLÉVISION | Conservée |
| D06-02 | STUDIO | Conservée |
| D06-03 | CRÉDITS | Conservée |
| D06-04 | SON | Conservée |
| D06-05 | URBAIN | Conservée |
| D06-06 | CAMÉRA | Conservée |
| D06-07 | ICÔNE | Conservée |
| D06-08 | BILANS | Conservée |
| D06-09 | AVION | Conservée |
| D06-10 | LIGNE | Conservée |
| D06-11 | INDICES | Conservée |
| D06-12 | LOCAL | Conservée |
| D06-13 | ADRESSES | Correction proposée : définition |

## 8. Empreintes des sources relues

Empreintes SHA-256 calculées lors de la préparation du patch. Elles permettent de vérifier que l’intégration porte toujours sur le corpus relu.

| Fichier | SHA-256 |
|---|---|
| src/features/games/mots-fleches/motsFlechesData.js | `064572ea829546f12b5f66fba13d05661fa8cb6b28de80351e155e54dd59cbc4` |
| src/features/games/mots-fleches/motsFlechesExtraFacile.js | `dfa53d7732271d32737dad719fae42a5d9b4387c0b7811da35fbe3f6596c2b16` |
| src/features/games/mots-fleches/motsFlechesExtraNormal.js | `e31ec8312fc9074f1a9b4a8cfe0bf97f5cfc3fa894ccf33aedd375597fa3985b` |
| src/features/games/mots-fleches/motsFlechesExtraDifficile.js | `05048fd1a63e06f0cda01fc57c81dfe7aeedacf20c733d205ae93206def606e3` |
| src/features/games/mots-fleches/motsFlechesEngine.js | `7525cf3f76e06237d5d3a11fb5c3aa78ee4dea6eebf650b7093d5e687c5e5922` |
