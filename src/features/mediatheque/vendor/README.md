# PDF.js embarqué

- Version : **5.7.284**
- Distribution : build générique Mozilla PDF.js
- Source : https://github.com/mozilla/pdf.js/releases/tag/v5.7.284
- Licence : Apache-2.0, voir `PDFJS-LICENSE`

Les fichiers sont servis localement afin que la liseuse fonctionne sans dépendance CDN.

## Intégrité des fichiers

SHA-256 calculés sur les deux fichiers actuellement intégrés :

| Fichier | SHA-256 |
| --- | --- |
| `pdf.min.mjs` | `9782EF0C332F1BEEA55BB4DF28AA406ABE2602713EE880FD9B99D32F029243AC` |
| `pdf.worker.min.mjs` | `7DEDAD74A392F1795711AEB17BF4CA7462B52824A400E99D26E7940791E59AD5` |

## Procédure de mise à jour

1. Télécharger l’archive `pdfjs-<version>-dist.zip` depuis la page officielle des versions.
2. Extraire `build/pdf.min.mjs`, `build/pdf.worker.min.mjs` et le fichier de licence.
3. Remplacer les deux modules dans ce dossier et mettre à jour `PDFJS-LICENSE` si nécessaire.
4. Mettre à jour la version, l’URL source et les deux SHA-256 consignés ci-dessus.
5. Exécuter les tests de la Médiathèque puis construire l’application.
6. Ouvrir un livre dans la liseuse et vérifier le chargement, la pagination, le zoom et le texte accessible.
