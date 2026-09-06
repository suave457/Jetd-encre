# Jet d’Encre — application du plan d’action

**Mise à jour du 6 septembre 2026 : le code est maintenant publié sur le site de test et les parcours scolaires ont été vérifiés avec Auth0 et D1.**

Les sauvegardes réelles avant/après migration ont été vérifiées par restauration locale isolée. La grille terminée, ses 20 XP uniques, la reprise dans un second navigateur et le résumé parent fonctionnent en ligne. Le commit final publié `b6767fb1b7c302601675d5fe29c0dd485505331e` a été reconstruit séparément : 321 tests réussis. La page administrateur demande une reconnexion du propriétaire ; son contenu authentifié n’a donc pas été revérifié. Le site reste un pilote fictif non indexable, pas une ouverture aux vrais dossiers d’élèves.

Le [compte rendu de publication](output/publication-2026-09-06/COMPTE-RENDU.md) précise les résultats, les deux corrections de publication et les étapes restantes. **Les sections ci-dessous conservent l’état historique de la livraison locale, antérieur à cette publication.**

## Historique — livraison locale avant publication

**6 septembre 2026 — livraison locale, non publiée.**

Le socle technique prioritaire du plan est intégré. Il permet de tester les mots fléchés avec un compte scolaire, une progression enregistrée par le serveur et des XP vérifiés. Le site en ligne n’a pas été modifié pendant cette livraison : le profil Cloudflare enregistré ne dispose plus d’une authentification utilisable. Les conditions d’accueil de données réelles ne sont pas encore réunies.

## 1. Ce qui a changé

| Domaine | Modification appliquée |
| --- | --- |
| Connexion | Les liens publics conduisent à l’espace scolaire. La démonstration reste distincte. Un guide explique les accès créés manuellement par l’équipe Jet d’Encre, la récupération et la déconnexion. |
| Protection de la connexion | Les demandes refusées d’une même source ne consomment plus le quota collectif. Les fenêtres de comptage ne reculent plus et un quota plein ne crée pas de nouveaux compteurs. Les autres protections OIDC sont conservées. |
| Mots fléchés scolaires | Nouvelle page `/pilote/jeux/mots-fleches`. Sauvegarde par élève et école ; 20, 35 ou 50 XP, attribués une seule fois après vérification des réponses côté serveur. Les 18 grilles représentent au maximum 630 XP. |
| Coupures et conflits | État de sauvegarde visible, reprise après rechargement de l’onglet, nouvelle tentative sans récompense en double. Deux versions concurrentes demandent un choix explicite au joueur. |
| Suivi parent | Le parent voit les grilles et XP de ses enfants autorisés, sans accès aux réponses en cours ni aux données d’autres familles. |
| Clavier et affichage | Saisie rapide et accents corrigés, consignes et commandes mieux disposées sur ordinateur et tablette, pluriels et contrastes corrigés. |
| Vocabulaire | Relecture des 222 entrées : corrections de sens, genre et formulations, puis reprise de 57 indices courts pour tenir dans les cases. La réponse reste cachée avant découverte ; les croisements, réponses et récompenses sont conservés. |
| Liseuse PDF | Reprise de la page, du zoom et du mode d’affichage après rendu réussi ; retour explicite à la première page ; valeurs et taille de rendu bornées. Cette reprise concerne la médiathèque de démonstration, pas une bibliothèque scolaire synchronisée en ligne. |
| Pages publiques | Guide et articles inclus dans le rendu initial de 14 pages. La préproduction reste non indexable. Les textes distinguent le fonctionnement scolaire, la démonstration locale et les informations encore fictives. |
| Exploitation | Contrôle de disponibilité étendu aux nouvelles tables, références d’erreur sans contenu privé, vérificateur de sauvegarde SQL dans une base temporaire isolée. |

### Limites à connaître

Les réponses en attente utilisent le stockage de session de **chaque onglet**. Elles survivent au rechargement, mais leur conservation n’est pas garantie si l’onglet est fermé avant synchronisation ; un avertissement demande de le garder ouvert. Le serveur demeure la référence pour les XP. Les autres jeux de démonstration ne sont pas devenus des jeux scolaires connectés.

La grille et ses réponses sont embarquées dans le logiciel : ce jeu sert à l’entraînement et à la motivation, pas à un examen surveillé. Les XP ne constituent pas une mesure certifiée de compétence linguistique.

## 2. Vérifications effectuées

| Contrôle | Résultat et portée |
| --- | --- |
| Tests automatisés | **321 réussis, 0 échec** sur Windows avec Node 24.20.0. Ils couvrent notamment droits, quotas, sauvegardes, récompenses uniques, concurrence, coupures, PDF et contenu des grilles. |
| Construction | Réussie ; 14 pages publiques prérendues, indexation désactivée. L’export du schéma de base réussit. |
| Reconstruction depuis Git | Clone autonome du commit `cb5c787a5c73b577efaabc7a15cc7224cd028e10`, installation avec verrou inchangé depuis le cache, compilation, 321 tests et export du schéma réussis. Arbre Git resté propre, PDF conservé octet pour octet, fichiers privés absents. Windows uniquement ; CI Linux non exécutée ici. |
| Dépendances | L’audit des paquets ne signale aucune vulnérabilité connue. Cela ne remplace pas une revue du code ni des bibliothèques embarquées. |
| Préparation Cloudflare | Simulation de publication réussie, **sans envoi ni migration distante**. |
| Parcours de jeu | Navigateur isolé sur le serveur local : grille facile terminée, +20 XP, rechargement et confirmation serveur ; résumé parent concordant ; autre école sans progression visible. |
| Réseau et onglets | Coupure simulée, réponses retrouvées, synchronisation et choix entre deux versions testés dans deux onglets distincts. Aucun double crédit observé. |
| Affichage | Saisie sans délai de `ECOLE` restituée en `ÉCOLE`. Commandes visibles sans défilement aux formats 1440 × 900, 1366 × 768 et 1024 × 768 sur les vues contrôlées. |
| Petits indices | Les 18 grilles contrôlées à ces trois formats, soit 54 vues, ne présentent plus de texte d’indice dépassant de sa case ni de débordement de page détecté. Captures finales inspectées. |
| PDF | Reprise vérifiée à la page 5, zoom 150 %, après rendu et rechargement du livre de démonstration de 8 pages. |
| Contrastes | Huit vues finales contrôlées automatiquement, sans échec de contraste détecté ; badge également mesuré. Ce n’est pas une certification WCAG et les cas indéterminés restent à examiner. |
| Sécurité | Défaut de quota corrigé et testé ; complément de revue sur quatre surfaces. **La couverture du dépôt reste partielle** et le scan complémentaire porte sur son instantané de départ, pas sur tous les changements finaux. |
| Sauvegarde | Restauration SQLite isolée et vérificateur testés sur données fictives. Aucun export récent ni exercice de restauration D1 distante n’est attesté. |
| Migration | Passage local d’une base au schéma 0003 vers 0004 : contenu de toutes les anciennes tables conservé, clés étrangères valides, puis récompense et réponses retrouvées après réouverture. |

Les tests de navigateur de cette livraison sont **locaux**, avec profils fictifs. Ils ne remplacent pas une recette des nouveaux écrans sur le site publié avec Auth0 et D1. Les sessions de test ont été fermées ; la session administrateur du propriétaire a été préservée.

## 3. Situation des sept lots

| Lot du plan | État | Validation restante |
| --- | --- | --- |
| 1 — Stabilisation | Corrections et reconstruction depuis Git réalisées | Publication et confirmation distante. |
| 2 — Entrée scolaire | Parcours public et guide intégrés | Remise privée et récupération des accès à valider avec une école. |
| 3 — Premier jeu connecté | Serveur, interface et tests locaux réalisés | Migration D1 puis recette Auth0, second navigateur et persistance en ligne. |
| 4 — Médiathèque et pédagogie | Reprise PDF et relecture réalisées | Catalogue autorisé, transcriptions, enseignant, vraie tablette et technologies d’assistance. |
| 5 — Exploitation et sécurité | Outillage et contrôles partiels réalisés | Revue des chemins restants, CI Linux, restauration D1, retour de version, alertes et charge bornée. |
| 6 — Ouverture publique | Préparation technique réalisée, indexation fermée | Domaine, identité réelle, assistance fonctionnelle, contrats et validation du cadre applicable. |
| 7 — École pilote | Non lancé avec des personnes réelles | Consentements/cadre validés, enseignant et familles, observation des parcours et corrections issues du terrain. |

## 4. Prochaines opérations, dans l’ordre

1. **Rétablir l’accès Cloudflare au profil existant `jetdencre-test`.** L’opérateur se reconnecte dans son navigateur. Aucun mot de passe ni jeton ne doit être copié dans le rapport ou le dépôt. Ne pas créer de compte temporaire ou activer un abonnement pour contourner ce blocage.
2. Vérifier la cible existante, les migrations appliquées et les accès. Sauvegarder la base de test dans un dossier privé hors OneDrive/Git, puis vérifier sa restauration avec le schéma correspondant à sa version. Le vérificateur livré attend toutes les migrations du code courant : un export antérieur à `0004` doit être contrôlé comme sauvegarde historique, pas déclaré invalide uniquement pour ce décalage.
3. Appliquer **uniquement la migration additive `0004_pilot_mots_fleches.sql`** à la base de test existante, en vérifiant au préalable que les migrations précédentes sont déjà présentes. Publier ensuite le code sur le Worker de test existant. Ne pas supprimer les tables en cas de retour au code précédent.
4. Refaire les parcours réels enseignant, élève, parent et administrateur avec les comptes fictifs déjà créés : aucune duplication de compte ou devoir ; jeu terminé une fois, reconnexion, second navigateur, séparation des familles/écoles et révocation de session.
5. Vérifier disponibilité, journaux sans secrets, sauvegarde après migration, restauration D1 sur une cible isolée désignée et retour de version. Mesurer un palier limité sans saturer l’environnement gratuit. La limite actuelle de 12 démarrages par adresse et par minute doit être évaluée pour une classe partageant une connexion.
6. Fermer les validations éditoriales, d’accessibilité et de cadre réel avant l’essai école. Garder l’indexation bloquée et les données fictives jusqu’à cette décision.

**Décision : prêt à poursuivre les essais techniques locaux ; pas encore prêt à annoncer une ouverture aux familles et écoles.**

## 5. Preuves et notes détaillées

- Plan initial : `output/audit-2026-09-05/PLAN-ACTION-2026-09-05.md`.
- Quota : `output/ameliorations-2026-09-05/CORRECTION-QUOTA-CONNEXION.md`.
- Relecture : `output/ameliorations-2026-09-05/RELECTURE-PEDAGOGIQUE.md`.
- Sécurité complémentaire et réserves : `output/ameliorations-2026-09-05/SECURITE-COMPLEMENT.md`.
- Sauvegarde : `output/ameliorations-2026-09-05/VERIFICATION-SAUVEGARDE-D1.md`.
- Contrastes : `output/playwright/launch/a11y/CONTRASTES-2026-09-05.md`.
- Captures locales de recette : `output/playwright/launch/`.

Les rapports d’audit scellés restent inchangés. Les notes d’identifiants fictifs, bases, exports, configurations privées et journaux de test sont exclus du dépôt.

## 6. Version vérifiée et conservation

Le point de reprise antérieur est `040c0507432544ac98939a701393e3cfc6870a8f`. Le code livré et reconstruit correspond à `cb5c787a5c73b577efaabc7a15cc7224cd028e10`. Le présent complément de compte rendu ne change pas ce code. Les commits sont **locaux ; aucun push Git n’a été effectué pendant cette livraison**.

La reconstruction suit l’ordre de la CI : installation, compilation, puis tests, car plusieurs tests inspectent les fichiers construits. Une première tentative de vérification lancée avant la compilation a échoué sur ces fichiers absents ; la reconstruction complète a ensuite été reprise dans un nouveau clone propre et a réussi. L’installation hors ligne utilise le cache de ce poste : elle ne démontre pas le téléchargement sur une machine neuve.

Le résultat synthétique est conservé dans `output/ameliorations-2026-09-05/RECONSTRUCTION-GIT-2026-09-06.json`. Une comparaison avec le point de reprise confirme aussi que les 222 réponses, la géométrie et les versions de récompense des 18 grilles n’ont pas changé. Les quatre artefacts scellés du complément de sécurité sont enregistrés sans conversion de fins de ligne et leurs octets ont été comparés à ceux du dépôt.
