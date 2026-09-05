# Vérifier localement une sauvegarde D1

Le vérificateur restaure un **export SQL complet** dans une nouvelle base SQLite temporaire, hors du projet. Il compare la structure aux migrations du code courant, contrôle les clés étrangères et l’intégrité, puis supprime sa copie temporaire. Il ne se connecte pas à Cloudflare et ne modifie ni l’export, ni la base de développement, ni D1.

**Validation sur export D1 réel, 6 septembre 2026 :** les exports de la base de test avant et après la migration 0004 ont été restaurés localement et contrôlés avec leur schéma respectif. Le format D1 inclut `DELETE FROM sqlite_sequence` avant de rétablir les compteurs AUTOINCREMENT : cette instruction exacte est maintenant acceptée uniquement pour cette table interne de la copie temporaire. Toute suppression de table applicative, clause supplémentaire ou accès à une autre base reste refusé, avec tests de non-régression. Aucun export n’est stocké dans le dépôt. Cela ne constitue toujours pas une restauration vers une base D1 distante.

## Vérifier un export déjà disponible

Depuis le dossier `admin-navigation-prototype`, indiquer le chemin du fichier SQL existant dans `$backupFile` :

```powershell
$backupFile = 'C:\Users\mouat\AppData\Local\Jetdencre\PrivateBackups\export-d1.sql'
& "$env:LOCALAPPDATA\Jetdencre\Tools\node-v24.20.0-win-x64\node.exe" .\scripts\verify-pilot-backup.mjs $backupFile
$LASTEXITCODE
```

Avec Node dans le chemin de commandes, l’équivalent est :

```powershell
node .\scripts\verify-pilot-backup.mjs $backupFile
```

Le script nécessite les protections SQLite disponibles à partir de Node **24.12** ; il a été testé avec le Node **24.20.0** installé sur ce poste. L’autoriseur SQL interdit les opérations non autorisées et le mode défensif est activé. [Documentation officielle Node SQLite](https://nodejs.org/api/sqlite.html#databasesetauthorizercallback), [mode défensif](https://nodejs.org/api/sqlite.html#databaseenabledefensiveactive).

La sortie est un objet JSON contenant seulement un résultat, des contrôles et des nombres : quantité de tables, migrations et lignes par table, anomalies d’intégrité et de clés étrangères. Les noms des tables comptées viennent du schéma du projet. Aucun nom d’élève, texte, jeton de session, contenu SQL ou chemin privé n’est imprimé, même en cas d’échec.

| Code de sortie | Signification |
| --- | --- |
| `0` | Restauration temporaire réussie ; schéma, migrations, intégrité et clés étrangères conformes ; copie supprimée. |
| `1` | Restauration effectuée, mais au moins un contrôle n’est pas conforme. Consulter les compteurs d’anomalies. |
| `2` | Fichier ou format refusé, protection requise indisponible, restauration impossible ou suppression non confirmée. |

`checks.temporaryCopyRemoved` doit être `true`. Aucun paramètre ne permet de choisir une base cible, de garder la copie ou d’écraser un fichier existant.

## Préparer un nouvel export, séparément

**Ces commandes sont destinées à l’opérateur ; aucun export distant n’a été lancé pendant cette livraison.** Utiliser Wrangler déjà disponible et le profil d’accès existant `jetdencre-test`. L’exemple cible uniquement la base de test connue, `jetdencre-test-db`.

```powershell
$backupDirectory = Join-Path $env:LOCALAPPDATA 'Jetdencre\PrivateBackups'
if (-not (Test-Path -LiteralPath $backupDirectory)) {
  New-Item -ItemType Directory -Path $backupDirectory | Out-Null
}
$backupFile = Join-Path $backupDirectory ('jetdencre-test-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N') + '.sql')
if (Test-Path -LiteralPath $backupFile) { throw 'Le fichier existe déjà : choisir un autre nom.' }
wrangler d1 export jetdencre-test-db --remote --config .\wrangler.test.local.jsonc --profile jetdencre-test --output $backupFile
if ($LASTEXITCODE -ne 0) { throw 'Export non confirmé : ne pas considérer cette sauvegarde comme disponible.' }
& "$env:LOCALAPPDATA\Jetdencre\Tools\node-v24.20.0-win-x64\node.exe" .\scripts\verify-pilot-backup.mjs $backupFile
```

Le fichier reste dans un dossier privé hors du dépôt et de OneDrive. Il contient les données de la base : conserver les restrictions d’accès du dossier opérateur et ne pas le joindre au suivi du projet. L’export doit inclure **schéma et données** ; ne pas ajouter `--no-data`, `--no-schema` ou `--table`. Cloudflare documente cette commande et précise qu’un export en cours bloque temporairement les autres requêtes de la base. Choisir une fenêtre adaptée. [Commandes D1 — export](https://developers.cloudflare.com/d1/wrangler-commands/#d1-export), [import et export D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/).

## Contrôles et format pris en charge

- Le schéma attendu est reconstruit en mémoire depuis les migrations SQL du projet. Les tables, index et contraintes sont comparés à la copie restaurée, y compris `pilot_game_progress` et `pilot_game_awards`.
- La table `d1_migrations` doit contenir exactement les noms des migrations SQL du code courant. Un export ancien, antérieur à une migration locale, échoue à ce contrôle : il doit être vérifié avec la version correspondante du code pour être évalué comme sauvegarde historique.
- `PRAGMA integrity_check` et `PRAGMA foreign_key_check` contrôlent la copie. Les tables ne sont pas corrigées automatiquement et aucune migration n’est appliquée à l’export pour masquer un décalage.
- Les exports UTF-8 jusqu’à **32 Mio** sont acceptés. La copie SQLite est limitée à environ **64 Mio**. Les fichiers binaires SQLite, exports partiels, vues, triggers, tables virtuelles et instructions hors du format autorisé sont refusés.
- Le format autorisé comprend `CREATE TABLE`, `CREATE INDEX`, `CREATE UNIQUE INDEX` et `INSERT INTO … VALUES` avec valeurs littérales, ainsi que l’instruction exacte `DELETE FROM sqlite_sequence` pour les compteurs internes de la copie. Les pragmas de clés étrangères et les enveloppes `BEGIN TRANSACTION` / `COMMIT` usuels sont neutralisés ; le vérificateur gère sa propre transaction. `ATTACH`, `DETACH`, `VACUUM`, chargement d’extensions, suppressions applicatives et SQL dynamique sont interdits.

## Portée du résultat

Un contrôle réussi prouve que **ce fichier** se restaure localement avec le schéma attendu et sans anomalie détectée. Il ne prouve pas sa fraîcheur, l’exhaustivité de données supprimées avant l’export, la cohérence avec des fichiers médias externes, la disponibilité de Cloudflare, ni le fonctionnement de l’application après restauration.

**SQLite locale n’est pas une restauration D1 en ligne.** La recette de reprise complète doit encore être réalisée, séparément, sur une base D1 de préproduction désignée, avec vérification des accès et parcours applicatifs. Ce script ne lance ni `d1 execute --remote`, ni Time Travel, ni remplacement de base.

Les tests automatisés utilisent uniquement des données fictives et couvrent restauration complète, migration/table manquante, schéma altéré, clé étrangère rompue, SQL hostile, protection d’un fichier existant, nettoyage temporaire et absence de contenu privé dans les sorties.
