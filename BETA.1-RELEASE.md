# Jet d’Encre — livraison BETA.1

Date : 28 août 2026

Base sauvegardée : tag `BETA` au commit `4408537a45d0419d99189aa80195017e29273980`

Livraison : tag `BETA.1`

## Résultat

Cette version corrige les quatre constats de l’audit Codex Security :

1. les inventaires éditoriaux et médias privés exigent maintenant l’accès BETA avant toute requête D1 ;
2. les identifiants analytics sont pseudonymisés par HMAC avec séparation par domaine, les propriétés sont strictement bornées et les versions de contenu n’acceptent plus de texte libre ;
3. la réinitialisation efface toutes les clés Jet d’Encre connues dans `localStorage` et `sessionStorage`, sans toucher aux autres produits, et signale clairement tout échec du navigateur ;
4. les noms personnalisés du jeu Projet DÉBAT sont échappés avant insertion HTML et enregistrés dès la saisie.

## Configuration serveur obligatoire

Les écritures analytics exigent désormais deux secrets distincts :

- `BETA_WRITE_TOKEN` : contrôle l’accès privé et peut être renouvelé ;
- `BETA_EVENT_PSEUDONYM_KEY` : clé stable d’au moins 32 caractères, réservée à la pseudonymisation des identifiants.

`BETA_EVENT_PSEUDONYM_KEY` ne doit pas être dérivée du jeton d’accès ni changée lors d’une rotation de `BETA_WRITE_TOKEN`. Si elle manque ou est trop courte, l’API refuse les événements avec une erreur `503` avant toute lecture du corps ou écriture D1.

Avant d’utiliser de vraies données, vérifier la table `beta_events`. Si des événements antérieurs à BETA.1 y existent, les purger dans l’environnement de démonstration ou organiser une migration contrôlée : cette livraison ne réécrit pas automatiquement les données déjà stockées.

## Vérifications réalisées

- 136 tests automatisés réussis sur 136 ;
- construction Vite de production réussie ;
- 12 tests Worker et emballage Sites réussis après construction ;
- test navigateur du profil Élève et de la confirmation de réinitialisation réussi ;
- test navigateur d’injection avec le nom `<svg onload=alert(1)>` réussi : texte affiché littéralement, aucun élément `svg[onload]`, aucune boîte de dialogue et aucune erreur console ;
- contre-revue Codex Security sans contournement restant sur les lectures privées ou l’échappement HTML.

## Limites assumées

- aucune donnée D1 distante n’a été supprimée ou migrée automatiquement ;
- aucune valeur secrète n’est incluse dans le dépôt ;
- `BETA` reste la sauvegarde inchangée de la version précédente.
