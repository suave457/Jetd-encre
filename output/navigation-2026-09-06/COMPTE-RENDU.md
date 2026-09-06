# Navigation et accueil administrateur — 6 septembre 2026

## Correction publiée

Le bouton Connexion menait directement au pilote et masquait le choix des profils. L’administrateur arrivait directement sur la gestion des écoles, sans accueil ni navigation propre à cet espace.

- [Choisir mon espace](https://jetdencre-test.mouataz-pro.workers.dev/connexion) : cinq profils, avec deux entrées clairement séparées, **Mon compte** et **Explorer la démonstration**.
- [Accueil administrateur](https://jetdencre-test.mouataz-pro.workers.dev/admin/accueil) : écoles, comptes, classes actives, sessions scolaires, connexions à préparer et liens vers les établissements. Les chiffres viennent du serveur et restent masqués sans droit administrateur.
- [Écoles et accès](https://jetdencre-test.mouataz-pro.workers.dev/admin/ecoles-acces) : gestion conservée, navigation vers l’accueil, le site et le choix du profil. Une école choisie sur l’accueil s’ouvre directement dans cette page.

Les cinq formulaires de démonstration restent disponibles aux anciennes adresses. Le tableau de bord éditorial de démonstration reste `/admin/pilotage` ; il n’est pas présenté comme une administration scolaire connectée. L’espace direction connecté n’est pas encore disponible : sa carte l’annonce et ouvre la présentation destinée aux écoles ; sa démonstration reste accessible.

Choisir Élève, Parent ou Enseignant adapte seulement le texte d’accueil. Le rôle et les droits restent déterminés par le compte authentifié. Aucune inscription libre n’a été ajoutée.

## Vérifications

| Contrôle | Résultat |
| --- | --- |
| Compilation et tests automatisés | 322 réussis, aucun échec. Routes, accès exacts, séparation démo/administration et refus d’un rôle demandé dans l’URL couverts. |
| Navigateur local | Accueil administrateur alimenté par la vraie API locale de test : chiffres concordants ; ouverture de la deuxième école, retour à l’accueil et redirection depuis le pilote réussis. Déconnexion vérifiée en 401. |
| Profils et navigation locale | Cinq cartes ; cinq formulaires de démonstration disponibles ; liens Connexion et Retour ; historique Précédent/Suivant vérifié. |
| Affichage | Choix des profils et accueil administrateur contrôlés à 1440 × 900 et 1024 × 768, sans débordement horizontal. Captures ordinateur inspectées. Il ne s’agit pas d’une validation sur tablette physique. |
| Site publié | Les sept adresses contrôlées — choix des profils, administration, gestion et jeu avec variantes `/` — répondent en 200. Administration anonyme refusée en 401. |
| Connexion réelle | Depuis le choix Enseignant, Auth0 reconnaît Salma ; ses deux travaux remis et sa correction existante sont retrouvés. L’URL demandant le profil admin ne change pas son rôle ; API admin refusée en 403, interface « Accès réservé » sans statistiques. Session de test déconnectée en 401 et navigateur fermé. |
| Compte administrateur du propriétaire | La page protégée est publiée, mais son accueil authentifié n’a pas été vérifié en ligne : le propriétaire doit encore se connecter. Aucun mot de passe ou cookie du propriétaire n’a été lu. |

La disponibilité du serveur, le schéma et l’accès OIDC restent valides. Les autres contrôles de lancement conservent les limites du compte rendu précédent : données fictives, indexation fermée, restauration distante et validations terrain encore à préparer.

## Version et preuves

Source : `77b3bace1c13ecb73a1a37c44f20b6749ca7c42c`.

Worker publié : `cb889945-702e-4ce4-b214-b902950b4cfb`, remplaçant `a2ded34f-8f0d-439f-bf72-20bd65027c5f`. Les variables distantes ont été conservées. Aucune migration, création de compte ou modification de droits. Aucun push Git pendant cette correction.

Les résultats synthétiques sont dans les fichiers JSON voisins. Les captures se trouvent dans `../playwright/navigation-2026-09-06/` ; celles de l’administration utilisent des écoles fictives **locales**, pas les chiffres du site publié. La capture `choix-profils-en-ligne.png` provient du site publié. Les scripts et journaux privés restent exclus du dépôt.
