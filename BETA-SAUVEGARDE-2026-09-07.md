# Jet d’Encre — Sauvegarde du code BETA

État du code : 7 septembre 2026. Cette sauvegarde Git n’est pas un déploiement et ne certifie pas la fin de la BETA.

## Inclus

- Écrans et navigation existants conservés, séparation des espaces et activation d’un manuel pour un compte élève précréé.
- Parcours scolaires reliés au serveur, jeux connectés, suivi enseignant, espace Direction et analyses administratives.
- Édition et publication contrôlée des articles.
- Bibliothèque PDF privée locale : import, versions, restauration, attribution aux écoles et retrait d’accès.
- Onze migrations supplémentaires 0005–0015 avec leurs snapshots et le journal, sans réécrire les migrations appliquées.
- Tests de non-régression et composants PDF.js accompagnés de leurs licences.

## Non inclus

Les bases de données, sessions, identifiants réels, secrets, configurations privées de déploiement, PDF fournis pour les essais, sauvegardes et captures privées ne font pas partie de cette sauvegarde source. Ils ne sont pas nécessaires pour compiler le site. Les identifiants de recette présents explicitement dans le code sont fictifs, utilisables seulement sur la boucle locale et exclus du site compilé.

La bibliothèque d’un nouveau clone est donc vide tant qu’un document autorisé n’a pas été importé et attribué. Ne pas copier automatiquement une base de recette vers un environnement hébergé.

## Reconstruction

Prérequis : Node.js 24.12 ou supérieur dans la branche 24, et pnpm 11.19.0 comme déclaré dans le projet.

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm test
pnpm exec drizzle-kit check --config drizzle.config.mjs
```

Compiler avant les tests : certains vérifient les fichiers compilés. Pour les essais locaux, lancer ensuite le script `dev` existant. Les formulaires `/recette/connexion/{profil}` et les outils de recette ne sont accessibles qu’en développement local, jamais dans le Worker publié.

L’import PDF local nécessite aussi Poppler (`pdfinfo`) ; le chemin peut être indiqué par `JDE_PDFINFO_PATH`. Une suite de tests exécutée sans Poppler ne constitue pas une preuve du fonctionnement de cet import sur la machine concernée.

## Limites de livraison

Les tests locaux du lot précédent comptent 727 réussites. Cela ne remplace pas la validation des connexions et des droits dans l’environnement réellement hébergé.

- La lecture/importation privée distante n’est pas encore raccordée.
- La conformité du formulaire hébergé à Pen, le domaine et les informations légales/support restent à valider.
- Le projet Sites et le Worker Cloudflare test sont deux environnements indépendants. Ne pas transférer leurs secrets ou données par simple copie du dépôt.
- La préparation doit rester strictement gratuite ; tout service facturable demande un accord explicite sur son coût.
- Projet DÉBAT et l’IA restent différés.

Conserver les références Git ALPHA, BETA et BETA.1 existantes sans les déplacer. Ne pas présenter cette sauvegarde comme une version déjà publiée à destination des amis testeurs.
