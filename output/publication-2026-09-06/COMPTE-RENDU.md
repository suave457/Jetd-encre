# Jet d’Encre — publication et recette du 6 septembre 2026

## Décision

**La mise à jour est publiée sur le site de test. Le parcours enseignant → élève → parent et le premier jeu scolaire connecté ont passé les contrôles décrits ici.** Le service reste réservé aux comptes fictifs : cela ne vaut pas validation d’un lancement auprès des écoles et familles.

- Site : [espace scolaire](https://jetdencre-test.mouataz-pro.workers.dev/pilote).
- Administration : [écoles et accès](https://jetdencre-test.mouataz-pro.workers.dev/admin/ecoles-acces). Cette page a été rouverte dans le navigateur intégré ; la session du propriétaire demande une nouvelle connexion. Aucun contenu administrateur authentifié n’a été contrôlé pendant cette recette.
- Source publiée : `b6767fb1b7c302601675d5fe29c0dd485505331e`.
- Version Cloudflare finale : `a2ded34f-8f0d-439f-bf72-20bd65027c5f`, confirmée à 100 % par relecture des déploiements.

## 1. Publication, sauvegarde et conservation

L’autorisation Cloudflare du profil existant a été renouvelée par le propriétaire. Aucun compte d’hébergement, abonnement, secret Auth0 ou droit scolaire n’a été créé ou modifié.

1. Export réel de la base D1 avant migration : 43 003 octets, schéma 0003, quatre migrations. Restauration dans une base SQLite locale temporaire : intégrité, clés étrangères, schéma et historique valides.
2. Application de la seule migration additive `0004_pilot_mots_fleches.sql`. Elle ajoute les tables de progression et de récompenses ; les migrations précédentes restent inchangées.
3. Export réel après migration, avant la recette du jeu : 44 841 octets, schéma 0004, cinq migrations. Les mêmes contrôles réussissent. Les 21 tables durables préexistantes ont un contenu identique entre les deux exports. Les trois tables volatiles de session et de connexion sont exclues de cette comparaison.
4. Publication sur le Worker de test existant en conservant les variables distantes. Version précédente : `3c8e0936-cf92-467c-a310-7cb159cbe6d5` ; première publication : `ab59a105-fff7-46b5-97fa-1d503111b1fd` ; correction puis version finale ci-dessus.

Les exports SQL restent hors OneDrive et Git dans le dossier privé de l’application, accessible seulement au compte Windows courant et à SYSTEM. Les copies temporaires restaurées ont été retirées. Les empreintes et résultats sans contenu privé sont conservés dans les fichiers de preuves voisins.

**Limite : il s’agit d’exports D1 réels restaurés localement, pas d’un exercice de restauration dans une seconde base D1 distante, ni d’un retour de version Cloudflare.** Le jeu de test achevé ensuite n’est pas contenu dans ces deux exports.

## 2. Défauts découverts et corrigés

| Défaut | Correction et vérification |
| --- | --- |
| Le vérificateur refusait l’instruction de métadonnées `DELETE FROM sqlite_sequence` présente dans un véritable export D1. | Autorisation de cette forme exacte uniquement dans la copie temporaire. Les suppressions de tables applicatives, formes qualifiées et clauses supplémentaires restent refusées. Tests du vérificateur : 7 réussis ; les deux exports réels sont ensuite validés. Commit `2e3c0cb`. |
| Le guide et l’accès direct au jeu donnaient une erreur 404 sur le Worker, malgré leur fonctionnement local. | Routes publiques alignées sur le manifeste commun des 14 pages ; ajout des deux routes exactes du pilote. Les chemins inconnus restent en 404. Tests de routage étendus et contrôles HTTP après republication. Commit `b6767fb`. |

La version finale a été clonée dans un dossier Windows indépendant, installée depuis le cache avec verrou inchangé, construite puis testée : **321 tests réussis, zéro échec**. L’export du schéma passe ; le PDF public est identique octet pour octet, les fichiers privés sont absents et l’arbre de ce clone est propre. Cette vérification ne démontre ni une installation par téléchargement sur poste neuf ni une CI Linux.

## 3. Recette réelle sur le site publié

Les comptes fictifs existants ont servi aux essais ; aucun nouveau devoir, travail remis, retour enseignant ou compte n’a été créé.

| Parcours / contrôle | Résultat observé |
| --- | --- |
| Connexion Auth0 française | Réussite pour Salma, Lina dans deux navigateurs isolés, parent de Lina, Nora et Adam. |
| Enseignante Salma | Un devoir existant, deux travaux remis et une correction à 18/20 retrouvés. Accès administrateur et progression individuelle élève refusés en 403. |
| Élève Lina | Première grille facile complétée au clavier, 11/11 mots, aucune lettre révélée : +20 XP confirmés par le serveur et retrouvés après rechargement. |
| Second navigateur | Nouvelle connexion de Lina dans un navigateur indépendant : réponses de la première grille, une grille terminée et 20 XP retrouvés. |
| Récompense unique | Nouvelle validation de la grille déjà terminée : +0 XP ; total toujours égal à 20, une seule récompense enregistrée. |
| Parent de Lina | Seulement son enfant dans le résumé, une grille terminée et 20 XP, avec le retour écrit existant à 18/20. Accès à la progression détaillée élève et à l’administration refusés en 403. |
| Adam, même classe | Sa propre remise, zéro grille et zéro XP ; ni progression ni travail de Lina affichés. |
| Nora, autre classe | Zéro grille, zéro XP ; URL directe du devoir de la première classe refusée en 404. |
| Déconnexion | Chaque changement de compte vérifie le refus de l’ancienne session. Les deux sessions finales sont déconnectées : espace scolaire et progression refusés en 401, puis navigateurs fermés. |
| Base après recette | Une progression, une récompense et 20 XP. Les comptes, classes, liens familiaux, devoirs, remises et corrections conservent leurs nombres initiaux. Les dix profils Jasmin sont actifs ; aucune session Jasmin active ne reste. |
| Disponibilité | Contrôle serveur 200 avec base et schéma vérifiés, identité OIDC ; espace scolaire et progression anonymes refusés en 401 avec référence de requête. |
| Pages publiques | Les 14 pages répondent en 200 et portent noindex. Les accès directs pilote/jeu, avec variante finale `/`, fonctionnent ; un jeu inconnu reste en 404. Robots.txt interdit l’exploration de tout le site de test. |

Les captures de la grille terminée, de sa reprise et du parent ont été inspectées visuellement. Les commandes du jeu tiennent dans la vue ordinateur de 1440 × 900 contrôlée. Les consoles des dernières pages de l’application ne signalent aucune erreur ; une erreur 404 de favicon a été observée auparavant sur le domaine Auth0, sans empêcher les connexions.

Le contrôle de disponibilité indique aussi que le stockage média du module BETA optionnel n’est pas disponible et que ses écritures sont désactivées. Ces indicateurs ne décrivent pas les écritures du pilote scolaire, effectivement vérifiées, ni les PDF statiques. Aucune bibliothèque PDF scolaire synchronisée n’est annoncée.

Les scénarios de coupure réseau, conflit entre onglets, autre école et reprise PDF restent ceux de la recette **locale** précédente : ils n’ont pas tous été répétés sur cette version distante. La couverture sécurité reste partielle ; aucun test de saturation n’a été lancé.

## 4. Étapes restantes avant une vraie école

| Ordre | Action | Critère de passage |
| --- | --- | --- |
| 1 | Reconnecter le propriétaire dans l’administration déjà affichée et contrôler en lecture seule les écoles et accès existants. | Compte administrateur reconnu, écoles et profils attendus, aucun droit modifié. |
| 2 | Sur une cible isolée désignée, exercer la restauration D1 et le retour de version ; vérifier les alertes et une charge bornée de classe. Compléter les chemins de sécurité non relus. | Restauration documentée, données vérifiées, procédure de secours utilisable ; limites d’une classe partageant une connexion mesurées sans saturation. |
| 3 | Valider le domaine, l’identité officielle, un contact d’assistance opérationnel, les contenus autorisés et le cadre applicable avant toute donnée d’enfant. | Aucun contact fictif utilisé comme assistance réelle ; périmètre et responsabilités approuvés. |
| 4 | Faire relire les grilles par un enseignant et observer un petit pilote accompagné sur ordinateur et tablette physique, avec contrôles d’accessibilité complémentaires. | L’élève comprend sans explication répétée, retrouve son travail ; enseignant et parent identifient le progrès et savent demander de l’aide. |

Deux finitions mineures à prévoir : remplacer le libellé de bilan « 0 — SANS AIDE » par « 0 aide utilisée », plus explicite, et corriger la requête de favicon Auth0 si elle persiste. Elles ne bloquent pas les essais fictifs.

**L’indexation reste fermée et les données restent fictives jusqu’à la décision d’ouverture.** La saisie en attente est conservée par onglet : fermer un onglet non synchronisé peut perdre cette attente. Les autres jeux restent des démonstrations ; les XP ne constituent pas une mesure certifiée de compétence.

## 5. Preuves conservées

- `RECONSTRUCTION-GIT.json` : reconstruction du commit final.
- `SAUVEGARDE-AVANT.json` et `SAUVEGARDE-APRES.json` : empreintes, schémas et contrôles des exports privés.
- `CONSERVATION-DONNEES.json` : comparaison des tables durables.
- `HTTP-PUBLIC.json` et `DISPONIBILITE.json` : contrôles du site publié.
- `COMPTAGES-FINAUX.json` : seuls des agrégats, sans identifiants ni secrets.
- Captures : `../playwright/publication-2026-09-06/`.

Les comptes rendus antérieurs sont conservés comme historique. Les commits sont locaux ; **aucun push Git n’a été réalisé pendant cette publication**. Les fichiers privés et les changements graphiques sans rapport avec cette intervention restent exclus de cette livraison.
