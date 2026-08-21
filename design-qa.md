# Design QA — Prototype Jet d’Encre

Date : 21 août 2026
Source visuelle : `reference/pencil-export-source-v2.html`
Implémentation vérifiée : prototype local, puis version Sites de production

## Périmètre vérifié

- 34 écrans Pen intégrés sans modifier les anciennes versions : 4 écrans Bibliothèque/Studio, 14 écrans du cycle éditorial Admin et 16 écrans Directeur.
- 17 routes de navigation couvrant les parcours Admin et Directeur.
- Deux formats prioritaires : ordinateur 1440 × 900 et tablette 1024 × 768.
- 43 contrôles P0 injectés : navigation, recherches, filtres, formulaires, états, validations et actions principales.

## Comparaison visuelle

Chaque comparaison a été réalisée à état et dimensions identiques, avec la référence Pen et le prototype navigable réunis dans la même image.

| Vue | Ordinateur | Tablette | Résultat |
|---|---:|---:|---|
| Admin — Prévisualisation éditoriale | 1440 × 900 | 1024 × 768 | Conforme |
| Directeur — Tableau de bord | 1440 × 900 | 1024 × 768 | Conforme |

- Structure, grille, proportions, typographie, rayons, bordures et hiérarchie visuelle conformes à Pen.
- Charte respectée : bleu nuit/or/ivoire pour la marque et la confiance ; vert fonctionnel pour les actions et états utiles.
- Aucun débordement, recadrage anormal, chevauchement ou contrôle hors écran observé.

## Parcours Admin testés

- Bibliothèque : recherche, onglets de statuts, filtres combinés, tri, pagination simulée et sélection multiple.
- Actions de contenu : créer, modifier, dupliquer, archiver, annuler et restaurer.
- Cycle éditorial complet : Studio → Prévisualisation → Revue → Planification → Publication réussie → Contenu public.
- Historique : comparaison entre deux versions distinctes et restauration sans perte de l’historique.
- Tablette : navigation compacte, actions Aperçu/Revue et filtres adaptés.
- États métier : brouillon, en revue, planifié, publié, archivé, refusé, droits insuffisants et erreur de publication.

## Parcours Directeur testés

- Tableau de bord et alertes opérationnelles.
- Classes : recherche, filtres, création et apparition de la nouvelle classe dans la liste.
- Enseignants : invitation et statut de confirmation.
- Affectations : confirmation et conflit prévu.
- Élèves : génération fictive de codes d’activation.
- Suivi d’utilisation : filtres période/classe/enseignant et états de synchronisation.
- Établissement et assistance : formulaire d’assistance et confirmation de ticket.
- Navigation ordinateur et rail tablette vérifiés sur l’ensemble des sections.

## Accessibilité et robustesse

- Libellés accessibles pour les actions icônes, rôles des boutons, champs et sélections.
- Cibles principales d’au moins 44 px, contrastes conformes à la charte et focus visibles.
- États jamais signalés uniquement par la couleur.
- Les écrans inactifs sont retirés de l’ordre de lecture et marqués `aria-hidden`.
- Console navigateur sans erreur ni avertissement bloquant sur les parcours testés.

## Vérifications de livraison

- Injection Pen : 34 frames et 43 contrôles P0 reconnus.
- Contrat prototype : 6/6.
- Build production : réussi.
- Tests Sites : 4/4.
- Actifs locaux référencés : présence vérifiée automatiquement.
- Le sélecteur « Mode prototype » est un ajout volontaire permettant de passer entre Administration et Direction sans modifier les écrans Pen.

## Limite documentée

Les données restent fictives et persistent uniquement pendant la session de démonstration. La pagination et les mutations simulent le comportement produit sans backend ni base de données.

## Résultat

final result: passed
