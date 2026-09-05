# Sécurité — complément local du 5 septembre 2026

## Résultat et portée

**Aucune nouvelle vulnérabilité exploitable confirmée dans les quatre surfaces examinées. La couverture du dépôt reste partielle.** Ce complément ne clôt ni les travaux différés du précédent audit, ni les conditions d’ouverture du service à des données réelles.

Le scan Standard `a8ecc449-af04-41e2-925a-4775ba6ae5a9`, lancé à 22:45 UTC et finalisé à 22:55 UTC, est distinct du scan antérieur `ada82bd0-2b9c-49f9-8470-70d8d38a5b30`. Aucun ancien artefact scellé n’a été modifié.

**Réserve sur la version examinée :** l’outil de finalisation a signalé « Working-tree contents changed while the scan was running; results were saved for the original snapshot. » Les résultats sont attachés à l’instantané de départ du worktree, fondé sur `040c0507432544ac98939a701393e3cfc6870a8f`. La correction de stockage décrite ci-dessous a été relue après sa modification. Ce rapport ne certifie pas le futur commit de livraison ni toute modification concurrente.

## Contrôles examinés

| Surface | Constat étayé |
|---|---|
| Passage démonstration → compte scolaire | Les chemins scolaires sont montés hors de `DemoProvider`. Le serveur dérive l’identité du cookie de session et le rôle de l’affectation active en base. Le choix d’un profil fictif n’est pas une autorité pour l’API. Voir [main.jsx:17](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/src/main.jsx:17>), [api.js:127](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/worker/pilot/api.js:127>) et [session.js:59](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/worker/pilot/session.js:59>). |
| Élève, parent et texte affiché | Les pages parent historiques lisent le profil fictif du store. Le résumé scolaire vérifie école, lien familial, élève et classe actifs ; le parent ne peut pas consulter ou écrire les cases d’une grille. Les messages, réponses et retours sont rendus comme texte React. Voir [ParentPages.jsx:184](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/src/ParentPages.jsx:184>), [games.js:149](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/worker/pilot/games.js:149>) et [PilotApp.jsx:47](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/src/features/pilote/PilotApp.jsx:47>). Les autres jeux locaux ne deviennent pas des récompenses scolaires. |
| Pré-rendu public | Le build utilise une liste de chemins et des articles embarqués ; `PublicPreview` n’accède ni au store de démonstration, ni à une session scolaire. Le texte passe par React ; les métadonnées sont échappées. L’indexation exige un choix explicite et reste désactivée pour les hôtes de staging identifiés. Voir [prerender-public.mjs:18](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/scripts/prerender-public.mjs:18>), [App.jsx:210](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/src/App.jsx:210>) et [publicContent.js:109](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/src/publicContent.js:109>). La désindexation n’est pas un contrôle d’accès. |
| Médias et état du lecteur PDF | La nouvelle persistance ne conserve que page, zoom et mode, avec identité de lecteur/livre, valeurs bornées et lecture JSON limitée à 512 caractères. Elle refuse les sources temporaires `blob:`/`data:` et les identités absentes. Le PDF sélectionné localement est limité à 100 Mio et à une signature PDF ; aucun téléversement n’apparaît dans ce parcours. PDF.js est chargé avec évaluation et XFA désactivés, et le bitmap est plafonné. Voir [pdfReadingState.js:12](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/src/features/mediatheque/pdfReadingState.js:12>), [localPdfCore.js:22](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/src/features/mediatheque/localPdfCore.js:22>) et [PdfReader.jsx:223](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/src/features/mediatheque/PdfReader.jsx:223>). |

## Observation résolue pendant la revue

La remise à zéro de la démonstration efface les clés `jde.*` dans les deux stockages du navigateur. Le cache initial des mots fléchés scolaires utilisait ce même préfixe : une remise à zéro pouvait donc effacer une réponse scolaire encore en attente de synchronisation, sans modifier la sauvegarde D1.

La tâche principale a remplacé cette clé par **`jde-school.crosswords.v1:`**, en dehors du domaine de suppression de la démonstration. Le changement a été relu dans [gameSync.js:9](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/src/features/pilote/gameSync.js:9>). Les assertions de conservation dans `localStorage` et `sessionStorage` ont été relues dans [local-data-reset.test.mjs:57](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/tests/local-data-reset.test.mjs:57>).

Cette observation relève de la séparation des données et du risque de perte de brouillon. Aucun attaquant distinct, gain d’autorité ou accès indu à D1 n’a été établi ; elle n’est pas comptée comme vulnérabilité confirmée. La tâche principale a annoncé **16 tests réussis** pour les suites concernées ; ce complément n’a pas réexécuté ces tests.

## Couverture et limites

**24 fichiers intégralement relus**, plus des extraits ciblés. La liste exacte est dans `fullyReviewedFiles` du nouvel artefact de couverture. Les grands fichiers `App.jsx`, `demoStoreCore.js`, `routeCore.js`, `PdfReader.jsx`, `StudentMediaLibrary.jsx`, ainsi que les contrôles d’intégration `api.js` et `games.js`, ne sont pas comptés comme entièrement audités ici.

Les autres modules différés — notamment les écrans de `PenAlignedPages`, les modules bêta, les autres jeux, une partie des tests et des outils — restent à examiner. Les bibliothèques PDF.js embarquées, leurs workers, les dépendances et les médias binaires n’ont pas été audités. Les configurations privées, bases locales, identifiants et dossiers réels n’ont pas été lus.

Revue statique hors ligne du code, sans lancer l’application ni envoyer de requête aux services du projet. Aucun déploiement, commit ou push effectué par ce complément. La vérification finale du produit reste à la tâche principale.

La compétence `codex-security:security-scan` a été appliquée. Son contrôle préalable a renvoyé `ready`, avec avertissements de délégation ; la revue a été menée séquentiellement sans nouvel agent, conformément au mandat. Aucune configuration persistante n’a été modifiée. L’accès TAC et ses niveaux d’octroi n’ont pas pu être vérifiés : connecteur non connecté (`USER_NOT_LOGGED_IN`). La mesure séparée des tokens est indisponible (`usage.coverage: unavailable`, `scan_thread_unavailable`).

Avant un accueil réel, restent à valider séparément les conditions d’exploitation, la configuration effective de l’identité et de Cloudflare, le domaine final, les responsabilités et la mise à jour des bibliothèques PDF. Ce complément n’est pas une autorisation de mise en production.

## Nouveaux artefacts

Copies exactes des quatre artefacts scellés, avec comparaison SHA-256 réussie après copie ; aucun fichier existant écrasé :

- [Rapport généré par Codex Security](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/output/ameliorations-2026-09-05/securite-complement/report.md>)
- [Couverture partielle et travaux différés](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/output/ameliorations-2026-09-05/securite-complement/coverage.json>)
- [Constats validés — liste vide](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/output/ameliorations-2026-09-05/securite-complement/findings.json>)
- [Manifeste du nouveau scan](<C:/Users/mouat/OneDrive/Documents/ChatGPT/Plateforme éducative/admin-navigation-prototype/output/ameliorations-2026-09-05/securite-complement/scan-manifest.json>)

Le présent document accompagne le rapport automatique ; il ne remplace ni ne modifie ses artefacts scellés.
