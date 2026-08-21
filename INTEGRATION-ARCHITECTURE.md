# Architecture d’intégration — Admin, Directeur et Élève

Date : 21 août 2026  
Projet : `admin-navigation-prototype`  
Principe : étendre le prototype existant sans réinitialiser React, l’iframe, le worker Sites ni les écrans W01–W05 déjà validés.

## Vague Élève W06

Le parcours publié regroupe 25 paires ordinateur/tablette : 12 paires W01/W02 existantes raccordées sans modification et 13 nouvelles paires W06. Les anciennes maquettes restent intactes dans Pen.

### Accès, activation et onboarding existants

| Route canonique | Clé | Paire Pen |
|---|---|---|
| `/connexion` | `auth.profile-choice` | `W01_02_AUTH_ChoixProfil` |
| `/connexion/eleve` | `auth.student-login` | `W01_03_AUTH_ConnexionEleve` |
| `/mot-de-passe-oublie` | `auth.forgot-password` | `W01_07_AUTH_MotDePasseOublie` |
| `/reinitialisation` | `auth.reset-password` | `W01_08_AUTH_Reinitialisation` |
| `/session-expiree` | `auth.session-expired` | `W01_10_AUTH_SessionExpiree` |
| `/activation` et ses quatre états | `activation.*` | `W01_11` à `W01_15` |
| `/eleve/onboarding/profil` | `student.onboarding-profile` | `W02_01_ELV_CreationProfil` |
| `/eleve/onboarding/classe` | `student.onboarding-class` | `W02_02_ELV_EcoleEtClasse` |

### Espace authentifié W06

| Route canonique | Clé | Paire Pen |
|---|---|---|
| `/eleve/tableau-de-bord` | `student.dashboard` | `W06_ELV_01_Dashboard` |
| `/eleve/manuels` | `student.manuals` | `W06_ELV_02_MesManuels` |
| `/eleve/manuels/:manualId/lecons/:lessonId` | `student.reader` | `W06_ELV_03_LecteurEnrichi` |
| `/eleve/activites/:activityId` | `student.exercise` | `W06_ELV_04_ExerciceQuiz` |
| `/eleve/devoirs` | `student.assignments` | `W06_ELV_05_MesDevoirs` |
| `/eleve/devoirs/:assignmentId` | `student.assignment` | `W06_ELV_06_DetailDevoir` |
| `/eleve/devoirs/:assignmentId/remise-confirmee` | `student.assignment-submitted` | `W06_ELV_07_ConfirmationRemise` |
| `/eleve/progression` | `student.progress` | `W06_ELV_08_Progression` |
| `/eleve/activites/:activityId/resultat` | `student.exercise-result` | `W06_ELV_09_ResultatExercice` |
| `/eleve/mediatheque` | `student.media` | `W06_ELV_10_Mediatheque` |
| `/eleve/recompenses` | `student.rewards` | `W06_ELV_11_Recompenses` |
| `/eleve/profil` ou `/eleve/aide` | `student.profile` | `W06_ELV_12_ProfilAide` |
| `/eleve/etat-systeme/:systemState?` | `student.system` | `W06_ELV_13_EtatsSysteme` |

Le prototype conserve seulement un état pédagogique fictif et non sensible dans `sessionStorage`. Aucun nom complet, e-mail, date de naissance, code réel, fichier audio ou donnée d’un camarade n’est stocké. La déconnexion volontaire efface uniquement l’état d’authentification Élève et renvoie vers `/connexion/eleve`. Une route Élève inconnue ouvre l’état « page introuvable » Élève et ne retombe jamais sur Administration.

## Décision technique

Conserver pour cette vague l’architecture actuelle : React sert uniquement de coque plein écran et charge un export Pen unique dans une iframe même origine. Le routage, l’état fictif et les interactions restent injectés dans l’export.

Le fichier autonome `public/prototype-config.js` contient désormais le contrat routes → frames, les routes d’actions et les données fictives. Il doit être chargé **avant** `prototype.js` lors du prochain export.

À ce jalon, un seul export HTML est le chemin le plus court. Ne passer à plusieurs exports par domaine que si le fichier final dépasse environ 8 Mo ou si le premier rendu dépasse 2,5 s en local.

## Manifest route → frame

| Route canonique | Clé | Ordinateur | Tablette |
|---|---|---|---|
| `/admin/bibliotheque` | `admin.library` | `W03_02_ADM_Bibliotheque_D_1440x900` | `W03_02_ADM_Bibliotheque_T_1024x768` |
| `/admin/contenus/nouveau` ou `/admin/contenus/:contentId/modifier` | `admin.studio` | `W03_01_ADM_StudioContenus_D_1440x900` | `W03_01_ADM_StudioContenus_T_1024x768` |
| `/admin/contenus/:contentId/previsualisation` | `admin.preview` | `W04_ADM_01_Previsualisation_D_1440x900` | `W04_ADM_01_Previsualisation_T_1024x768` |
| `/admin/contenus/:contentId/revue` | `admin.review` | `W04_ADM_02_RevueEditoriale_D_1440x900` | `W04_ADM_02_RevueEditoriale_T_1024x768` |
| `/admin/contenus/:contentId/planification` | `admin.schedule` | `W04_ADM_03_Planification_D_1440x900` | `W04_ADM_03_Planification_T_1024x768` |
| `/admin/contenus/:contentId/publication-reussie` | `admin.published` | `W04_ADM_04_PublicationReussie_D_1440x900` | `W04_ADM_04_PublicationReussie_T_1024x768` |
| `/admin/contenus/:contentId/historique` | `admin.history` | `W04_ADM_05_HistoriqueVersions_D_1440x900` | `W04_ADM_05_HistoriqueVersions_T_1024x768` |
| `/contenus/:slug` | `public.content` | `W04_ADM_06_ContenuPublicFinal_D_1440x900` | `W04_ADM_06_ContenuPublicFinal_T_1024x768` |
| `/admin/contenus/:contentId/etat-systeme/:systemState?` | `admin.system` | `W04_ADM_07_EtatsSysteme_D_1440x900` | `W04_ADM_07_EtatsSysteme_T_1024x768` |
| `/directeur/tableau-de-bord` | `director.dashboard` | `W05_DIR_01_TableauDeBord_D_1440x900` | `W05_DIR_01_TableauDeBord_T_1024x768` |
| `/directeur/classes` | `director.classes` | `W05_DIR_02_Classes_D_1440x900` | `W05_DIR_02_Classes_T_1024x768` |
| `/directeur/classes/nouvelle` ou `/directeur/classes/:classId` | `director.class` | `W05_DIR_03_ClasseDetailEdition_D_1440x900` | `W05_DIR_03_ClasseDetailEdition_T_1024x768` |
| `/directeur/enseignants` | `director.teachers` | `W05_DIR_04_EnseignantsInvitations_D_1440x900` | `W05_DIR_04_EnseignantsInvitations_T_1024x768` |
| `/directeur/affectations` | `director.assignments` | `W05_DIR_05_Affectations_D_1440x900` | `W05_DIR_05_Affectations_T_1024x768` |
| `/directeur/eleves/activation` | `director.activation` | `W05_DIR_06_ElevesActivation_D_1440x900` | `W05_DIR_06_ElevesActivation_T_1024x768` |
| `/directeur/suivi-utilisation` | `director.usage` | `W05_DIR_07_SuiviUtilisation_D_1440x900` | `W05_DIR_07_SuiviUtilisation_T_1024x768` |
| `/directeur/etablissement` | `director.school` | `W05_DIR_08_EtablissementAssistance_D_1440x900` | `W05_DIR_08_EtablissementAssistance_T_1024x768` |

Les boards `W04_ADM_00_FlowCycleEditorial` et les éventuels boards W05 restent dans Pen pour la documentation, mais ne doivent pas être exportés dans le prototype exécutable.

## Routeur à intégrer dans `prototype.js`

1. Remplacer `state.view` par `state.route` et `state.params`.
2. Construire les expressions régulières depuis `JDE_PROTOTYPE_CONFIG.routes`.
3. `getFrame()` doit lire `route.frames[getDevice()]` et non un objet W03 codé en dur.
4. Masquer toutes les frames présentes dans le manifest, pas uniquement `[data-pencil-name^="W03_"]`.
5. Ajouter `aria-hidden` et `inert` aux frames inactives.
6. À l’initialisation, lire la route depuis la fenêtre parente si l’export est dans l’iframe ; sinon lire le hash de la page exportée.
7. Dans l’iframe même origine, écrire la route propre dans `window.parent.history.pushState`. Écouter `popstate` sur la fenêtre parente pour que Précédent/Suivant fonctionne. En ouverture directe de `pencil-export.html`, utiliser `#/<route>` afin d’éviter de charger la coque dans l’iframe.
8. Une route inconnue globale revient sur `/admin/bibliotheque`. Une route commençant par `/eleve` ouvre l’état système Élève « page introuvable ».

## Sélecteurs P0

### Admin existant

- `[data-pencil-name="Navigation Admin · Bibliothèque"]`
- `[data-pencil-name="Rail Admin · Bibliothèque"]`
- `[data-pencil-name="Navigation Admin · Studio de contenus"]`
- `[data-pencil-name="Rail Admin · Studio"]`
- `[data-pencil-name="Action Nouveau contenu"]`
- `[data-pencil-name="Action Nouveau contenu tablette"]`
- `[data-pencil-name="Action Prévisualiser"]`
- `[data-pencil-name="Action Envoyer en revue"]`
- `[data-pencil-name="Navigation Admin · Historique"]`
- `[data-pencil-name="Rail Admin · Historique"]`

### Admin W04

- `[data-pencil-name="CTA Retour au Studio"]`
- `[data-pencil-name="CTA Envoyer en revue"]`
- `[data-pencil-name="CTA Demander corrections"]`
- `[data-pencil-name="CTA Valider revue"]`
- `[data-pencil-name="CTA Planifier publication"]`
- `[data-pencil-name="CTA Publier maintenant"]`
- `[data-pencil-name="CTA Voir contenu publié"]`
- `[data-pencil-name="CTA Comparer versions"]`
- `[data-pencil-name="CTA Restaurer cette version"]`
- `[data-pencil-name="CTA Réessayer publication"]`
- `[data-pencil-name="CTA Retour Bibliothèque"]`
- `[data-pencil-name="Onglet type Article"]`
- `[data-pencil-name="Onglet type Podcast"]`
- `[data-pencil-name="Onglet type Documentaire"]`
- `[data-pencil-name="Onglet type Jeu vidéo"]`
- `[data-pencil-name="Onglet type eBook"]`
- `[data-pencil-name="Ligne version actuelle"]`
- `[data-pencil-name="Ligne version précédente"]`
- `[data-pencil-name="Carte état Refusé"]`
- `[data-pencil-name="Carte état Droits insuffisants"]`
- `[data-pencil-name="Carte état Erreur publication"]`

### Directeur W05

- `[data-pencil-name="Action · Créer une classe"]`
- `[data-pencil-name="Action · Inviter un enseignant"]`
- `[data-pencil-name="Action · Affecter"]`
- `[data-pencil-name="Action · Activer des élèves"]`
- `[data-pencil-name="Action · Voir les alertes"]`
- `[data-pencil-name="Filtre · Année scolaire"]`
- `[data-pencil-name="Filtre · Niveau"]`
- `[data-pencil-name="Filtre · Classe"]`
- `[data-pencil-name="Filtre · Période"]`
- `[data-pencil-name="Recherche · Classes"]`
- `[data-pencil-name="Recherche · Enseignants"]`
- `[data-pencil-name="Recherche · Élèves"]`
- `[data-pencil-name="Onglet · Vue d’ensemble"]`
- `[data-pencil-name="Onglet · Élèves"]`
- `[data-pencil-name="Onglet · Enseignants"]`
- `[data-pencil-name="Bouton · Enregistrer la classe"]`
- `[data-pencil-name="Bouton · Envoyer l’invitation"]`
- `[data-pencil-name="Bouton · Confirmer l’affectation"]`
- `[data-pencil-name="Bouton · Générer les codes"]`
- `[data-pencil-name="Bouton · Contacter l’assistance"]`

Les noms de navigation Directeur à utiliser sont `Navigation Directeur · <section>` et `Rail Directeur · <section>`, avec les sections : `Tableau de bord`, `Classes`, `Enseignants`, `Affectations`, `Activation élèves`, `Suivi d’utilisation`, `Établissement`.

Chaque requête DOM doit être limitée à la frame active : `$(selector, activeFrame)`. Les noms génériques sont répétés entre ordinateur et tablette et ne sont pas des identifiants globaux.

## Mutations et persistance `sessionStorage`

Clé : `jde.prototype.session.v4`. Charger le schéma courant, ou migrer et fusionner la session `v3` si elle existe afin de préserver les états Admin et Directeur. Sauvegarder après chaque mutation P0, pas après les changements de focus ou l’ouverture d’un simple menu.

### Admin

| Action | Mutation |
|---|---|
| Envoyer en revue | `editorial.content.status = "En revue"`; `review.decision = "pending"`; ajouter une version |
| Demander corrections | `status = "Brouillons"`; `review.decision = "changes_requested"`; conserver le commentaire ; retour Studio |
| Valider revue | `review.decision = "approved"`; navigation Planification |
| Planifier | `status = "Planifiés"`; écrire date/heure/fuseau ; ajouter une version ; écran réussite |
| Publier maintenant | `status = "Publiés"`; `publication.publishedAt = ISODate`; ajouter une version ; écran réussite |
| Comparer versions | mémoriser `comparison = [currentVersionId, selectedVersionId]`; afficher le comparateur |
| Restaurer une version | ne jamais supprimer l’historique : cloner la version choisie comme nouvelle version courante, `status = "Brouillons"`, puis ouvrir le Studio |
| Choisir un état système | `publication.systemState = refused | forbidden | failed` |
| Réessayer | effacer `systemState`, puis retourner en Planification ou écran réussite selon le scénario |
| Changer le type public | `publicPreviewType = article | podcast | documentaire | jeu | ebook` |

### Directeur

| Action | Mutation |
|---|---|
| Enregistrer une classe | ajouter ou modifier `director.classes`; mettre à jour `metrics.activeClasses`; toast puis retour Classes |
| Envoyer une invitation | pousser une invitation `pending` dans `pendingInvitations`; incrémenter `invitedTeachers` |
| Confirmer une affectation | écrire `assignments[classId] = { teacherId, manualId }`; mettre à jour `classes[].teacher` |
| Générer des codes | ajouter un lot à `activationBatches` avec `classId`, nombre et horodatage ; ne pas stocker de vrais codes |
| Recherche/filtre | mettre à jour `director.filters` ou la requête locale et re-rendre les lignes/cartes |
| Contacter l’assistance | ajouter un ticket fictif avec statut `Envoyé` ; afficher un numéro de suivi non sensible |

Un bouton de remise à zéro peut supprimer uniquement cette clé de session, jamais `localStorage` en bloc.

## Données fictives à conserver

- Contenu Admin : `POD-0018`, « Les voix du Maroc · Épisode 01 », Podcast, puis titre public « Les voix du Maroc : la marche du quartier ».
- Établissement : École Al Manar, Casablanca, année 2026–2027, directeur M. Benjelloun.
- KPI : 18 classes, 42 enseignants, 618 élèves, 94 % activés, 76 % actifs semaine, santé 82/100, synchronisation 78 %.
- Pour lever l’incohérence du board Directeur, les deux classes sans enseignant sont `6B` et `6C`. `5A` reste affectée à Salma Idrissi.
- Aucune adresse courriel réelle, aucun vrai code d’activation et aucune donnée personnelle exploitable.

## Export Pen sans perdre l’injection

1. Exporter uniquement les 84 frames écran du manifest W01–W06 avec `includeLayerNames: true`. Exclure les boards de flux.
2. Archiver le HTML brut sous `reference/pencil-export-source-v3.html` afin qu’il reste versionné sans être embarqué dans le site publié.
3. Copier ce brut vers `public/pencil-export.html`.
4. Injecter de façon déterministe dans `<head>` : `<link rel="stylesheet" href="prototype.css">`.
5. Injecter juste avant `</body>`, dans cet ordre : `<script src="prototype-config.js"></script>`, puis `<script src="prototype.js"></script>`.
6. Vérifier automatiquement que chaque nom de frame du manifest existe exactement une fois et que tous les contrôles P0 existent au moins une fois.
7. Ne jamais apporter de correction visuelle directement dans le HTML exporté : corriger Pen, réexporter, puis réinjecter.

Créer ensuite `scripts/inject-pencil-prototype.mjs` pour automatiser les étapes 3 à 6. Cela évite que le prochain export écrase silencieusement les scripts et styles.

## Risques actuels et garde-fous

1. **Iframe et URL non synchronisées.** Le hash interne actuel n’est ni partageable ni restauré au rechargement. Le pont vers l’historique parent est P0.
2. **Export monolithique.** Le fichier actuel pèse environ 917 Ko pour 4 frames, 811 `div` et 223 SVG. Trente-quatre frames peuvent approcher 7–8 Mo. Mesurer avant publication.
3. **Sélecteurs fragiles.** Il existe déjà 60 noms de calques dupliqués. Toujours limiter les sélecteurs à la frame active et s’appuyer sur les noms P0 exacts.
4. **Données dupliquées ordinateur/tablette.** L’état JavaScript doit être la source unique ; chaque `renderRoute()` hydrate la frame active depuis cet état.
5. **Réexport destructif.** L’export remplace les liens CSS/JS. L’injecteur et le test de contrat doivent être obligatoires avant le build.
6. **État uniquement en mémoire.** Sans `sessionStorage`, un rechargement efface invitations, affectations, codes et publication. Versionner le schéma.
7. **Navigation clavier.** Les frames masquées doivent être `inert`; les modales doivent piéger le focus, répondre à Échap et le rendre au déclencheur.
8. **Polices distantes.** Inter et Outfit viennent de Google Fonts. Prévoir une vérification Sites et conserver les fallbacks système.

## Tests d’acceptation

### Contrat export

- 84 frames attendues, chacune exactement une fois.
- `prototype-config.js`, puis `prototype.js`, chargés dans cet ordre.
- Logo et autres actifs locaux retournent 200.
- Aucune erreur JavaScript au chargement.

### Admin ordinateur et tablette

- Bibliothèque → Studio → Prévisualisation → Revue → Planification → Réussite → Contenu public.
- Branche corrections demandées → retour Studio avec commentaire et statut conservés.
- Historique → comparaison → restauration comme nouvelle version Brouillon.
- États Refusé, Droits insuffisants et Erreur publication → Réessayer.
- Précédent/Suivant du navigateur et rechargement conservent route et état de session.

### Directeur ordinateur et tablette

- Dashboard → création de classe → sauvegarde → présence dans la liste.
- Invitation enseignant → statut En attente.
- Affectation enseignant/manuel → classe mise à jour.
- Génération d’un lot de codes → confirmation et indicateur mis à jour.
- Recherches Classes/Enseignants/Élèves, quatre filtres et trois onglets.
- Alertes → Suivi ; Assistance → ticket de confirmation.

### Qualité

- 1440×900 et 1024×768 sans contenu coupé ni contrôle hors écran.
- Focus visible, activation Entrée/Espace, fermeture Échap, retour du focus.
- Aucun contrôle d’une frame inactive accessible au clavier.
- Build `pnpm run build` réussi, puis `pnpm run test:sites` : 4/4.
- Publier une nouvelle version du projet Sites existant `appgprj_6a88a5e396708191ae642a599cad1011` seulement après ces validations.
