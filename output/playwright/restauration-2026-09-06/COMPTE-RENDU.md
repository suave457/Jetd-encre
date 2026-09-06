# Jet d’Encre — restauration du design et des parcours

## Livraison du 6 septembre 2026

Les corrections sont publiées sur le site de test existant : https://jetdencre-test.mouataz-pro.workers.dev/connexion.

- Source : `cd4051e0e199fb1004a609000cc1bd2ecbd300ab`.
- Version Cloudflare : `7bf35112-b45b-45e5-9205-71bd05493752`.
- Référence visuelle comparée : version GitHub `5ce85b8`, captures du dossier `../comparaison-2026-09-06/`.
- Aucun changement de base, de compte, de privilège, de secret ou de fournisseur. Aucun push GitHub effectué dans cette intervention.

## Ce qui a été corrigé

| Constat | Correction livrée |
| --- | --- |
| Le parcours réel ressemblait à un autre site | Menus latéraux, logo, typographies, couleurs et structure des cartes réutilisés depuis le design validé. |
| Choix des profils encombré et connexion indirecte | Carte compacte avec cinq profils ; élève, parent, enseignant et administrateur ouvrent la connexion sécurisée sans second bouton intermédiaire. |
| Accueil scolaire réduit à un écran technique | Accueils élève, parent et enseignant utilisant les devoirs et résultats autorisés du serveur. |
| Administration détachée de la charte | Même cadre visuel ; accueil avec compteurs réels, liste des écoles et accès à préparer. |
| Ressources, jeux et travaux dispersés | Devoirs, médiathèque, classes/enfants et progrès accessibles dans le même espace. Le jeu de mots fléchés conserve son écran plein format et revient au catalogue. |
| Risque de perdre le contexte d’un travail | Liens vers le bon devoir, filtres par classe/enfant, conservation des brouillons entre rubriques et avec le bouton Actualiser. |
| Livre repoussé sous le bas de l’écran | En-tête de lecture compact ; page entière visible dès l’ouverture sur ordinateur et tablette. Mode Largeur et navigation du PDF conservés. |
| Navigation publique trop chargée | Cinq entrées principales ; informations secondaires regroupées dans le pied de page ; guide présenté en rubriques dépliables. |

## Vérifications réalisées

- Compilation finale réussie ; **327 tests automatisés sur 327 réussis** ; audit des dépendances sans vulnérabilité connue signalée.
- Comparaison visuelle avec les captures de la version Git validée : choix des profils et accueil élève. Contrôle des espaces public, administrateur, élève, enseignant et parent à 1440 × 900 et 1024 × 768, sans débordement horizontal observé.
- Base locale réelle : navigation administration/écoles, recherche, formulaire ouvert puis annulé sans créer de compte ; données affichées cohérentes avec l’API. Accès administrateur refusé aux profils scolaires.
- Brouillon enseignant conservé après navigation, Retour et Actualiser ; les liens explicites vers les travaux rouvrent le devoir, tout en permettant de retrouver le brouillon en rouvrant le formulaire. Aucune nouvelle publication pendant ces essais.
- Lecture locale : PDF chargé, suivante/précédente, page 3 retrouvée après rechargement, mode Largeur et défilement interne ; audio/vidéo chargés. La reprise du PDF reste propre au compte et à cet appareil, séparée des données de démonstration.
- **Connexion Auth0 réelle après publication** : Salma, Lina et parent de Lina, uniquement les comptes fictifs existants. Les trois retrouvent le devoir Jasmin et le retour 18/20. Enseignante : 1 devoir, 2 remises, 1 correction ; élève et parent : 1/1/1.
- Élève en ligne : ouverture du jeu et retour au catalogue, **20 XP et 1 grille conservés** ; livre ouvert dans la médiathèque connectée et page 3 conservée après rechargement. Parent : uniquement le résumé de son enfant, 20 XP et 1 grille.
- Accès administrateur refusé aux trois comptes scolaires (403). Déconnexions vérifiées (401) et navigateur de test fermé ; session propriétaire non manipulée. Console finale de l’application sans erreur. Un favicon Auth0 absent a été observé pendant la connexion, sans blocage.
- Contrôle HTTP : 21 pages répondent 200 et restent non indexables ; serveur prêt ; API privées anonymes refusées ; URL de jeu inconnue en 404 ; robots toujours fermés à l’indexation.
- Lecture de contrôle D1 : compteurs conformes au dernier état connu, 3 écoles, 18 utilisateurs, 2 devoirs, 4 remises, 2 corrections, 1 récompense de jeu et 20 XP. Les 10 profils Jasmin sont actifs, avec **zéro session Jasmin active** après les tests.

## Limites à conserver clairement

Il s’agit du site de test, pas d’un lancement auprès de vraies écoles. L’espace Direction connecté n’est pas encore disponible. Les outils éditoriaux, les manuels interactifs et les autres modules non reliés au serveur restent dans une démonstration explicitement séparée ; leurs chiffres ne sont pas présentés comme des résultats réels.

L’administration authentifiée a été vérifiée avec la base locale, pas avec le compte propriétaire sur le Worker dans cette intervention. Les essais tablette utilisent un navigateur à ces dimensions, pas une tablette physique. Ils ne constituent pas une certification d’accessibilité, un nouveau test de charge ou un audit de sécurité exhaustif. Les réserves précédentes de lancement, notamment les mentions légales réelles, les droits de publication et le pilote école, restent applicables.

Les captures et journaux détaillés restent dans ce dossier local. Les résultats HTTP et les compteurs agrégés sont consignés dans `live-http.json` et `live-counts.json`.
