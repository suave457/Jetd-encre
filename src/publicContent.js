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
      ["Regarder un progrès concret", "Un mot nouveau, une phrase plus précise ou une initiative de parole est un progrès observable. Dans le futur service, le bilan parent devra s’appuyer sur des activités réellement réalisées. Aujourd’hui, l’espace famille est une démonstration locale."],
    ], cta: ["Explorer l’espace famille de démonstration", "/connexion/parent"],
  },
  "/ecoles": {
    title: "Préparer un pilote dans votre école", description: "Périmètre du pilote Jet d’Encre : une unité de français, quelques classes accompagnées et des critères précis avant l’ouverture du service.",
    eyebrow: "Pour les établissements",
    intro: "Le premier pilote vise une unité de 5e AEP, avec des aides différenciées. Il n’est pas encore ouvert à de vrais dossiers d’élèves.",
    sections: [
      ["Un périmètre clair", "Une unité, des séquences courtes et quelques classes. Un enseignant relais accompagne la prise en main. Les jeux et médias sont choisis selon les objectifs de communication, pas selon leur quantité."],
      ["Un cycle complet à vérifier", "L’enseignant donne un devoir, l’élève remet son travail, l’enseignant fournit un retour et le parent consulte un bilan. Ce cycle doit fonctionner sur des appareils distincts avec des droits vérifiés."],
      ["Avant de commencer", "Comptes individuels, autorisations, contenus relus, conditions d’utilisation, sauvegarde et assistance doivent être prêts. L’école de démonstration sert uniquement à la recette ; aucune inscription réelle n’est recueillie sur cette page."],
    ], cta: ["Explorer l’espace enseignant de démonstration", "/connexion/enseignant"],
  },
  "/niveau/5e-aep": {
    title: "Le pilote de français en 5e AEP", description: "Découvrez le périmètre de préparation du niveau 5e AEP : vocabulaire, compréhension et courtes productions, avec une différenciation adaptée.",
    eyebrow: "Niveau pilote en préparation",
    intro: "Une première unité cohérente avant d’étendre la collection. Le niveau de classe ne détermine pas à lui seul le niveau de français.",
    sections: [
      ["Des situations proches des élèves", "Décrire son quartier, demander poliment des produits ou présenter un lieu. Les activités s’appuient sur des situations marocaines et font pratiquer lecture, écoute et expression."],
      ["Des aides pour des niveaux hétérogènes", "Définitions simples, modèles de phrases et reprise de la consigne permettent d’ajuster l’accompagnement. Les repères A1–A2 guident la conception ; ils ne constituent pas une certification de l’élève."],
      ["Ce qui est accessible aujourd’hui", "Le prototype permet d’essayer des jeux et des médias de démonstration. La collection complète, le suivi entre appareils et la couverture du programme restent en préparation et ne sont pas annoncés comme disponibles."],
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
});
export const PUBLIC_PREVIEW_PATHS = Object.freeze(["/", ...Object.keys(PUBLIC_PAGES)]);
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
    robots: indexable && safeOrigin && publicContent ? "index,follow" : "noindex,nofollow",
  };
}

