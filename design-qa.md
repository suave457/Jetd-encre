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
- Chaque changement d’écran replace automatiquement le canevas à gauche pour ne jamais ouvrir une page sur une zone tronquée.
- Le sélecteur de parcours reste compact sans fusionner ni tronquer les trois rôles.
- À 1440 × 900 : zoom 1, aucun défilement, rendu Pen inchangé.
- À 1024 × 768 avec `device=tablet` : frame tablette inchangée, zoom 1.
- Contrat prototype après correction : 8/8 ; build et tests Sites : réussis.

## Limite documentée

Les données et médias restent fictifs. Les interactions simulent le produit sans backend, stockage permanent, micro réel ni données d’élèves réels. Les contrôles clavier, lecteur d’écran et zoom 200 % devront être repris sur l’application de production.

## Résultat

historical result: passed

---

# Design QA — Version responsive presque complète

Date : 24 août 2026

## Sources et captures comparées

- Landing approuvée : `C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/audit-captures-2026-08-18/01-landing-page.png/vEZpN.png` — source 1440 × 7530, état initial public.
- Référence Élève : `C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/figma-export/renders/studentDashboard.png` — 1440 × 1024, tableau de bord.
- Référence Enseignant : `C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/figma-export/renders/teacherDashboard.png` — 1440 × 1024, tableau de bord.
- Référence Direction : `C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/figma-export/renders/directorDashboard.png` — 1440 × 1024, vue d’ensemble.
- Référence Administration : `C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/figma-export/renders/adminDashboard.png` — 1440 × 1024, pilotage.
- Capture d’implémentation landing : `qa/responsive-landing-1366x768.png` — viewport 1366 × 768, état initial.
- Capture d’implémentation Admin : `qa/responsive-admin-1366x768.png` — viewport 1366 × 768, bibliothèque sans filtre.

## Historique de comparaison

1. La landing approuvée et l’implémentation ont été ouvertes ensemble. La composition, l’ordre des sections, l’énergie enfant-friendly, les motifs marocains, les surfaces ivoire, le vert pédagogique et les accents safran sont conservés. Le logo temporaire de la référence est remplacé par le logo officiel Jet d’Encre.
2. Les tableaux de bord Élève, Enseignant, Direction et Admin ont été comparés aux rendus Pen. La coque bleu nuit, la hiérarchie des cartes, les états or/vert et la densité éditoriale restent cohérents, sans réduction globale du canevas.
3. Premier contrôle à 1280 × 640 : la barre latérale possédait un défilement interne en plus du défilement de page. Correctif appliqué avec une variante de hauteur compacte ; contrôle suivant : `scrollHeight === clientHeight` pour la barre latérale et aucun défilement horizontal.
4. Les écrans ont ensuite été contrôlés à 1366 × 768, 1366 × 650, 1280 × 640 et 1024 × 768. Résultat : aucun chevauchement, aucune découpe du bas et `scrollWidth <= clientWidth + 1` sur chaque route testée.

## Parcours et interactions vérifiés

- Landing : navigation de section, CTA activation, connexion, FAQ et pied de page.
- Portail : quatre profils visibles et accessibles — Élève, Enseignant, Direction, Administration.
- Connexion : formulaire et entrée dans chaque espace de démonstration.
- Élève : accueil, manuel avec navigation de leçons, devoirs avec onglets, médiathèque, progrès et récompenses.
- Enseignant : tableau de bord, classes, élèves, devoirs, création en quatre étapes, ressources et analyses.
- Direction : vue d’ensemble, classes, enseignants, activations, utilisation et rapports.
- Administration : pilotage, établissements, utilisateurs, licences, bibliothèque, filtres, studio drag-and-drop, support et sécurité.
- 33 routes contrôlées dans le navigateur ; toutes affichent leur écran attendu, aucune ne produit l’état introuvable et aucune n’introduit de débordement horizontal.
- Filtre « Publié » de la bibliothèque : 3 contenus attendus sur 6.
- Console navigateur : 0 erreur, 0 avertissement.

## Accessibilité et résilience

- Liens et boutons sémantiques, états actifs avec `aria-current`, onglets avec `aria-selected`, accordéon avec `aria-expanded`.
- Indicateurs de focus visibles, textes alternatifs sur les images informatives et respect de `prefers-reduced-motion`.
- Cibles principales de 44 px minimum.
- Mise en page à largeur fluide ; aucun `scale()` global.
- Un seul défilement de page ; la barre latérale compacte ne défile plus sur les portables peu hauts.
- Tableaux conservés dans leur panneau avec défilement local uniquement si nécessaire aux largeurs plus étroites.

## Vérifications techniques

- Build production : réussi.
- Contrat du prototype Pen historique : 8/8.
- Tests Sites : 4/4.
- Les 84 frames historiques et `public/pencil-export.html` restent présents et intacts.

## Limite du prototype

Les données sont réalistes mais fictives et ne sont pas persistées. Les actions simulent l’expérience produit sans backend, comptes réels ni données d’élèves réels.

historical result: passed

---

# Design QA — Parcours Blog public et administration

Date : 24 août 2026

## Vérité visuelle et captures comparées

- Identité de marque : `C:/Users/mouat/OneDrive/Desktop/logo et identité visuelle.png` — 1254 × 1254 px, logo, ivoire, bleu nuit et or.
- Référence landing existante : `qa/responsive-landing-1366x768.png` — capture 1351 × 759 px, viewport CSS 1366 × 768.
- Référence Administration existante : `qa/responsive-admin-1366x768.png` — capture 1351 × 759 px, viewport CSS 1366 × 768.
- Blog public ordinateur : `qa/blog-hub-1366x768.png` — capture 1351 × 759 px, viewport CSS 1366 × 768, DPR normalisé à 1.
- Article ordinateur : `qa/blog-article-1366x768.png` — capture 1351 × 759 px, viewport CSS 1366 × 768.
- Administration Blog ordinateur : `qa/admin-blog-1366x768.png` — capture 1351 × 759 px, viewport CSS 1366 × 768.
- Blog, article et Administration tablette : `qa/blog-hub-1024x768.png`, `qa/blog-article-1024x768.png`, `qa/admin-blog-1024x768.png` — captures 1009 × 757 px, viewport CSS 1024 × 768.
- La différence entre le viewport CSS et les pixels capturés correspond à la zone occupée par les barres du navigateur. Les comparaisons ordinateur ont été réalisées à la même densité et au même cadrage de contenu.

Les références ne représentent pas le même écran métier que le Blog ; elles servent de vérité visuelle pour le système de marque, les proportions publiques et la coque Administration. Elles ont été ouvertes dans la même comparaison que les nouveaux écrans afin de juger les surfaces réellement communes.

## Comparaison visuelle

- Composition : le Blog reprend la largeur, le bandeau public, la texture zellige, la hiérarchie généreuse et les marges de la landing, sans transformer la page en interface adulte stricte.
- Typographie : les titres publics conservent la grande sans-serif expressive de la landing ; les titres éditoriaux et Admin réutilisent la sérif premium déjà présente. Les textes UI restent compacts mais lisibles aux deux viewports.
- Couleurs : bleu nuit, ivoire, vert pédagogique, or et corail sont mappés sur les tokens existants ; les états Publié, Planifié et Brouillon restent cohérents avec la bibliothèque Admin.
- Images : les six visuels proviennent de la bibliothèque réelle du projet, avec recadrage `object-fit: cover`, coins et élévation cohérents. Aucun visuel factice en CSS ou emoji n’a été ajouté.
- Icônes : la même famille Phosphor est utilisée dans la navigation, la recherche, les métadonnées, les actions Admin et l’éditeur.
- Contenu : les sujets sont spécifiques au contexte marocain et au FLE — plurilinguisme darija/amazighe/français, culture de Fès, compréhension orale, confiance et tâche actionnelle.
- Rythme et densité : la page publique alterne hero, recherche, mise à la une, grille et newsletter ; la page Admin conserve la densité du tableau existant tout en ajoutant des indicateurs éditoriaux.

La comparaison ciblée s’est concentrée sur trois zones lisibles à taille réelle : en-tête et hero public, couverture de l’article, puis liste et actions Admin. Aucun autre zoom régional n’était nécessaire, les contrôles, textes, icônes et bordures étant lisibles dans les captures 1366 × 768.

## Historique des itérations

1. Première passe : [P2 — qualité d’image] le visuel initial de l’article principal affichait un damier intégré au fichier source dans la couverture de l’article. Impact : impression d’asset non finalisé dans une zone premium très visible.
2. Correctif : remplacement par un visuel propre de la bibliothèque existante, mise à jour du texte alternatif, reconstruction et nouvelle capture au même viewport.
3. Passe post-correctif : la couverture est nette, correctement recadrée et cohérente avec le traitement des cartes ; aucun P0, P1 ou P2 restant.

## Parcours et interactions vérifiés

- Landing : présence de la section « Le Mag Jet d’Encre », quatre cartes et navigation vers `/blog` par le menu et le CTA « Voir tous les articles ».
- Blog : six cartes au repos, recherche « médina » ramenant exactement l’article de Fès, filtres Tous/Parents/Enseignants/Enfants et état vide prévu.
- Article : route profonde, fil d’Ariane, trois sections, sommaire, encadré pédagogique, partage, articles associés et CTA d’activation.
- Newsletter : formulaire et état de confirmation présents.
- Administration : six articles, KPIs, filtres de statut, aperçu public, modification, duplication et archivage représentés.
- Éditeur Admin : onglets Contenu, Ciblage et SEO & publication ; aperçu, enregistrement du brouillon et confirmation de publication.
- Responsive : aucune largeur de document supérieure au viewport à 1366 × 768, 1280 × 720 ou 1024 × 768 ; le menu latéral Admin devient un panneau tablette et les tableaux restent contenus dans leur surface.
- Images cassées : 0. Erreurs et avertissements console : 0.

## Accessibilité et résilience

- Navigation sémantique, labels de recherche et newsletter, textes alternatifs informatifs et fil d’Ariane nommé.
- Onglets avec `role=tab` et `aria-selected`, filtres avec `aria-pressed`, focus visible et cibles principales d’au moins 42–46 px.
- Respect de `prefers-reduced-motion` et absence de mise à l’échelle globale du canevas.
- Les zones denses utilisent un débordement local seulement lorsqu’il devient nécessaire sous le breakpoint tablette.

## Vérifications techniques

- Build production : réussi.
- Contrat historique du prototype : 8/8.
- Tests de préparation Sites : 4/4.
- Les versions, frames Pen et exports historiques restent intacts.
- Le prototype reste local : aucune nouvelle publication Sites n’a été déclenchée.

## Résultat

final result: passed
