# PDF.js embarqué

- Version : **5.7.284**
- Distribution : build générique Mozilla PDF.js
- Source : https://github.com/mozilla/pdf.js/releases/tag/v5.7.284
- Licence : Apache-2.0, voir `PDFJS-LICENSE`

Les fichiers sont servis localement afin que la liseuse fonctionne sans dépendance CDN.

## Décodeur JBIG2 — 7 septembre 2026

Le PDF privé de recette utilise une image JBIG2, notamment page 120. Le lecteur fournit désormais `wasmUrl` vers `/assets/pdfjs/5.7.284/wasm/`, avec le décodeur et son repli JavaScript officiels. Aucun module principal n’a été remplacé, aucun CDN n’est appelé et la politique de sécurité n’a pas été assouplie.

Les quatre fichiers proviennent de `web/wasm/` dans l’archive officielle `pdfjs-5.7.284-dist.zip`, dont le SHA-256 vérifié est `6D1B81252D76358DF5831567D7D551F40EBAE0CD8E0A554694BC4DF0D3DB8715`.

| Fichier public | SHA-256 |
| --- | --- |
| `jbig2.wasm` | `E6BEE67724A7B5436FE8162638E3708CFC8D52B6342DB69A49715E30FF27CFDC` |
| `jbig2_nowasm_fallback.js` | `04C795A6657A4553A64B781EA3E85256203D913C3B71B72B85FA3CE00622F458` |
| `LICENSE_JBIG2` | `9E66B7F1B934A28B37F3BC4DAC97915DE1674271E79A0A88182A18ED9731B4D1` |
| `LICENSE_PDFJS_JBIG2` | `AAD3CCE09842E00E9E11AD5E8FEF8CC02FBC3A3768FE2F007443B9CEE37AAEE5` |

La licence complète et les notices tierces accompagnent les fichiers distribués. Le PDF personnel n’est pas un de ces fichiers publics.

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
