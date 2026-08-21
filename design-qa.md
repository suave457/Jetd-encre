# Design QA — Prototype Admin Jet d’Encre

Date : 21 août 2026  
Source visuelle : `public/reference/pencil-export-source.html`  
Implémentation vérifiée : `http://127.0.0.1:4173/`

## Preuves navigateur

| Vue capturée et inspectée | Résultat |
|---|---|
| Ordinateur — 1440 × 900, Bibliothèque et Studio | Conforme |
| Tablette — 1024 × 768, Bibliothèque et Studio | Conforme |

- Rendu ordinateur : 6 lignes initiales ; largeur mesurée `248 + 1192 = 1440`, aucun bouton hors écran.
- Rendu tablette : 4 cartes initiales ; largeur mesurée `88 + 936 = 1024`, aucun bouton hors écran.
- Iframe racine : pleine hauteur aux deux formats.
- Console navigateur : aucune erreur sur les deux formats.

## Parcours testés

### Ordinateur

- Route initiale Bibliothèque et navigation Studio ↔ Bibliothèque.
- Recherche avec résultat ciblé.
- Filtres Type, Audience et Statut, avec états ARIA synchronisés aux onglets.
- Tri alphabétique A–Z.
- Nouveau/Modifier vers le Studio.
- Dupliquer : confirmation, copie Brouillon ciblée et ouverture dans le Studio.
- Sélection multiple et barre d’actions.
- Archiver : déplacement réel vers l’onglet Archivés, Annuler immédiat, puis Restaurer.

### Tablette

- Navigation Studio ↔ Bibliothèque et bouton Importer explicitement libellé.
- Drawer de filtres accessible au clavier : Type, Audience, Niveau, Statut, Réinitialiser et Appliquer.
- Filtre combiné `Blog + Parents` : 1 résultat ; Réinitialiser : 4 cartes.
- Recherche ciblée, sélection multiple, archivage et restauration.

## Vérifications techniques

- Build production : réussi.
- Tests Sites : 4/4 réussis.
- Routes `/` et `/pencil-export.html` : statut 200.
- Quatre frames attendues, actifs de marque et logo présents.
- `prototype.css` et `prototype.js` chargés ; syntaxe JavaScript valide.
- Langue française, recherches natives, navigation clavier, rôles, titres et libellés ARIA vérifiés.

## Limite documentée

La pagination reste une simulation d’interface sans source de données distante. La page sélectionnée, ses états ARIA et son toast sont toutefois conservés pendant la navigation.

## Résultat

final result: passed
