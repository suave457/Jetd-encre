import "./legal-pages.css";
import { usesSchoolDocumentNavigation } from './routeCore.js';
import { publicContactHref } from './publicContactCore.js';

export const LEGAL_PAGE_PATHS = Object.freeze({
  "mentions-legales": "/mentions-legales",
  confidentialite: "/confidentialite",
  "conditions-utilisation": "/conditions-utilisation",
  cookies: "/cookies",
  accessibilite: "/accessibilite",
});

const PAGE_META = Object.freeze({
  "mentions-legales": {
    eyebrow: "INFORMATIONS LÉGALES",
    title: "Mentions légales",
    description: "Identité de l’éditeur, hébergement et règles applicables à la plateforme Jet d’Encre.",
  },
  confidentialite: {
    eyebrow: "DONNÉES PERSONNELLES",
    title: "Politique de confidentialité",
    description: "Comment Jet d’Encre protège les données des élèves, des familles et des équipes éducatives.",
  },
  "conditions-utilisation": {
    eyebrow: "RÈGLES DU SERVICE",
    title: "Conditions générales d’utilisation",
    description: "Les droits et responsabilités associés à l’utilisation de la plateforme éducative.",
  },
  cookies: {
    eyebrow: "STOCKAGE LOCAL",
    title: "Cookies et technologies similaires",
    description: "Les informations enregistrées dans le navigateur et les choix laissés aux utilisateurs.",
  },
  accessibilite: {
    eyebrow: "INCLUSION NUMÉRIQUE",
    title: "Déclaration d’accessibilité",
    description: "Les engagements, les fonctions disponibles et les améliorations encore prévues.",
  },
});

const DEFAULT_OPERATOR = Object.freeze({
  name: "Jet d’Encre Éditions — entité fictive de démonstration",
  legalForm: "SARL fictive — aucun statut juridique attesté",
  registeredOffice: "12, rue de la Lecture, Ville Démo, Maroc — adresse fictive",
  registry: "DEMO-RC-0001 — référence fictive non valable",
  ice: "DEMO-ICE-0001 — référence fictive non valable",
  publicationDirector: "Équipe de démonstration — responsable réel à désigner",
  contactEmail: "assistance@jetdencre.invalid",
  privacyEmail: "confidentialite@jetdencre.invalid",
  phone: "Aucun numéro réel dans cette démonstration",
  hostName: "Site de test Cloudflare Workers et D1 ; connexion Auth0 ; production à confirmer",
  hostAddress: "Coordonnées contractuelles à renseigner avant ouverture réelle",
  cndpReference: "Aucune formalité déclarée accomplie — référence à valider avant traitement réel",
});

const LAST_UPDATED = "5 septembre 2026";

function HashLink({ to, children, ...props }) {
  return <a href={to} onClick={(event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (usesSchoolDocumentNavigation(to)) return;
    event.preventDefault();
    window.history.pushState({}, "", to);
    window.dispatchEvent(new Event("jde:navigate"));
  }} {...props}>{children}</a>;
}

function ContactAddress({ email }) {
  const href = publicContactHref(email);
  return href ? <a href={href}>{email}</a> : <span title="Contact officiel non fourni — aucun envoi possible">{email || 'Contact à confirmer'} (contact à confirmer)</span>;
}

function ExternalLink({ href, children }) {
  return <a href={href} target="_blank" rel="noreferrer noopener">{children}<span className="legal-external-mark" aria-hidden="true">↗</span></a>;
}

function LegalSection({ id, title, children }) {
  return <section id={id} className="legal-section"><h2>{title}</h2>{children}</section>;
}

function PrototypeNotice() {
  return <aside className="legal-prototype-notice" role="note">
    <strong>Démonstration — informations fictives, sans valeur juridique</strong>
    <p>Les noms, adresses et identifiants d’exemple servent uniquement à tester l’affichage. Les adresses en .invalid ne reçoivent aucun message. Toutes les informations officielles et les formalités applicables doivent être renseignées puis validées avant l’ouverture à de vrais utilisateurs.</p>
  </aside>;
}

function DefinitionList({ items }) {
  return <dl className="legal-definition-list">{items.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>;
}

function MentionsLegales({ operator }) {
  return <>
    <PrototypeNotice />
    <LegalSection id="editeur" title="1. Éditeur de la plateforme">
      <p>La fiche ci-dessous est fictive. Elle illustre les informations que l’éditeur réel devra fournir avant le lancement.</p>
      <DefinitionList items={[
        ["Dénomination", operator.name],
        ["Forme juridique et capital", operator.legalForm],
        ["Siège social", operator.registeredOffice],
        ["Registre du commerce", operator.registry],
        ["ICE", operator.ice],
        ["Directeur ou directrice de publication", operator.publicationDirector],
        ["Adresse électronique", <ContactAddress email={operator.contactEmail}/>],
        ["Téléphone", operator.phone],
      ]} />
    </LegalSection>
    <LegalSection id="hebergement" title="2. Hébergement">
      <p>Le site de test utilise Cloudflare Workers et la base D1 ; Auth0 assure la connexion du parcours scolaire. La démonstration conserve ses essais dans le navigateur, tandis que le parcours scolaire conserve ses comptes de test, travaux et progrès sur le serveur. Ce site ne constitue pas encore un service ouvert à de vrais élèves.</p>
      <DefinitionList items={[["Hébergeur", operator.hostName], ["Adresse", operator.hostAddress]]} />
    </LegalSection>
    <LegalSection id="propriete" title="3. Propriété intellectuelle">
      <p>La marque Jet d’Encre, son identité graphique, les textes, illustrations, activités, jeux, enregistrements et ressources pédagogiques sont protégés par les règles applicables à la propriété intellectuelle. Leur consultation n’emporte aucun transfert de droits.</p>
      <p>Les établissements et utilisateurs autorisés disposent uniquement d’un droit d’usage personnel, pédagogique et non exclusif, dans les limites de leur licence. Toute reproduction, diffusion, adaptation ou exploitation commerciale non expressément autorisée est interdite.</p>
    </LegalSection>
    <LegalSection id="responsabilite" title="4. Responsabilité et disponibilité">
      <p>Jet d’Encre veille à fournir des contenus exacts, accessibles et adaptés aux apprentissages. Les informations pédagogiques complètent le travail de l’enseignant ; elles ne remplacent ni son appréciation professionnelle ni les règles de l’établissement.</p>
      <p>Une maintenance, un incident technique ou une évolution de sécurité peut interrompre temporairement le service. Les fonctions identifiées comme démonstration, bêta ou préproduction ne doivent pas être utilisées avec de vraies données d’élèves.</p>
    </LegalSection>
    <LegalSection id="liens" title="5. Liens et services tiers">
      <p>Les liens externes sont proposés à titre pratique. Jet d’Encre ne contrôle pas les contenus, les pratiques de confidentialité ni la disponibilité des sites tiers. L’utilisateur est invité à consulter leurs propres conditions.</p>
    </LegalSection>
    <LegalSection id="droit" title="6. Droit applicable">
      <p>Ces mentions sont soumises au droit marocain. En cas de difficulté, les parties recherchent d’abord une solution amiable. À défaut, le différend relève des juridictions compétentes selon les règles de procédure applicables.</p>
      <p>Pour les données personnelles, consultez la <HashLink to={LEGAL_PAGE_PATHS.confidentialite}>politique de confidentialité</HashLink>.</p>
    </LegalSection>
  </>;
}

function Confidentialite({ operator }) {
  return <>
    <PrototypeNotice />
    <LegalSection id="responsable" title="1. Responsable du traitement">
      <p><strong>{operator.name}</strong> est destiné à devenir responsable des traitements liés à la plateforme, seul ou conjointement avec l’établissement scolaire selon l’organisation retenue. Les rôles exacts devront être précisés dans le contrat conclu avec chaque établissement.</p>
      <DefinitionList items={[
        ["Contact données personnelles", <ContactAddress email={operator.privacyEmail}/>],
        ["Référence CNDP", operator.cndpReference],
      ]} />
    </LegalSection>
    <LegalSection id="cadre" title="2. Cadre et principes de protection">
      <p>La politique est préparée au regard de la loi marocaine n° 09-08 relative à la protection des personnes physiques à l’égard du traitement des données à caractère personnel et de son décret d’application. Jet d’Encre applique des principes de finalité déterminée, de proportionnalité, d’exactitude, de durée limitée, de confidentialité et de sécurité.</p>
      <p><ExternalLink href="https://www.cndp.ma/textes-et-lois/">Consulter les textes officiels publiés par la CNDP</ExternalLink>.</p>
    </LegalSection>
    <LegalSection id="donnees" title="3. Données susceptibles d’être traitées">
      <ul>
        <li><strong>Compte et identité :</strong> nom, prénom, rôle, adresse électronique, établissement, classe et pseudonyme lorsque celui-ci suffit.</li>
        <li><strong>Parcours pédagogique :</strong> manuels activés, activités, réponses, devoirs, corrections, progression, badges et résultats.</li>
        <li><strong>Échanges :</strong> messages entre la famille, l’enseignant, la direction et l’assistance.</li>
        <li><strong>Préférences :</strong> langue d’aide, confort visuel, réduction des animations et notifications.</li>
        <li><strong>Données techniques :</strong> horodatage, type d’appareil, journaux de sécurité et informations nécessaires au diagnostic.</li>
      </ul>
      <p>Jet d’Encre n’a pas vocation à collecter des données sensibles, médicales ou sans rapport avec l’apprentissage. Les zones de texte libre ne doivent pas être utilisées pour transmettre de telles informations.</p>
    </LegalSection>
    <LegalSection id="finalites" title="4. Pourquoi ces données sont utilisées">
      <ul>
        <li>créer et sécuriser les accès propres à chaque rôle ;</li>
        <li>fournir les manuels, activités, jeux et aides adaptés au niveau ;</li>
        <li>permettre le suivi pédagogique, la remise et la correction des travaux ;</li>
        <li>faciliter les échanges utiles entre l’école et la famille ;</li>
        <li>administrer les licences, prévenir les abus et résoudre les incidents ;</li>
        <li>produire des statistiques agrégées pour améliorer le service.</li>
      </ul>
      <p>Selon la situation, le traitement repose sur le consentement préalable lorsqu’il est requis, la fourniture du service demandé, la relation avec l’établissement ou le respect d’une obligation légale. Aucun profil publicitaire ni aucune vente de données ne sont prévus.</p>
    </LegalSection>
    <LegalSection id="mineurs" title="5. Protection renforcée des élèves mineurs">
      <p>Les comptes Élève sont créés ou activés dans un cadre scolaire et sous la responsabilité des adultes habilités. Les informations présentées à l’enfant doivent être formulées dans un langage clair. Le parent ou représentant légal peut exercer les droits de l’enfant dans les conditions prévues par la loi.</p>
      <p>Les équipes éducatives n’accèdent qu’aux élèves, classes et informations nécessaires à leurs missions. Les défis de classe utilisent des pseudonymes et ne doivent pas rendre publics les résultats individuels.</p>
    </LegalSection>
    <LegalSection id="destinataires" title="6. Destinataires et sous-traitants">
      <p>Les données sont accessibles, selon leurs habilitations, à l’élève concerné, à son représentant légal, aux enseignants autorisés, à la direction de l’établissement et aux personnels techniques strictement habilités. Les prestataires d’hébergement, de maintenance ou d’envoi de messages ne reçoivent que les informations nécessaires à leur mission et doivent être encadrés par contrat.</p>
      <p>Le pilote technique utilise Cloudflare et Auth0, ainsi que Google Fonts pour les polices. Avant de traiter des données scolaires réelles, l’éditeur doit faire examiner les prestataires, les lieux de traitement, les responsabilités et les formalités applicables. Aucune conformité juridique ni formalité accomplie n’est attestée par cette page.</p>
    </LegalSection>
    <LegalSection id="conservation" title="7. Durées de conservation prévues">
      <p>Les durées ci-dessous sont des propositions à valider ; elles ne sont pas une politique de purge déjà activée. Les travaux et progrès fictifs du pilote restent en base jusqu’à une opération administrative contrôlée. Aucun accueil de données scolaires réelles n’est autorisé par ce document.</p>
      <ul>
        <li>compte : pendant sa période d’activité, puis au maximum douze mois après sa désactivation ;</li>
        <li>progression, devoirs et corrections : deux années scolaires après l’année concernée, sauf durée plus courte définie avec l’établissement ;</li>
        <li>messages école–famille : douze mois après la fin de l’année scolaire ;</li>
        <li>demandes d’assistance : vingt-quatre mois après leur clôture ;</li>
        <li>journaux de sécurité : douze mois, sauf nécessité documentée liée à un incident.</li>
      </ul>
      <p>Les obligations légales, un contentieux ou la demande d’un établissement peuvent justifier une durée différente. Les données sont ensuite supprimées ou rendues anonymes.</p>
    </LegalSection>
    <LegalSection id="securite" title="8. Sécurité">
      <p>La version de production doit prévoir une authentification robuste, des autorisations contrôlées côté serveur, le chiffrement des échanges, la journalisation des accès sensibles, des sauvegardes testées et une procédure de gestion des incidents. Les comptes de démonstration ne doivent jamais être réutilisés en production.</p>
    </LegalSection>
    <LegalSection id="droits" title="9. Vos droits">
      <p>Dans les conditions prévues par la loi n° 09-08, toute personne concernée peut demander l’accès aux données qui la concernent, leur rectification et, lorsque les conditions sont réunies, s’opposer à leur traitement. Une demande peut être envoyée à <ContactAddress email={operator.privacyEmail}/> avec les éléments permettant de vérifier l’identité et le compte concernés.</p>
      <p>Si la réponse apportée ne convient pas, la personne peut contacter la <ExternalLink href="https://www.cndp.ma/">Commission Nationale de contrôle de la protection des Données à caractère Personnel (CNDP)</ExternalLink>.</p>
    </LegalSection>
    <LegalSection id="prototype" title="10. Données de démonstration">
      <p>Dans la démonstration, les essais sont locaux et peuvent être effacés par « Réinitialiser la démonstration ». Dans l’espace scolaire connecté, les devoirs, corrections, grilles et XP sont enregistrés sur le serveur pour les comptes de test autorisés. Effacer les données du navigateur ou réinitialiser la démonstration ne supprime pas ces enregistrements serveur. Les réponses de mots fléchés non encore confirmées sont conservées dans l’onglet pendant la session ; gardez cet onglet ouvert en cas de coupure réseau.</p>
    </LegalSection>
  </>;
}

function ConditionsUtilisation({ operator }) {
  return <>
    <PrototypeNotice />
    <LegalSection id="objet" title="1. Objet et acceptation">
      <p>Les présentes conditions encadrent l’accès à Jet d’Encre, plateforme de français destinée aux élèves, familles, enseignants, directions et administrateurs. L’utilisation du service implique leur respect ainsi que celui de la <HashLink to={LEGAL_PAGE_PATHS.confidentialite}>politique de confidentialité</HashLink>.</p>
    </LegalSection>
    <LegalSection id="acces" title="2. Accès au service">
      <p>Les administrateurs Jet d’Encre créent manuellement les écoles, les classes et les accès scolaires. Le référent de l’établissement organise la remise confidentielle des identifiants. Le serveur détermine le rôle attribué ; aucun code de démonstration ni choix de profil ne crée un accès scolaire.</p>
      <p>Les comptes de démonstration servent uniquement à tester le prototype. Ils ne donnent aucun droit sur un futur service de production et ne doivent contenir aucune donnée réelle.</p>
    </LegalSection>
    <LegalSection id="mineurs-cgu" title="3. Utilisateurs mineurs">
      <p>L’usage par un élève mineur s’inscrit dans un cadre défini par l’établissement et son représentant légal. L’adulte accompagnateur veille à la compréhension des règles, à la confidentialité des identifiants et au respect d’autrui.</p>
    </LegalSection>
    <LegalSection id="usage" title="4. Usages autorisés et interdits">
      <p>La plateforme doit être utilisée à des fins éducatives, administratives ou d’accompagnement familial. Il est notamment interdit :</p>
      <ul>
        <li>d’accéder au compte, aux travaux ou aux résultats d’une autre personne ;</li>
        <li>de publier des propos violents, discriminatoires, humiliants ou portant atteinte à la vie privée ;</li>
        <li>de transmettre des données sensibles ou inutiles dans les champs libres ;</li>
        <li>de contourner les protections, perturber le service ou rechercher des vulnérabilités sans autorisation écrite ;</li>
        <li>de copier, revendre ou diffuser les ressources en dehors des droits accordés par la licence.</li>
      </ul>
    </LegalSection>
    <LegalSection id="contenus" title="5. Contenus pédagogiques et contributions">
      <p>Les ressources Jet d’Encre restent la propriété de leurs titulaires. Les réponses, devoirs et messages créés par les utilisateurs demeurent leurs contributions ; ils accordent au service le droit technique limité de les héberger, les présenter aux destinataires autorisés et les traiter pour assurer le suivi pédagogique.</p>
      <p>Un établissement peut retirer un contenu contraire à ses règles ou à la loi. Toute correction automatique reste une aide : l’enseignant conserve la responsabilité de l’évaluation pédagogique.</p>
    </LegalSection>
    <LegalSection id="licences" title="6. Licences et codes manuels">
      <p>Une licence est personnelle ou rattachée à un établissement selon l’offre souscrite. Un code manuel ne peut être cédé, publié ou activé pour plusieurs personnes sauf indication contraire. Une utilisation frauduleuse peut entraîner sa suspension.</p>
    </LegalSection>
    <LegalSection id="disponibilite-cgu" title="7. Disponibilité et évolution">
      <p>{operator.name} peut faire évoluer les contenus et fonctions pour améliorer la sécurité, l’accessibilité et la qualité pédagogique. Une maintenance ou un incident peut rendre tout ou partie du service temporairement indisponible. Les changements importants seront signalés dans un délai raisonnable.</p>
    </LegalSection>
    <LegalSection id="suspension" title="8. Suspension et clôture">
      <p>Un accès peut être suspendu en cas de risque de sécurité, d’usage interdit, de fin de licence ou à la demande de l’établissement habilité. Avant la clôture définitive, les données exportables sont mises à disposition lorsque cela est possible et autorisé.</p>
    </LegalSection>
    <LegalSection id="responsabilite-cgu" title="9. Responsabilités">
      <p>Chaque utilisateur est responsable de l’exactitude des informations qu’il transmet et des actions réalisées depuis son compte. Jet d’Encre met en œuvre les moyens raisonnables pour assurer la qualité du service, sans garantir une disponibilité ininterrompue ni l’absence absolue d’erreur.</p>
    </LegalSection>
    <LegalSection id="contact-cgu" title="10. Contact et droit applicable">
      <p>Une question peut être adressée à <ContactAddress email={operator.contactEmail}/>. Les présentes conditions sont soumises au droit marocain. Les parties privilégient une résolution amiable avant toute saisine de la juridiction compétente.</p>
    </LegalSection>
  </>;
}

function Cookies() {
  return <>
    <PrototypeNotice />
    <LegalSection id="definition" title="1. De quoi parle-t-on ?">
      <p>Un cookie est un petit fichier déposé par un site dans le navigateur. D’autres mécanismes, comme le stockage local, peuvent mémoriser des informations de façon similaire. Cette page couvre les deux.</p>
    </LegalSection>
    <LegalSection id="utilisation" title="2. Utilisation dans le prototype">
      <p>La démonstration utilise le stockage local pour ses profils, préférences, activations et essais. La liseuse y mémorise aussi la dernière page et le zoom, par profil et par livre. Le parcours scolaire utilise un cookie de session nécessaire à l’accès protégé et envoie au serveur les travaux, corrections, réponses aux grilles et récompenses confirmées. Ses brouillons de mots fléchés en attente restent dans le stockage de l’onglet, séparés par compte et école.</p>
      <p>Le prototype n’utilise actuellement ni cookie publicitaire, ni mesure d’audience tierce, ni suivi entre plusieurs sites. Il charge toutefois une typographie depuis Google Fonts, ce qui peut transmettre au fournisseur des informations techniques de connexion.</p>
    </LegalSection>
    <LegalSection id="categories" title="3. Catégories prévues pour la production">
      <DefinitionList items={[
        ["Strictement nécessaires", "Connexion, sécurité, choix de langue et continuité du service. Ils ne peuvent pas être désactivés depuis la plateforme."],
        ["Préférences", "Confort visuel, réduction des animations et personnalisation. Ils doivent pouvoir être modifiés à tout moment."],
        ["Mesure d’audience", "Uniquement après information et accord lorsqu’il est requis, avec des statistiques aussi agrégées que possible."],
        ["Publicité", "Aucun traceur publicitaire ou profilage commercial n’est prévu dans les espaces éducatifs."],
      ]} />
    </LegalSection>
    <LegalSection id="choix" title="4. Gérer vos choix">
      <p>Utilisez « Réinitialiser la démonstration » uniquement pour les essais locaux. La suppression des données du navigateur ne supprime pas les travaux ou XP scolaires déjà enregistrés sur le serveur. Sur un appareil partagé, utilisez d’abord « Se déconnecter » dans l’espace scolaire pour révoquer la session. Auth0 gère également les informations nécessaires à son propre écran de connexion.</p>
      <p>Avant l’ajout de tout outil facultatif en production, un panneau de choix devra permettre d’accepter, de refuser et de modifier séparément les catégories non essentielles.</p>
    </LegalSection>
    <LegalSection id="duree-cookies" title="5. Durée et mise à jour">
      <p>Le cookie de session du pilote a une durée maximale de trois heures ; le cookie de transaction de connexion expire après dix minutes. Une suspension ou une déconnexion révoque l’accès serveur. Les essais de démonstration et marques de lecture restent locaux jusqu’à leur suppression. Les brouillons de grilles en attente survivent au rechargement de leur onglet, mais seule une sauvegarde confirmée par le serveur garantit de les retrouver après fermeture.</p>
    </LegalSection>
  </>;
}

function Accessibilite({ operator }) {
  return <>
    <LegalSection id="engagement" title="1. Engagement">
      <p>Jet d’Encre veut rendre l’apprentissage du français accessible au plus grand nombre, quels que soient l’appareil, la langue première ou les besoins de l’utilisateur. Le référentiel de travail retenu est le niveau AA des WCAG 2.2.</p>
      <div className="legal-status-card"><span aria-hidden="true">◐</span><div><strong>État actuel : conformité partielle</strong><p>Une évaluation technique complète et des tests avec des utilisateurs doivent encore être réalisés avant la déclaration définitive.</p></div></div>
    </LegalSection>
    <LegalSection id="mesures" title="2. Mesures déjà intégrées">
      <ul>
        <li>navigation au clavier et indicateurs de focus visibles ;</li>
        <li>zones tactiles d’au moins 44 pixels pour les actions principales ;</li>
        <li>mise en page adaptable de 320 pixels aux grands écrans ;</li>
        <li>prise en compte de la préférence système de réduction des animations ;</li>
        <li>titres structurés, libellés de formulaires et messages d’état annoncés ;</li>
        <li>textes alternatifs pour les images informatives et décorations ignorées par les lecteurs d’écran.</li>
      </ul>
    </LegalSection>
    <LegalSection id="limitations" title="3. Limitations connues">
      <ul>
        <li>certains jeux intégrés et graphiques demandent encore une validation complète au clavier et avec lecteur d’écran ;</li>
        <li>les transcriptions, sous-titres et fichiers audio définitifs ne sont pas encore disponibles pour tous les médias ;</li>
        <li>les réglages de confort doivent encore être reliés à toutes les interfaces ;</li>
        <li>les documents téléchargeables devront être contrôlés individuellement avant leur publication.</li>
      </ul>
    </LegalSection>
    <LegalSection id="assistance" title="4. Signaler une difficulté">
      <p>Si un contenu ou une fonction vous empêche d’accéder à l’information, écrivez à <ContactAddress email={operator.contactEmail}/>. Indiquez la page, l’appareil, le navigateur, la technologie d’assistance éventuelle et l’action que vous souhaitiez réaliser. Une solution de remplacement accessible sera recherchée.</p>
    </LegalSection>
    <LegalSection id="evaluation" title="5. Évaluation et amélioration">
      <p>Cette déclaration a été préparée le {LAST_UPDATED} à partir d’un audit interne du prototype. Avant la production, elle devra être complétée par des tests automatisés, une revue clavier, une revue avec lecteurs d’écran, un contrôle des contrastes et des essais sur les principaux parcours utilisateurs.</p>
    </LegalSection>
  </>;
}

export function normalizeLegalPage(page = "mentions-legales") {
  const value = String(page).replace(/^#?\/?/, "").replace(/\/$/, "");
  if (value === "cgu" || value === "conditions-generales-utilisation") return "conditions-utilisation";
  if (value === "politique-confidentialite" || value === "vie-privee") return "confidentialite";
  return PAGE_META[value] ? value : "mentions-legales";
}

export function LegalPages({ page = "mentions-legales", operator: operatorOverrides = {} }) {
  const currentPage = normalizeLegalPage(page);
  const meta = PAGE_META[currentPage];
  const operator = { ...DEFAULT_OPERATOR, ...operatorOverrides };
  const content = currentPage === "mentions-legales"
    ? <MentionsLegales operator={operator} />
    : currentPage === "confidentialite"
      ? <Confidentialite operator={operator} />
      : currentPage === "conditions-utilisation"
        ? <ConditionsUtilisation operator={operator} />
        : currentPage === "cookies"
          ? <Cookies />
          : <Accessibilite operator={operator} />;

  return <div className="legal-page">
    <a className="skip-link" href="#legal-main">Aller au contenu</a>
    <header className="legal-header">
      <HashLink to="/" className="legal-brand" aria-label="Jet d’Encre — accueil">
        <img src="/assets/jet-dencre-logo-horizontal-light-400.webp" width="200" height="73" alt="Jet d’Encre Éditions" />
      </HashLink>
      <nav aria-label="Navigation secondaire">
        <HashLink to="/">Accueil</HashLink>
        <HashLink to="/blog">Blog</HashLink>
        <a href="/connexion" className="legal-login-link">Connexion</a>
      </nav>
    </header>
    <section className="legal-hero">
      <span>{meta.eyebrow}</span>
      <h1>{meta.title}</h1>
      <p>{meta.description}</p>
      <small>Dernière mise à jour : {LAST_UPDATED}</small>
    </section>
    <main id="legal-main" className="legal-layout" tabIndex="-1">
      <aside className="legal-navigation" aria-label="Pages légales">
        <strong>Informations utiles</strong>
        <nav>{Object.entries(PAGE_META).map(([key, item]) => <HashLink key={key} to={LEGAL_PAGE_PATHS[key]} aria-current={key === currentPage ? "page" : undefined}>{item.title}</HashLink>)}</nav>
        <p>Une question ?<ContactAddress email={operator.contactEmail}/></p>
      </aside>
      <article className="legal-document">{content}</article>
    </main>
    <footer className="legal-footer">
      <p>© 2026 {operator.name}. Tous droits réservés.</p>
      <nav aria-label="Pied de page légal">{Object.entries(PAGE_META).map(([key, item]) => <HashLink key={key} to={LEGAL_PAGE_PATHS[key]}>{item.title}</HashLink>)}</nav>
    </footer>
  </div>;
}

export default LegalPages;
