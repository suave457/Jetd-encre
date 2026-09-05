# Correction du quota de connexion — 5 septembre 2026

## Résultat

Correctif local vérifié. **Non déployé à ce stade.** Le constat historique du scan scellé reste intact ; ce document décrit la correction, pas une modification rétroactive de l’audit.

L’ancienne implémentation consommait le quota collectif avant de vérifier le quota individuel. Une source pouvait ainsi épuiser le budget de tous les autres utilisateurs en répétant des demandes déjà refusées. Une contre-analyse a également confirmé qu’une requête retardée pouvait remettre un compteur à une minute antérieure.

## Invariants rétablis

- Une source refusée ne consomme pas le quota collectif.
- Un quota collectif épuisé ne crée plus de nouvelle ligne de compteur individuel.
- Une fenêtre ancienne ne remplace jamais une fenêtre plus récente.
- Les plafonds restent 12 démarrages par source et 300 au total par minute.
- L’opération utilise deux écritures ordonnées dans un même `DB.batch`. La seconde ne s’exécute que si la première a admis la demande.

L’ordre et l’atomicité reposent sur le contrat documenté de [Cloudflare D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/). Les tests utilisent la véritable SQLite locale, avec l’adaptateur transactionnel du projet ; ils ne constituent pas une preuve de charge sur D1 distant.

## Vérifications

Reproduction initiale, analyse indépendante, correction, tests ciblés, puis revue indépendante du patch. Cette revue a détecté une régression d’allocation des compteurs : elle a été corrigée par la transaction conditionnelle, puis les tests ont été relancés.

Les 32 tests OIDC passent : 300 demandes d’une même source laissent le compteur global à 12 et une source neuve peut démarrer ; appels concurrents bornés ; 400 nouvelles sources après saturation ne créent aucune ligne ; requête retardée sans recul de fenêtre ; démarrage normal, PKCE, nonce, signature, cookies et refus des redirections conservés.

Fichiers : `worker/pilot/oidc.js`, `tests/pilot-oidc.test.mjs`.

## Limites avant l’ouverture

Aucun test de saturation n’a été envoyé au site gratuit. Le nombre de connexions possibles derrière une même adresse d’école reste à mesurer avant une vraie classe : le correctif ne relève pas discrètement la limite individuelle. La publication et la recette Auth0/D1 distante nécessitent une réautorisation Cloudflare.
