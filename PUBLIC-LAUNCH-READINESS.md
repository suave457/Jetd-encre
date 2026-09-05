# Préparation du lancement public — 5 septembre 2026

## Accès et accueil

- `/pilote` est l’entrée scolaire. Les liens publics Connexion utilisent une navigation de document vers cette application distincte, y compris ses pages de jeux.
- `/pilote/jeux/mots-fleches` est une route exacte du jeu scolaire ; ses droits et données restent contrôlés par le service scolaire.
- `/connexion` conserve les profils de démonstration locale. Les liens qui y conduisent sont explicitement nommés « Démonstration ». Le choix d’un rôle n’attribue aucun droit scolaire.
- `/admin/ecoles-acces` ouvre l’administration des accès, soumise à son contrôle d’accès existant. Aucun espace direction connecté n’est annoncé.
- `/guide-ecole` explique la remise privée des accès, la vérification du profil, la récupération du mot de passe et la déconnexion sur un appareil partagé. Référencer ce guide aussi depuis l’espace scolaire.
- La récupération appartient au fournisseur de connexion et au gestionnaire habilité. Le guide n’envoie aucun courriel et ne remplace pas le mot de passe. Les coordonnées fictives ne sont pas présentées comme une assistance validée.

## Référencement préparé, indexation non ouverte

Le prérendu public couvre l’accueil, les pages d’information, le guide, le Mag et ses six articles statiques d’exemple. Le contenu éditorial statique est partagé entre les métadonnées et le rendu ; les modifications locales de démonstration ne sont pas publiées dans le build.

Les métadonnées restent `noindex,nofollow` par défaut. Sans origine HTTPS valide et activation explicite, le sitemap reste vide et robots.txt interdit l’exploration. Les hôtes `workers.dev`, `pages.dev` et `chatgpt.site` restent interdits même si l’option d’indexation est activée. Les chemins scolaires, administratifs, de connexion et de récupération ne figurent pas au sitemap. robots.txt n’est pas un contrôle d’accès.

Ce correctif ne change ni les variables d’environnement, ni les en-têtes du Worker, ni le déploiement. Le `noindex` de staging doit rester en place, côté HTML comme côté serveur.

## Conditions avant une future ouverture

1. Confirmer l’identité de l’éditeur, le domaine public, les contacts et le responsable de l’assistance ; remplacer ou supprimer les coordonnées fictives. Faire valider les conditions applicables et l’accueil de données réelles avant tout usage avec des élèves.
2. Faire relire et approuver chaque texte public et article, y compris signatures, images et affirmations pédagogiques. Les articles actuels restent signalés comme des exemples.
3. Valider la remise des accès et une procédure de récupération avec l’établissement. Vérifier les rôles et rattachements sans publier d’identifiants ni de mots de passe.
4. Configurer seulement après ces validations `VITE_PUBLIC_SITE_URL` avec le domaine HTTPS confirmé et `VITE_PUBLIC_INDEXING_ENABLED=true` pour le build public approuvé. Ne pas activer cette option sur le site de test.
5. Vérifier les pages produites, titres, descriptions, canoniques, robots.txt, sitemap et les en-têtes de réponse. Toute adaptation future des en-têtes serveur doit conserver le noindex des espaces privés et des environnements de test.

Aucun domaine, contact officiel, validation éditoriale, ouverture publique, indexation effective ou déploiement n’est attesté par ce document.
