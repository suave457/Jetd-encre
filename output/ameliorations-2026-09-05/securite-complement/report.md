# Security Review: admin-navigation-prototype

## Scope

Revue complémentaire bornée, statique et locale des transitions démo/serveur, des parcours élève/parent, du pré-rendu public et des nouvelles fonctions de lecture PDF. Elle ne clôt pas la couverture partielle du scan antérieur.

- Scan mode: repository
- Target kind: git_worktree
- Target ID: target_sha256_0e2ccb9edcb9a2c216667a78a474ac3f8269b42f2c16e3ba76db6ca4b74050ee
- Revision: 040c0507432544ac98939a701393e3cfc6870a8f
- Snapshot digest: codex-security-snapshot/v1:sha256:f111f9d1ab3d54f07c9d9def869209bbc44860872d78aec2d6c5d89c3ea8ca5a
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: Aucune application ni requête réseau du projet exécutée dans ce complément. Tests finaux délégués à la tâche principale, qui a annoncé 16/16 pour reset/synchronisation ; assertions du reset relues ici, sans assimiler cette annonce à une reproduction indépendante.
- Artifacts reviewed: output/audit-2026-09-05/securite/coverage.json
- Scan context: Scan distinct a8ecc449-af04-41e2-925a-4775ba6ae5a9 ; ancien scan ada82bd0-2b9c-49f9-8470-70d8d38a5b30 conservé sans modification.

Limitations and exclusions:
- Couverture partielle du dépôt ; 24 fichiers intégralement relus plus extraits ciblés. App.jsx, demoStoreCore.js, routeCore.js, PdfReader.jsx, StudentMediaLibrary.jsx, worker/pilot/api.js et worker/pilot/games.js ne sont pas comptés comme entièrement audités dans ce complément.
- Aucun nouvel agent autorisé : architecture et investigation séquentielles, sans seconde revue indépendante.
- Préflight ready avec avertissements de délégation ; interpréteur Python fourni par l’application utilisé après échec de l’alias système. Aucune configuration persistante modifiée.
- TAC : connecteur non connecté (USER_NOT_LOGGED_IN) ; état et niveaux d’octroi non vérifiables, affichage protégé potentiellement indisponible.
- Sources de travail susceptibles de changer pendant la revue. Le parent a corrigé le préfixe du cache scolaire ; la version courante et le test associé ont été relus après correction.
- Ni secrets, ni bases privées, ni comptes réels, ni services externes examinés ; aucun déploiement. Mesure séparée de tokens indisponible.
- Excluded .env\*, \*.local.jsonc, .local-data/\*\*, .local-media/\*\*: Secrets et état privé non nécessaires, ni lus ni reproduits.
- Excluded node_modules/\*\*, dist/\*\*, src/features/mediatheque/vendor/\*\*, public/assets/\*\*: Dépendances, sorties de build, parseurs PDF embarqués et binaires non audités dans ce complément.
- Excluded output/audit-2026-09-05/securite/\*\*: Scan antérieur scellé conservé sans modification ; seule sa couverture est lue comme contexte, sans reprise de ses conclusions comme preuve de cette revue.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 0 |
| Severity mix | none |
| Confidence mix | none |
| Coverage | partial |
| Validation mode | static_source_review |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

Jet d’Encre expose une démonstration React stockée dans le navigateur et une application scolaire distincte appuyée sur l’API Worker/D1. Le rendu public de build consomme des articles éditoriaux embarqués. Le lecteur PDF reçoit un catalogue embarqué ou un blob choisi explicitement par l’utilisateur ; son état de lecture reste local. Architecture vérifiée séquentiellement, sans revue indépendante.

### Assets

- Identité et rôle scolaires, travaux d’élèves, rattachements parent-enfant et progression/XP conservés dans D1 (worker/pilot/api.js:6-14,127-136 ; worker/pilot/games.js:149-189).
- Confidentialité des réponses scolaires et absence de promotion des profils fictifs en droits scolaires (src/main.jsx:17-21).
- Intégrité des brouillons scolaires locaux par école/utilisateur et séparation de la remise à zéro de la démonstration (src/features/pilote/gameSync.js:9,15-45 ; src/localDataReset.js:1,23).
- Contenu public pré-rendu sans données de session et paramètres de lecture PDF bornés (src/App.jsx:210-214 ; scripts/prerender-public.mjs:18-35 ; src/features/mediatheque/pdfReadingState.js:12-48).

### Trust Boundaries

- Visiteur et rôle fictif → session scolaire : DemoProvider ne monte pas les chemins pilotes. L’API utilise authenticate(), le cookie HttpOnly __Host-jde_pilot avec Secure/SameSite=Lax et l’affectation active provenant de D1, jamais le rôle du stockage local (src/main.jsx:17-21 ; worker/pilot/session.js:21-25,59-69 ; worker/pilot/api.js:6-14,127-136).
- Parent authentifié → données d’enfant : résumé limité par école, lien familial actif, élève/membership/classe actifs ; la route détaillée des cases reste réservée à l’élève (worker/pilot/games.js:149-186). ParentPages reçoit uniquement la démonstration (src/ParentPages.jsx:184-190).
- Session navigateur → brouillons scolaires : clé JSON \[schoolId,userId\], contrôle d’identité initiale et de réponse, CSRF issu de /session, annulation/invalidation au changement de session (src/features/pilote/gameSync.js:9-16,62-70 ; src/features/pilote/PilotCrosswords.jsx:8-38).
- Source éditoriale/build privilégié → HTML public : liste de chemins embarqués, échappement attributs/métadonnées, renderToString de PublicPreview sans store ni réponse d’API (scripts/prerender-public.mjs:15-35 ; src/App.jsx:210-214 ; src/publicContent.js:73-105).
- Fichier choisi/catalogue → PDF.js navigateur : source blob ou chemin de catalogue ; limite locale 100 Mio/signature %PDF-, URL blob libérée, isEvalSupported:false et enableXfa:false, bitmap borné (src/features/mediatheque/localPdfCore.js:22-50 ; src/features/mediatheque/StudentMediaLibrary.jsx:282-295 ; src/features/mediatheque/PdfReader.jsx:223 ; src/features/mediatheque/pdfReaderCore.js:48-65).

### Attacker Capabilities

- Un visiteur peut choisir un profil fictif, modifier son propre localStorage/sessionStorage et taper du texte dans la démonstration ; cela n’établit aucun droit sur D1.
- Un élève/parent scolaire peut envoyer des requêtes avec son propre cookie et le CSRF de sa session, sans pouvoir choisir le rôle ni l’école dans le contexte d’API.
- Un utilisateur peut sélectionner un PDF sur son appareil. Aucun upload serveur de ce PDF n’est établi dans les composants examinés.
- Les sources éditoriales et variables de build ne sont pas traitées comme contrôlables par un visiteur non privilégié ; le build n’est pas un endpoint public.

### Security Objectives

- Conserver l’école, l’identité et le rattachement familial comme autorités serveur ; ne jamais convertir XP/données de démonstration en écritures scolaires.
- Rendre les réponses/textes comme texte React et ne pas exporter de sessions ou brouillons dans les HTML publics.
- Éviter qu’une remise à zéro de la démonstration efface le cache scolaire en attente.
- Limiter l’état PDF persistant aux page/zoom/mode et ne pas persister les fichiers blob/data ni une identité anonyme partagée.

### Assumptions

- Contexte fourni : pilote de test, données fictives, aucune ouverture à de vrais dossiers d’élèves autorisée dans cette tâche.
- Les deux interfaces partagent l’origine du navigateur ; leur stockage ne constitue pas une enclave contre un script déjà exécuté sur cette origine ou une personne contrôlant le même profil navigateur.
- Aucun SECURITY.md applicable trouvé par le résolveur pour racine, src, src/features/pilote, src/features/mediatheque, scripts et worker/pilot.
- Les composants d’entrée importants sont examinés ici, pas l’ensemble des implémentations différées du scan scellé antérieur.
- La désindexation protège le référencement, pas l’accès ; la confidentialité scolaire dépend des contrôles serveur et non des robots/meta.
- Le parseur PDF.js embarqué, son worker, les fichiers binaires et la configuration effective de Cloudflare/OIDC restent hors de ce complément.
- Une collision de préfixe initiale permettait au reset démo de supprimer le cache scolaire du même navigateur. Parent l’a résolue en cours de revue par jde-school.crosswords.v1: ; sources et assertions relues, pas d’attaquant distinct ni de violation D1 établis.

## Findings

### No findings

No reportable findings survived the canonical discovery, validation, and reportability gates.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Séparation des identités démo et scolaires et cache de grilles | Authentication and storage boundaries | No issue found | src/main.jsx:17-21 sépare DemoProvider des applications scolaires ; src/demoStoreCore.js:622-627,657-684,762-849 authentifie uniquement les comptes fictifs en stockage local. worker/pilot/api.js:127-136 forme le contexte depuis authenticate/membership ; worker/pilot/session.js:21-25,59-69 impose cookie d’assurance attendu, origine et CSRF. GameSync vérifie userId/schoolId aux frontières (gameSync.js:15,65), ne lit pas le store démo. Observation opérationnelle de reset résolue par le parent : gameSync.js:9 utilise jde-school.crosswords.v1:, hors préfixes localDataReset.js:1 ; tests/local-data-reset.test.mjs:35,43,57-58 préservent les deux stockages. Aucun franchissement d’autorité confirmé ; pas une vulnérabilité retenue. |
| Affichage parent/élève et équivalence d’accès du résumé scolaire | Tenant isolation and output encoding | No issue found | ParentPages.jsx:184-190 utilise l’élève fictif du store ; profils bornés à une allowlist (parentDataCore.js:4-18), textes de messages/devoirs rendus en React (ParentPages.jsx:107,156-158). Le parcours connecté n’utilise pas ces fonctions pour accorder des droits : worker/pilot/games.js:149-186 vérifie famille/école/membership/classe actifs et interdit au parent les cases et écritures. PilotGameSummary contrôle userId et schoolId (PilotCrosswords.jsx:56-65). PilotApp.jsx:63-81,94-111,125-129 purge et invalide l’état au changement d’identité/erreurs d’accès. StudentCultureQuiz.jsx et quizEngine.js produisent des points locaux par callbacks, sans fetch ; App.jsx:697-716,879 raccorde seulement le store démo. Les fonctions restantes du monolithe ne sont pas déclarées relues. |
| Pré-rendu public, métadonnées et contenu éditorial | Public disclosure and HTML injection | No issue found | scripts/prerender-public.mjs:18-35 appelle PublicPreview ; src/App.jsx:210-214 consomme blogArticles statiques et PublicInfoPage, sans DemoProvider, session ou fetch. Chemins seulement PUBLIC_PREVIEW_PATHS embarqués (publicContent.js:73), valeurs metadata échappées (prerender-public.mjs:15,24-30), titres/corps rendus comme texte React (PublicInfoPage.jsx:10-15 ; App.jsx:286). src/publicContent.js:74-81 limite l’origine canonique à HTTPS sans userinfo ni chemin ; opt-in explicite et refus des hôtes de staging aux lignes109-125. Pas de source distante ni de publication d’état du navigateur constatée. Les imports de tout App.jsx ne sont pas une preuve d’audit intégral du monolithe. |
| Sources média et nouvelle persistance du lecteur PDF | Local file handling and bounded browser state | No issue found | StudentMediaLibrary.jsx:28,269-295 limite le catalogue au contenu embarqué et au PDF explicitement choisi ; blob URL libérée à279, identité lecteur provenant du profil élève démo à262-264. localPdfCore.js:22-33 vérifie taille/type/signature, sans upload. PdfReader.jsx:223 charge PDF.js local avec évaluation et XFA désactivés ; état rétabli seulement après document valide à235-244. pdfReadingState.js:12-18 refuse utilisateur/livre absents et source blob/data ; JSON de lecture \<=512 caractères, page/zoom/mode normalisés à21-48. pdfReaderCore.js:48-65 borne le bitmap à6M pixels/dimension4096. Les URL source des liens PDF proviennent de ce catalogue/blob, pas d’un champ arbitraire reçu d’un autre utilisateur. Pas de conclusion sur les vulnérabilités internes de PDF.js. |

## Open Questions And Follow Up

- Les conditions d’accueil de données réelles, l’origine finale, le fournisseur d’identité et les réglages Cloudflare/OIDC seront-ils validés séparément avant ouverture ?
  - Follow-up prompt: Faire valider la préparation de lancement et le périmètre du pilote par les responsables ; ce scan de source local ne vérifie pas ces prérequis.
- Quel processus garantira la mise à jour et la revue de sécurité des bibliothèques PDF.js embarquées ?
  - Follow-up prompt: Vérifier la provenance/version et les avis de sécurité dans une tâche autorisée distincte ; aucun avis externe consulté ici.
- Quelles implémentations du reste de la couverture partielle feront l’objet d’une prochaine revue ciblée ?
  - Follow-up prompt: Partir des chemins deferred de ce complément et du précédent sans marquer les tests ou recherches ponctuelles comme audits complets.
- Seuls les chemins source→contrôle→consommateur cités dans les surfaces ont été examinés ; aucune affirmation de revue intégrale de ces fichiers.
  - Follow-up prompt: Review deferred unit partial_monoliths and close its stated proof gap. Paths: src/App.jsx, src/demoStoreCore.js, src/routeCore.js, src/features/mediatheque/PdfReader.jsx, src/features/mediatheque/StudentMediaLibrary.jsx, src/features/mediatheque/mediaLibraryCore.js, worker/pilot/api.js, worker/pilot/games.js.
- Le mandat borne le complément. Ces autres implémentations différées ne sont pas closes ; les examens antérieurs ou tests par d’autres tâches ne remplacent pas une revue source dans ce scan.
  - Follow-up prompt: Review deferred unit other_unreviewed_implementations and close its stated proof gap. Paths: src/PenAlignedPages.jsx, src/LegalPages.jsx, src/features/achievements, src/features/beta-admin, src/features/beta-data, src/features/beta-roles, src/features/question-bank, src/features/games/class-challenges, src/features/games/DailyChallenge.jsx, src/features/games/dailyChallengeData.js, src/features/games/market-shop, src/features/games/mots-fleches, src/features/games/word-choice, src/features/games/mission-zellige, tests, db, drizzle, worker/index.js, worker/pilot/admin.js, worker/pilot/oidc.js.
- Pas de validation dynamique locale ou distante dans ce complément ; final tests et publication restent à la tâche principale. Configuration réelle, comptes, consentements, charge et services OIDC/D1 non observés.
  - Follow-up prompt: Review deferred unit runtime_and_release and close its stated proof gap. Paths: wrangler.test.example.jsonc, PUBLIC-LAUNCH-READINESS.md.
