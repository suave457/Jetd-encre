# Direction artistique — Banque de questions

## Intention

L’illustration présente la banque comme un outil éditorial organisé et accueillant : cartes de quiz en papier ivoire, plume bleu nuit et signets dorés. Quatre médaillons évoquent la culture marocaine, l’apprentissage du français, les sciences et l’ouverture sur le monde. Aucun texte n’est intégré à l’image afin de préserver la lisibilité, l’internationalisation et l’accessibilité.

## Fichiers livrés

| Fichier | Dimensions | Usage recommandé |
| --- | ---: | --- |
| `assets/question-bank-preview-banner-1050.webp` | 1050 × 336 px | Source de `artworkSrc` dans l’aperçu élève 350 × 112 px. Le ratio est identique ; conserver `object-fit: cover`. |
| `assets/question-bank-welcome-640.webp` | 640 × 566 px | Panneau d’accueil compact ou tablette. |
| `assets/question-bank-welcome-960.webp` | 960 × 848 px | Panneau d’accueil haute densité ou grand écran. |
| `assets/question-bank-welcome-v1.png` | 1334 × 1179 px | Master RGBA, à conserver comme source. |

Les WebP conservent leur transparence afin que le fond navy, ivoire ou teal de l’interface reste piloté par le CSS.

## Intégration

- Dans `QuestionBankAdmin`, importer `question-bank-preview-banner-1050.webp` puis le passer à `artworkSrc`.
- Le bandeau a été recadré pour le format exact 350 × 112 px ; ne pas le recadrer davantage.
- Pour une future carte d’accueil, utiliser la version complète avec `object-fit: contain`, largeur visuelle conseillée de 220 à 320 px.
- Texte alternatif conseillé : « Cartes de questions entourées de symboles de culture, de langue, de sciences et du monde ».
- Ne pas ajouter d’ombre forte : les volumes et les contours dorés sont déjà intégrés à l’illustration.

## Palette

- Bleu nuit : `#07182E`
- Ivoire : `#FAF6EF`
- Or : `#E4A82F`
- Teal : `#13564E`
- Terracotta, en accent seulement : `#C96B4A`

## Génération

Mode utilisé : outil ImageGen intégré, avec l’illustration du Défi du jour comme référence de style. Le prompt final demandait une nature morte éditoriale 3D premium composée de cartes de quiz ivoire, d’une plume navy, d’un signet doré et de quatre médaillons de catégories, sans texte ni logo, sur fond réellement transparent. Une passe ciblée a remplacé le symbole géographique français par un livre et une bulle afin de représenter le FLE sans associer la langue à un seul pays ; une dernière passe a extrait le fond en alpha réel.
