# Recette locale des contrastes — 5 septembre 2026

Session isolée `jasmin-contrast`, connexion élève de démonstration via le bouton prérempli. Aucun accès Auth0, compte scolaire réel ou session propriétaire. Axe-core **4.13.0**, règle `color-contrast`, ordinateur **1440 × 900** et tablette simulée **1024 × 768**.

## Résultat après intégration CSS

Les huit mesures finales ont été relancées par navigation/rechargement sur les sources corrigées par le parent, **sans injection CSS**. Le badge de notification a ensuite fait l’objet d’un contrôle ciblé après le correctif complémentaire. Les captures initiales ont été prises après chargement des polices et stabilisation des animations, avant jugement visuel.

| Vue | Écran | Nœuds en échec avant | Après | Résultats indéterminés |
|---|---|---:|---:|---:|
| desktop | dashboard | 5 | 0 | 2 |
| desktop | catalogue | 4 | 0 | 13 |
| desktop | reader | 2 | 0 | 3 |
| desktop | mots-fleches | 0 | 0 | 0 |
| tablette | dashboard | 4 | 0 | 2 |
| tablette | catalogue | 3 | 0 | 13 |
| tablette | reader | 1 | 0 | 3 |
| tablette | mots-fleches | 0 | 0 | 0 |

## Résidus initiaux corrigés

Seuil attendu : 4,5:1 pour ces petits textes.

| Style | Texte / fond initiaux | Ratio | Correction intégrée |
|---|---|---:|---|
| `.topbar-meta > .demo-badge` | `#68758a` / `#fff9e9` | 4,43 | Texte `#526177` via `.topbar-meta > span` |
| `.profile-button small` | `#7c8797` / `#fffdf9` | 3,58 | Texte `#526177` |
| `.page-eyebrow` | `#9b6815` / `#faf6ef` | 4,44 | Texte `#895910` |
| `.page-header p` | `#66738b` / `#faf6ef` | 4,44 | Variable `--muted: #526177` |
| `.status-pill.warning` | `#9c6500` / `#fff0cd` | 4,35 | Texte `#895910` |

Le correctif préparé hors checkout est conservé dans `C:/Users/mouat/AppData/Local/Temp/jetdencre-contrast-20260905/global-contrast.patch`. Il porte sur cinq valeurs de couleur dans `src/styles.css` ; aucune géométrie ni fonctionnalité n’a été modifiée par cette recette.

### Badge de notification : échec découvert dans les résultats indéterminés

Axe laisse `.notification i` indéterminé car son texte est court. Le chiffre « 1 » est pourtant un texte visible de 8 px, graisse 800. Le contrôle manuel des styles calculés a confirmé du blanc sur `#d9575e`, soit **3,835:1**, inférieur au seuil de 4,5:1. Le patch complémentaire `notification-contrast.patch` remplace seulement ce fond par `#b23845`. Après intégration et rechargement, les styles calculés confirment **5,925:1**. Les preuves séparées `notification-manual-before.json` et `notification-manual-after.json` documentent cette vérification ; les captures rapprochées portent les mêmes noms en PNG.

## Autres observations

- Les huit mesures finales ne détectent pas de débordement horizontal ni d’erreur ou avertissement console.
- Les huit captures initiales ont été examinées. Le titre et les onglets des mots fléchés ne se chevauchent pas à 1024 × 768 ; la grille et les commandes restent visibles.
- La liseuse affiche bien le PDF du catalogue et son texte accessible, sans alerte de chargement. Cette recette ne teste pas les parcours complets de lecture ou de jeu.
- La miniature du livre sous la ligne de flottaison, absente d’une première capture tablette à cause du chargement différé, apparaît après défilement. Aucun fichier manquant n’est déduit de cette première capture.

## Preuves et limites

`contrast-results.json` contient les mesures détaillées avant/après, sélecteurs, couleurs calculées, résultats indéterminés, informations de mise en page et snapshots. Les fichiers `*-verified.log` sont les mesures finales sur les sources enregistrées. Les captures `*-proposed.png` et journaux `*-proposed.log` concernent uniquement une vérification intermédiaire par injection et ne sont pas utilisés comme preuve finale du CSS enregistré.

Le contexte de navigateur est fermé après la recette ; voir `session-close.log`. Les pixels du PDF et des images ne sont pas mesurés par axe. Les résultats indéterminés nécessitent une vérification manuelle complémentaire. Zéro violation automatique sur cette règle ne certifie pas une conformité WCAG complète, et une fenêtre simulée ne remplace pas une tablette physique.
