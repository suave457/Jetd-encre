# Jet d’Encre — version BETA

Date de préparation : 27 août 2026
Positionnement : préproduction fonctionnelle, sans IA et sans données réelles d’enfants.

## Sauvegarde ALPHA

La version publique validée avant ces travaux est conservée par :

- le tag Git `ALPHA` ;
- l’archive `sauvegardes/Jet-dEncre-ALPHA-2026-08-27.zip` ;
- le bundle Git `sauvegardes/Jet-dEncre-ALPHA-2026-08-27.bundle`.

Ces sauvegardes ne contiennent pas les documents d’audit non validés qui se trouvaient déjà hors du suivi Git.

## Ce que BETA ajoute

### Administration

- cockpit « À traiter aujourd’hui » avec actions persistantes ;
- trois KPI décisionnels définis et calculés : activation utile à J+7, valeur pédagogique hebdomadaire et progression comparable à 28 jours ;
- centre d’analyses avec période, périmètre, échantillon, fraîcheur, export et qualité des données ;
- import CSV avec séparateurs français, vérification, détection des doublons, aperçu, application atomique et retour arrière ;
- bibliothèque avec sélection multiple, actions groupées, versionnement automatique et restauration non destructive ;
- référentiels partagés pour niveaux AEP, unités, domaines, microcompétences, publics et formats ;
- médiathèque de contrôle des droits, descriptions accessibles, transcriptions et sous-titres ;
- nouveau studio de contenu alimenté par les référentiels partagés et bloquant l’envoi en validation tant que la fiche n’est pas prête ;
- journal local des mutations sensibles.

### Enseignants

- tableau de bord recentré sur les élèves actifs, remises attendues et corrections ;
- centre de priorités expliquant chaque alerte et proposant une action ;
- décisions marquées comme traitées et conservées après rechargement.

### Direction

- tableau de bord unifié sur le périmètre Al Manar : 654 élèves, 618 activés, 18 classes et 42 enseignants ;
- indicateurs pédagogiques avec numérateurs et dénominateurs ;
- centre d’actions calculant classes sans enseignant, activation sous 85 %, usage sous 40 % et accompagnement d’équipe.

### Données et sécurité

- taxonomie AEP–CECRL centralisée, sans prétendre à une équivalence automatique ;
- liste blanche d’événements analytiques excluant noms, courriels, réponses libres, messages, audio, localisation et codes d’activation ;
- contrôles de qualité sur doublons, dates futures, références orphelines, cohérence et fraîcheur ;
- schéma D1 versionné par migration ;
- stockage privé R2 préparé pour les médias ;
- Worker API séparé du repli de navigation ;
- écritures serveur désactivées tant qu’un secret BETA privé n’est pas configuré ;
- politique de sécurité renforcée, notamment pour les scripts et l’encadrement des pages.

## État des données

Les données visibles dans BETA sont fictives et clairement signalées. Les calculs sont fonctionnels, mais ne doivent pas servir à une décision réelle avant raccordement des sources métier.

Le stockage local assure les démonstrations et les tests de parcours. La base D1 et le bucket R2 sont préparés pour l’hébergement, mais les écritures partagées nécessitent une authentification externe privée. Les comptes de démonstration ne doivent jamais devenir des comptes d’administration d’une BETA publique.

## Dépendances restant à externaliser ou raccorder

- fournisseur d’identité et gestion réelle des comptes ;
- données établissements, classes, utilisateurs et licences ;
- collecte d’événements métier côté serveur ;
- service de messagerie et relances ;
- versement réel des fichiers dans R2 avec secret d’écriture privé ;
- politique de conservation, consentement et procédures d’exercice des droits ;
- déploiement public de BETA, après autorisation explicite.

## Vérifications de livraison

- tests unitaires des données, KPI, imports, versions, stockage et Worker ;
- compilation de production ;
- navigation manuelle Admin, Enseignant et Direction ;
- import, application et annulation testés ;
- version d’un contenu créée et restaurée ;
- fiche média rendue conforme puis remise dans son état initial ;
- référentiel désactivé puis réactivé ;
- cockpit vérifié en largeur mobile sans débordement horizontal ;
- absence d’erreur dans un nouvel onglet de navigation.
