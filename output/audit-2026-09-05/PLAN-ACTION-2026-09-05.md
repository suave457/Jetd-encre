# Jet d’Encre — Plan d’action après audit
## Ordre recommandé · 5 septembre 2026

**Objectif : une première école peut utiliser un parcours complet et fiable, avec des accès attribués manuellement par Jet d’Encre, une progression conservée et une assistance réelle.** Aucun des travaux ci-dessous n’est présenté comme déjà réalisé.

## Lot 1 — Sauvegarder l’état du projet et corriger les défauts confirmés

**Responsable : développement. Effort indicatif : 1 à 3 jours de travail, hors validation externe.**

1. Examiner les fichiers modifiés, séparer les artefacts privés, enregistrer un état propre dans Git et vérifier la reconstruction depuis un clone.
2. Corriger l’ordre des quotas de connexion et ajouter le test de non-interférence entre utilisateurs.
3. Corriger la saisie rapide des mots fléchés ; protéger les raccourcis et les saisies groupées.
4. Corriger l’en-tête de grille sur tablette et les contrastes partagés.

**Validation de sortie :** suite complète verte ; aucune lettre perdue aux vitesses testées ; une source abusive n’empêche pas une source neuve de se connecter ; captures sans chevauchement à 1440 × 900, 1366 × 768 et 1024 × 768 ; contrôle clavier réel.

## Lot 2 — Donner une seule entrée claire aux écoles

**Responsables : développement + produit. Effort indicatif : 1 à 2 jours.**

- « Me connecter » ouvre le vrai parcours scolaire ; « Essayer la démonstration » reste distinct.
- Le rôle est déterminé par le serveur ; aucun choix du navigateur ne confère un droit.
- L’équipe Jet d’Encre crée l’école, ses classes et les comptes. Il n’y a pas d’inscription libre d’école.
- L’administration indique clairement : compte créé, identité rattachée, accès actif ou suspendu.
- Préparer une fiche d’accueil et une procédure sûre de première connexion et de récupération. Garder les notes de mots de passe de test hors du dépôt ; pour les comptes réels, définir une remise privée et un changement initial approprié.

**Validation de sortie :** un enseignant, un parent et un élève trouvent leur espace depuis l’accueil sans instruction technique ; la suspension révoque les sessions ; un compte d’une autre classe ou école n’accède pas aux travaux.

## Lot 3 — Relier un premier jeu au compte scolaire

**Responsable : développement. Effort indicatif : 3 à 5 jours. Dépend du lot 2.**

Commencer par **les mots fléchés**, déjà validés comme concept par le propriétaire.

- Sauvegarder grille et progression par élève côté serveur.
- Calculer les récompenses depuis la grille et les réponses vérifiées ; appliquer 20, 35 ou 50 XP selon le niveau.
- Utiliser une opération idempotente : double clic, rechargement et requête répétée ne donnent pas deux récompenses.
- Préserver le travail en cas de coupure réseau et montrer l’état « enregistré » ou « à synchroniser ».
- Afficher la progression à l’élève et un résumé utile au parent. Distinguer entraînement, XP et compétences évaluées.

**Validation de sortie :** retrouver sa grille sur un second navigateur ; une grille terminée ne crédite qu’une fois ; les XP sont identiques après reconnexion ; aucune progression d’un autre élève n’est visible ; une requête falsifiée ne crée pas de points.

Les autres jeux viennent après ce parcours de référence. Ne pas financer d’abord une multiplication des jeux ou une correction générative automatique.

## Lot 4 — Finir la médiathèque et la recette pédagogique

**Responsables : développement + relecture FLE/édition. Effort indicatif : 2 à 3 jours, hors création de contenu.**

- Conserver dernière page, zoom et progression de lecture ; proposer « Reprendre ».
- Vérifier les fichiers manquants, longs ou invalides et les messages associés.
- Vérifier la lecture avec clavier et technologies d’assistance, puis sur une vraie tablette.
- Préparer un petit catalogue réellement publiable avec droits, source, niveau, objectif, transcription et tâche de réemploi.
- Revoir les 222 réponses et indices au regard du niveau et du public marocain : vocabulaire usuel, définition univoque, formulation naturelle, absence de réponse révélée trop tôt. Les tests structurels ne remplacent pas cette relecture.
- Corriger les détails comme « 1 mots trouvés » et « 1 mots dans le carnet ».

**Validation de sortie :** ressources utiles sans assistance de l’équipe, reprise de lecture fiable, aucun fichier privé inclus involontairement, droits de publication documentés, échantillon relu par un enseignant.

## Lot 5 — Préparer l’exploitation et compléter les contrôles de sécurité

**Responsables : développement/exploitation + propriétaire. Effort indicatif : 2 à 4 jours techniques.**

- Compléter la revue de sécurité des implémentations restantes, avec priorité au passage des données de démonstration vers le serveur.
- Vérifier les configurations réelles Auth0 et Cloudflare sans divulguer les secrets : permissions minimales, récupération d’accès, protections administrateur, alertes et quotas.
- Séparer clairement test et production ; protéger les médias qui exigent une autorisation.
- Sauvegarder puis restaurer une copie isolée ; vérifier les données et consigner la procédure.
- Tester un retour de version et une migration depuis une base représentative.
- Mesurer un palier limité d’utilisateurs sur une préproduction isolée, avec plafond de coût et critères d’arrêt. Ne pas saturer le site gratuit actuel.
- Rendre visibles les erreurs utiles au support grâce aux références de requête, sans enregistrer le contenu des devoirs ni les secrets.

**Validation de sortie :** reconstruction depuis Git et contrôles CI réussis sur les deux systèmes ; restauration et retour de version démontrés ; alertes reçues ; limites documentées ; aucun défaut bloquant encore ouvert dans le périmètre choisi.

## Lot 6 — Préparer l’ouverture légale et publique

**Responsable : propriétaire, avec appui technique et conseil compétent. Délai externe non estimé. Peut avancer en parallèle.**

- Choisir le domaine officiel et renseigner l’identité réelle de l’éditeur.
- Mettre en service l’assistance et tester un message reçu et une réponse.
- Valider contrats avec l’école, information des familles, responsabilités, conservation, demandes d’accès/suppression, prestataires et transferts éventuels.
- Faire décrire au site son fonctionnement réel : distinguer stockage de démonstration, sessions et données scolaires.
- Préparer les pages et articles publics, leur rendu initial, sitemap et métadonnées ; conserver les espaces privés hors index.
- N’autoriser l’indexation que sur le domaine et le contenu approuvés.

**Validation de sortie :** dossier juridique approuvé, contacts fonctionnels, aucune identité fictive sur les pages de production, contenu public exact, accès privés protégés.

## Lot 7 — Mener une recette avec une école avant d’élargir

**Responsables : produit + enseignant référent + familles volontaires. Après les lots nécessaires aux données réelles.**

Proposition : une école, deux classes et un petit groupe de familles, sur un cycle complet de devoir. La taille exacte dépendra du cadre validé et des limites mesurées.

Observer la première connexion, la lecture d’une consigne, une grille complétée, la remise d’un travail, une correction consultée par le parent et une récupération de compte. Relever les abandons et demandes d’aide ; ne pas confondre un score d’XP avec un progrès linguistique.

**Critères proposés de passage à l’ouverture :**

| Critère | Seuil de décision proposé |
| --- | --- |
| Données et droits | Aucun accès entre familles/classes non autorisé ; aucun travail perdu |
| Connexion | Chaque rôle complète le parcours depuis l’accueil |
| Progression | Récompense unique, persistante et contrôlée pour le premier jeu |
| Compréhension | Au moins 8 utilisateurs sur 10 terminent les actions clés sans guidage technique |
| Exploitation | Sauvegarde restaurée, support joignable, alerte et retour de version testés |
| Risques ouverts | Aucun défaut de sécurité ou de fonctionnement bloquant pour le périmètre annoncé |
| Cadre réel | Identité, contrats et formalités applicables validés |

Ces seuils sont des objectifs de recette, pas des résultats déjà obtenus.

## Décision de chef de projet

**Premier travail à engager : le lot 1, puis une connexion unifiée et les mots fléchés reliés au vrai profil.** C’est le chemin le plus court vers une valeur concrète pour l’école et la famille. La reprise PDF et les améliorations éditoriales viennent ensuite ; les nouveaux jeux et fonctions d’IA avancées attendent.

L’effort total reste une estimation de cadrage : les travaux externes, la relecture des contenus, les défauts découverts pendant la suite de l’audit et la recette avec une école peuvent modifier le calendrier. Ne pas annoncer une date publique avant les validations de sortie.
