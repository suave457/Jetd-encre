import { PUBLIC_BLOG_ARTICLES } from "./publicContentArticles.js";

export const PUBLIC_TEST_NOTICE = Object.freeze({
  title: "Accès scolaire en test · données fictives.",
  body: "Le pilote utilise des comptes de test. Ne saisissez pas de données personnelles d’élèves. Les coordonnées officielles restent à valider avant l’ouverture du service.",
});

export const PUBLIC_PAGES = Object.freeze({
  "/methode": {
    title: "Notre méthode de français", description: "Une méthode de FLE ancrée dans le contexte marocain : comprendre, pratiquer et réutiliser le français entre la classe et la maison.",
    eyebrow: "La démarche Jet d’Encre",
    intro: "Partir d’une situation que l’enfant reconnaît, lui donner les mots pour agir et l’aider à les réutiliser.",
    sections: [
      ["Comprendre une situation", "Un dialogue, une image ou un court texte introduit un besoin de communication : demander un produit, décrire un lieu ou raconter un événement. La darija et l’amazighe peuvent aider à clarifier le sens avant la formulation en français."],
      ["S’entraîner avec des aides", "L’enfant dispose de consignes courtes, de modèles et de définitions. Un jeu entraîne un objectif précis ; une correction explique l’erreur. La vitesse et les XP ne suffisent pas à démontrer la maîtrise."],
      ["Réutiliser et recevoir un retour", "Une petite production termine la séquence : un message, quatre phrases ou une présentation orale. Le retour porte sur la clarté, le lexique et la formulation. Le pilote doit encore valider l’ensemble de ce parcours."],
    ], cta: ["Lire un extrait", "/decouvrir"],
  },
  "/familles": {
    title: "Accompagner son enfant en français", description: "Trois gestes simples pour pratiquer le français à la maison, dans un contexte plurilingue et sans faire le travail à la place de l’enfant.",
    eyebrow: "Pour les familles",
    intro: "Cinq minutes de conversation peuvent prolonger ce qui a été travaillé en classe. L’objectif est d’oser parler et de comprendre.",
    sections: [
      ["Inviter à raconter", "Demandez : « Quel endroit as-tu aimé aujourd’hui ? » Laissez l’enfant réfléchir. S’il cherche un mot, proposez un choix ou un début de phrase : « J’ai aimé… parce que… »."],
      ["Reformuler sans interrompre", "Accueillez d’abord l’idée. Reprenez ensuite la phrase naturellement en français. Une courte explication en darija ou en amazighe peut aider ; revenez ensemble à une formulation française accessible."],
      ["Regarder un progrès concret", "Un mot nouveau, une phrase plus précise ou une initiative de parole est un progrès observable. Avec le compte parent remis par l’école, l’espace scolaire permet de consulter les travaux et retours associés à son enfant. Le pilote reste réservé aux données de test ; les profils de démonstration sont séparés."],
    ], cta: ["Ouvrir mon espace scolaire", "/pilote"], secondaryCta: ["Lire le guide d’accueil", "/guide-ecole"],
  },
  "/ecoles": {
    title: "Préparer un pilote dans votre école", description: "Périmètre du pilote Jet d’Encre : une unité de français, quelques classes accompagnées et des critères précis avant l’ouverture du service.",
    eyebrow: "Pour les établissements",
    intro: "Le premier pilote vise une unité de 5e AEP, avec des aides différenciées. Il n’est pas encore ouvert à de vrais dossiers d’élèves.",
    sections: [
      ["Un périmètre clair", "Une unité, des séquences courtes et quelques classes. Un enseignant relais accompagne la prise en main. Les jeux et médias sont choisis selon les objectifs de communication, pas selon leur quantité."],
      ["Un parcours scolaire distinct de la démonstration", "L’espace scolaire relie les comptes attribués par l’établissement : devoir de l’enseignant, remise de l’élève et consultation du retour par le parent. Le pilote est encore en test. Le choix d’un profil dans la démonstration ne crée aucun droit scolaire et l’espace direction connecté n’est pas disponible."],
      ["Avant de commencer", "L’administration prépare l’école, les classes et les comptes individuels, puis remet les accès en privé. Il n’y a pas d’inscription libre. Autorisations, contenus relus, conditions d’utilisation, sauvegarde et assistance doivent être validés avant un accueil réel ; les coordonnées affichées dans la démonstration ne sont pas des contacts officiels validés."],
    ], cta: ["Ouvrir mon espace scolaire", "/pilote"], secondaryCta: ["Préparer les accès avec le guide", "/guide-ecole"],
  },
  "/niveau/5e-aep": {
    title: "Le pilote de français en 5e AEP", description: "Découvrez le périmètre de préparation du niveau 5e AEP : vocabulaire, compréhension et courtes productions, avec une différenciation adaptée.",
    eyebrow: "Niveau pilote en préparation",
    intro: "Une première unité cohérente avant d’étendre la collection. Le niveau de classe ne détermine pas à lui seul le niveau de français.",
    sections: [
      ["Des situations proches des élèves", "Décrire son quartier, demander poliment des produits ou présenter un lieu. Les activités s’appuient sur des situations marocaines et font pratiquer lecture, écoute et expression."],
      ["Des aides pour des niveaux hétérogènes", "Définitions simples, modèles de phrases et reprise de la consigne permettent d’ajuster l’accompagnement. Les repères A1–A2 guident la conception ; ils ne constituent pas une certification de l’élève."],
      ["Ce qui est accessible aujourd’hui", "Les jeux et médias de démonstration permettent une première exploration. L’espace scolaire propose seulement les activités qui y sont effectivement affichées pour le compte de test. La collection complète et la couverture du programme restent en préparation ; les progrès de démonstration ne sont pas transférés au compte scolaire."],
    ], cta: ["Lire l’extrait de démonstration", "/decouvrir"],
  },
  "/decouvrir": {
    title: "Un petit extrait pour découvrir Jet d’Encre", description: "Lisez une courte promenade dans un quartier marocain et racontez à votre tour un lieu familier. Extrait pédagogique de démonstration.",
    eyebrow: "Lire et prendre la parole",
    intro: "Une promenade dans le quartier — extrait de démonstration à adapter avec l’enseignant.",
    sections: [
      ["Je lis", "Samedi matin, Salma accompagne son père au marché. Ils passent devant une petite librairie. Sur la place, un artisan range des paniers colorés. Salma demande : « Pouvons-nous regarder les livres après les courses ? » Son père sourit : « Oui, choisissons d’abord les fruits. » Au retour, Salma décrit la place à son petit frère : « Il y a une fontaine au milieu et des boutiques tout autour. »"],
      ["Je comprends", "Où vont Salma et son père ? Que souhaite regarder Salma ? Retrouvez dans le texte une expression qui indique une position. Réponses pour vérifier : au marché ; les livres ; « au milieu » ou « tout autour »."],
      ["À moi de parler", "Décrivez un endroit de votre quartier en deux ou trois phrases. Vous pouvez commencer par : « Près de chez moi, il y a… » puis « À côté, je vois… ». Demandez à votre camarade quel détail l’aide à imaginer cet endroit."],
    ], cta: ["Découvrir les aides pour les familles", "/familles"],
  },
  "/guide-ecole": {
    title: "Le guide d’accueil de votre école", description: "Recevoir son accès Jet d’Encre, se connecter avec le bon compte, demander une réinitialisation et utiliser un appareil partagé en toute clarté.",
    eyebrow: "Élèves, familles et enseignants",
    intro: "Un seul point d’entrée : le bouton Connexion ouvre l’espace scolaire. Ce guide accompagne le pilote de test ; l’accueil de vrais élèves reste soumis à la validation de l’établissement et de l’éditeur.",
    sections: [
      ["1. Recevoir son accès en privé", "L’administration Jet d’Encre crée l’école, les classes et les comptes. Le référent de l’établissement coordonne les demandes et la remise des accès. Recevez votre identifiant et les consignes par son canal habituel, en privé. Il n’y a pas d’inscription libre : une activation de démonstration ou un choix de profil ne crée pas un compte scolaire. Ne partagez jamais votre mot de passe dans un devoir, une capture d’écran ou un groupe de discussion."],
      ["2. Se connecter et vérifier son profil", "Ouvrez Connexion, puis connectez-vous avec le compte reçu. Le rôle et les accès viennent de l’affectation validée par l’administration Jet d’Encre ; vous ne les choisissez pas à la connexion. Vérifiez le nom du compte et les informations affichées. Un parent consulte seulement les enfants qui lui sont rattachés. Si le profil ou le rattachement est incorrect, arrêtez-vous et signalez-le au référent sans ouvrir les travaux d’une autre personne."],
      ["3. Mot de passe oublié ou accès refusé", "Repartez du bouton Connexion de ce site. Si le formulaire de connexion propose « Mot de passe oublié ? », suivez ses indications avec l’identifiant reçu. Sinon, demandez au référent de l’établissement une réinitialisation auprès du gestionnaire des accès. Ne créez pas un second compte pour contourner le problème et ne communiquez pas votre ancien mot de passe. Aucun envoi de message ni changement de mot de passe n’est effectué par cette page."],
      ["4. Utiliser un appareil partagé", "À la fin, choisissez Déconnexion et vérifiez que l’écran propose de se connecter à nouveau. Ne mémorisez pas le mot de passe sur un appareil partagé. À la prochaine connexion, vérifiez le nom du compte avant de travailler ; fermer seulement l’onglet ne suffit pas à terminer une session."],
      ["5. Essayer la démonstration sans confondre les données", "Le lien Démonstration ouvre des profils fictifs et des essais enregistrés dans le navigateur. Les remettre à zéro ou effacer le stockage du navigateur ne réinitialise pas un mot de passe scolaire. Les devoirs et résultats de démonstration ne sont pas transférés dans le pilote. L’espace direction existe uniquement en démonstration à ce stade."],
      ["6. Qui peut aider ?", "Utilisez le contact habituel déjà communiqué par votre établissement. Les noms, adresses et coordonnées de démonstration ne constituent pas un service d’assistance officiel. Le responsable éditorial, le domaine public, les contacts et les conditions d’accueil doivent être confirmés avant l’ouverture du service à de vrais élèves."],
    ], cta: ["Ouvrir mon espace scolaire", "/pilote"], secondaryCta: ["Essayer la démonstration", "/connexion"],
  },
});
export const PUBLIC_PREVIEW_PATHS = Object.freeze(["/", ...Object.keys(PUBLIC_PAGES), "/blog", ...PUBLIC_BLOG_ARTICLES.map(article => `/blog/${article.slug}`)]);
export function getSiteOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (["localhost", "127.0.0.1"].includes(url.hostname) || url.hostname.endsWith(".invalid")) return null;
    return url.origin;
  } catch { return null; }
}
export function getPageMetadata(path, { origin, indexable = false, article } = {}) {
  const page = PUBLIC_PAGES[path];
  article ??= PUBLIC_BLOG_ARTICLES.find(item => path === `/blog/${item.slug}`);
  const isArticle = path.startsWith("/blog/") && Boolean(article);
  const title = page?.title || (isArticle ? article.title : ({
    "/": "Jet d’Encre — Le français entre la classe et la maison",
    "/blog": "Le Mag Jet d’Encre — Français et pédagogie",
    "/mentions-legales": "Mentions légales — démonstration",
    "/confidentialite": "Confidentialité — démonstration",
    "/conditions-utilisation": "Conditions d’utilisation — démonstration",
    "/accessibilite": "Accessibilité de Jet d’Encre",
    "/cookies": "Stockage local et cookies",
    "/connexion": "Connexion de démonstration",
    "/activation": "Tester l’activation d’un manuel",
  })[path] || "Espace de démonstration");
  const safeOrigin = getSiteOrigin(origin);
  const publicContent = PUBLIC_PREVIEW_PATHS.includes(path) || path === "/blog" || isArticle;
  return {
    title: title.includes("Jet d’Encre") ? title : title + " · Jet d’Encre",
    description: page?.description || article?.excerpt || "Démonstration de Jet d’Encre : manuels, jeux et médias pour pratiquer le français dans le contexte marocain. Les données scolaires restent fictives.",
    canonical: safeOrigin && publicContent ? safeOrigin + path : null,
    robots: isPublicIndexingEnabled({ origin: safeOrigin, indexable }) && publicContent ? "index,follow" : "noindex,nofollow",
  };
}


// Staging must stay unindexed even if the production opt-in is set accidentally.
export function isPublicIndexingEnabled({ origin, indexable = false } = {}) {
  const safeOrigin = getSiteOrigin(origin);
  if (!indexable || !safeOrigin) return false;
  return !/(?:^|\.)(?:workers\.dev|pages\.dev|chatgpt\.site)$/.test(new URL(safeOrigin).hostname);
}

export function buildPublicSitemap(options = {}) {
  const origin = getSiteOrigin(options.origin);
  const escapeXml = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const urls = isPublicIndexingEnabled(options)
    ? PUBLIC_PREVIEW_PATHS.map(path => "<url><loc>" + escapeXml(origin + path) + "</loc></url>").join("") : "";
  return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>";
}

export function buildPublicRobots(options = {}) {
  if (!isPublicIndexingEnabled(options)) return "User-agent: *\nDisallow: /\n";
  const privatePrefixes = ["/pilote", "/eleve", "/parent", "/enseignant", "/directeur", "/admin", "/connexion", "/activation", "/mot-de-passe-oublie", "/reinitialisation", "/session-expiree", "/invitation", "/api", "/__local-media"];
  return "User-agent: *\nAllow: /\n" + privatePrefixes.map(path => "Disallow: " + path + "\n").join("") + "Sitemap: " + getSiteOrigin(options.origin) + "/sitemap.xml\n";
}
