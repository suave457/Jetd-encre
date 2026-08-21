# Design QA — Prototype Jet d’Encre

Date : 21 août 2026

Source visuelle : `reference/pencil-export-source-v3.html`

Implémentation vérifiée : prototype local Sites-ready

## Périmètre vérifié

- 84 écrans Pen intégrés, chacun une seule fois : 34 écrans Admin/Directeur déjà validés et 50 écrans du parcours Élève complet.
- 42 routes couvrant Administration, Direction, accès Élève, activation, onboarding et espace Élève authentifié.
- Deux formats prioritaires : ordinateur 1440 × 900 et tablette 1024 × 768.
- 78 contrôles P0 reconnus par l’injection : navigation, filtres, choix, actions, validations, formulaires et états.
- Les anciennes versions W01/W02 et les vagues W03–W05 sont intactes dans Pen.

## Comparaison visuelle

Les références Pen et les rendus navigateur ont été contrôlés ensemble, à la même route et dans le même format cible.

| Vue | Ordinateur | Tablette | Résultat |
|---|---:|---:|---|
| Admin — Prévisualisation éditoriale | 1440 × 900 | 1024 × 768 | Conforme |
| Directeur — Tableau de bord | 1440 × 900 | 1024 × 768 | Conforme |
| Élève — Tableau de bord | 1440 × 900 | — | Conforme |
| Élève — Médiathèque | — | 1024 × 768 | Conforme |

- Structure, grille, proportions, typographie, rayons, bordures et hiérarchie visuelle conformes aux frames Pen.
- Charte respectée : bleu nuit/or/ivoire pour la marque ; vert/safran/terre cuite pour l’apprentissage et l’action.
- Les écrans Élève gardent une tonalité accueillante et dynamique sans perdre la crédibilité éditoriale Jet d’Encre.
- Aucun débordement, chevauchement, placeholder ou élément coupé détecté dans les 26 nouvelles frames W06.

## Parcours Élève testés

- Accès : choix du profil → connexion Élève → tableau de bord.
- Récupération : mot de passe oublié → réinitialisation → retour connexion ; session expirée distincte d’une déconnexion volontaire.
- Activation : saisie, code invalide, accès déjà actif, code expiré et activation réussie.
- Onboarding : création du profil → école/classe → tableau de bord.
- Apprentissage : tableau de bord → manuels → lecteur enrichi → quiz → résultat → reprise de la leçon.
- Devoirs : liste → détail/réalisation → remise confirmée → retour tableau de bord.
- Médiathèque : filtres, lecture simulée et états visuels.
- Progression et récompenses : navigation croisée et continuité vers l’apprentissage.
- Profil/aide : avatar fictif, aide, copie d’un code de démonstration et déconnexion.
- Route Élève inconnue : ouverture de l’état système Élève, sans bascule vers Administration.

## Parcours Admin et Directeur conservés

- Admin : Bibliothèque, Studio, cycle éditorial, historique, publication et états système.
- Directeur : tableau de bord, classes, enseignants, affectations, activation, suivi d’utilisation et assistance.
- Les tests de contrat existants confirment que les actions ordinateur/tablette et les actifs historiques restent présents.

## Accessibilité et protection du mineur

- Textes W06 à 12 px minimum et cibles P0 à 44 × 44 px minimum dans les frames Pen.
- Navigation exposée comme liens avec `aria-current`; mutations comme boutons; filtres et choix avec états accessibles.
- Focus visible, annonce polie des changements de route, écrans inactifs `inert` et `aria-hidden`.
- Aucun nom complet, e-mail, date de naissance, code réel, blob audio ou donnée d’un autre élève dans `sessionStorage`.
- La déconnexion efface uniquement l’état d’authentification Élève et renvoie vers la connexion.
- Le sélecteur de rôles est explicitement présenté comme une démonstration.

## Vérifications de livraison

- Export/injection Pen : 84 frames et 78 contrôles P0.
- Contrat prototype : 7/7.
- Build production : réussi.
- Tests Sites : 4/4.
- Actifs locaux référencés : présence vérifiée automatiquement.
- Routes profondes vérifiées dans le navigateur MCP : connexion, activation, onboarding, lecteur, résultat, remise, profil et page Élève inconnue.
- Board d’architecture Pen `W06_ELV_14_FlowNavigation_11200x1000` : 25 paires, texte ≥ 12 px, CheckLayout 0.

## Correctif d’affichage ordinateur dans une fenêtre étroite

- Cas reproduit à 894 × 698 : la frame ordinateur était bien active, mais sa réduction à 62 % rendait les textes illisibles.
- Le mode `device=desktop` conserve désormais la frame 1440 × 900, privilégie l’ajustement en hauteur et autorise un défilement horizontal explicite si la fenêtre est plus étroite.
- À 894 × 698 : frame `W05_DIR_04_EnseignantsInvitations_D_1440x900`, zoom 0,7578, contenu 1091 × 682 ; la barre horizontale est réservée sans créer de second défilement vertical.
- À 1440 × 900 : zoom 1, aucun défilement, rendu Pen inchangé.
- À 1024 × 768 avec `device=tablet` : frame tablette inchangée, zoom 1.
- Contrat prototype après correction : 8/8 ; build et tests Sites : réussis.

## Limite documentée

Les données et médias restent fictifs. Les interactions simulent le produit sans backend, stockage permanent, micro réel ni données d’élèves réels. Les contrôles clavier, lecteur d’écran et zoom 200 % devront être repris sur l’application de production.

## Résultat

final result: passed
