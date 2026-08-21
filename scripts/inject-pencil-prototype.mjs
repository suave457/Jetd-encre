#!/usr/bin/env node
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(root, process.argv[2] || "reference/pencil-export-source-v3.html");
const target = path.resolve(root, process.argv[3] || "public/pencil-export.html");
const publicDir = path.join(root, "public");
const configPath = path.join(publicDir, "prototype-config.js");

for (const required of [
  source,
  configPath,
  path.join(publicDir, "prototype.css"),
  path.join(publicDir, "prototype.js"),
]) {
  await access(required);
}

const context = { window: {} };
vm.runInNewContext(await readFile(configPath, "utf8"), context, { filename: configPath });
const config = context.window.JDE_PROTOTYPE_CONFIG;
if (!config?.routes?.length) throw new Error("prototype-config.js ne contient aucun manifest de routes.");

const expectedFrames = [...new Set(config.routes.flatMap((route) => Object.values(route.frames || {})))];
const requiredControls = [
  "Action Prévisualiser",
  "Action Aperçu tablette",
  "Action Revue tablette",
  "Étape tablette 4 · Aperçu",
  "Action Envoyer en revue",
  "CTA Retour au Studio",
  "CTA Envoyer en revue",
  "CTA Demander corrections",
  "CTA Valider revue",
  "CTA Retour revue",
  "CTA Planifier publication",
  "CTA Retour Bibliothèque",
  "CTA Voir contenu publié",
  "CTA Comparer versions",
  "CTA Restaurer cette version",
  "CTA Écouter épisode",
  "CTA Lire transcription",
  "CTA Réessayer publication",
  "Ligne version actuelle",
  "Ligne version précédente",
  "Carte état Refusé",
  "Carte état Droits insuffisants",
  "Carte état Erreur publication",
  "Action · Créer une classe",
  "Action · Inviter un enseignant",
  "Action · Affecter",
  "Action · Activer des élèves",
  "Action · Voir les alertes",
  "Filtre · Année scolaire",
  "Filtre · Niveau",
  "Filtre · Classe",
  "Filtre · Période",
  "Recherche · Classes",
  "Recherche · Enseignants",
  "Recherche · Élèves",
  "Onglet · Vue d’ensemble",
  "Onglet · Élèves",
  "Onglet · Enseignants",
  "Bouton · Enregistrer la classe",
  "Bouton · Envoyer l’invitation",
  "Bouton · Confirmer l’affectation",
  "Bouton · Générer les codes",
  "Bouton · Contacter l’assistance",
  "Action Élève W01_02_AUTH_ChoixProfil_D_1440x900",
  "Action Élève W01_02_AUTH_ChoixProfil_T_1024x768",
  "Action principale W01_03_AUTH_ConnexionEleve_D_1440x900",
  "Action principale W01_03_AUTH_ConnexionEleve_T_1024x768",
  "Activer mon manuel",
  "CTA · Activer mon manuel",
  "Action principale · Continuer",
  "Action principale · Rejoindre ma classe",
  "Nav Élève · Tableau de bord",
  "Navigation Élève · Accueil",
  "Nav Élève · Manuels",
  "Navigation Élève · Mes manuels",
  "Nav Élève · Devoirs",
  "Navigation Élève · Mes devoirs",
  "Nav Élève · Médiathèque",
  "Navigation Élève · Médiathèque",
  "Nav Élève · Progression",
  "Navigation Élève · Mes progrès",
  "Action Élève · Reprendre la leçon",
  "Action Élève · Ouvrir mes manuels",
  "Action Élève · Ouvrir manuel",
  "Action Élève · Ouvrir leçon",
  "Action Élève · Lancer activité",
  "Choix Quiz · Recycler",
  "Action Élève · Valider réponse",
  "Onglet Devoirs · À faire",
  "Action Élève · Rendre le devoir",
  "Action Élève · Refaire activité",
  "Action Élève · Continuer leçon",
  "Action Élève · Lire média",
  "Action Élève · Voir progression",
  "Action Élève · Ouvrir aide",
  "Action Élève · Se déconnecter",
  "Action Élève · Réessayer",
  "Action Élève · Contacter aide",
];

const countName = (html, name) => html.split(`data-pencil-name="${name}"`).length - 1;
let html = await readFile(source, "utf8");
const missingFrames = expectedFrames.filter((name) => countName(html, name) !== 1);
if (missingFrames.length) {
  throw new Error(`Frames absentes ou dupliquées dans l’export Pen : ${missingFrames.join(", ")}`);
}
const missingControls = requiredControls.filter((name) => countName(html, name) < 1);
if (missingControls.length) {
  throw new Error(`Contrôles P0 absents de l’export Pen : ${missingControls.join(", ")}`);
}

html = html
  .replace(/<link\b[^>]*href=["'](?:\.\/)?prototype\.css["'][^>]*>\s*/gi, "")
  .replace(/<script\b[^>]*src=["'](?:\.\/)?prototype-config\.js["'][^>]*><\/script>\s*/gi, "")
  .replace(/<script\b[^>]*src=["'](?:\.\/)?prototype\.js["'][^>]*><\/script>\s*/gi, "")
  .replace(/<html\b([^>]*)\blang=["'][^"']*["']([^>]*)>/i, "<html$1lang=\"fr\"$2>");

if (!/<html\b[^>]*\blang=/i.test(html)) html = html.replace(/<html\b/i, '<html lang="fr"');
if (!/<\/head>/i.test(html) || !/<\/body>/i.test(html)) {
  throw new Error("L’export Pen doit contenir un scaffold HTML complet.");
}

html = html
  .replace(/<\/head>/i, '    <link rel="stylesheet" href="prototype.css" />\n  </head>')
  .replace(
    /<\/body>/i,
    '    <script src="prototype-config.js"></script>\n    <script src="prototype.js"></script>\n  </body>',
  );

await writeFile(target, html, "utf8");
console.log(`Export injecté : ${path.relative(root, target)} · ${expectedFrames.length} frames · ${requiredControls.length} contrôles P0.`);
