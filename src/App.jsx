import { StudentAssignmentView, StudentDashboardView, StudentHomeworkView } from './features/student/StudentViews.jsx';
import { ProgressBar, DataTable } from './TableAndProgress.jsx';
import PageHeader from './PageHeader.jsx';
import { publicationId } from './features/editorial/publicationCore.js';
import { usePublishedArticles, usePublishedArticle } from './features/editorial/usePublishedArticles.js';
import './features/editorial/publication.css';
import ArticleEditorView from './features/editorial/ArticleEditorView.jsx';
import AccessPortal from './features/pilote/AccessPortal.jsx';
import { announceSchoolLogout, endSchoolSession } from './features/pilote/schoolLogout.js';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, ArrowLeft, ArrowRight, Bell, BookOpenText, Books, Buildings,
  CaretDown, CaretRight, ChartBar, ChartLineUp, ChatCircleDots, Check,
  CheckCircle, ChalkboardTeacher, ClipboardText, Clock, CloudArrowUp, Copy,
  DiamondsFour, DownloadSimple, Eye, FileText, FolderOpen, Funnel, GameController, Gauge, GridNine,
  GearSix, Headphones, House, Key, List, ListChecks, MagnifyingGlass, Medal, Megaphone,
  PaperPlaneTilt, PencilSimple, PlayCircle, Plus, PresentationChart, Question,
  RocketLaunch, ShieldCheck, SignOut, Sparkle, Storefront, Student, Trophy,
  UserCircle, Users, UsersThree, WarningCircle, X,
} from "@phosphor-icons/react/ssr";
import { ParentLoginPage, ParentPages } from "./ParentPages.jsx";
import { DEMO_ACCOUNTS, useDemoStore } from "./demoStore.jsx";
import { getResponsiveImageProps } from "./mediaAssets.js";
import { getNotFoundHome, parseRoute, resolveAppAccess, resolveLocationRoute, resolveRouteRecord, usesSchoolDocumentNavigation } from "./routeCore.js";
import { LegalPages } from "./LegalPages.jsx";
import { PublicInfoPage } from "./PublicInfoPage.jsx";
import { buildParentHomework as getStudentHomework } from "./parentDataCore.js";
import { PUBLIC_PAGES, PUBLIC_TEST_NOTICE, getPageMetadata } from "./publicContent.js";
import { PUBLIC_BLOG_ARTICLES as blogArticles } from "./publicContentArticles.js";
import { articlePath, isDemoArticlePreview, resolvePublicArticles } from "./publicArticleCore.js";
import PublicArticleShare from "./PublicArticleShare.jsx";
import {
  DAILY_CHALLENGE_ID,
  getCompletedDailyChallenge,
  getDailyChallenge,
  getDailyChallengeHistory,
} from "./features/games/dailyChallengeData.js";
import {
  MISSION_ZELLIGE_ID,
  getCompletedMissionZellige,
  getDailyMissionZellige,
  getMissionZelligeHistory,
} from "./features/games/mission-zellige/missionZelligeData.js";
import {
  AchievementProgressPage,
  AchievementRewardsPage,
} from "./features/achievements/StudentAchievements.jsx";
import { CURRENT_CLASS_PARTICIPANT } from "./features/games/class-challenges/classChallengeData.js";
import {
  isPenHandledScreen,
  PenAccessPage,
  PenRolePage,
  PublicContentPage,
} from "./PenAlignedPages.jsx";
import { BetaAdminPage } from "./features/beta-admin/BetaAdminPages.jsx";
import { BetaRolePage } from "./features/beta-roles/BetaRolePages.jsx";

const ASSETS = "/assets";
const CultureQuiz=lazy(()=>import("./features/games/CultureQuiz.jsx"));
const DailyChallenge=lazy(()=>import("./features/games/DailyChallenge.jsx"));
const MissionZellige=lazy(()=>import("./features/games/mission-zellige/MissionZellige.jsx"));
const WordChoiceGame=lazy(()=>import("./features/games/word-choice/WordChoiceGame.jsx"));
const MotsFlechesGame=lazy(()=>import("./features/games/mots-fleches/MotsFlechesGame.jsx"));
const MarketShopGame=lazy(()=>import("./features/games/market-shop/MarketShopGame.jsx"));
import TeacherAnalyticsEntry from "./features/games/TeacherAnalyticsEntry.jsx";
const TeacherMarketDashboard=lazy(()=>import("./features/games/market-shop/TeacherMarketDashboard.jsx"));
const DebateGameFrame=lazy(()=>import("./features/games/debate/DebateGameFrame.jsx"));
const QuestionBankAdmin=lazy(()=>import("./features/question-bank/QuestionBankAdmin.jsx"));
const ClassChallengesStudent=lazy(()=>import("./features/games/class-challenges/ClassChallengesStudent.jsx"));
const ClassChallengesTeacher=lazy(()=>import("./features/games/class-challenges/ClassChallengesTeacher.jsx"));
const StudentMediaLibrary=lazy(()=>import("./features/mediatheque/StudentMediaLibrary.jsx"));
const DEFAULT_STUDENT_XP = 1240;

const roleConfigs = {
  eleve: {
    label: "Élève", space: "ESPACE ÉLÈVE", initials: "LM", name: "Lina Mansouri",
    nav: [["tableau-de-bord","Accueil",House],["manuels","Mes manuels",BookOpenText],["devoirs","Mes devoirs",ClipboardText],["mediatheque","Médiathèque",Books],["jeux","Mes jeux",GameController],["progression","Mes progrès",ChartLineUp],["recompenses","Récompenses",Trophy],["profil","Profil & aide",UserCircle]],
  },
  parent: {
    label: "Parent", space: "ESPACE FAMILLE", initials: "YM", name: "Youssef Mansouri",
    nav: [["tableau-de-bord","Vue d’ensemble",House],["enfants","Mes enfants",Users],["devoirs","Devoirs",ClipboardText],["progres","Progression",ChartLineUp],["messages","Messages",ChatCircleDots],["parametres","Paramètres",GearSix]],
  },
  enseignant: {
    label: "Enseignant", space: "ESPACE ENSEIGNANT", initials: "SB", name: "Mme Salma Benjelloun",
    nav: [["tableau-de-bord","Tableau de bord",House],["actions","Mes priorités",ListChecks],["classes","Mes classes",ChalkboardTeacher],["eleves","Élèves",Student],["devoirs","Devoirs",ClipboardText],["jeux","Mes jeux",GameController],["defis","Défis de classe",Trophy],["ressources","Ressources",FolderOpen],["analyses","Analyses",ChartBar]],
  },
  directeur: {
    label: "Direction", space: "ESPACE DIRECTION", initials: "MA", name: "M. Amine Alaoui",
    nav: [["tableau-de-bord","Vue d’ensemble",House],["actions","Priorités",ListChecks],["classes","Classes",ChalkboardTeacher],["enseignants","Enseignants",UsersThree],["affectations","Affectations",Users],["eleves","Élèves & activation",Student,"/directeur/eleves/activation"],["suivi-utilisation","Suivi d’utilisation",Gauge],["etablissement","Établissement",Buildings],["rapports","Rapports",FileText]],
  },
  admin: {
    label: "Administration", space: "ADMINISTRATION", initials: "JE", name: "Équipe Jet d’Encre",
    nav: [["pilotage","Cockpit BETA",Gauge],["analyses","Analyses & données",ChartLineUp],["imports","Centre d’import",CloudArrowUp],["bibliotheque","Bibliothèque",Books],["medias","Médias & droits",PlayCircle],["referentiels","Référentiels",ListChecks],["questions","Banque de questions",Question],["blog","Blog & articles",FileText],["etablissements","Établissements",Buildings],["utilisateurs","Utilisateurs",Users],["licences","Licences & codes",Key],["studio","Ajouter un contenu",Plus],["support","Support",Question],["securite","Sécurité",ShieldCheck]],
  },
};

const levelCards = [
  ["Niveau 1","1re année primaire","Les premiers mots","Débutant","#f6b82d"],
  ["Niveau 2","2e année primaire","Je lis et je raconte","Explorateur","#2ea599"],
  ["Niveau 3","3e année primaire","Ma ville, mes histoires","Curieux","#ef8b57"],
  ["Niveau 4","4e année primaire","Le Maroc et le monde","Aventurier","#7d64b3"],
  ["Niveau 5","5e année primaire","J’écris et je partage","Créateur","#3aa56a"],
  ["Niveau 6","6e année primaire","Cap vers le collège","Champion","#dc5571"],
];

const contentItems = [
  {title:"Voyage au Maroc",type:"E-book",level:"5e AEP",status:"Publié",date:"22 août 2026",color:"gold"},
  {title:"Le thé à la menthe",type:"Podcast",level:"4e AEP",status:"Brouillon",date:"20 août 2026",color:"teal"},
  {title:"Les secrets de la médina",type:"Documentaire",level:"6e AEP",status:"Planifié",date:"19 août 2026",color:"navy"},
  {title:"Le défi des mots",type:"Jeu éducatif",level:"3e AEP",status:"Publié",date:"18 août 2026",color:"coral"},
  {title:"Histoires du Rif",type:"Article",level:"5e AEP",status:"À réviser",date:"16 août 2026",color:"purple"},
  {title:"Les animaux du désert",type:"Vidéo",level:"2e AEP",status:"Publié",date:"14 août 2026",color:"green"},
];

function usePublicArticles(){
  const {articles}=useDemoStore();
  const demoPreview=isDemoArticlePreview(window.location.search);
  return useMemo(()=>resolvePublicArticles(articles,{demoPreview}),[articles,demoPreview]);
}

function EditorialPreviewNotice(){return <p className="prototype-banner" role="note"><strong>Aperçu éditorial local.</strong> Les modifications restent sur cet appareil et ne publient rien sur le site. <RouteLink to="/blog">Voir le Mag du site</RouteLink></p>;}

function PublicLandingPage(){
  const examples=usePublicArticles(), demoPreview=isDemoArticlePreview(window.location.search);
  const published=usePublishedArticles({enabled:!demoPreview});
  return <LandingPage publicArticles={[...published.items,...examples]} demoPreview={demoPreview}/>;
}

function useRoute() {
  const read = () => resolveLocationRoute(window.location);
  const [route,setRoute] = useState(read);
  useEffect(() => {
    const onChange=()=>setRoute(read());
    window.addEventListener("popstate",onChange);
    window.addEventListener("hashchange",onChange);
    window.addEventListener("jde:navigate",onChange);
    return()=>{
      window.removeEventListener("popstate",onChange);
      window.removeEventListener("hashchange",onChange);
      window.removeEventListener("jde:navigate",onChange);
    };
  },[]);
  useEffect(()=>{
    window.scrollTo({top:0,left:0,behavior:"instant"});
    const metadata=getPageMetadata(route,{origin:import.meta.env.VITE_PUBLIC_SITE_URL,indexable:import.meta.env.VITE_PUBLIC_INDEXING_ENABLED==="true",article:blogArticles.find(item=>route===`/blog/${item.slug}`)});
    document.title=metadata.title;
    for(const [name,value] of Object.entries({description:metadata.description,robots:metadata.robots})){
      let tag=document.querySelector(`meta[name="${name}"]`);
      if(!tag){tag=document.createElement("meta");tag.name=name;document.head.append(tag);}
      tag.content=value;
    }
    for(const [property,content] of Object.entries({"og:title":metadata.title,"og:description":metadata.description,"twitter:title":metadata.title,"twitter:description":metadata.description})){
      document.querySelector(`meta[property="${property}"],meta[name="${property}"]`)?.setAttribute("content",content);
    }
    document.querySelector('link[rel="canonical"]')?.remove();
    document.querySelector('meta[property="og:url"]')?.remove();
    if(metadata.canonical){const link=document.createElement("link");link.rel="canonical";link.href=metadata.canonical;document.head.append(link);const tag=document.createElement("meta");tag.setAttribute("property","og:url");tag.content=metadata.canonical;document.head.append(tag);}
    const heading=document.querySelector("main h1");
    if(heading){heading.setAttribute("tabindex","-1");requestAnimationFrame(()=>heading.focus({preventScroll:true}));}
  },[route]);
  return route;
}

function navigateRoute(to,{replace=false}={}){
  const path=canonicalLink(to);
  window.history[replace?"replaceState":"pushState"]({},"",path);
  window.dispatchEvent(new Event("jde:navigate"));
}

function canonicalLink(to,className=""){
  if(["/admin/licences","/admin/analyses","/admin/blog","/admin/bibliotheque"].includes(to))return to+"?mode=demo";
  if(to==="/enseignant/devoirs"&&className.includes("button-green"))return "/enseignant/devoirs/nouveau";
  if(/^\/enseignant\/devoirs\/[^/]+$/.test(to)&&to!=="/enseignant/devoirs/nouveau")return `${to}/remises`;
  if(/^\/admin\/bibliotheque\/[^/]+$/.test(to))return to.replace("/admin/bibliotheque/","/admin/contenus/")+"/previsualisation";
  return ({"/eleve/manuel":"/eleve/manuels","/eleve/progres":"/eleve/progression","/admin/studio":"/admin/contenus/nouveau","/directeur/activations":"/directeur/eleves/activation","/directeur/utilisation":"/directeur/suivi-utilisation"})[to]||to;
}
function RouteLink({to,className="",children,onClick,target,...props}) {
  const resolved=canonicalLink(to,className);
  const handleClick=(event)=>{
    onClick?.(event);
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||target==="_blank")return;
    // These routes mount a separate school application; use a document navigation.
    if(usesSchoolDocumentNavigation(resolved))return;
    event.preventDefault();
    navigateRoute(resolved);
  };
  return <a href={resolved} className={className} onClick={handleClick} target={target} {...props}>{children}</a>;
}
function SkipLink({targetId,children}){return <a className="skip-link" href={`#${targetId}`} onClick={event=>{event.preventDefault();document.getElementById(targetId)?.focus()}}>{children}</a>}
function slugifyRoute(value){return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}

function ResponsiveImage({fileName,alt="",eager=false,sizes,...props}){
  const responsive=getResponsiveImageProps(fileName,{sizes,loading:eager?"eager":"lazy",decoding:"async"});
  return <img {...responsive} {...props} alt={alt} fetchPriority={eager?"high":undefined}/>;
}

function StorageWarning(){const {storageBackend}=useDemoStore();return storageBackend==="memory"?<p className="prototype-banner" role="alert"><strong>Sauvegarde indisponible.</strong> Le navigateur refuse le stockage. Vos essais restent en mémoire et peuvent être perdus à la fermeture.</p>:null;}

function DemoBadge(){return <span className="demo-badge"><ShieldCheck weight="fill"/> BETA · données locales</span>}

function Brand({inverse=false,compact=false}) {
  return <span className={`brand ${inverse?"brand-inverse":""} ${compact?"brand-compact":""}`}><span className="brand-mark"><ResponsiveImage fileName="jet-dencre-monogram-light.png" alt="" sizes="44px" /></span>{!compact&&<span className="brand-copy"><strong>Jet d’Encre</strong><small>ÉDITIONS</small></span>}</span>;
}

function scrollToId(id) { document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"}); }

export function PublicPreview({path="/"}) {
  if(path==="/")return <LandingPage/>;
  if(path==="/blog")return <BlogPageContent publicArticles={blogArticles}/>;
  if(path.startsWith("/blog/"))return <BlogArticleContent slug={path.slice(6)} publicArticles={blogArticles}/>;
  return <PublicInfoPage path={path} ui={{RouteLink,PublicSubHeader,BlogFooter}}/>;
}

export function LandingPage({publicArticles=blogArticles,demoPreview=false}={}) {
  const [faq,setFaq]=useState(0);
  useEffect(()=>{
    const section=window.location.hash.slice(1);
    if(!["collection","univers","methode","faq"].includes(section))return;
    const frame=window.requestAnimationFrame(()=>scrollToId(section));
    return()=>window.cancelAnimationFrame(frame);
  },[]);
  const faqs = [
    ["À quel âge mon enfant peut-il commencer ?","Le premier pilote se prépare pour la 5e année du primaire, avec des aides adaptées au niveau de français. Les autres niveaux sont présentés comme projets de collection ; aucun test d’orientation n’est encore proposé."],
    ["Le contenu est-il conforme au programme marocain ?","Les situations s’appuient sur le contexte marocain et la didactique du FLE. La couverture du programme et chaque séquence du pilote doivent encore être validées par l’équipe pédagogique."],
    ["Comment accéder au contenu numérique ?","Le bouton Connexion ouvre le choix du profil, puis l’accès scolaire avec le compte remis par votre établissement. Le pilote reste réservé aux comptes de test. Pour explorer les écrans sans compte scolaire, choisissez Essayer la démonstration : ses données restent dans ce navigateur."],
    ["Comment démarrer avec ma classe ?","Le référent de l’établissement organise les accès individuels et leur remise confidentielle. Le guide d’accueil explique la première connexion et les difficultés d’accès. Les contenus et conditions d’ouverture doivent être validés avant tout usage avec de vrais élèves."],
  ];
  return <div className="landing-page">
    <PublicSubHeader active="home" demoPreview={demoPreview}/>
    <main>
      {demoPreview&&<EditorialPreviewNotice/>}
      <p className="prototype-banner" role="note"><strong>{PUBLIC_TEST_NOTICE.title}</strong> {PUBLIC_TEST_NOTICE.body}</p>
      <section className="hero zellige-section">
        <div className="hero-copy"><span className="eyebrow"><Sparkle weight="fill"/> Le français entre la classe et la maison</span><h1>Parlons bien,<br/>parlons <em>français&nbsp;!</em></h1><p>Une méthode de français joyeuse et ancrée dans la culture marocaine, conçue pour faire parler, lire et grandir chaque enfant avec confiance.</p><div className="hero-actions"><RouteLink to="/activation" className="button button-gold">Activer mon code manuel <ArrowRight weight="bold"/></RouteLink><RouteLink to="/connexion?mode=demo" className="button button-light">Essayer la démonstration <BookOpenText/></RouteLink></div><div className="trust-points"><span><CheckCircle weight="fill"/> Contexte marocain</span><span><CheckCircle weight="fill"/> Activités ludiques</span><span><CheckCircle weight="fill"/> Suivi des progrès</span></div></div>
        <div className="hero-visual"><div className="hero-image-frame"><ResponsiveImage fileName="generated-1773971894915.png" alt="Manuel illustré ouvert sur la kasbah et la cérémonie du thé" eager sizes="(max-width: 900px) 90vw, 590px"/></div><span className="floating-pill pill-a"><Headphones weight="fill"/> Audios inclus</span><span className="floating-pill pill-b"><GameController weight="fill"/> Jeux interactifs</span><span className="floating-pill pill-c"><Medal weight="fill"/> Progrès valorisés</span><span className="hero-score">5e<small>pilote en préparation</small></span></div>
      </section>
      <section className="metrics" aria-label="Les usages de Jet d’Encre">{[[BookOpenText,"Lire","des textes et des histoires"],[Headphones,"Écouter","des audios et des vidéos"],[GameController,"Jouer","pour pratiquer le français"],[Users,"Partager","un objectif entre école et maison"]].map(([Icon,value,label])=><article key={label}><Icon weight="duotone"/><strong>{value}</strong><span>{label}</span></article>)}</section>
      <section id="methode" className="section how-section zellige-section"><SectionHeading eyebrow="Simple comme 1, 2, 3" title={<>Comment ça <em>marche&nbsp;?</em></>} copy="Les comptes scolaires sont créés par l’administration Jet d’Encre, à la demande de l’établissement. Aucun choix de rôle ni achat de manuel ne crée un accès scolaire sur cette page."/><div className="steps-grid">{[["01",Books,"Reçois ton accès","L’école te remet ton identifiant et les consignes de connexion en privé."],["02",Key,"Connecte-toi","Utilise le bouton Connexion avec le compte qui t’a été attribué."],["03",RocketLaunch,"Retrouve ton espace","Vérifie ton profil et consulte les activités disponibles pour ta classe."]].map(([n,Icon,title,copy])=><article className="step-card" key={n}><span className="step-number">{n}</span><span className="step-icon"><Icon weight="duotone"/></span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
      <section id="collection" className="section collection-section"><SectionHeading eyebrow="La collection en préparation" title={<>Un premier pilote en 5e AEP,<br/><em>une collection à construire</em></>} copy="Les couvertures présentent les six niveaux envisagés. Elles ne signifient pas que six parcours complets sont déjà disponibles."/><div className="levels-grid">{levelCards.map(([level,grade,title,badge,color],index)=><article className="level-card" key={level} style={{"--level-color":color}}><div className="level-cover"><span className="level-index">{index+1}</span><span className="level-shape"><BookOpenText weight="duotone"/></span><strong>{level}</strong><small>Le français facile</small></div><div className="level-info"><span>{grade}</span><h3>{index===4?<RouteLink to="/niveau/5e-aep" aria-label="Découvrir le pilote de français en 5e AEP">{title}</RouteLink>:title}</h3><small>{index===4?"Pilote en préparation":"Projet de collection"}</small></div></article>)}</div></section>
      <section id="univers" className="section universe-section zellige-section"><SectionHeading eyebrow="Notre pédagogie 360°" title={<>Du papier à l’écran,<br/><em>une expérience qui donne envie</em></>} copy="Les forces du livre, du numérique et du jeu réunies dans un seul parcours cohérent."/><div className="feature-stack"><Feature image="generated-1773971894915.png" tag="1 · Culture & lecture" tone="gold" title="Le manuel papier" copy="Des textes ancrés dans la culture marocaine et ouverts sur le monde. Chaque chapitre développe l’oral, la lecture et l’écriture à travers une tâche motivante." chips={["Culture","Patrimoine","Communication"]}/><Feature reverse image="generated-1774007681359.png" tag="2 · Écoute & découverte" tone="teal" title="La plateforme numérique" copy="Audios, vidéos, documentaires et exercices autocorrectifs prolongent le manuel et donnent une vraie place à l’oral." chips={["Podcasts","Vidéos","Prononciation"]}/><Feature image="generated-1774007656775.png" tag="3 · Défis & jeux" tone="coral" title="La pratique ludique" copy="Des mini-défis, badges et séries d’apprentissage transforment l’effort en plaisir sans perdre l’objectif pédagogique." chips={["Jeux","Badges","Motivation"]}/></div></section>
      <section id="blog" className="section blog-teaser-section"><div className="blog-teaser-heading"><div><span className="eyebrow">Le Mag Jet d’Encre</span><h2>Des idées pour faire vivre<br/><em>le français au quotidien</em></h2><p>Conseils aux parents, pratiques de classe et découvertes culturelles pensées pour le contexte marocain.</p></div><RouteLink to={demoPreview?"/blog?mode=demo":"/blog"} className="button button-dark">Voir tous les articles <ArrowRight/></RouteLink></div><div className="landing-blog-grid">{publicArticles[0]&&<BlogCard article={publicArticles[0]} featured demoPreview={demoPreview}/>}{publicArticles.slice(1,4).map(article=><BlogCard article={article} compact key={article.slug} demoPreview={demoPreview}/>)}{!publicArticles.length&&<p>Aucun article publié dans cet aperçu.</p>}</div></section>
      <section id="faq" className="section faq-section"><div className="faq-intro"><span className="eyebrow">Questions fréquentes</span><h2>Tout ce qu’il faut savoir</h2><p>Première connexion, mot de passe oublié ou appareil partagé : retrouvez les étapes utiles dans le guide de l’école.</p><RouteLink to="/guide-ecole" className="button button-dark">Lire le guide d’accueil <ArrowRight/></RouteLink></div><div className="faq-list">{faqs.map(([q,a],index)=><article className={faq===index?"faq-item is-open":"faq-item"} key={q}><button onClick={()=>setFaq(faq===index?-1:index)} aria-expanded={faq===index}><span>{q}</span><CaretDown weight="bold"/></button>{faq===index&&<p>{a}</p>}</article>)}</div></section>
      <section className="proof-section"><SectionHeading light eyebrow="Notre cap pour le pilote" title="Une expérience utile à chacun"/><div className="quotes-grid"><blockquote>Préparer une activité courte, observer les réponses et proposer un retour précis.<footer>Objectif enseignant</footer></blockquote><blockquote>Comprendre ce que l’enfant a réussi et savoir comment l’accompagner à la maison.<footer>Objectif famille</footer></blockquote><blockquote>Aider les classes à démarrer et résoudre les difficultés d’accès avant d’élargir le pilote.<footer>Objectif école</footer></blockquote></div><div className="final-cta"><div><span className="eyebrow"><Sparkle weight="fill"/> Démonstration à explorer</span><h2>Découvrez les écrans de démonstration</h2><p>Explorez des profils fictifs sans compte scolaire. Les essais de démonstration restent sur cet appareil et ne rejoignent pas le pilote.</p></div><RouteLink to="/connexion?mode=demo" className="button button-gold">Essayer la démonstration <ArrowRight weight="bold"/></RouteLink></div></section>
    </main>
    <BlogFooter/>
  </div>;
}

function SectionHeading({eyebrow,title,copy,light=false}){return <div className={`section-heading ${light?"light":""}`}><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{copy&&<p>{copy}</p>}</div>}
function Feature({image,tag,tone,title,copy,chips,reverse=false}){return <article className={`feature-row ${reverse?"reverse":""}`}><ResponsiveImage fileName={image} alt="" sizes="(max-width: 900px) 100vw, 52vw"/><div><span className={`feature-tag ${tone}`}>{tag}</span><h3>{title}</h3><p>{copy}</p><div className="chip-row">{chips.map(x=><span key={x}>{x}</span>)}</div></div></article>}

function PublicSubHeader({active="blog",demoPreview=false}){
  const [menuOpen,setMenuOpen]=useState(false);
  return <header className={`public-header${active==="home"?"":" blog-public-header"}`}><RouteLink to={demoPreview?"/?mode=demo":"/"} className="public-logo" aria-label="Jet d’Encre — accueil"><ResponsiveImage fileName="jet-dencre-logo-horizontal-light.png" alt="Jet d’Encre Éditions" eager sizes="198px"/></RouteLink><button className="menu-button" onClick={()=>setMenuOpen(!menuOpen)} aria-label={menuOpen?"Fermer le menu":"Ouvrir le menu"} aria-expanded={menuOpen}>{menuOpen?<X/>:<List/>}</button><nav className={menuOpen?"public-nav is-open":"public-nav"} aria-label="Navigation principale"><a href="/#collection" onClick={()=>setMenuOpen(false)}>Nos manuels</a><a href="/#univers" onClick={()=>setMenuOpen(false)}>Ressources</a><a href="/#methode" onClick={()=>setMenuOpen(false)}>Notre approche</a><RouteLink to={demoPreview?"/blog?mode=demo":"/blog"} className={active==="blog"?"active":""} onClick={()=>setMenuOpen(false)}>Le Mag</RouteLink><a href="/#faq" onClick={()=>setMenuOpen(false)}>Aide</a></nav><RouteLink to="/connexion" className="button button-dark header-login"><UserCircle weight="bold"/> Connexion</RouteLink></header>
}

function BlogCard({article,featured=false,compact=false,demoPreview=false}){
  const fileName=article.image.split("/").at(-1);
  return <article className={`blog-card ${featured?"featured":""} ${compact?"compact":""}`}><RouteLink to={articlePath(article.slug,demoPreview)} className="blog-card-image"><ResponsiveImage fileName={fileName} alt={article.imageAlt} sizes={featured?"(max-width: 900px) 100vw, 55vw":"(max-width: 680px) 100vw, 420px"}/><span>{article.category}{article.source!=='publication'&&' · Exemple'}</span></RouteLink><div className="blog-card-body"><div className="blog-meta"><span>{article.theme}</span><span><Clock/> {article.readTime}</span></div><h3><RouteLink to={articlePath(article.slug,demoPreview)}>{article.title}</RouteLink></h3><p>{article.excerpt}</p><RouteLink to={articlePath(article.slug,demoPreview)} className="read-link">Lire l’article <ArrowRight weight="bold"/></RouteLink></div></article>
}

function BlogPage(){
  const examples=usePublicArticles(), demoPreview=isDemoArticlePreview(window.location.search);
  const queryState=useState(''), categoryState=useState('Tous');
  const publicationFeed=usePublishedArticles({enabled:!demoPreview,q:queryState[0].trim(),category:categoryState[0]});
  return <BlogPageContent publicArticles={[...publicationFeed.items,...examples]} demoPreview={demoPreview} queryState={queryState} categoryState={categoryState} publicationFeed={publicationFeed}/>;
}

function BlogPageContent({publicArticles,demoPreview=false,queryState,categoryState,publicationFeed}){
  const localQuery=useState(''), localCategory=useState('Tous');
  const [query,setQuery]=queryState||localQuery, [category,setCategory]=categoryState||localCategory;
  const filtered=publicArticles.filter(article=>(category==="Tous"||article.category===category)&&`${article.title} ${article.excerpt} ${article.theme}`.toLowerCase().includes(query.toLowerCase()));
  const defaultView=category==="Tous"&&!query;
  const featured=publicArticles.find(article=>article.source==='publication')||publicArticles.find(article=>article.featured)||publicArticles[0];
  return <div className="blog-page"><PublicSubHeader demoPreview={demoPreview}/>{demoPreview&&<EditorialPreviewNotice/>}<p className="prototype-banner" role="note"><strong>Mag du site de test.</strong> Les articles marqués « Exemple » restent des contenus de démonstration.</p><main><section className="blog-hero zellige-section"><div><span className="eyebrow"><BookOpenText weight="fill"/> Le Mag Jet d’Encre</span><h1>Des ressources qui rapprochent<br/><em>l’école et la maison</em></h1><p>Conseils pratiques, culture marocaine et pédagogie active pour donner à chaque enfant l’envie de parler français.</p></div><div className="blog-hero-stats"><strong>FLE</strong><span>en pratique</span><small>Des pistes à adapter à votre classe.</small></div></section><section className="blog-content"><div className="blog-toolbar"><label className="blog-search"><MagnifyingGlass/><input value={query} onChange={e=>setQuery(e.target.value)} maxLength={100} placeholder="Rechercher un article, un thème…" aria-label="Rechercher dans le blog"/></label><div className="blog-categories" aria-label="Filtrer par public">{["Tous","Parents","Enseignants","Enfants"].map(item=><button key={item} className={category===item?"active":""} onClick={()=>setCategory(item)} aria-pressed={category===item}>{item}</button>)}</div></div>{publicationFeed?.loading&&<p role="status">Chargement des publications…</p>}{publicationFeed?.error&&<div role="alert"><p>{publicationFeed.error} Les exemples restent consultables.</p><button className="button button-light" onClick={publicationFeed.retry}>Réessayer</button></div>}{defaultView&&featured&&<section className="blog-featured"><div className="blog-section-title"><div><span className="eyebrow">À la une</span><h2>Le conseil de la semaine</h2></div><span>Mis à jour le {featured.date}</span></div><BlogCard article={featured} featured demoPreview={demoPreview}/></section>}<section className="blog-latest"><div className="blog-section-title"><div><span className="eyebrow">{defaultView?"À lire aussi":"Résultats"}</span><h2>{defaultView?"Nos derniers articles":`${filtered.length} article${filtered.length>1?"s":""}${publicationFeed?.nextOffset!=null?" affichés":""}`}</h2></div>{!defaultView&&<button onClick={()=>{setQuery("");setCategory("Tous")}}>Réinitialiser les filtres</button>}</div>{filtered.length?<div className="blog-grid">{(defaultView?filtered.filter(x=>x.slug!==featured?.slug):filtered).map(article=><BlogCard article={article} key={article.slug} demoPreview={demoPreview}/>)}</div>:<div className="blog-empty"><MagnifyingGlass/><h3>Aucun article ne correspond</h3><p>Essayez un mot plus général ou choisissez une autre catégorie.</p><button className="button button-light" onClick={()=>{setQuery("");setCategory("Tous")}}>Voir tous les articles</button></div>}{publicationFeed?.nextOffset!=null&&<button className="button button-light" disabled={publicationFeed.loading} onClick={publicationFeed.more}>Charger la suite</button>}</section></section><section className="blog-newsletter"><div><span className="eyebrow"><PaperPlaneTilt weight="fill"/> La lettre Jet d’Encre</span><h2>Des idées à retrouver dans le Mag</h2><p>Activités prêtes à tester, conseils FLE et découvertes éditoriales.</p></div><div className="newsletter-success" role="note"><BookOpenText/><span><strong>Lettre en préparation</strong><small>Aucune inscription ni adresse e-mail collectée dans cette démonstration.</small></span></div></section></main><BlogFooter/></div>
}

function BlogArticlePage({slug}){
  const examples=usePublicArticles(), demoPreview=isDemoArticlePreview(window.location.search), dynamic=Boolean(publicationId(slug))&&!demoPreview;
  const result=usePublishedArticle(slug,dynamic);
  useEffect(()=>{
    if(!dynamic)return;
    const title=result.article?result.article.title+' — Jet d’Encre':result.loading?'Chargement de l’article — Jet d’Encre':'Article indisponible — Jet d’Encre';
    const description=result.article?.excerpt||'Consultez les articles disponibles dans le Mag Jet d’Encre.';
    const frame=requestAnimationFrame(()=>{document.title=title;for(const key of ['description','og:description','twitter:description'])document.querySelector('meta[name="'+key+'"],meta[property="'+key+'"]')?.setAttribute('content',description);for(const key of ['og:title','twitter:title'])document.querySelector('meta[name="'+key+'"],meta[property="'+key+'"]')?.setAttribute('content',title);});
    return()=>cancelAnimationFrame(frame);
  },[dynamic,result.article,result.loading]);
  if(dynamic&&!result.article)return <div className="blog-page"><PublicSubHeader/><main className="blog-content"><section className="blog-empty"><h1>{result.loading?'Chargement de l’article…':result.status===404?'Cet article n’est pas disponible':'Le Mag est momentanément indisponible'}</h1>{result.error&&<p role="alert">{result.error}</p>}{!result.loading&&result.status!==404&&<button className="button button-light" onClick={result.retry}>Réessayer</button>}<RouteLink to="/blog" className="button button-dark">Retour au Mag</RouteLink></section></main><BlogFooter/></div>;
  return <BlogArticleContent slug={slug} publicArticles={dynamic?[result.article,...examples]:examples} demoPreview={demoPreview}/>;
}

export function BlogArticleContent({slug,publicArticles,demoPreview=false,preview=false}){
  const article=publicArticles.find(item=>item.slug===slug); if(!article)return <NotFound/>;
  const related=publicArticles.filter(item=>item.slug!==slug).slice(0,3);
  return <div className="blog-page article-page">{!preview&&<PublicSubHeader demoPreview={demoPreview}/>}{demoPreview&&<EditorialPreviewNotice/>}{preview?<p className="prototype-banner" role="note"><strong>Aperçu privé.</strong> Rien n’est publié par cet aperçu. Les liens sont désactivés.</p>:article.source!=='publication'&&<p className="prototype-banner" role="note"><strong>Article de démonstration.</strong> Signature fictive et contenu à relire avant publication.</p>}<main><section className="article-hero zellige-section"><div className="article-hero-copy"><nav className="breadcrumb" aria-label="Fil d’Ariane"><RouteLink to={demoPreview?"/?mode=demo":"/"}>Accueil</RouteLink><CaretRight/><RouteLink to="/blog">Blog</RouteLink><CaretRight/><span>{article.category}</span></nav><span className="article-category">{article.category} · {article.theme}</span><h1>{article.title}</h1><p>{article.excerpt}</p><div className="article-author"><span>{article.author.split(" ").map(x=>x[0]).join("").slice(0,2)}</span><div><strong>{article.author}</strong><small>{article.date} · {article.readTime} de lecture</small></div></div></div><ResponsiveImage fileName={article.image.split("/").at(-1)} alt={article.imageAlt} eager sizes="(max-width: 900px) 100vw, 48vw"/></section><div className="article-layout"><article className="article-body">{article.source==='publication'?<div className="published-article-body">{article.body.split(/\n\s*\n/).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div>:<><p className="article-lead">Au Maroc, le français se construit dans des environnements plurilingues, entre la maison, l’école et la vie quotidienne. Cette proposition vise une progression réaliste : faire participer davantage, sans transformer chaque échange en évaluation.</p>{article.sections.map(([title,copy],index)=><section id={`partie-${index+1}`} key={title}><span>0{index+1}</span><h2>{title}</h2><p>{copy}</p>{index===0&&<div className="article-tip"><Sparkle weight="fill"/><div><strong>À retenir</strong><p>{article.takeaway}</p></div></div>}</section>)}</>}{!preview&&<PublicArticleShare slug={article.slug} article={article} demoPreview={demoPreview}/>}</article><aside className="article-aside">{article.sections.length>0&&<div className="article-toc"><strong>Dans cet article</strong>{article.sections.map(([title],index)=><button key={title} onClick={()=>scrollToId(`partie-${index+1}`)}><span>0{index+1}</span>{title}</button>)}</div>}<div className="article-side-cta"><BookOpenText weight="duotone"/><h3>Prolongez l’expérience</h3><p>Explorez un extrait pédagogique de démonstration pour prolonger la lecture.</p><RouteLink to="/decouvrir" className="button button-gold button-wide">Lire un extrait</RouteLink></div></aside></div>{!preview&&<section className="related-section"><div className="blog-section-title"><div><span className="eyebrow">Pour continuer</span><h2>Articles associés</h2></div><RouteLink to={demoPreview?"/blog?mode=demo":"/blog"} className="read-link">Retour au Blog <ArrowRight/></RouteLink></div><div className="blog-grid">{related.map(item=><BlogCard article={item} compact key={item.slug} demoPreview={demoPreview}/>)}</div></section>}</main>{!preview&&<BlogFooter/>}</div>
}

function BlogFooter(){return <footer className="public-footer"><Brand inverse/><div><strong>Découvrir</strong><a href="/#collection">Nos manuels</a><a href="/#univers">Ressources numériques</a><RouteLink to="/methode">Notre méthode</RouteLink><RouteLink to="/blog">Le Mag</RouteLink><RouteLink to="/connexion?mode=demo">Essayer la démonstration</RouteLink></div><div><strong>Vous accompagner</strong><RouteLink to="/familles">Familles</RouteLink><RouteLink to="/ecoles">Écoles</RouteLink><RouteLink to="/guide-ecole">Guide de connexion</RouteLink><RouteLink to="/connexion">Se connecter</RouteLink></div><div><strong>Informations</strong><RouteLink to="/mentions-legales">Mentions légales</RouteLink><RouteLink to="/confidentialite">Confidentialité</RouteLink><RouteLink to="/conditions-utilisation">Conditions d’utilisation</RouteLink><RouteLink to="/cookies">Cookies</RouteLink><RouteLink to="/accessibilite">Accessibilité</RouteLink></div><p className="copyright">© 2026 Jet d’Encre Éditions · Site de test · Coordonnées officielles à valider · Maroc</p></footer>}

export function AuthLayout({children,title,intro,connected=false}){return <div className="auth-page zellige-section"><SkipLink targetId="auth-main">Aller au contenu principal</SkipLink><div className="auth-top"><RouteLink to="/"><Brand/></RouteLink><RouteLink to="/" className="back-link"><ArrowLeft/> Retour à l’accueil</RouteLink></div><main id="auth-main" className="auth-card" tabIndex="-1"><div className="auth-heading">{connected?<span className="demo-badge"><ShieldCheck weight="fill"/> BETA · compte scolaire</span>:<DemoBadge/>}<h1>{title}</h1><p>{intro}</p></div>{children}</main><p className="auth-note"><ShieldCheck weight="fill"/> {connected?'Version BETA de test · Accès réservé aux comptes créés par Jet d’Encre':'Version BETA de démonstration · Les données restent sur cet appareil'}</p></div>}

function ConnectionPage(){return <AccessPortal/>;}

function LoginPage({role}){
  const config=roleConfigs[role]||roleConfigs.eleve;
  const account=DEMO_ACCOUNTS[role]||DEMO_ACCOUNTS.eleve;
  const {signIn}=useDemoStore();
  const [identifier,setIdentifier]=useState(account.identifier);
  const [password,setPassword]=useState(account.password);
  const [message,setMessage]=useState("");
  const home=role==="admin"?"pilotage":"tableau-de-bord";
  useEffect(()=>{setIdentifier(account.identifier);setPassword(account.password);setMessage("")},[role,account.identifier,account.password]);
  const submit=(event)=>{event.preventDefault();const result=signIn(role,{identifier,password});if(!result.ok){setMessage(result.message);return;}const requested=sessionStorage.getItem("jde.returnTo");sessionStorage.removeItem("jde.returnTo");const destination=requested?.startsWith(`/${role}/`)?requested:result.activationLinked&&role==="eleve"?"/eleve/manuels":`/${role}/${home}`;navigateRoute(destination,{replace:true});};
  return <RoleLoginView role={role} identifier={identifier} password={password} setIdentifier={setIdentifier} setPassword={setPassword} message={message} submit={submit} account={account}/>;
}

// Shared original presentation: the controller supplies the identity provider, never the view.
export function RoleLoginView({role,identifier,password,setIdentifier,setPassword,message,submit,account=null,busy=false,recipe=false,onRecovery}){
  const config=roleConfigs[role]||roleConfigs.eleve;
  return <AuthLayout connected={recipe} title={`Connexion ${config.label.toLowerCase()}`} intro={recipe?`Accédez à votre ${config.space.toLowerCase()} avec le compte fictif remis pour les essais.`:`Accédez à votre ${config.space.toLowerCase()} avec les identifiants préremplis de la démonstration.`}>
    <form className="login-form" onSubmit={submit} aria-busy={busy}>
      <label>{role==='eleve'?'Identifiant':'Adresse e-mail'}<input type={role==='eleve'?'text':'email'} autoComplete={recipe?'off':'username'} value={identifier} onChange={e=>setIdentifier(e.target.value)} disabled={busy} maxLength={254} required/></label>
      <label>Mot de passe<input type="password" autoComplete={recipe?'off':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} maxLength={128} required/></label>
      <div className="form-options"><label className="check-label"><input type="checkbox" disabled={recipe} defaultChecked={!recipe}/> Se souvenir de moi</label>{recipe?<button type="button" className="text-action" onClick={onRecovery}>Mot de passe oublié ?</button>:<RouteLink to="/mot-de-passe-oublie?mode=demo">Mot de passe oublié ?</RouteLink>}</div>
      {account&&<div className="demo-credentials"><strong>Compte de démonstration</strong><span>{account.identifier}</span><span>Mot de passe : {account.password}</span></div>}
      {recipe&&<p className="activation-help" role="note">Recette locale · comptes fictifs uniquement. Session limitée à trois heures, sans prolongation automatique.</p>}
      {message&&<p className="form-notice" role="alert"><WarningCircle weight="fill"/> {message}</p>}
      <button className="button button-dark button-wide" type="submit" disabled={busy}>{busy?'Connexion…':'Ouvrir mon espace'} <ArrowRight weight="bold"/></button>
    </form>
    {recipe?<a href="/connexion" className="back-choice"><ArrowLeft/> Choisir un autre profil</a>:<RouteLink to="/connexion?mode=demo" className="back-choice"><ArrowLeft/> Choisir un autre profil</RouteLink>}
  </AuthLayout>;
}

function ActivationPage(){
  const {activateCode,resetDemo}=useDemoStore();
  const [code,setCode]=useState("");
  const [result,setResult]=useState(null);
  const submit=(event)=>{event.preventDefault();const outcome=activateCode(code);if(outcome.ok){navigateRoute("/activation/succes?mode=demo");return;}navigateRoute((outcome.status==="already_used"?"/activation/acces-deja-active":"/activation/code-invalide")+'?mode=demo');};
  const resetLocalDemo=()=>{const outcome=resetDemo();if(!outcome.ok){setResult(outcome);return;}setResult(null);setCode("")};
  if(result?.ok)return <AuthLayout title="Manuel activé" intro="L’activation a bien été enregistrée dans cette démonstration."><div className="activation-success" role="status"><span><CheckCircle weight="fill"/></span><h2>Code reconnu !</h2><p>Votre manuel <strong>Jet d’Encre · Français {result.level}</strong> est prêt à être associé au profil élève.</p><RouteLink to="/connexion/eleve" className="button button-dark button-wide">Continuer vers l’espace élève <ArrowRight/></RouteLink></div></AuthLayout>;
  return <AuthLayout title="Activez votre manuel" intro="Le code se trouve sur la carte d’activation à l’intérieur du manuel."><form className="activation-form" onSubmit={submit}><label>Code d’activation<div className="code-input"><Key weight="duotone"/><input value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setResult(null)}} placeholder="JDE-26-FR5-0042" aria-invalid={Boolean(result&&!result.ok)} aria-describedby="activation-help activation-error" required/></div></label>{result&&!result.ok&&<p id="activation-error" className="form-error" role="alert"><WarningCircle weight="fill"/> {result.message}</p>}<button className="button button-gold button-wide" type="submit">Vérifier mon code <ArrowRight weight="bold"/></button><div id="activation-help" className="activation-help"><Question weight="fill"/><span>Code disponible pour tester : <button type="button" onClick={()=>setCode("JDE-26-FR5-0042")}>JDE-26-FR5-0042</button>. Le code JDE-26-FR5-0041 montre l’état « déjà utilisé ».</span></div>{result?.status==="already_used"&&<button type="button" className="text-action" onClick={resetLocalDemo}>Réinitialiser toutes les données de démonstration</button>}</form></AuthLayout>
}

function useCompactNavigation(role){
  const query=role==="parent"?"(max-width: 680px)":"(max-width: 1100px)";
  const [compact,setCompact]=useState(()=>window.matchMedia(query).matches);
  useEffect(()=>{const media=window.matchMedia(query);const update=()=>setCompact(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update)},[query]);
  return compact;
}

function AppShell({role,page,detail,screen,params,studentXp=DEFAULT_STUDENT_XP}){
  const config=roleConfigs[role];
  const {currentUser,unreadNotifications,visibleNotifications,markNotificationRead,markAllNotificationsRead,signOut,resetDemo}=useDemoStore();
  const compact=useCompactNavigation(role);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [search,setSearch]=useState("");
  const [panel,setPanel]=useState(null);
  const [confirmReset,setConfirmReset]=useState(false);
  const [resetError,setResetError]=useState("");
  const closeButton=useRef(null);
  const menuButton=useRef(null);
  const sidebarScrollY=useRef(0);
  const pageTitle=config.nav.find(([slug])=>slug===page)?.[1]||config.nav[0][1];
  const searchEnabled=role==="parent"||(role==="enseignant"&&page==="eleves")||(role==="directeur"&&page==="enseignants")||(role==="admin"&&["bibliotheque","blog","etablissements","utilisateurs"].includes(page));
  const openSidebar=()=>{sidebarScrollY.current=window.scrollY;setSidebarOpen(true)};
  const closeSidebar=(restoreFocus=true)=>{setSidebarOpen(false);if(restoreFocus)requestAnimationFrame(()=>{menuButton.current?.focus({preventScroll:true});requestAnimationFrame(()=>window.scrollTo({top:sidebarScrollY.current,behavior:"auto"}))})};
  useEffect(()=>{if(!compact)setSidebarOpen(false)},[compact]);
  useEffect(()=>{const escape=(event)=>{if(event.key==="Escape"){if(sidebarOpen)closeSidebar(true);setPanel(null)}};document.addEventListener("keydown",escape);return()=>document.removeEventListener("keydown",escape)},[sidebarOpen]);
  useEffect(()=>{if(sidebarOpen&&compact)requestAnimationFrame(()=>{closeButton.current?.focus({preventScroll:true});requestAnimationFrame(()=>window.scrollTo({top:sidebarScrollY.current,behavior:"auto"}))})},[sidebarOpen,compact]);
  const logout=async()=>{try{await endSchoolSession();signOut();announceSchoolLogout();navigateRoute("/connexion",{replace:true});}catch(error){window.alert('La déconnexion scolaire n’a pas été confirmée. Vérifiez votre connexion et réessayez.');}};
  const reset=()=>{if(!confirmReset){setResetError("");setConfirmReset(true);return;}const outcome=resetDemo();if(!outcome.ok){setResetError(outcome.message);setConfirmReset(false);return;}setConfirmReset(false);setResetError("");setPanel(null);navigateRoute("/connexion",{replace:true})};
  return <div className={`app-shell role-shell-${role}`}>
    <SkipLink targetId="app-main">Aller au contenu principal</SkipLink>
    <aside id="workspace-navigation" className={sidebarOpen?"app-sidebar is-open":"app-sidebar"} aria-label={`Menu ${config.label}`} aria-hidden={compact&&!sidebarOpen} inert={compact&&!sidebarOpen?true:undefined}>
      <div className="sidebar-brand"><Brand inverse/><button ref={closeButton} className="sidebar-close" onClick={()=>closeSidebar(true)} aria-label="Fermer le menu"><X/></button><small>{config.space}</small></div>
      {role==="parent"&&<div className="parent-family-summary"><span>YM</span><span><strong>Famille Mansouri</strong><small>1 profil fictif · démonstration</small></span></div>}
      <nav aria-label={`Navigation ${config.label}`}>{config.nav.map(([slug,label,Icon,to])=><RouteLink key={slug} to={to||`/${role}/${slug}`} className={page===slug?"side-link active":"side-link"} onClick={()=>closeSidebar(false)} aria-current={page===slug?"page":undefined}><Icon weight={page===slug?"fill":"regular"}/><span>{label}</span></RouteLink>)}</nav>
      <button className="sidebar-help" onClick={()=>{setPanel(role==="parent"?"profile":"help");closeSidebar(false)}}>{role==="parent"?<UserCircle weight="fill"/>:<Question weight="fill"/>}<span><strong>{role==="parent"?"Youssef Mansouri":"Aide & assistance"}</strong><small>{role==="parent"?"Compte parent":"Guides et contact"}</small></span></button>
      <button type="button" className="side-logout" onClick={logout}><SignOut/> Se déconnecter</button>
    </aside>
    {sidebarOpen&&compact&&<button className="sidebar-backdrop" onClick={()=>closeSidebar(true)} aria-label="Fermer le menu"/>}
    <div className="app-area" inert={compact&&sidebarOpen?true:undefined}>
      <header className="app-topbar"><button ref={menuButton} className="sidebar-toggle" onClick={openSidebar} aria-label="Ouvrir le menu" aria-controls="workspace-navigation" aria-expanded={sidebarOpen}><List/></button>{searchEnabled?<div className="app-search"><MagnifyingGlass/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={role==="parent"?"Rechercher un enfant, un devoir, un message…":`Rechercher dans ${pageTitle.toLowerCase()}`} aria-label={role==="parent"?"Rechercher dans l’espace famille":`Rechercher dans ${pageTitle.toLowerCase()}`}/></div>:<div className="app-search-placeholder" aria-hidden="true"/>}<div className="topbar-meta">{role==="eleve"&&<div className="student-xp-chip" aria-live="polite" aria-label={`${studentXp} points d’expérience`}><Sparkle weight="fill"/><strong>{studentXp} XP</strong></div>}{role==="parent"?<span className="parent-connected"><i/> Famille · démonstration</span>:<><DemoBadge/><span>Année scolaire 2026–2027</span></>}<button className="notification" onClick={()=>setPanel(panel==="notifications"?null:"notifications")} aria-label={`${unreadNotifications.length} notification${unreadNotifications.length===1?"":"s"} non lue${unreadNotifications.length===1?"":"s"}`} aria-expanded={panel==="notifications"}><Bell/>{unreadNotifications.length>0&&<i>{unreadNotifications.length}</i>}</button><button className="profile-button" onClick={()=>setPanel(panel==="profile"?null:"profile")} aria-label={`Ouvrir le profil de ${currentUser?.name||config.name}`} aria-expanded={panel==="profile"}><span>{config.initials}</span><span><strong>{currentUser?.name||config.name}</strong><small>{config.label}</small></span><CaretDown/></button></div></header>
      {panel&&<section className={`workspace-popover popover-${panel}`} aria-label={panel==="notifications"?"Notifications":panel==="profile"?"Menu du profil":"Aide et assistance"}><header><strong>{panel==="notifications"?"Notifications":panel==="profile"?"Mon profil":"Besoin d’aide ?"}</strong><button className="icon-button" onClick={()=>{setPanel(null);setConfirmReset(false);setResetError("")}} aria-label="Fermer"><X/></button></header>{panel==="notifications"&&<><div className="notification-list">{visibleNotifications.length?visibleNotifications.slice(0,6).map(item=><button key={item.id} className={item.read?"read":""} onClick={()=>{markNotificationRead(item.id,true);setPanel(null);if(item.action)navigateRoute(item.action)}}><span><Bell weight={item.read?"regular":"fill"}/></span><span><strong>{item.title}</strong><small>{item.message||"Information de votre espace"}</small></span></button>):<p className="popover-empty">Aucune notification pour le moment.</p>}</div>{unreadNotifications.length>0&&<button className="text-action popover-action" onClick={()=>markAllNotificationsRead(role)}>Tout marquer comme lu</button>}</>}{panel==="profile"&&<div className="profile-panel"><DemoBadge/><p><strong>{currentUser?.name||config.name}</strong><span>{config.space}</span></p>{role==="eleve"&&<div className="profile-xp-balance" aria-label={`${studentXp} points d’expérience`}><Sparkle weight="fill"/><span><small>XP DU PROFIL</small><strong>{studentXp.toLocaleString("fr-FR")} XP</strong></span></div>}{confirmReset&&<p className="reset-warning" role="alert">Cette action efface uniquement les essais locaux et restaure les données de départ.</p>}{resetError&&<p className="reset-warning" role="alert">{resetError}</p>}<button className={confirmReset?"confirm-reset":""} onClick={reset}><Archive/> {confirmReset?"Confirmer la réinitialisation":"Réinitialiser la démonstration"}</button><button onClick={logout}><SignOut/> Se déconnecter</button></div>}{panel==="help"&&<div className="help-panel"><p>Ce prototype vous permet de tester tous les parcours sans envoyer de données à un serveur.</p><p role="note">Assistance de démonstration : aucun message n’est transmis. Utilisez le contact habituel de votre établissement pour une demande réelle.</p><button className="button button-light button-wide" onClick={()=>setPanel(null)}><CheckCircle/> J’ai compris</button></div>}</section>}
      <main id="app-main" className="app-content" tabIndex="-1"><StorageWarning/><div className="mobile-page-title"><span>{config.space}</span><strong>{pageTitle}</strong></div>{isPenHandledScreen(screen)?<PenRolePage screen={screen} params={params} studentXp={studentXp} ui={{RouteLink,PageHeader,ProgressBar,ResponsiveImage}}/>:role==="eleve"&&page==="mediatheque"?<Suspense fallback={<div className="panel" role="status">Ouverture de la Médiathèque…</div>}><StudentMediaLibrary detail={detail} onNavigate={navigateRoute} ui={{PageHeader,RouteLink}}/></Suspense>:role==="parent"?<ParentPages page={page} detail={detail} search={search}/>:detail?<RoleDetailPage role={role} page={page} detail={detail}/>:<>{role==="eleve"&&<StudentPages page={page} studentXp={studentXp}/>} {role==="enseignant"&&<TeacherPages page={page} search={search}/>} {role==="directeur"&&<DirectorPages page={page} search={search}/>} {role==="admin"&&<AdminPages page={page} search={search}/>}</>}</main>
    </div>
  </div>
}

function KpiGrid({items}){return <div className="kpi-grid">{items.map(([label,value,note,tone="green"])=><article className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong><small className={`tone-${tone}`}>{note}</small></article>)}</div>}
function Tabs({value,onChange,items}){const move=(event)=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();const buttons=[...event.currentTarget.querySelectorAll('[role="tab"]')];const current=Math.max(0,buttons.indexOf(document.activeElement));const next=event.key==="Home"?0:event.key==="End"?buttons.length-1:(current+(event.key==="ArrowRight"?1:-1)+buttons.length)%buttons.length;onChange(items[next][0]);buttons[next]?.focus()};return <div className="tab-list" role="tablist" onKeyDown={move}>{items.map(([key,label])=><button key={key} type="button" role="tab" aria-selected={value===key} tabIndex={value===key?0:-1} className={value===key?"active":""} onClick={()=>onChange(key)}>{label}</button>)}</div>}
function BarChart({values,labels}){return <div className="bar-chart" role="img" aria-label={labels.map((label,index)=>`${label} : ${values[index]} %`).join(", ")}>{values.map((v,i)=><div key={labels[i]}><i style={{height:`${v}%`}} className={i===values.length-1?"accent":""}/><span>{labels[i]}</span></div>)}</div>}
function Donut({value}){return <div className="donut" role="progressbar" aria-label="Taux d’utilisation" aria-valuemin="0" aria-valuemax="100" aria-valuenow={value} style={{"--value":`${value*3.6}deg`}}><span>{value}%</span></div>}

function StudentAssignmentDetail({assignment}){
  const {submissions,session,submitAssignment}=useDemoStore();
  const existing=submissions.find(item=>item.assignmentId===assignment.id&&item.studentId===(session.userId||"user-eleve-lina"));
  const [answer,setAnswer]=useState(existing?.answer||"");
  const [feedback,setFeedback]=useState("");
  const [error,setError]=useState("");
  const submitted=existing?.status==="À corriger";
  const reviewed=existing?.status==="Corrigé";
  const submit=event=>{event.preventDefault();setError("");const result=submitAssignment({assignmentId:assignment.id,answer});if(!result.ok){setError(result.message);return}setFeedback("Ta remise est enregistrée dans cette démonstration locale. Aucun envoi hors de cet appareil.");navigateRoute(`/eleve/devoirs/${assignment.id}/remise-confirmee`)};
  return <StudentAssignmentView assignment={assignment} existing={existing} answer={answer} onChange={setAnswer} onSubmit={submit} feedback={feedback} error={error} ui={{RouteLink,PageHeader,DemoBadge}}/>;
}

function TeacherAssignmentDetail({assignment}){
  const {submissions,reviewSubmission}=useDemoStore();
  const assignmentSubmissions=submissions.filter(item=>item.assignmentId===assignment.id);
  const [selectedId,setSelectedId]=useState(assignmentSubmissions[0]?.id||"");
  const selected=assignmentSubmissions.find(item=>item.id===selectedId)||assignmentSubmissions[0]||null;
  const [score,setScore]=useState(selected?.score??"");
  const [comment,setComment]=useState(selected?.feedback||"");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{if(!selected)return;setScore(selected.score??"");setComment(selected.feedback||"");setNotice("");setError("")},[selected?.id]);
  const review=event=>{event.preventDefault();setError("");const result=reviewSubmission(selected.id,{score,feedback:comment});if(!result.ok){setError(result.message);return}setNotice(`La correction de ${selected.studentName} est enregistrée localement. Aucun envoi hors de cet appareil.`)};
  return <><nav className="detail-breadcrumb" aria-label="Fil d’Ariane"><RouteLink to="/enseignant/devoirs"><ArrowLeft/> Retour aux devoirs</RouteLink></nav><PageHeader eyebrow="CORRECTIONS" title={assignment.title} subtitle={`${assignment.className||assignment.level} · ${assignmentSubmissions.length} remise${assignmentSubmissions.length>1?"s":""} dans la démonstration`} serif/>{notice&&<div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Correction envoyée</strong><small>{notice}</small></span></div>}{assignmentSubmissions.length===0?<div className="empty-state assignment-empty"><ClipboardText/><h2>Aucune remise pour le moment</h2><p>Les réponses envoyées par les élèves apparaîtront ici automatiquement.</p></div>:<div className="teacher-correction-layout"><section className="panel submission-list" aria-label="Remises des élèves"><h2>Remises</h2>{assignmentSubmissions.map(item=><button key={item.id} className={selected?.id===item.id?"active":""} onClick={()=>setSelectedId(item.id)}><span>{item.studentName.split(" ").map(part=>part[0]).join("").slice(0,2)}</span><span><strong>{item.studentName}</strong><small>{item.status} · {new Date(item.submittedAt).toLocaleDateString("fr-FR")}</small></span><CaretRight/></button>)}</section><form className="panel correction-form" onSubmit={review}><span className="eyebrow">Réponse de {selected.studentName}</span><blockquote>{selected.answer}</blockquote><div className="form-two"><label>Note sur 20<input type="number" min="0" max="20" step="0.5" value={score} onChange={event=>setScore(event.target.value)} required/></label><label>Statut<input value={selected.status} readOnly/></label></div><label>Commentaire formatif<textarea value={comment} onChange={event=>setComment(event.target.value)} required/></label>{error&&<p className="form-error" role="alert"><WarningCircle/>{error}</p>}<button className="button button-dark" type="submit"><PaperPlaneTilt/> Envoyer la correction</button></form></div>}</>;
}

function RoleDetailPage({role,page,detail}){
  const {assignments,contents,updateContent,notify,session,currentUser}=useDemoStore();
  const [feedback,setFeedback]=useState("");
  const [mediaPlaying,setMediaPlaying]=useState(false);
  const [scheduleDate,setScheduleDate]=useState("2026-09-15");
  const [reviewNote,setReviewNote]=useState("Droits, niveau et métadonnées vérifiés.");
  const records={
    "enseignant:classes:5a":{eyebrow:"CLASSE 5A",title:"5e AEP · Classe 5A",subtitle:"29 élèves · Mme Salma Benjelloun",stats:[["Élèves actifs","82 %"],["Moyenne","7,6 / 10"],["Devoirs ouverts","3"],["À accompagner","4"]],sections:[["Progression du groupe","La classe avance régulièrement dans l’unité 3. L’expression écrite reste la compétence prioritaire."],["Prochaine action","Prévoir un atelier guidé de description du quartier pour les quatre élèves identifiés."]]},
    "enseignant:eleves:lina-mansouri":{eyebrow:"PROFIL ÉLÈVE",title:"Lina Mansouri",subtitle:"5e AEP · Classe 5A",stats:[["Progression globale","68 %"],["Moyenne","8,4 / 10"],["Série","9 jours"],["Temps hebdo","42 min"]],sections:[["Points forts","Compréhension orale, vocabulaire du patrimoine et participation aux tâches collectives."],["Objectif actuel","Structurer une production écrite de 80 mots avec des connecteurs simples."]]},
    "directeur:classes:4b":{eyebrow:"CLASSE À SUIVRE",title:"4e AEP · Classe 4B",subtitle:"24 élèves · Enseignant non affecté",stats:[["Activation","88 %"],["Usage","38 %"],["Élèves actifs","9 / 24"],["Alerte","Prioritaire"]],sections:[["Diagnostic","L’usage est inférieur à l’objectif établissement et aucun enseignant principal n’est affecté."],["Décision recommandée","Affecter un enseignant puis planifier un point d’adoption à sept jours."]]},
    "directeur:enseignants:salma-benjelloun":{eyebrow:"ÉQUIPE PÉDAGOGIQUE",title:"Salma Benjelloun",subtitle:"Français · Classes 5A et 5B",stats:[["Activité","Très active"],["Élèves suivis","57"],["Ressources partagées","24"],["Remise moyenne","91 %"]],sections:[["Pratiques observées","Usage régulier des ressources audio et retours formatifs courts sur les productions."],["Accompagnement","Valoriser ce parcours lors de la prochaine réunion pédagogique."]]},
    "admin:etablissements:groupe-scolaire-al-manar":{eyebrow:"ÉTABLISSEMENT",title:"Groupe scolaire Al Manar",subtitle:"Casablanca · Actif",stats:[["Élèves","654"],["Enseignants","42"],["Activation","94 %"],["Usage","76 %"]],sections:[["Licence","Contrat 2026–2027 · 700 accès attribués."],["Contact principal","M. Amine Alaoui · Direction pédagogique."]]},
    "admin:utilisateurs:lina-mansouri":{eyebrow:"COMPTE UTILISATEUR",title:"Lina Mansouri",subtitle:"Élève · Groupe scolaire Al Manar",stats:[["Statut","Active"],["Dernier accès","Aujourd’hui"],["Niveau","5e AEP"],["Activation","Valide"]],sections:[["Accès","Manuel Niveau 5 et ressources associées."],["Protection","Ce prototype ne contient aucune donnée personnelle réelle."]]},
    "parent:enfants:lina-mansouri":{eyebrow:"SUIVI DE MON ENFANT",title:"Lina Mansouri",subtitle:"5e AEP · Groupe scolaire Al Manar",stats:[["Progression globale","68 %"],["Moyenne","8,4 / 10"],["Devoirs à faire","2"],["Série","9 jours"]],sections:[["Cette semaine","42 minutes d’apprentissage et douze activités terminées."],["À encourager","Lina progresse bien à l’oral ; une courte activité d’écriture est recommandée."]]},
  };
  const availableAssignments=role==="eleve"?getStudentHomework(assignments,[],session.userId,currentUser?.classId||(session.userId==="user-eleve-lina"?"classe-5a":null)):assignments;
  const assignment=page==="devoirs"?resolveRouteRecord(availableAssignments,detail):null;
  const content=["bibliotheque","mediatheque","ressources"].includes(page)?resolveRouteRecord(contents,detail):null;
  const editableContent=role==="admin"&&page==="bibliotheque"?content:null;
  useEffect(()=>()=>window.speechSynthesis?.cancel(),[]);
  if(role==="enseignant"&&page==="analyses"&&detail==="souk-des-mots")return <TeacherMarketProgressPage/>;
  const previewContent=()=>{
    if(!content)return;
    if(mediaPlaying){window.speechSynthesis?.cancel();setMediaPlaying(false);setFeedback("Lecture arrêtée.");return;}
    if(!("speechSynthesis" in window)){setFeedback("La lecture vocale n’est pas disponible dans ce navigateur.");return;}
    const utterance=new SpeechSynthesisUtterance(`${content.title}. ${content.summary||"Découvre cette ressource Jet d’Encre et son vocabulaire essentiel."}`);
    utterance.lang="fr-FR";
    utterance.rate=.92;
    utterance.onend=()=>setMediaPlaying(false);
    utterance.onerror=()=>setMediaPlaying(false);
    window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);setMediaPlaying(true);setFeedback("Aperçu vocal lancé avec la synthèse du navigateur.");
  };
  if(assignment&&role==="eleve")return <StudentAssignmentDetail assignment={assignment}/>;
  if(assignment&&role==="enseignant")return <TeacherAssignmentDetail assignment={assignment}/>;
  const base=records[`${role}:${page}:${detail}`];
  const readable=detail.replaceAll("-"," ").replace(/\b\p{L}/gu,letter=>letter.toUpperCase());
  const generic=page==="classes"?{eyebrow:"FICHE CLASSE",title:`Classe ${detail.toUpperCase()}`,subtitle:"Groupe scolaire Al Manar",stats:[["Élèves","28"],["Activation","91 %"],["Usage","72 %"],["Moyenne","7,5 / 10"]],sections:[["Progression","Le groupe suit la progression prévue et utilise régulièrement les ressources audio."],["Prochaine action","Consulter les élèves à accompagner puis préparer le prochain devoir."]]}:page==="eleves"||page==="enseignants"||page==="utilisateurs"?{eyebrow:"FICHE UTILISATEUR",title:readable,subtitle:page==="enseignants"?"Équipe pédagogique":page==="eleves"?"Élève · Groupe scolaire Al Manar":"Compte de démonstration",stats:[["Statut","Actif"],["Dernier accès","Cette semaine"],["Activité","Régulière"],["Alertes","0"]],sections:[["Synthèse","Le profil est actif et correctement rattaché à son établissement."],["Confidentialité","Toutes les informations affichées sont fictives et limitées à ce prototype."]]}:page==="etablissements"?{eyebrow:"ÉTABLISSEMENT",title:readable,subtitle:"Réseau Jet d’Encre",stats:[["Statut","Actif"],["Élèves","196"],["Enseignants","12"],["Activation","84 %"]],sections:[["Licence","Accès valides pour l’année scolaire 2026–2027."],["Suivi","Les indicateurs détaillés seront alimentés par le système de production."]]}:page==="rapports"?{eyebrow:"RAPPORT DE PILOTAGE",title:readable,subtitle:"Synthèse locale · Données fictives",stats:[["Adoption","74 %"],["Activation","87 %"],["Classes actives","12 / 13"],["Période","Août 2026"]],sections:[["Lecture","L’adoption progresse de six points. La classe 4B reste le principal point d’attention."],["Décision","Affecter un enseignant à la 4B puis refaire un point à sept jours."]]}:page==="licences"?{eyebrow:"LOT DE LICENCES",title:detail,subtitle:"Français · Campagne 2026–2027",stats:[["Statut","Actif"],["Activation","82 %"],["Disponibles","362"],["Alertes","2"]],sections:[["Distribution","Le lot est attribué au réseau de démonstration et conserve des codes disponibles."],["Sécurité","Les contrôles affichés sont simulés localement ; aucune licence réelle n’est générée."]]}:page==="support"?{eyebrow:"TICKET DE SUPPORT",title:`Ticket #${detail}`,subtitle:"Centre de support · Démonstration",stats:[["Priorité","Haute"],["Statut","En cours"],["Délai","3 h 20"],["Échanges","3"]],sections:[["Demande","Le demandeur souhaite vérifier l’activation d’un lot de manuels."],["Prochaine action","Contrôler la campagne associée puis préparer une réponse au demandeur."]]}:null;
  const dynamic=assignment?{eyebrow:"DEVOIR",title:assignment.title,subtitle:`${assignment.className||assignment.level} · ${assignment.status}`,stats:[["Remises",`${assignment.submissions||0} / ${assignment.expectedSubmissions||0}`],["Statut",assignment.status],["Niveau",assignment.level||"5e AEP"],["Échéance",new Date(assignment.dueAt).toLocaleDateString("fr-FR")]],sections:[["Consigne",assignment.instructions||"Aucune consigne."],["Suivi","Les remises sont enregistrées dans la démonstration locale."]]}:content?{eyebrow:"CONTENU ÉDITORIAL",title:content.title,subtitle:`${content.type} · ${content.level}`,stats:[["Statut",content.status],["Format",content.type],["Niveau",content.level],["Unité",content.unit||"Toutes"]],sections:[["Visibilité",content.visibility||"Élèves et enseignants"],["Compétences",Array.isArray(content.competencies)?content.competencies.join(", "):content.competencies||"À compléter"]]}:null;
  const record=dynamic||base||generic;
  if(!record)return <div className="empty-state detail-empty"><FolderOpen/><h1>Détail indisponible</h1><p>Cette fiche n’existe pas dans les données de démonstration.</p><RouteLink to={`/${role}/${page}`} className="button button-light"><ArrowLeft/> Retour à la liste</RouteLink></div>;
  const contentWorkflow=editableContent?({"Brouillon":{next:"À réviser",label:"Envoyer en révision",feedback:"Le contenu a été placé dans la file de révision."},"À réviser":{next:"Planifié",label:"Valider et planifier",feedback:`Le contenu est validé et planifié pour le ${new Date(`${scheduleDate}T12:00:00`).toLocaleDateString("fr-FR")}.`},"Planifié":{next:"Publié",label:"Publier maintenant",feedback:"Le contenu est maintenant publié et visible dans les espaces autorisés."},"Publié":{next:"À réviser",label:"Rouvrir la révision",feedback:"Le contenu publié est revenu dans la file de révision."},"Archivé":{next:"Brouillon",label:"Restaurer en brouillon",feedback:"Le contenu est restauré comme brouillon."}}[editableContent.status]||{next:"À réviser",label:"Envoyer en révision",feedback:"Le contenu a été placé dans la file de révision."}):null;
  const primaryLabel=contentWorkflow?.label||"Enregistrer un suivi";
  const act=()=>{if(editableContent){const patch={status:contentWorkflow.next,reviewNote};if(contentWorkflow.next==="Planifié")patch.scheduledAt=`${scheduleDate}T08:00:00.000Z`;if(contentWorkflow.next==="Publié")patch.publishedAt=new Date().toISOString();updateContent(editableContent.id,patch);notify({role:"admin",type:"contenu",title:`Cycle éditorial · ${record.title}`,message:`Nouveau statut : ${contentWorkflow.next}.`,action:`/admin/bibliotheque/${editableContent.id}`});setFeedback(contentWorkflow.feedback);}else{notify({role,title:`Action enregistrée · ${record.title}`,message:"Suivi ajouté dans le prototype local."});setFeedback("L’action a été enregistrée et une notification a été créée.");}};
  const headerAction=editableContent?<button className="button button-dark" onClick={act}><PencilSimple/>{primaryLabel}</button>:content?<button className="button button-light" onClick={previewContent}><PlayCircle/> {mediaPlaying?"Arrêter l’aperçu":"Écouter l’aperçu"}</button>:<button className="button button-dark" onClick={act}><CheckCircle/>{primaryLabel}</button>;
  return <><nav className="detail-breadcrumb" aria-label="Fil d’Ariane"><RouteLink to={`/${role}/${page}`}><ArrowLeft/> Retour à {roleConfigs[role].nav.find(([slug])=>slug===page)?.[1]?.toLowerCase()}</RouteLink></nav><PageHeader eyebrow={record.eyebrow} title={record.title} subtitle={record.subtitle} serif action={headerAction}/>{feedback&&<div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Action confirmée</strong><small>{feedback}</small></span></div>}<div className="detail-stat-grid">{record.stats.map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><div className="detail-layout"><section className="panel detail-summary"><h2>Synthèse</h2>{record.sections.map(([title,copy])=><article key={title}><span><CheckCircle weight="duotone"/></span><div><h3>{title}</h3><p>{copy}</p></div></article>)}</section><aside className="panel detail-actions"><h2>Actions rapides</h2>{editableContent?.status==="À réviser"&&<div className="detail-workflow-form"><label>Date de publication<input type="date" min="2026-08-27" value={scheduleDate} onChange={event=>setScheduleDate(event.target.value)}/></label><label>Note de révision<textarea value={reviewNote} onChange={event=>setReviewNote(event.target.value)}/></label></div>}{editableContent?<button onClick={act}><PencilSimple/><span><strong>{primaryLabel}</strong><small>Passer au statut « {contentWorkflow.next} »</small></span><CaretRight/></button>:content?<button onClick={previewContent}><PlayCircle/><span><strong>{mediaPlaying?"Arrêter l’aperçu":"Aperçu vocal"}</strong><small>Lecture générée dans le navigateur</small></span><CaretRight/></button>:<button onClick={act}><Megaphone/><span><strong>Créer un suivi</strong><small>Ajoute une notification locale</small></span><CaretRight/></button>}<RouteLink to={`/${role}/${page}`}><FolderOpen/><span><strong>Retour à la liste</strong><small>Conserver les filtres du module</small></span><CaretRight/></RouteLink><div className="prototype-note"><DemoBadge/><p>Données fictives enregistrées uniquement dans ce navigateur.</p></div></aside></div></>;
}

function StudentPages({page,studentXp}){if(page==="tableau-de-bord")return <StudentDashboard/>;if(page==="manuel"||page==="manuels")return <StudentManual/>;if(page==="activites")return <StudentActivities/>;if(page==="devoirs")return <StudentHomework/>;if(page==="jeux")return <StudentGames studentXp={studentXp}/>;if(page==="progres"||page==="progression")return <AchievementProgressPage studentXp={studentXp} ui={{PageHeader,KpiGrid,RouteLink}}/>;if(page==="recompenses")return <AchievementRewardsPage studentXp={studentXp} ui={{PageHeader,RouteLink}}/>;if(page==="onboarding")return <div className="empty-state"><UserCircle/><h1>Compléter mon profil</h1><p>Choisis ton avatar puis confirme ta classe pour personnaliser ton parcours.</p><RouteLink to="/eleve/onboarding/profil" className="button button-gold">Commencer <ArrowRight/></RouteLink></div>;return <NotFound route={{role:"eleve"}} sessionRole="eleve"/>}

function StudentActivities(){return <><PageHeader eyebrow="ACTIVITÉS" title="Je m’entraîne à mon rythme" subtitle="Des activités courtes pour écouter, choisir, écrire et gagner en confiance."/><div className="quick-grid"><RouteLink to="/eleve/activites/mots-environnement"><Sparkle weight="duotone"/><strong>Les mots de l’environnement</strong><span>5 questions · Unité 3</span></RouteLink><RouteLink to="/eleve/jeux/mot-juste"><PencilSimple weight="duotone"/><strong>Le Mot juste</strong><span>Lexique et grammaire</span></RouteLink><RouteLink to="/eleve/jeux/defi-du-jour"><Trophy weight="duotone"/><strong>Défi du jour</strong><span>5 questions · bonus quotidien</span></RouteLink><RouteLink to="/eleve/devoirs"><PaperPlaneTilt weight="duotone"/><strong>Mes tâches finales</strong><span>Productions à remettre</span></RouteLink></div></>}

function StudentDashboard() {
  const {manualActivations,quizAttempts,assignments,submissions,session,currentUser}=useDemoStore();
  const active=manualActivations.filter(item=>item.userId===session.userId).at(-1);
  const latest=quizAttempts.find(item=>item.userId===session.userId);
  const homework=getStudentHomework(assignments,submissions,session.userId,currentUser?.classId||(session.userId==="user-eleve-lina"?"classe-5a":null));
  const todo=homework.filter(item=>item.status==="À faire");
  return <StudentDashboardView currentUser={currentUser} active={active} latest={latest} todo={todo} ui={{PageHeader,RouteLink,ResponsiveImage}}/>;
}

function StudentManual() {
  const {manualActivations,session}=useDemoStore();
  const active=manualActivations.filter(item=>item.userId===session.userId).at(-1);
  return <><PageHeader eyebrow={`MANUEL · ${active?.level||"5e AEP"}`} title={active?.manualTitle||"Le manuel Jet d’Encre"} subtitle="Aperçu éditorial de démonstration"/>
    <p className="prototype-banner" role="note">Cette illustration présente une intention éditoriale ; ce n’est pas un manuel complet à feuilleter. Les livres réellement lisibles sont dans la Médiathèque.</p>
    <div className="manual-layout"><section className="manual-viewer"><div className="manual-visual"><ResponsiveImage fileName="generated-1773971894915.png" alt="Illustration d’une double page de démonstration sur le patrimoine marocain" sizes="(max-width:900px) 100vw,65vw"/></div></section><aside className="lesson-panel"><span className="status-pill warning">En préparation</span><h2>Lire et pratiquer</h2><p>Explore un livre de démonstration ou essaie une activité corrigée. Aucune progression du manuel n’est déduite de cette illustration.</p><RouteLink to="/eleve/mediatheque" className="lesson-action"><Books/><span><strong>Ouvrir la Médiathèque</strong><small>Des livres avec de vraies pages</small></span><ArrowRight/></RouteLink><RouteLink to="/eleve/activites/mots-environnement" className="lesson-action"><GameController/><span><strong>Les mots de l’environnement</strong><small>5 questions et leurs explications</small></span><ArrowRight/></RouteLink></aside></div></>;
}

function StudentHomework(){
  const {assignments,submissions,session,currentUser}=useDemoStore();
  const homework=getStudentHomework(assignments,submissions,session.userId,currentUser?.classId||(session.userId==="user-eleve-lina"?"classe-5a":null));
  return <StudentHomeworkView homework={homework} ui={{PageHeader,RouteLink,Tabs}}/>;
}

function DebateGameFeature({role="eleve"}){return <DebateGameFeatureView role={role} RouteLink={RouteLink}/>;}

function StudentGames({studentXp=DEFAULT_STUDENT_XP}){
  const {quizAttempts,session}=useDemoStore();
  const challenge=getDailyChallenge();
  const history=getDailyChallengeHistory(quizAttempts,session.userId);
  const completedToday=getCompletedDailyChallenge(quizAttempts,session.userId,challenge.dateKey);
  const zelligeDaily=getDailyMissionZellige();
  const zelligeCompleted=getCompletedMissionZellige(quizAttempts,session.userId,zelligeDaily.dateKey);
  const zelligeHistory=getMissionZelligeHistory(quizAttempts,session.userId);
  const zelligeFragmentCount=new Set(zelligeHistory.map(attempt=>attempt.fragmentId||attempt.category).filter(Boolean)).size;
  return <>
    <PageHeader eyebrow="APPRENDRE EN JOUANT" title="Mes jeux" subtitle="Teste tes connaissances, découvre de nouveaux repères et fais progresser ton profil." action={<div className="games-xp-balance"><Sparkle weight="fill"/><span><small>MON PROFIL</small><strong>{studentXp} XP</strong></span></div>}/>
    <DebateGameFeature role="eleve"/>
    <section className={`game-feature-card mission-zellige-feature${zelligeCompleted?" is-completed":""}`}>
      <div className="game-feature-copy">
        <span className="game-kicker"><Sparkle weight="fill"/> MISSION DU JOUR · AVENTURE GUIDÉE</span>
        <h2>{zelligeCompleted?"Mission accomplie, bravo !":zelligeDaily.mission.title}</h2>
        <p>{zelligeCompleted?"Tes 20 XP sont enregistrés. Tu peux rejouer cette situation sans limite ou tester les trois autres décors de la bêta.":"Observe une scène marocaine illustrée, écoute un indice et construis une phrase utile pour aider Lina dans son quartier."}</p>
        <div className="game-facts" aria-label="Caractéristiques de Mission Zellige"><span><PlayCircle weight="bold"/> 4 situations illustrées</span><span><Clock weight="bold"/> 3–5 min</span><span><Sparkle weight="fill"/> +20 XP aujourd’hui</span><span><DiamondsFour weight="fill"/> {zelligeFragmentCount}/4 fragments</span></div>
        <RouteLink to="/eleve/jeux/mission-zellige" className="button button-gold">{zelligeCompleted?"Revoir ma mission":"Commencer la mission"} <ArrowRight weight="bold"/></RouteLink>
      </div>
      <div className="mission-zellige-card-art">
        <img src={zelligeDaily.mission.cardImageSrc} alt="" width="640" height="400" loading="lazy" decoding="async"/>
        <span>{zelligeCompleted?<><CheckCircle weight="fill"/> Terminée aujourd’hui</>:<>BÊTA · 5e AEP</>}</span>
      </div>
    </section>
    <section className={`game-feature-card daily-game-feature zellige-section${completedToday?" is-completed":""}`}>
      <div className="game-feature-copy">
        <span className="game-kicker"><Trophy weight="fill"/> DÉFI DU JOUR · {challenge.category.toUpperCase()}</span>
        <h2>{completedToday?"Défi relevé, bravo !":"Cinq questions, une nouvelle aventure"}</h2>
        <p>{completedToday?`Ton score du jour est enregistré : ${completedToday.correctCount}/${completedToday.questionCount}. Reviens demain pour une nouvelle catégorie vedette.`:"Cinq questions choisies spécialement pour aujourd’hui. Termine le parcours pour gagner ton bonus, puis retrouve ton score dans l’historique."}</p>
        <div className="game-facts" aria-label="Caractéristiques du défi"><span><Question weight="bold"/> 5 questions</span><span><Clock weight="bold"/> 10 s par question</span><span><Sparkle weight="fill"/> +20 XP de complétion</span>{history.length>0&&<span><CheckCircle weight="fill"/> {history.length} défi{history.length>1?"s":""} terminé{history.length>1?"s":""}</span>}</div>
        <RouteLink to="/eleve/jeux/defi-du-jour" className="button button-gold">{completedToday?"Voir mon résultat":"Relever le défi"} <PlayCircle weight="fill"/></RouteLink>
      </div>
      <div className="daily-game-art" aria-hidden="true"><img src="/assets/defi-du-jour-hero.webp" alt="" width="768" height="768" loading="eager" decoding="async"/>{completedToday&&<span><CheckCircle weight="fill"/> Aujourd’hui</span>}</div>
    </section>
    <section className="game-secondary-card">
      <span className="game-secondary-icon"><GameController weight="duotone"/></span>
      <div><span className="game-kicker">ENTRAÎNEMENT LIBRE</span><h2>Quiz Culture générale</h2><p>Dix questions sur le Maroc, le monde francophone, les sciences, l’histoire et les arts. Rejoue quand tu veux et gagne 10 XP par bonne réponse.</p></div>
      <RouteLink to="/eleve/jeux/culture-generale" className="button button-light">Jouer librement <ArrowRight/></RouteLink>
    </section>
    <section className="game-secondary-card word-choice-entry">
      <span className="game-secondary-icon word-choice-thumb"><img src="/assets/games/word-choice/le-mot-juste-hero.webp" alt="" width="160" height="160" loading="lazy" decoding="async"/></span>
      <div><span className="game-kicker">VOCABULAIRE & GRAMMAIRE</span><h2>Le Mot juste</h2><p>Complète des phrases proches du quotidien marocain, choisis parmi quatre mots et découvre une explication simple après chaque réponse.</p></div>
      <RouteLink to="/eleve/jeux/mot-juste" className="button button-light">Trouver le mot <PencilSimple weight="fill"/></RouteLink>
    </section>
    <section className="game-secondary-card mots-fleches-entry">
      <span className="game-secondary-icon mots-fleches-thumb"><GridNine weight="duotone"/></span>
      <div><span className="game-kicker">LEXIQUE & ORTHOGRAPHE · 18 GRILLES</span><h2>Mots fléchés</h2><p>Retrouve les mots grâce aux définitions placées dans la grille. Explore 6 grilles par niveau et gagne de 20 à 50 XP après chaque grille complète.</p></div>
      <RouteLink to="/eleve/jeux/mots-fleches" className="button button-light">Choisir une grille <ArrowRight/></RouteLink>
    </section>
    <section className="game-secondary-card market-shop-entry">
      <span className="game-secondary-icon market-shop-thumb"><img src="/assets/games/market-shop/market-vendor-scene.webp" alt="" width="160" height="160" loading="lazy" decoding="async"/></span>
      <div><span className="game-kicker">COMMUNIQUER AU QUOTIDIEN</span><h2>Le Souk des mots</h2><p>Écoute une commande, prépare le bon panier et utilise une formule polie avec le vendeur. Trois paliers et douze missions permettent de gagner jusqu’à 180 XP.</p></div>
      <RouteLink to="/eleve/jeux/souk-des-mots" className="button button-light">Faire les courses <Storefront weight="fill"/></RouteLink>
    </section>
    <section className="game-secondary-card class-challenge-entry">
      <span className="game-secondary-icon class-challenge-thumb"><img src="/assets/games/class-challenges/defis-classes-hero.webp" alt="" width="160" height="160" loading="lazy" decoding="async"/></span>
      <div><span className="game-kicker">DÉFI DE LA CLASSE · PSEUDONYME PRIVÉ</span><h2>La classe avance ensemble</h2><p>Participe aux défis de ton enseignante, suis ton rang et compare ta progression uniquement avec les pseudonymes de ta classe.</p></div>
      <RouteLink to="/eleve/jeux/defis-classe" className="button button-light">Voir les défis <UsersThree weight="fill"/></RouteLink>
    </section>
    <div className="game-guidance" aria-label="Principes du quiz">
      <article><CheckCircle weight="duotone"/><div><strong>Apprendre après chaque réponse</strong><span>Une explication courte complète la correction.</span></div></article>
      <article><Clock weight="duotone"/><div><strong>Un défi différent chaque jour</strong><span>La sélection change avec une catégorie vedette tournante.</span></div></article>
      <article><Sparkle weight="duotone"/><div><strong>Une récompense équilibrée</strong><span>Les bonnes réponses et le bonus quotidien rejoignent ton profil.</span></div></article>
    </div>
  </>
}

function TeacherClassChallengesPage(){const {classChallenges,classChallengeResults,createClassChallenge,finishClassChallenge}=useDemoStore();return <Suspense fallback={<div className="panel" role="status">Ouverture des défis de classe…</div>}><ClassChallengesTeacher challenges={classChallenges} results={classChallengeResults} onCreate={createClassChallenge} onFinish={finishClassChallenge}/></Suspense>}

function TeacherGames(){return <TeacherGamesView RouteLink={RouteLink}/>;}

function TeacherPages({page,search}){if(["tableau-de-bord","actions"].includes(page))return <BetaRolePage role="enseignant" page={page} ui={{PageHeader,RouteLink}}/>;if(page==="classes")return <TeacherClasses/>;if(page==="eleves")return <TeacherStudents search={search}/>;if(page==="devoirs"||page==="remises")return <TeacherHomework/>;if(page==="jeux")return <TeacherGames/>;if(page==="defis")return <TeacherClassChallengesPage/>;if(page==="ressources")return <TeacherResources/>;if(page==="analyses")return <TeacherAnalytics/>;return <NotFound route={{role:"enseignant"}} sessionRole="enseignant"/>}

function TeacherDashboard(){return <><PageHeader eyebrow="GROUPE SCOLAIRE AL MANAR · CASABLANCA" title="Bonjour Mme Benjelloun" subtitle="Voici les actions importantes pour aujourd’hui." action={<RouteLink to="/enseignant/devoirs" className="button button-green"><Plus/> Créer un devoir</RouteLink>}/><KpiGrid items={[["Classes","4","Toutes actives"],["Élèves","112","+ 3 cette semaine"],["À corriger","18","À traiter","gold"],["Actifs cette semaine","76 %","+ 8 points"]]}/><div className="dashboard-two-columns teacher-columns"><article className="panel"><div className="panel-heading"><h2>Mes classes</h2><RouteLink to="/enseignant/classes">Voir toutes les classes</RouteLink></div>{[["5A","5e AEP · Classe 5A","29 élèves · Moyenne 7,6/10","82 % actifs"],["5B","5e AEP · Classe 5B","28 élèves · 6 devoirs à corriger","74 % actifs"],["6A","6e AEP · Classe 6A","30 élèves","79 % actifs"]].map(r=><div className="class-row" key={r[0]}><span>{r[0]}</span><div><strong>{r[1]}</strong><small>{r[2]}</small></div><i>{r[3]}</i></div>)}</article><article className="panel action-panel"><h2>À faire maintenant</h2><div className="notice-card"><WarningCircle weight="fill"/><span><strong>5 élèves sans activation</strong><small>Classes 5A et 5B</small></span></div><div className="task-line"><strong>Quiz Unité 3</strong><small>24 remises · 6 à corriger</small></div><RouteLink to="/enseignant/ressources" className="button button-light button-wide"><PresentationChart/> Choisir une ressource</RouteLink></article></div></>}

function TeacherClasses(){
  const {notify}=useDemoStore();
  const [active,setActive]=useState("classes");
  const [creating,setCreating]=useState(false);
  const [draft,setDraft]=useState({code:"",grade:"5e année primaire",students:25});
  const [extra,setExtra]=useState([]);
  const all=[...[ ["5A","5e année primaire",29,82,"7,6"],["5B","5e année primaire",28,74,"7,2"],["6A","6e année primaire",30,79,"8,1"],["6B","6e année primaire",25,68,"7,4"] ],...extra];
  const visible=active==="attention"?all.filter(item=>Number(item[3])<70):active==="activite"?all.filter(item=>Number(item[3])>=75):all;
  const addClass=event=>{event.preventDefault();const code=draft.code.trim().toUpperCase();if(!code)return;setExtra(items=>[...items,[code,draft.grade,Number(draft.students)||0,0,"—"]]);notify({role:"enseignant",title:`Classe ${code} ajoutée`,message:"Groupe local prêt à être rattaché.",action:"/enseignant/classes"});setCreating(false);setDraft({code:"",grade:"5e année primaire",students:25})};
  return <><PageHeader eyebrow="MES CLASSES" title={`${all.length} classes · ${all.reduce((sum,item)=>sum+Number(item[2]),0)} élèves`} subtitle="Suivez les activités, les devoirs et la progression de chaque groupe." action={<button className="button button-green" onClick={()=>setCreating(value=>!value)} aria-expanded={creating}><Plus/> Ajouter une classe</button>}/>{creating&&<form className="panel pen-editor-form" onSubmit={addClass}><h2>Ajouter un groupe de travail</h2><div className="form-two"><label>Code de la classe<input value={draft.code} onChange={event=>setDraft({...draft,code:event.target.value})} placeholder="Ex. 5C" required/></label><label>Niveau<select value={draft.grade} onChange={event=>setDraft({...draft,grade:event.target.value})}><option>4e année primaire</option><option>5e année primaire</option><option>6e année primaire</option></select></label></div><label>Nombre d’élèves<input type="number" min="1" max="50" value={draft.students} onChange={event=>setDraft({...draft,students:event.target.value})}/></label><button className="button button-green" type="submit"><Check/> Ajouter le groupe</button></form>}<Tabs value={active} onChange={setActive} items={[["classes","Toutes les classes"],["activite","Activité récente"],["attention",`À surveiller · ${all.filter(item=>Number(item[3])<70).length}`]]}/><div className="class-cards">{visible.map(([code,grade,n,activeRate,avg])=><article key={code}><div className="class-card-top"><span>{code}</span><i className={Number(activeRate)<70?"warn":""}>{activeRate}% actifs</i></div><h3>{grade} · Classe {code}</h3><p>{n} élèves</p><div className="mini-stats"><span><strong>{avg}/10</strong>Moyenne</span><span><strong>3</strong>Devoirs</span><span><strong>6</strong>Unités</span></div><RouteLink to={`/enseignant/classes/${code.toLowerCase()}`} className="button button-light button-wide">Ouvrir la classe <ArrowRight/></RouteLink></article>)}</div>{visible.length===0&&<div className="empty-state"><CheckCircle/><h3>Aucune classe à surveiller</h3><p>Tous les groupes sont au-dessus du seuil d’attention.</p></div>}</>;
}

function TeacherStudents({search}){const allStudents=[["Lina Mansouri","5A","68 %","8,4/10","Active"],["Yassine El Idrissi","5A","72 %","7,1/10","Active"],["Nour Berrada","5B","64 %","6,8/10","À relancer"],["Adam Tazi","6A","91 %","9,0/10","Active"],["Meryem Chraïbi","6B","78 %","7,7/10","Active"]];const students=allStudents.filter(r=>r[0].toLowerCase().includes(search.toLowerCase()));const csv=encodeURIComponent(["Élève,Classe,Progression,Moyenne,Statut",...students.map(row=>row.join(","))].join("\n"));return <><PageHeader eyebrow="SUIVI DES ÉLÈVES" title="Profils de démonstration" subtitle="Consultez les progrès individuels et identifiez rapidement les besoins d’accompagnement." action={<a className="button button-light" href={`data:text/csv;charset=utf-8,${csv}`} download="suivi-eleves-demo.csv"><DownloadSimple/> Exporter</a>}/><div className="filter-bar"><button><Funnel/> Toutes les classes <CaretDown/></button><button>Activité récente <CaretDown/></button><span>{students.length} élève{students.length>1?"s":""} affiché{students.length>1?"s":""}</span></div><DataTable label="Liste des élèves" headers={["Élève","Classe","Progression","Moyenne","Statut",""]} rows={students.map(r=>[r[0],r[1],r[2],r[3],<span className={r[4]==="Active"?"status-pill success":"status-pill warning"}>{r[4]}</span>,<RouteLink to={`/enseignant/eleves/${slugifyRoute(r[0])}`} className="icon-button" aria-label={`Ouvrir le profil de ${r[0]}`}><CaretRight/></RouteLink>])}/></>}

function TeacherHomework(){
  const {assignments,createAssignment,duplicateAssignment,archiveAssignment,notify}=useDemoStore();
  const [wizard,setWizard]=useState(false);const [step,setStep]=useState(1);const [notice,setNotice]=useState("");
  const close=()=>{setWizard(false);setStep(1)};
  const publish=(input)=>{const result=createAssignment(input);if(result.ok){notify({role:"eleve",title:"Nouveau devoir",message:`${input.title} · ${input.className}`});setNotice(`Le devoir « ${input.title} » est publié et visible dans la liste.`);close();}return result;};
  if(wizard)return <HomeworkWizard step={step} setStep={setStep} onClose={close} onPublish={publish}/>;
  const visible=assignments.filter(item=>item.status!=="Archivé");
  return <><PageHeader eyebrow="DEVOIRS" title="Préparer et corriger" subtitle="Créez une activité, suivez les remises et donnez un retour utile à chaque élève." action={<button className="button button-green" onClick={()=>setWizard(true)}><Plus/> Créer un devoir</button>}/>{notice&&<div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Devoir enregistré</strong><small>{notice}</small></span></div>}<KpiGrid items={[["À venir",String(visible.length),"Données locales"],["Remises à corriger","18","6 prioritaires","gold"],["Taux de remise","91 %","+ 4 points"],["Moyenne générale","7,8/10","Stable"]]}/><div className="list-panel">{visible.map(item=><article className="homework-row" key={item.id}><span className="row-icon"><ClipboardText weight="duotone"/></span><div><h3>{item.title}</h3><p>{item.className||item.level} · Échéance {new Date(item.dueAt).toLocaleDateString("fr-FR")}</p></div><span className={`status-pill ${item.status==="Publié"?"success":"neutral"}`}>{item.submissions||0} / {item.expectedSubmissions||0} remises</span><span className="homework-actions"><RouteLink className="icon-button" to={`/enseignant/devoirs/${item.id}`} aria-label={`Ouvrir ${item.title}`}><Eye/></RouteLink><button className="icon-button" onClick={()=>{duplicateAssignment(item.id);setNotice("Une copie brouillon a été créée.")}} aria-label={`Dupliquer ${item.title}`}><Copy/></button><button className="icon-button" onClick={()=>{archiveAssignment(item.id);setNotice("Le devoir a été archivé.")}} aria-label={`Archiver ${item.title}`}><Archive/></button></span></article>)}</div></>
}

function HomeworkWizard({step,setStep,onClose,onPublish}){
  const labels=["Informations","Contenu","Destinataires","Publication"];
  const [title,setTitle]=useState("Décrire un lieu de ma ville");
  const [instructions,setInstructions]=useState("Présente un lieu de ta ville en utilisant au moins cinq adjectifs qualificatifs.");
  const [className,setClassName]=useState("5e AEP · Classe 5A");
  const [dueAt,setDueAt]=useState("2026-09-10");
  const submit=()=>onPublish({title,subject:"Français",classId:className.includes("5A")?"classe-5a":"classe-5b",className,level:"5e AEP",teacherId:"user-enseignante-salma",instructions,dueAt:`${dueAt}T18:00:00.000Z`,status:"Publié",submissions:0,expectedSubmissions:className.includes("5A")?29:28});
  return <div className="wizard"><div className="wizard-top"><div><span className="page-eyebrow">NOUVEAU DEVOIR</span><h1>Créer un devoir</h1></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X/></button></div><div className="wizard-steps" aria-label="Étapes">{labels.map((item,index)=><span className={step===index+1?"active":step>index+1?"done":""} key={item}><i>{step>index+1?<Check/>:index+1}</i>{item}</span>)}</div><section className="wizard-card">{step===1&&<><h2>Informations principales</h2><label>Titre du devoir<input value={title} onChange={event=>setTitle(event.target.value)} required/></label><label>Consigne<textarea value={instructions} onChange={event=>setInstructions(event.target.value)}/></label><div className="form-two"><label>Matière<select defaultValue="fr"><option value="fr">Français</option></select></label><label>Durée estimée<select defaultValue="10"><option value="10">10 minutes</option><option value="20">20 minutes</option></select></label></div></>}{step===2&&<><h2>Choisissez les activités</h2><div className="selectable-list">{["Compréhension orale · La place Jemaa el-Fna","Vocabulaire · Décrire un lieu","Production écrite · Mon quartier"].map((item,index)=><label key={item}><input type="checkbox" defaultChecked={index<2}/><span><strong>{item}</strong><small>{index===2?"Réponse libre":"Activité autocorrective"}</small></span></label>)}</div></>}{step===3&&<><h2>Destinataires et calendrier</h2><div className="form-two"><label>Classe<select value={className} onChange={event=>setClassName(event.target.value)}><option>5e AEP · Classe 5A</option><option>5e AEP · Classe 5B</option></select></label><label>Échéance<input type="date" value={dueAt} min="2026-08-27" onChange={event=>setDueAt(event.target.value)}/></label></div></>}{step===4&&<div className="publish-summary"><span><CheckCircle weight="duotone"/></span><h2>Tout est prêt</h2><p><strong>{title}</strong> sera envoyé à {className} avec une échéance au {new Date(`${dueAt}T12:00:00`).toLocaleDateString("fr-FR")}.</p><div><span>2 activités</span><span>{className.includes("5A")?29:28} élèves</span><span>10 minutes</span></div></div>}</section><div className="wizard-actions"><button className="button button-light" onClick={()=>step===1?onClose():setStep(step-1)}><ArrowLeft/> {step===1?"Annuler":"Précédent"}</button>{step<4?<button className="button button-green" disabled={step===1&&!title.trim()} onClick={()=>setStep(step+1)}>Continuer <ArrowRight/></button>:<button className="button button-green" onClick={submit}><PaperPlaneTilt/> Publier le devoir</button>}</div></div>
}

function TeacherResources(){const {contents}=useDemoStore();const [filter,setFilter]=useState("Tous");const labelFor={Podcast:"Audios",Documentaire:"Vidéos","Jeu éducatif":"Jeux","E-book":"Manuels"};const imageFor={Podcast:"generated-1774007681359.png",Documentaire:"generated-1774007838586.png","Jeu éducatif":"generated-1774007656775.png","E-book":"generated-1773971894915.png"};const resources=contents.filter(item=>item.status==="Publié"&&item.visibility!=="Élèves"&&(filter==="Tous"||labelFor[item.type]===filter));return <><PageHeader eyebrow="RESSOURCES PÉDAGOGIQUES" title="Préparez vos séances" subtitle="Les ressources validées par l’administration sont disponibles sans ressaisie."/><div className="resource-toolbar" aria-label="Filtrer les ressources">{["Tous","Manuels","Audios","Vidéos","Jeux"].map(item=><button className={filter===item?"active":""} aria-pressed={filter===item} onClick={()=>setFilter(item)} key={item}>{item}</button>)}</div><div className="resource-grid">{resources.map(item=><article key={item.id}><ResponsiveImage fileName={imageFor[item.type]||"generated-1774018865796.png"} alt="" sizes="(max-width: 900px) 50vw, 25vw"/><div><span>{item.type}</span><h3>{item.title}</h3><p>{item.unit||"Toutes les unités"} · {item.level||"Tous niveaux"}</p><div><RouteLink to={`/enseignant/ressources/${item.id}`} className="button button-light"><Eye/> Aperçu</RouteLink><button className="icon-button" disabled title="Projection disponible après intégration du lecteur média" aria-label={`Projeter ${item.title}`}><PresentationChart/></button></div></div></article>)}</div>{resources.length===0&&<div className="empty-state"><FolderOpen/><h3>Aucune ressource dans ce filtre</h3><p>Choisissez une autre catégorie.</p></div>}</>}

function TeacherMarketProgressPage(){const {quizAttempts,quizAwards}=useDemoStore();return <Suspense fallback={<div className="panel" role="status">Préparation du suivi du Souk des mots…</div>}><TeacherMarketDashboard awardHistory={quizAwards} attemptHistory={quizAttempts} onBack={()=>navigateRoute("/enseignant/analyses")}/></Suspense>}

function TeacherAnalytics(){return <><TeacherAnalyticsEntry RouteLink={RouteLink}/><KpiGrid items={[["Élèves actifs","86 / 112","+ 9 cette semaine"],["Temps moyen","34 min","Par semaine"],["Activités réussies","78 %","+ 5 points"],["À accompagner","11","Élèves identifiés","gold"]]}/><div className="dashboard-two-columns"><article className="panel"><h2>Progression par classe</h2><BarChart values={[82,74,79,68]} labels={["5A","5B","6A","6B"]}/></article><article className="panel"><h2>Compétences à renforcer</h2><ProgressBar value={58} label="Expression écrite"/><ProgressBar value={67} label="Accords grammaticaux"/><ProgressBar value={72} label="Compréhension orale"/><RouteLink to="/enseignant/eleves" className="button button-light button-wide">Voir les élèves concernés</RouteLink></article></div></>}

function DirectorPages({page,search}){if(["tableau-de-bord","actions"].includes(page))return <BetaRolePage role="directeur" page={page} ui={{PageHeader,RouteLink}}/>;if(page==="classes")return <DirectorClasses/>;if(page==="enseignants")return <DirectorTeachers search={search}/>;if(page==="activations"||page==="eleves")return <DirectorActivations/>;if(page==="utilisation"||page==="suivi-utilisation")return <DirectorUsage/>;if(page==="rapports")return <DirectorReports/>;return <NotFound route={{role:"directeur"}} sessionRole="directeur"/>}

function DirectorDashboard(){return <><PageHeader eyebrow="GROUPE SCOLAIRE AL MANAR · CASABLANCA" title="Piloter l’adoption pédagogique" subtitle="Données des 30 derniers jours · Synchronisées il y a 8 minutes" serif action={<RouteLink to="/directeur/rapports" className="button button-dark">Voir les rapports <ArrowRight/></RouteLink>}/><div className="wide-notice"><WarningCircle weight="fill"/><div><strong>La classe 4B présente une activité inférieure à 40 %.</strong><span>Un enseignant n’est pas encore affecté à cette classe.</span></div><RouteLink to="/directeur/classes/4b" className="button button-light">Voir la classe</RouteLink></div><KpiGrid items={[["Élèves activés","618 / 654","94 %"],["Classes actives","18","Toutes les classes"],["Enseignants actifs","40 / 42","95 %"],["Usage hebdomadaire","76 %","+ 6 points"]]}/><div className="dashboard-two-columns"><article className="panel"><div className="panel-heading"><h2>Utilisation pédagogique par semaine</h2><span>Août 2026</span></div><BarChart values={[54,63,72,78]} labels={["S1","S2","S3","S4"]}/></article><article className="panel"><h2>Ressources utilisées</h2><Donut value={76}/><p className="chart-legend">Exercices 46 % · Audios 28 %<br/>Manuels 18 % · Vidéos 8 %</p></article></div></>}
function DirectorClasses(){return <><PageHeader eyebrow="ORGANISATION" title="Classes de l’établissement" subtitle="18 classes · 654 élèves · Année scolaire 2026–2027" action={<RouteLink to="/directeur/classes/nouvelle" className="button button-dark"><Plus/> Créer une classe</RouteLink>}/><div className="filter-bar"><button><Funnel/> Tous les niveaux <CaretDown/></button><button>Tous les statuts <CaretDown/></button><span>18 classes</span></div><DataTable label="Classes de l’établissement" headers={["Classe","Niveau","Élèves","Enseignant","Activation","Usage",""]} rows={[["4A","4e AEP","34","Mme Bakkali","94 %","76 %"],["4B","4e AEP","36","Non affecté","89 %","38 %"],["5A","5e AEP","37","Mme Benjelloun","97 %","82 %"],["5B","5e AEP","35","Mme Benjelloun","93 %","74 %"],["6A","6e AEP","38","M. Idrissi","96 %","79 %"]].map(r=>[...r,<RouteLink to={`/directeur/classes/${r[0].toLowerCase()}`} className="icon-button" aria-label={`Ouvrir la classe ${r[0]}`}><CaretRight/></RouteLink>])}/></>}
function DirectorTeachers({search}){
  const {notify}=useDemoStore();
  const [inviteOpen,setInviteOpen]=useState(false);
  const [invite,setInvite]=useState({name:"",email:"",discipline:"Français"});
  const [notice,setNotice]=useState("");
  const rows=[["Salma Benjelloun","Français","2 classes","Très active"],["Omar El Idrissi","Français","3 classes","Active"],["Nadia Bakkali","Français","2 classes","Active"],["Mehdi Amrani","Français","1 classe","À accompagner"]].filter(r=>r[0].toLowerCase().includes(search.toLowerCase()));
  const submitInvite=event=>{event.preventDefault();setNotice(`Invitation préparée pour ${invite.name}.`);notify({role:"directeur",title:"Invitation enseignant préparée",message:`${invite.name} · ${invite.email}`,action:"/directeur/enseignants"});setInviteOpen(false);setInvite({name:"",email:"",discipline:"Français"})};
  return <><PageHeader eyebrow="ÉQUIPE PÉDAGOGIQUE" title="Enseignants" subtitle="Invitez, affectez et accompagnez les 42 enseignants de votre établissement." action={<button className="button button-dark" onClick={()=>setInviteOpen(value=>!value)} aria-expanded={inviteOpen}><Plus/> Inviter un enseignant</button>}/>{notice&&<div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Invitation prête</strong><small>{notice}</small></span></div>}{inviteOpen&&<form className="panel pen-editor-form" onSubmit={submitInvite}><h2>Nouvelle invitation</h2><div className="form-two"><label>Nom complet<input value={invite.name} onChange={event=>setInvite({...invite,name:event.target.value})} required/></label><label>Adresse e-mail<input type="email" value={invite.email} onChange={event=>setInvite({...invite,email:event.target.value})} required/></label></div><label>Discipline<select value={invite.discipline} onChange={event=>setInvite({...invite,discipline:event.target.value})}><option>Français</option><option>Coordination pédagogique</option></select></label><button className="button button-dark" type="submit"><PaperPlaneTilt/> Préparer l’invitation</button></form>}<KpiGrid items={[["Enseignants","42","40 actifs"],["Classes affectées","17 / 18","1 à traiter","gold"],["Connexion récente","95 %","30 derniers jours"],["Ressources partagées","126","+ 18 ce mois"]]}/><DataTable label="Liste des enseignants" headers={["Enseignant","Discipline","Affectation","Activité",""]} rows={rows.map(r=>[...r,<RouteLink to={`/directeur/enseignants/${slugifyRoute(r[0])}`} className="icon-button" aria-label={`Ouvrir le profil de ${r[0]}`}><CaretRight/></RouteLink>])}/></>;
}
function DirectorActivations(){return <><PageHeader eyebrow="LICENCES & CODES" title="Activation des élèves" subtitle="Suivez l’activation des manuels par classe et préparez les relances." action={<button className="button button-light" disabled title="Export disponible après raccordement des données"><DownloadSimple/> Exporter</button>}/><div className="activation-banner"><div><span>248</span><p>élèves activés sur 284</p></div><ProgressBar value={87} label="Taux global d’activation"/><button className="button button-gold" disabled title="Envoi disponible après raccordement de la messagerie"><Megaphone/> Relancer 36 familles</button></div><DataTable label="Activations par classe" headers={["Classe","Élèves","Activés","Restants","Progression","Action"]} rows={[["4A","26","24","2","92 %"],["4B","24","21","3","88 %"],["5A","29","28","1","97 %"],["5B","28","26","2","93 %"],["6A","30","29","1","96 %"]].map(r=>[...r,<button className="button button-light" disabled title="Envoi disponible après raccordement de la messagerie">Relancer</button>])}/></>}
function DirectorUsage(){return <><PageHeader eyebrow="ADOPTION PÉDAGOGIQUE" title="Utilisation de la plateforme" subtitle="Analysez la fréquence d’usage par niveau, classe et type de ressource."/><KpiGrid items={[["Utilisateurs actifs","74 %","+ 6 points"],["Sessions / semaine","3,8","Par élève"],["Temps moyen","32 min","Par semaine"],["Contenus consultés","1 842","Ce mois-ci"]]}/><div className="dashboard-two-columns"><article className="panel"><h2>Usage par niveau</h2><BarChart values={[58,66,74,82,79,71]} labels={["1A","2A","3A","4A","5A","6A"]}/></article><article className="panel"><h2>Répartition des ressources</h2><Donut value={68}/><div className="legend-list"><span><i className="green"/>Exercices · 46 %</span><span><i className="gold"/>Audios · 28 %</span><span><i className="coral"/>Vidéos · 18 %</span></div></article></div></>}
function DirectorReports(){return <><PageHeader eyebrow="RAPPORTS" title="Rapports de pilotage" subtitle="Des synthèses prêtes à consulter avec l’équipe pédagogique." action={<button className="button button-dark" disabled title="Création disponible après raccordement du moteur de rapports"><Plus/> Nouveau rapport</button>}/><div className="report-grid">{[["Rapport mensuel d’adoption","Août 2026","Prêt"],["Suivi des activations","Rentrée 2026","Prêt"],["Progression par niveau","Trimestre 1","En préparation"],["Usage des ressources","Juillet–août","Prêt"]].map(([title,date,status])=><article key={title}><span><FileText weight="duotone"/></span><h3>{title}</h3><p>{date}</p><i className={status==="Prêt"?"status-pill success":"status-pill warning"}>{status}</i><div>{status==="Prêt"?<RouteLink to={`/directeur/rapports/${slugifyRoute(title)}`} className="button button-light"><Eye/> Consulter</RouteLink>:<button className="button button-light" disabled title="Rapport en préparation"><Clock/> En préparation</button>}<button className="icon-button" disabled title="Téléchargement disponible après génération" aria-label={`Télécharger ${title}`}><DownloadSimple/></button></div></article>)}</div></>}

function AdminPages({page,search}){if(["pilotage","analyses","imports","referentiels","medias","bibliotheque","contenus","studio"].includes(page))return <BetaAdminPage page={page} search={search} ui={{PageHeader,RouteLink}}/>;if(page==="questions")return <Suspense fallback={<div className="panel" role="status">Ouverture de la banque de questions…</div>}><QuestionBankAdmin/></Suspense>;if(page==="blog")return <AdminBlogV2 search={search}/>;if(page==="etablissements")return <AdminEstablishments search={search}/>;if(page==="utilisateurs")return <AdminUsers search={search}/>;if(page==="licences")return <AdminLicenses/>;if(page==="support")return <AdminSupport/>;if(page==="securite")return <AdminSecurity/>;return <NotFound route={{role:"admin"}} sessionRole="admin"/>}

function AdminDashboard(){return <><div className="admin-hero"><div><span>JET D’ENCRE · OPÉRATIONS</span><h1>Pilotage de la plateforme</h1><p>Année scolaire 2026–2027 · Tous les environnements</p></div><span><ShieldCheck weight="fill"/> Simulation locale · aucune sécurité serveur</span></div><KpiGrid items={[["Établissements actifs","63","+ 5 ce mois"],["Licences émises","14 820","2026–2027"],["Licences activées","80,7 %","11 964 licences"],["Tickets ouverts","27","8 prioritaires","gold"]]}/><div className="wide-notice danger"><WarningCircle weight="fill"/><div><strong>8 activations inhabituelles à vérifier</strong><span>Plusieurs tentatives sur des codes appartenant au même lot.</span></div><RouteLink to="/admin/securite" className="button button-light">Examiner les anomalies</RouteLink></div><div className="dashboard-two-columns"><article className="panel"><h2>Activations par semaine</h2><BarChart values={[49,62,78,86,74]} labels={["S1","S2","S3","S4","S5"]}/></article><article className="panel quick-actions"><h2>Actions rapides</h2><RouteLink to="/admin/etablissements"><Buildings/><span><strong>Voir les établissements</strong><small>Consulter le réseau</small></span><CaretRight/></RouteLink><RouteLink to="/admin/licences"><Key/><span><strong>Suivre les lots de codes</strong><small>Manuel, année, quantité</small></span><CaretRight/></RouteLink><RouteLink to="/admin/bibliotheque"><Books/><span><strong>Gérer les contenus</strong><small>Publier ou archiver</small></span><CaretRight/></RouteLink></article></div></>}

function AdminLibrary({search}){
  const {contents,updateContent,duplicateContent,archiveContent}=useDemoStore();
  const [status,setStatus]=useState("Tous");const [type,setType]=useState("Tous les formats");const [notice,setNotice]=useState("");
  const filtered=contents.filter(item=>(status==="Tous"?item.status!=="Archivé":item.status===status)&&(type==="Tous les formats"||item.type===type)&&item.title.toLowerCase().includes(search.toLowerCase()));
  const colorFor=(format)=>format==="Podcast"?"teal":format==="Documentaire"?"navy":format==="Jeu éducatif"?"coral":format==="Article"?"purple":"gold";
  return <><PageHeader eyebrow="GESTION ÉDITORIALE" title="Bibliothèque de contenus" subtitle="Recherchez, filtrez, modifiez, dupliquez et archivez tous les contenus de la plateforme." serif action={<RouteLink to="/admin/studio" className="button button-dark"><Plus/> Ajouter un contenu</RouteLink>}/>{notice&&<div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Bibliothèque mise à jour</strong><small>{notice}</small></span></div>}<div className="library-toolbar"><div className="tabs-inline" aria-label="Filtrer par statut">{["Tous","Publié","Brouillon","Planifié","À réviser","Archivé"].map(item=><button key={item} onClick={()=>setStatus(item)} className={status===item?"active":""} aria-pressed={status===item}>{item}</button>)}</div><label className="select-filter"><span className="sr-only">Filtrer par format</span><select value={type} onChange={event=>setType(event.target.value)}><option>Tous les formats</option>{[...new Set(contents.map(item=>item.type))].map(item=><option key={item}>{item}</option>)}</select></label></div><div className="content-table" role="table" aria-label="Bibliothèque de contenus"><div className="content-table-head" role="row"><span role="columnheader">Contenu</span><span role="columnheader">Format</span><span role="columnheader">Niveau</span><span role="columnheader">Statut</span><span role="columnheader">Mise à jour</span><span role="columnheader">Actions</span></div>{filtered.map(item=><article key={item.id} role="row"><span className={`content-thumb ${colorFor(item.type)}`} aria-hidden="true"><FileText weight="duotone"/></span><span className="content-title" role="cell"><strong>{item.title}</strong><small>Jet d’Encre Éditions</small></span><span role="cell">{item.type}</span><span role="cell">{item.level||"Tous"}</span><span role="cell"><i className={`status-pill ${item.status==="Publié"?"success":item.status==="Brouillon"?"neutral":"warning"}`}>{item.status}</i></span><span role="cell">{new Date(item.updatedAt).toLocaleDateString("fr-FR")}</span><span className="row-actions" role="cell"><RouteLink to={`/admin/bibliotheque/${item.id}`} title="Aperçu" aria-label={`Aperçu de ${item.title}`}><Eye/></RouteLink><button title="Envoyer en révision" aria-label={`Envoyer ${item.title} en révision`} onClick={()=>{updateContent(item.id,{status:"À réviser"});setNotice(`« ${item.title} » est maintenant à réviser.`)}}><PencilSimple/></button><button title="Dupliquer" aria-label={`Dupliquer ${item.title}`} onClick={()=>{duplicateContent(item.id);setNotice(`Une copie brouillon de « ${item.title} » a été créée.`)}}><Copy/></button><button title="Archiver" aria-label={`Archiver ${item.title}`} onClick={()=>{archiveContent(item.id);setNotice(`« ${item.title} » a été archivé.`)}}><Archive/></button></span></article>)}</div>{filtered.length===0&&<div className="empty-state"><MagnifyingGlass/><h3>Aucun contenu trouvé</h3><p>Essayez un autre filtre ou une autre recherche.</p></div>}</>
}

function AdminBlogV2({search}){
  const {articles,createArticle,updateArticle,duplicateArticle,archiveArticle}=useDemoStore();
  const [status,setStatus]=useState("Tous");const [mode,setMode]=useState("list");const [editingId,setEditingId]=useState(null);const [notice,setNotice]=useState("");
  const [form,setForm]=useState({title:"",excerpt:"",body:"",category:"Parents",theme:"Oral",author:"Nadia El Mansouri",status:"Brouillon",scheduleDate:"2026-09-15"});
  const filtered=articles.filter(item=>(status==="Tous"?item.status!=="Archivé":item.status===status)&&item.title.toLowerCase().includes(search.toLowerCase()));
  const openEditor=(article=null)=>{setEditingId(article?.id||null);setForm(article?{title:article.title,excerpt:article.excerpt||"",body:article.body||"",category:article.category||"Parents",theme:article.theme||"Oral",author:article.author||"Nadia El Mansouri",status:article.status||"Brouillon",scheduleDate:article.scheduledAt?.slice(0,10)||"2026-09-15"}:{title:"",excerpt:"",body:"",category:"Parents",theme:"Oral",author:"Nadia El Mansouri",status:"Brouillon",scheduleDate:"2026-09-15"});setMode("editor");setNotice("")};
  const save=(publish=false)=>{const nextStatus=publish?"Publié":form.status;const payload={...form,status:nextStatus,publishedAt:nextStatus==="Publié"?new Date().toISOString():null,scheduledAt:nextStatus==="Planifié"?`${form.scheduleDate}T08:00:00.000Z`:null};const result=editingId?updateArticle(editingId,payload):createArticle(payload);if(result.ok){setEditingId(result.item.id);setForm(current=>({...current,status:payload.status}));setNotice(nextStatus==="Publié"?"Article enregistré dans l’aperçu local. Le site public n’a pas été modifié.":nextStatus==="Planifié"?`Article planifié pour le ${new Date(`${form.scheduleDate}T12:00:00`).toLocaleDateString("fr-FR")}.`:"Brouillon enregistré sur cet appareil.")}};
  if(mode==="editor")return <ArticleEditorView form={form} setForm={setForm} editingId={editingId} notice={notice} onBack={()=>setMode("list")} onSave={save} ui={{PageHeader,DemoBadge}}/>;
  return <><PageHeader eyebrow="PUBLICATION ÉDITORIALE" title="Blog & articles" subtitle="Planifiez, relisez et publiez les contenus destinés aux familles et aux équipes pédagogiques." serif action={<button className="button button-dark" onClick={()=>openEditor()}><Plus/> Nouvel article</button>}/>{notice&&<div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Liste mise à jour</strong><small>{notice}</small></span></div>}<KpiGrid items={[["Articles publiés",String(articles.filter(item=>item.status==="Publié").length),"Aperçu local uniquement"],["Brouillons",String(articles.filter(item=>item.status==="Brouillon").length),"À compléter","gold"],["À réviser",String(articles.filter(item=>item.status==="À réviser").length),"File éditoriale"],["Total",String(articles.filter(item=>item.status!=="Archivé").length),"Hors archives"]]}/><div className="library-toolbar blog-admin-toolbar"><div className="tabs-inline" aria-label="Filtrer les articles">{["Tous","Publié","Brouillon","Planifié","À réviser","Archivé"].map(item=><button key={item} className={status===item?"active":""} aria-pressed={status===item} onClick={()=>setStatus(item)}>{item}</button>)}</div><RouteLink to="/blog?mode=demo" className="button button-light"><Eye/> Voir l’aperçu local</RouteLink></div><div className="admin-article-list store-articles">{filtered.map(article=><article key={article.id}><span className="article-placeholder"><FileText weight="duotone"/></span><div className="admin-article-title"><span>{article.category} · {article.theme}</span><strong>{article.title}</strong><small>{article.author} · {new Date(article.updatedAt).toLocaleDateString("fr-FR")}</small></div><span className={`status-pill ${article.status==="Publié"?"success":article.status==="Brouillon"?"neutral":"warning"}`}>{article.status}</span><span className="article-performance"><strong>{article.status==="Publié"?"Publié":"Non publié"}</strong><small>{article.status==="Planifié"&&article.scheduledAt?new Date(article.scheduledAt).toLocaleDateString("fr-FR"):"Prototype local"}</small></span><span className="row-actions">{article.status==="Publié"?<RouteLink to={articlePath(article.slug,true)} title="Aperçu public" aria-label={`Aperçu de ${article.title}`}><Eye/></RouteLink>:<button disabled title="Publiez l’article pour ouvrir son aperçu public" aria-label="Aperçu non disponible"><Eye/></button>}<button title="Modifier" aria-label={`Modifier ${article.title}`} onClick={()=>openEditor(article)}><PencilSimple/></button><button title="Dupliquer" aria-label={`Dupliquer ${article.title}`} onClick={()=>{duplicateArticle(article.id);setNotice("Une copie brouillon a été créée.")}}><Copy/></button><button title="Archiver" aria-label={`Archiver ${article.title}`} onClick={()=>{archiveArticle(article.id);setNotice(`« ${article.title} » a été archivé.`)}}><Archive/></button></span></article>)}</div>{filtered.length===0&&<div className="empty-state"><FileText/><h3>Aucun article dans cet état</h3><p>Choisissez un autre statut ou créez un nouvel article.</p></div>}</>
}

function AdminBlog({search}){
  const [mode,setMode]=useState("list"); const [status,setStatus]=useState("Tous"); const [editorTab,setEditorTab]=useState("contenu"); const [saved,setSaved]=useState(""); const [title,setTitle]=useState("7 jeux simples pour faire parler français à la maison");
  const statuses=["Publié","Publié","Planifié","Publié","À réviser","Brouillon"];
  const rows=blogArticles.map((article,index)=>({...article,status:statuses[index]})).filter(article=>(status==="Tous"||article.status===status)&&article.title.toLowerCase().includes(search.toLowerCase()));
  if(mode==="editor")return <div className="admin-blog-editor"><PageHeader eyebrow="BLOG & ARTICLES" title="Éditeur d’article" subtitle="Rédigez, ciblez et préparez la publication sans quitter la plateforme." serif action={<button className="button button-light" onClick={()=>{setMode("list");setSaved("")}}><ArrowLeft/> Retour aux articles</button>}/>{saved&&<div className="editor-success"><CheckCircle weight="fill"/><span><strong>{saved}</strong><small>Les modifications sont enregistrées dans cette démonstration.</small></span></div>}<div className="editor-tabs" role="tablist">{[["contenu","Contenu"],["ciblage","Ciblage"],["seo","SEO & publication"]].map(([key,label])=><button role="tab" aria-selected={editorTab===key} className={editorTab===key?"active":""} onClick={()=>setEditorTab(key)} key={key}>{label}</button>)}</div><div className="blog-editor-layout"><section className="panel blog-editor-form">{editorTab==="contenu"&&<><h2>Rédaction</h2><label>Titre de l’article<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Chapô<textarea defaultValue="Des activités courtes, sans écran et sans pression, pour transformer les moments du quotidien en occasions de parler."/></label><label>Corps de l’article<textarea className="rich-textarea" defaultValue={"Créer un espace où l’enfant ose parler\n\nÀ la maison, l’objectif n’est pas de corriger chaque erreur. L’enfant a surtout besoin de sentir que sa parole est accueillie.\n\nTrois jeux à commencer aujourd’hui\n\nLe sac mystère, le reporter du jour et le jeu des interdits donnent un but concret à la prise de parole."}/></label><label className="cover-choice">Image de couverture<span><img src={blogArticles[0].image} alt="Aperçu de la couverture"/><button className="button button-light"><CloudArrowUp/> Remplacer l’image</button></span></label></>}{editorTab==="ciblage"&&<><h2>Public et classement</h2><div className="form-two"><label>Catégorie<select defaultValue="Parents"><option>Parents</option><option>Enseignants</option><option>Enfants</option></select></label><label>Thème<select defaultValue="Oral"><option>Oral</option><option>Plurilinguisme</option><option>Culture marocaine</option><option>Approche actionnelle</option></select></label></div><div className="form-two"><label>Audience<select defaultValue="Familles"><option>Familles</option><option>Professionnels</option><option>Jeunes lecteurs</option></select></label><label>Niveau<select defaultValue="Tous les niveaux"><option>Tous les niveaux</option><option>1re–3e AEP</option><option>4e–6e AEP</option></select></label></div><label>Auteur<input defaultValue="Nadia El Mansouri"/></label><label>Mots-clés<input defaultValue="expression orale, jeux, famille, confiance"/></label></>}{editorTab==="seo"&&<><h2>Référencement et publication</h2><label>Adresse de l’article<input defaultValue="7-jeux-parler-francais-maison"/></label><label>Titre SEO<input defaultValue="7 jeux pour parler français à la maison | Jet d’Encre"/></label><label>Description SEO<textarea defaultValue="Sept jeux simples et motivants pour aider votre enfant à parler français au quotidien, dans un contexte familial marocain."/></label><div className="form-two"><label>Statut<select defaultValue="Publié"><option>Brouillon</option><option>À réviser</option><option>Planifié</option><option>Publié</option></select></label><label>Date de publication<input type="date" defaultValue="2026-08-24"/></label></div><div className="seo-preview"><span>jetdencre.ma › blog › 7-jeux-parler-francais-maison</span><strong>{title}</strong><p>Sept jeux simples et motivants pour aider votre enfant à parler français au quotidien.</p></div></>}</section><aside className="panel article-preview-panel"><div className="panel-heading"><h2>Aperçu</h2><span>Ordinateur</span></div><article className="mini-article-preview"><img src={blogArticles[0].image} alt="Aperçu de l’article"/><span>Parents · Oral</span><h3>{title}</h3><p>Des activités courtes et sans pression pour faire parler français à la maison.</p><small>Nadia El Mansouri · 6 min</small></article><RouteLink to="/blog/7-jeux-parler-francais-maison" className="button button-light button-wide"><Eye/> Ouvrir l’aperçu public</RouteLink></aside></div><div className="blog-editor-actions"><button className="button button-light" onClick={()=>setSaved("Brouillon enregistré")}><PencilSimple/> Enregistrer le brouillon</button><button className="button button-dark" onClick={()=>setSaved("Article publié")}><PaperPlaneTilt/> Publier l’article</button></div></div>;
  return <><PageHeader eyebrow="PUBLICATION ÉDITORIALE" title="Blog & articles" subtitle="Planifiez, relisez et publiez les contenus destinés aux familles et aux équipes pédagogiques." serif action={<button className="button button-dark" onClick={()=>setMode("editor")}><Plus/> Nouvel article</button>}/><KpiGrid items={[["Articles publiés","24","+ 3 ce mois"],["Brouillons","5","2 à compléter","gold"],["Lectures ce mois","18 420","+ 14 %"],["Temps moyen","4 min 38","Bonne lecture"]]}/><div className="library-toolbar blog-admin-toolbar"><div className="tabs-inline">{["Tous","Publié","Brouillon","Planifié","À réviser"].map(item=><button key={item} className={status===item?"active":""} onClick={()=>setStatus(item)}>{item}</button>)}</div><RouteLink to="/blog" className="button button-light"><Eye/> Voir le Blog public</RouteLink></div><div className="admin-article-list">{rows.map(article=><article key={article.slug}><img src={article.image} alt=""/><div className="admin-article-title"><span>{article.category} · {article.theme}</span><strong>{article.title}</strong><small>{article.author} · {article.date}</small></div><span className={`status-pill ${article.status==="Publié"?"success":article.status==="Brouillon"?"neutral":"warning"}`}>{article.status}</span><span className="article-performance"><strong>{article.status==="Publié"?`${Math.floor(1200+article.title.length*37).toLocaleString("fr-FR")} lectures`:"—"}</strong><small>{article.status==="Publié"?"30 derniers jours":"Non publié"}</small></span><span className="row-actions"><RouteLink to={`/blog/${article.slug}`} title="Aperçu"><Eye/></RouteLink><button title="Modifier" onClick={()=>{setTitle(article.title);setMode("editor")}}><PencilSimple/></button><button title="Dupliquer"><Copy/></button><button title="Archiver"><Archive/></button></span></article>)}</div>{rows.length===0&&<div className="empty-state"><FileText/><h3>Aucun article dans cet état</h3><p>Choisissez un autre statut ou créez un nouvel article.</p></div>}</>
}

function AdminStudioV2(){
  const {createContent,notify}=useDemoStore();
  const [file,setFile]=useState(null);const [progress,setProgress]=useState(1);const [title,setTitle]=useState("Les secrets de la médina");const [summary,setSummary]=useState("Une visite guidée en français pour découvrir les métiers, l’architecture et les histoires de la médina.");const [format,setFormat]=useState("Documentaire");const [duration,setDuration]=useState("12 minutes");const [level,setLevel]=useState("5e AEP");const [unit,setUnit]=useState("Unité 3");const [competencies,setCompetencies]=useState("Compréhension orale, vocabulaire, culture");const [visibility,setVisibility]=useState("Élèves et enseignants");const inputRef=useRef();
  const selectFile=(next)=>setFile(next||null);
  const publish=()=>{const result=createContent({title,summary,type:format,duration,level,unit,competencies:competencies.split(",").map(item=>item.trim()).filter(Boolean),visibility,status:"À réviser",fileName:file?.name||null});if(result.ok){notify({role:"admin",title:"Contenu envoyé en validation",message:title});navigateRoute("/admin/bibliotheque");}};
  return <><PageHeader eyebrow="STUDIO DE CONTENU" title="Ajouter un nouveau contenu" subtitle="Déposez un fichier, décrivez-le et envoyez sa fiche en validation éditoriale." serif action={<RouteLink to="/admin/bibliotheque" className="button button-light"><ArrowLeft/> Retour à la bibliothèque</RouteLink>}/><div className="prototype-inline-note"><DemoBadge/><span>Le prototype mémorise la fiche et le nom du fichier ; aucun média n’est envoyé à un serveur.</span></div><div className="studio-steps" aria-label="Étapes">{["Importer","Décrire","Classer","Valider"].map((item,index)=><span className={progress===index+1?"active":progress>index+1?"done":""} key={item}><i>{progress>index+1?<Check/>:index+1}</i>{item}</span>)}</div><div className="studio-layout"><section className="panel studio-main">{progress===1&&<><h2>Déposez votre contenu</h2><p>PDF, EPUB, MP3, MP4, image ou archive de jeu · aperçu local uniquement</p><button type="button" className={file?"dropzone has-file":"dropzone"} onClick={()=>inputRef.current?.click()} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();selectFile(event.dataTransfer.files[0])}}><input ref={inputRef} type="file" hidden onChange={event=>selectFile(event.target.files[0])}/>{file?<><CheckCircle weight="duotone"/><strong>{file.name}</strong><span>{Math.max(1,Math.round((file.size||0)/1024/1024))} Mo · métadonnées prêtes</span></>:<><CloudArrowUp weight="duotone"/><strong>Glissez-déposez votre fichier ici</strong><span>ou cliquez pour parcourir votre ordinateur</span></>}</button></>}{progress===2&&<><h2>Décrivez le contenu</h2><label>Titre<input value={title} onChange={event=>setTitle(event.target.value)} required/></label><label>Résumé<textarea value={summary} onChange={event=>setSummary(event.target.value)}/></label><div className="form-two"><label>Format<select value={format} onChange={event=>setFormat(event.target.value)}><option>Documentaire</option><option>Podcast</option><option>E-book</option><option>Jeu éducatif</option><option>Article</option></select></label><label>Durée<input value={duration} onChange={event=>setDuration(event.target.value)}/></label></div></>}{progress===3&&<><h2>Classez le contenu</h2><div className="form-two"><label>Niveau<select value={level} onChange={event=>setLevel(event.target.value)}><option>4e AEP</option><option>5e AEP</option><option>6e AEP</option></select></label><label>Unité<select value={unit} onChange={event=>setUnit(event.target.value)}><option>Unité 3</option><option>Unité 4</option><option>Hors unité</option></select></label></div><label>Compétences<input value={competencies} onChange={event=>setCompetencies(event.target.value)}/></label><label>Visibilité<select value={visibility} onChange={event=>setVisibility(event.target.value)}><option>Élèves et enseignants</option><option>Enseignants uniquement</option><option>Public</option></select></label></>}{progress===4&&<div className="publish-summary"><span><CheckCircle weight="duotone"/></span><h2>Prêt pour la validation</h2><p><strong>{title}</strong> apparaîtra dans la bibliothèque avec le statut « À réviser ».</p><div><span>{format}</span><span>{level} · {unit}</span><span>{duration}</span></div></div>}</section><aside className="panel studio-help"><h3>Contrôle éditorial</h3><ul><li><CheckCircle weight="fill"/> Titre court et compréhensible.</li><li><CheckCircle weight="fill"/> Droits du média vérifiés.</li><li><CheckCircle weight="fill"/> Transcription prévue pour l’audio.</li><li><CheckCircle weight="fill"/> Niveau et compétences renseignés.</li></ul><div className="quality-score"><span>Complétude</span><strong>{progress<3?"À compléter":title&&competencies?"92 %":"65 %"}</strong></div></aside></div><div className="wizard-actions studio-actions"><button className="button button-light" disabled={progress===1} onClick={()=>setProgress(current=>current-1)}><ArrowLeft/> Précédent</button>{progress<4?<button className="button button-dark" disabled={(progress===1&&!file)||(progress===2&&!title.trim())} onClick={()=>setProgress(current=>current+1)}>Continuer <ArrowRight/></button>:<button className="button button-dark" onClick={publish}><PaperPlaneTilt/> Envoyer en validation</button>}</div></>
}

function AdminStudio(){const [file,setFile]=useState(null);const [progress,setProgress]=useState(1);const inputRef=useRef();return <><PageHeader eyebrow="STUDIO DE CONTENU" title="Ajouter un nouveau contenu" subtitle="Importez votre fichier, complétez les informations et publiez-le sur la plateforme." serif action={<RouteLink to="/admin/bibliotheque" className="button button-light"><ArrowLeft/> Retour à la bibliothèque</RouteLink>}/><div className="studio-steps">{["Importer","Décrire","Classer","Publier"].map((x,i)=><span className={progress===i+1?"active":progress>i+1?"done":""} key={x}><i>{progress>i+1?<Check/>:i+1}</i>{x}</span>)}</div><div className="studio-layout"><section className="panel studio-main">{progress===1&&<><h2>Déposez votre contenu</h2><p>PDF, EPUB, MP3, MP4, image ou archive de jeu · fiche locale uniquement ; aucun fichier envoyé</p><button className={file?"dropzone has-file":"dropzone"} onClick={()=>inputRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();setFile(e.dataTransfer.files[0]||{name:"documentaire-medina.mp4",size:482000000})}}><input ref={inputRef} type="file" hidden onChange={e=>setFile(e.target.files[0])}/>{file?<><CheckCircle weight="duotone"/><strong>{file.name}</strong><span>{Math.max(1,Math.round(file.size/1024/1024))} Mo · Prêt à importer</span></>:<><CloudArrowUp weight="duotone"/><strong>Glissez-déposez votre fichier ici</strong><span>ou cliquez pour parcourir votre ordinateur</span></>}</button></>}{progress===2&&<><h2>Décrivez le contenu</h2><label>Titre<input defaultValue="Les secrets de la médina"/></label><label>Résumé<textarea defaultValue="Une visite guidée en français pour découvrir les métiers, l’architecture et les histoires de la médina."/></label><div className="form-two"><label>Format<select defaultValue="Documentaire"><option>Documentaire</option><option>Podcast</option><option>E-book</option><option>Jeu éducatif</option></select></label><label>Durée<input defaultValue="12 minutes"/></label></div></>}{progress===3&&<><h2>Classez le contenu</h2><div className="form-two"><label>Niveau<select defaultValue="5e AEP"><option>5e AEP</option><option>4e AEP</option><option>6e AEP</option></select></label><label>Unité<select defaultValue="Unité 3"><option>Unité 3</option><option>Unité 4</option></select></label></div><label>Compétences<input defaultValue="Compréhension orale, vocabulaire, culture"/></label><label>Visibilité<select defaultValue="Élèves et enseignants"><option>Élèves et enseignants</option><option>Enseignants uniquement</option><option>Public</option></select></label></>}{progress===4&&<div className="publish-summary"><span><CheckCircle weight="duotone"/></span><h2>Prêt pour la publication</h2><p>Le contenu sera visible pour les élèves et enseignants de 5e AEP après validation éditoriale.</p><div><span>Documentaire</span><span>5e AEP · Unité 3</span><span>12 minutes</span></div></div>}</section><aside className="panel studio-help"><h3>Conseils éditoriaux</h3><ul><li><CheckCircle weight="fill"/> Utilisez un titre court et clair.</li><li><CheckCircle weight="fill"/> Vérifiez les droits des médias.</li><li><CheckCircle weight="fill"/> Ajoutez une transcription aux contenus audio.</li><li><CheckCircle weight="fill"/> Renseignez le niveau et les compétences.</li></ul><div className="quality-score"><span>Qualité estimée</span><strong>{progress<3?"À compléter":"92 %"}</strong></div></aside></div><div className="wizard-actions studio-actions"><button className="button button-light" disabled={progress===1} onClick={()=>setProgress(progress-1)}><ArrowLeft/> Précédent</button>{progress<4?<button className="button button-dark" disabled={progress===1&&!file} onClick={()=>setProgress(progress+1)}>Continuer <ArrowRight/></button>:<button className="button button-dark" onClick={()=>navigateRoute("/admin/bibliotheque")}><PaperPlaneTilt/> Envoyer en validation</button>}</div></>}

function AdminEstablishments({search}){const rows=[["Groupe scolaire Al Manar","Casablanca","284","18","Actif"],["École Al Amal","Rabat","196","12","Actif"],["Institut Ibn Battouta","Tanger","248","15","Actif"],["École Les Orangers","Marrakech","174","11","À renouveler"]].filter(r=>r[0].toLowerCase().includes(search.toLowerCase()));return <><PageHeader eyebrow="RÉSEAU · DÉMONSTRATION" title="Établissements" subtitle="Exemple de réseau scolaire. Pour gérer les accès du pilote, ouvrez Écoles et accès." action={<a className="button button-dark" href="/admin/ecoles-acces"><Buildings/> Écoles et accès</a>}/><KpiGrid items={[["Établissements","63","+ 5 ce mois"],["Élèves rattachés","11 964","80,7 % activés"],["Enseignants","742","94 % actifs"],["Renouvellements","8","À traiter","gold"]]}/><DataTable label="Liste des établissements" headers={["Établissement","Ville","Élèves","Enseignants","Statut",""]} rows={rows.map(r=>[...r,<RouteLink to={`/admin/etablissements/${slugifyRoute(r[0])}`} className="icon-button" aria-label={`Ouvrir ${r[0]}`}><CaretRight/></RouteLink>])}/></>}
function AdminUsers({search}){const rows=[["Salma Benjelloun","Enseignante","Al Manar","Active"],["Amine Alaoui","Directeur","Al Manar","Actif"],["Lina Mansouri","Élève","Al Manar","Active"],["Nour Berrada","Élève","Al Manar","À vérifier"]].filter(r=>r[0].toLowerCase().includes(search.toLowerCase()));return <><PageHeader eyebrow="COMPTES" title="Utilisateurs" subtitle="Recherchez et administrez les comptes de tous les espaces." action={<button className="button button-light" disabled title="Export disponible après raccordement des données"><DownloadSimple/> Exporter</button>}/><div className="filter-bar"><button><Funnel/> Tous les rôles <CaretDown/></button><button>Tous les statuts <CaretDown/></button><span>12 786 utilisateurs</span></div><DataTable label="Liste des utilisateurs" headers={["Utilisateur","Rôle","Établissement","Statut",""]} rows={rows.map(r=>[...r,<RouteLink to={`/admin/utilisateurs/${slugifyRoute(r[0])}`} className="icon-button" aria-label={`Ouvrir le compte de ${r[0]}`}><CaretRight/></RouteLink>])}/></>}
function AdminLicenses(){return <><PageHeader eyebrow="LICENCES & CODES" title="Piloter les activations" subtitle="Suivez la distribution des lots et détectez les anomalies." action={<button className="button button-dark" disabled title="Génération disponible après raccordement du service de licences"><Plus/> Générer un lot</button>}/><KpiGrid items={[["Codes générés","14 820","2026–2027"],["Codes activés","11 964","80,7 %"],["Disponibles","2 856","Tous niveaux"],["Expirent bientôt","420","Dans 30 jours","gold"]]}/><div className="list-panel">{[["JDE-26-FR5-0041","Français · 5e AEP · 2 000 codes","1 638 activés · 362 disponibles",82],["JDE-26-FR4-0028","Français · 4e AEP · 2 400 codes","2 070 activés · 330 disponibles",86],["JDE-26-FR6-0019","Français · 6e AEP · 1 800 codes","1 402 activés · 398 disponibles",78]].map(([title,meta,status,value])=><article className="license-row" key={title}><div><span className="status-pill success">Lot actif</span><h3>{title}</h3><p>{meta}</p></div><div><ProgressBar value={value} label={status}/></div><RouteLink to={`/admin/licences/${title}`} className="icon-button" aria-label={`Ouvrir le lot ${title}`}><CaretRight/></RouteLink></article>)}</div></>}
function AdminSupport(){const tickets=[["#2841","École Al Amal","Activation d’un lot","Haute","En cours"],["#2838","Mme Benjelloun","Projection vidéo","Normale","Nouveau"],["#2835","Institut Ibn Battouta","Import des élèves","Haute","En attente"]];return <><PageHeader eyebrow="ASSISTANCE" title="Centre de support" subtitle="27 demandes ouvertes · 8 prioritaires" action={<button className="button button-dark" disabled title="Création disponible après raccordement du service support"><Plus/> Nouveau ticket</button>}/><KpiGrid items={[["Tickets ouverts","27","8 prioritaires","gold"],["Délai moyen","3 h 20","- 18 minutes"],["Résolus ce mois","146","94 % au premier contact"],["Satisfaction","96 %","+ 2 points"]]}/><DataTable label="Tickets de support" headers={["Ticket","Demandeur","Sujet","Priorité","Statut",""]} rows={tickets.map(row=>[...row,<RouteLink to={`/admin/support/${row[0].replace("#","")}`} className="icon-button" aria-label={`Ouvrir le ticket ${row[0]}`}><CaretRight/></RouteLink>])}/></>}
function AdminSecurity(){return <><PageHeader eyebrow="SÉCURITÉ" title="Journal et conformité" subtitle="Simulation visuelle des contrôles qui seront raccordés au système de production." action={<button className="button button-light" disabled title="Export disponible après raccordement du journal serveur"><DownloadSimple/> Exporter le journal</button>}/><div className="security-hero"><ShieldCheck weight="duotone"/><div><h2>Scénario de sécurité</h2><p>La double authentification et le journal affichés ici sont des données fictives de prototype.</p></div><span className="status-pill warning">Simulation locale</span></div><KpiGrid items={[["Connexions simulées","1 842","Données fictives"],["Actions simulées","36","Démonstration"],["Alertes ouvertes","2","À examiner","gold"],["Sauvegarde locale","Il y a 18 min","Réussie"]]}/><div className="list-panel audit-list">{[["24 août · 11:42","Contenu « Voyage au Maroc » publié","Équipe éditoriale"],["24 août · 10:18","Lot JDE-26-FR5-0041 exporté","Admin Jet d’Encre"],["24 août · 09:52","Rôle directeur attribué","Support niveau 2"]].map(x=><article key={x[0]}><Clock/><span><strong>{x[1]}</strong><small>{x[0]} · {x[2]}</small></span><span className="status-pill neutral">Donnée fictive</span></article>)}</div></>}

function NotFound({route=null,sessionRole=null}){const home=getNotFoundHome(route,sessionRole);const inSpace=home!=="/";return <div className="not-found"><Brand/><h1>Cette page est introuvable</h1><p>{inSpace?"Le lien demandé n’est pas disponible dans cet espace. Vos données n’ont pas été modifiées.":"Le lien demandé n’existe pas ou n’est plus disponible."}</p><RouteLink to={home} className="button button-dark"><ArrowLeft/> {inSpace?"Retour à mon espace":"Retour à l’accueil"}</RouteLink></div>}

function Redirecting(){return <div className="not-found redirecting" role="status"><Brand/><span className="loading-orbit"/><h1>Ouverture de votre espace…</h1><p>Vérification du profil de démonstration.</p></div>}

export function App(){
  const route=useRoute();
  const parsed=useMemo(()=>parseRoute(route),[route]);
  const {session,users,quizAttempts,quizAwards,classChallenges,classChallengeResults,notify,awardStudentXp,recordQuizAttempt,recordClassChallengeResult}=useDemoStore();
  const access=useMemo(()=>resolveAppAccess(parsed,session),[parsed,session]);
  const studentUserId=session.role==="eleve"&&session.userId?session.userId:DEMO_ACCOUNTS.eleve.userId;
  const studentUser=users.find(user=>user.id===studentUserId);
  const storedStudentXp=Number(studentUser?.xp);
  const studentXp=Number.isFinite(storedStudentXp)&&storedStudentXp>=0?storedStudentXp:DEFAULT_STUDENT_XP;
  useEffect(()=>{
    if(parsed.kind==='pilot-admin'){window.location.replace(parsed.path);return;}
    if(parsed.kind==="redirect"){navigateRoute(parsed.to,{replace:true});return;}
    if(["app","not-found"].includes(parsed.kind)&&!access.allowed){if(access.reason==="authentication_required")sessionStorage.setItem("jde.returnTo",parsed.path);navigateRoute(access.redirectTo,{replace:true});}
  },[access.allowed,access.reason,access.redirectTo,parsed.kind,parsed.path,parsed.to]);
  const awardXp=(amount,metadata={})=>awardStudentXp({
    userId:studentUserId,
    amount,
    eventId:metadata.eventId,
    attemptId:metadata.attemptId,
    questionId:metadata.questionId,
    source:metadata.source||"culture-generale",
  });
  const completeQuiz=(summary={})=>{
    const result=recordQuizAttempt({
      userId:studentUserId,
      quizId:"culture-generale",
      attemptId:summary.attemptId,
      correctCount:summary.correctCount,
      questionCount:summary.questionCount||10,
      xpEarned:summary.xpEarned,
      bestStreak:summary.bestStreak,
      scorePercent:summary.scorePercent,
    });
    if(result.ok&&result.recorded)notify({role:"eleve",userId:studentUserId,title:"Quiz Culture générale terminé",message:`${summary.xpEarned||0} XP gagnés · ${summary.correctCount||0}/10 bonnes réponses.`});
  };
  const completeWordChoice=(summary={})=>{
    const result=recordQuizAttempt({
      userId:studentUserId,
      quizId:"mot-juste",
      attemptId:summary.attemptId,
      category:summary.category,
      level:summary.level,
      correctCount:summary.correctCount,
      questionCount:summary.questionCount||10,
      xpEarned:summary.xpEarned,
      answerXpEarned:summary.xpEarned,
      completionXp:0,
      bestStreak:summary.bestStreak,
      scorePercent:summary.scorePercent,
    });
    if(result.ok&&result.recorded)notify({role:"eleve",userId:studentUserId,title:"Le Mot juste terminé",message:`${summary.correctCount||0}/${summary.questionCount||10} bonnes réponses · ${summary.xpEarned||0} XP gagnés.`,action:"/eleve/jeux/mot-juste"});
  };
  const completeMarketShop=(summary={})=>{
    const missionCount=Math.max(0,Number(summary.missionCount||4));
    const completedMissionCount=Math.max(0,Number(summary.completedMissionCount||0));
    const tierLabel=summary.tierLabel||"Parcours complet";
    const result=recordQuizAttempt({
      userId:studentUserId,
      quizId:"souk-des-mots",
      attemptId:summary.attemptId,
      experienceType:summary.experienceType||"market-tier",
      category:"Communication quotidienne",
      fragmentId:summary.tierId||"parcours",
      fragmentLabel:tierLabel,
      assistanceLevel:summary.withoutHelpCount===missionCount?"autonomous":"guided",
      masteryLabel:completedMissionCount===missionCount?"Palier réussi":"Palier en cours",
      level:summary.level||"5e AEP",
      correctCount:completedMissionCount,
      questionCount:missionCount,
      xpEarned:summary.xpEarned,
      answerXpEarned:summary.xpEarned,
      completionXp:0,
      bestStreak:summary.withoutHelpCount,
      scorePercent:missionCount?Math.round((completedMissionCount/missionCount)*100):0,
    });
    if(result.ok&&result.recorded)notify({role:"eleve",userId:studentUserId,title:`${tierLabel} terminé`,message:`${completedMissionCount}/${missionCount} missions · ${summary.xpEarned||0} XP gagnés au Souk des mots.`,action:"/eleve/jeux/souk-des-mots"});
    return result;
  };
  const completeMotsFleches=(summary={})=>{
    const result=recordQuizAttempt({
      userId:studentUserId,
      quizId:"mots-fleches",
      attemptId:summary.attemptId,
      experienceType:"arrowword-grid",
      category:"Lexique et orthographe",
      fragmentId:summary.puzzleId,
      fragmentLabel:summary.puzzleTitle,
      assistanceLevel:summary.assistanceLevel,
      masteryLabel:"Grille réussie",
      level:summary.level,
      correctCount:summary.correctCount,
      questionCount:summary.questionCount,
      xpEarned:summary.xpEarned,
      answerXpEarned:0,
      completionXp:summary.completionXp,
      bestStreak:summary.correctCount,
      scorePercent:summary.scorePercent||100,
    });
    if(result.ok&&result.recorded){
      const earned=Number(summary.xpEarned||0);
      notify({
        role:"eleve",
        userId:studentUserId,
        title:`Grille ${summary.level||"Mots fléchés"} terminée`,
        message:earned>0?`${earned} XP ajoutés à ton profil.`:"Les XP de cette grille avaient déjà été gagnés.",
        action:"/eleve/jeux/mots-fleches",
      });
    }
    return result;
  };
  const completeDailyChallenge=(summary={})=>{
    const result=recordQuizAttempt({
      userId:studentUserId,
      quizId:DAILY_CHALLENGE_ID,
      attemptId:summary.attemptId,
      dailyKey:summary.dailyKey,
      category:summary.category,
      correctCount:summary.correctCount,
      questionCount:summary.questionCount||5,
      answerXpEarned:summary.answerXpEarned,
      completionXp:summary.completionXp,
      xpEarned:summary.xpEarned,
      bestStreak:summary.bestStreak,
      scorePercent:summary.scorePercent,
    });
    if(result.ok&&result.recorded)notify({role:"eleve",userId:studentUserId,title:"Défi du jour relevé",message:`${summary.correctCount||0}/5 bonnes réponses · ${summary.xpEarned||0} XP gagnés aujourd’hui.`,action:"/eleve/jeux/defi-du-jour"});
  };
  const completeMissionZellige=(summary={})=>{
    const result=recordQuizAttempt({
      userId:studentUserId,
      quizId:MISSION_ZELLIGE_ID,
      attemptId:summary.attemptId,
      dailyKey:summary.dailyKey,
      category:summary.category,
      experienceType:summary.experienceType,
      fragmentId:summary.fragmentId,
      fragmentLabel:summary.fragmentLabel,
      assistanceLevel:summary.assistanceLevel,
      masteryLabel:summary.masteryLabel,
      level:summary.level||"5e AEP",
      correctCount:summary.correctCount,
      questionCount:summary.questionCount||2,
      answerXpEarned:0,
      completionXp:summary.completionXp,
      xpEarned:summary.xpEarned,
      bestStreak:summary.bestStreak,
      scorePercent:summary.scorePercent,
    });
    if(result.ok&&result.recorded)notify({role:"eleve",userId:studentUserId,title:"Mission Zellige accomplie",message:`${summary.xpEarned||0} XP gagnés · nouvelle situation demain.`,action:"/eleve/jeux/mission-zellige"});
    return result;
  };
  const completeClassChallenge=(summary={},challenge={},participant=CURRENT_CLASS_PARTICIPANT)=>{
    const result=recordClassChallengeResult({
      challengeId:challenge.id,
      participantId:participant.participantId,
      pseudonym:participant.pseudonym,
      correctCount:summary.correctCount,
      xpEarned:summary.xpEarned,
    });
    if(result.ok&&result.recorded){
      recordQuizAttempt({
        userId:studentUserId,
        quizId:`defi-classe:${challenge.id}`,
        attemptId:summary.attemptId,
        category:challenge.theme,
        correctCount:summary.correctCount,
        questionCount:summary.questionCount||challenge.questionIds?.length||5,
        xpEarned:summary.xpEarned,
        answerXpEarned:summary.xpEarned,
        completionXp:0,
        bestStreak:summary.bestStreak,
        scorePercent:summary.scorePercent,
      });
      notify({role:"eleve",userId:studentUserId,title:"Défi de classe terminé",message:`Résultat enregistré sous « ${participant.pseudonym} » · ${summary.correctCount||0}/5.`,action:"/eleve/jeux/defis-classe"});
    }
    return result;
  };
  if(parsed.kind==="landing")return <PublicLandingPage/>;
  if(parsed.kind==="public-info")return <PublicInfoPage path={parsed.path} ui={{RouteLink,PublicSubHeader,BlogFooter}}/>;
  if(parsed.kind==="blog-index")return <BlogPage/>;
  if(parsed.kind==="blog-article")return <BlogArticlePage slug={parsed.slug}/>;
  if(parsed.kind==="legal")return <LegalPages page={parsed.page}/>;
  if(parsed.kind==="public-content")return <PublicContentPage params={parsed.params} ui={{RouteLink,ResponsiveImage}}/>;
  if(parsed.kind==="connection")return <ConnectionPage/>;
  if(parsed.kind==="auth")return <PenAccessPage screen={parsed.screen} ui={{AuthLayout,RouteLink}}/>;
  if(parsed.kind==="activation"&&parsed.state)return <PenAccessPage screen={parsed.screen} ui={{AuthLayout,RouteLink}}/>;
  if(parsed.kind==="activation")return <ActivationPage/>;
  if(parsed.kind==="login")return parsed.role==="parent"?<ParentLoginPage/>:<LoginPage role={parsed.role}/>;
  if(parsed.kind==="redirect"||(["app","not-found"].includes(parsed.kind)&&!access.allowed))return <Redirecting/>;
  if(parsed.kind==="app"&&["student.onboarding-profile","student.onboarding-class"].includes(parsed.screen))return <PenRolePage screen={parsed.screen} params={parsed.params} studentXp={studentXp} ui={{RouteLink,PageHeader,ProgressBar,ResponsiveImage}}/>;
  if(parsed.kind==="app"&&parsed.role==="eleve"&&parsed.page==="jeux"&&parsed.detail==="mission-zellige"){
    const zelligeHistory=getMissionZelligeHistory(quizAttempts,studentUserId);
    const fragmentCount=new Set(zelligeHistory.map(attempt=>attempt.fragmentId||attempt.category).filter(Boolean)).size;
    return <Suspense fallback={<Redirecting/>}><MissionZellige currentXp={studentXp} attempts={quizAttempts} userId={studentUserId} studentName={studentUser?.name?.split(" ")[0]||"Lina"} fragmentCount={fragmentCount} onAwardXp={awardXp} onComplete={completeMissionZellige} onExit={()=>navigateRoute("/eleve/jeux")}/></Suspense>;
  }
  if(parsed.kind==="app"&&parsed.role==="eleve"&&parsed.page==="jeux"&&parsed.detail==="mot-juste")return <Suspense fallback={<Redirecting/>}><WordChoiceGame currentXp={studentXp} onAwardXp={awardXp} onComplete={completeWordChoice} onExit={()=>navigateRoute("/eleve/jeux")}/></Suspense>;
  if(parsed.kind==="app"&&parsed.role==="eleve"&&parsed.page==="jeux"&&parsed.detail==="mots-fleches")return <Suspense fallback={<Redirecting/>}><MotsFlechesGame currentXp={studentXp} studentId={studentUserId} studentName={studentUser?.name||"Lina Mansouri"} awardHistory={quizAwards} onAwardXp={awardXp} onComplete={completeMotsFleches} onExit={()=>navigateRoute("/eleve/jeux")}/></Suspense>;
  if(parsed.kind==="app"&&parsed.role==="eleve"&&parsed.page==="jeux"&&parsed.detail==="souk-des-mots")return <Suspense fallback={<Redirecting/>}><MarketShopGame currentXp={studentXp} studentId={studentUserId} awardHistory={quizAwards} attemptHistory={quizAttempts} onAwardXp={awardXp} onComplete={completeMarketShop} onExit={()=>navigateRoute("/eleve/jeux")}/></Suspense>;
  if(parsed.kind==="app"&&parsed.role==="eleve"&&parsed.page==="jeux"&&parsed.detail==="defis-classe")return <Suspense fallback={<Redirecting/>}><ClassChallengesStudent challenges={classChallenges} results={classChallengeResults} currentXp={studentXp} participant={CURRENT_CLASS_PARTICIPANT} onAwardXp={awardXp} onComplete={completeClassChallenge} onExit={()=>navigateRoute("/eleve/jeux")}/></Suspense>;
  if(parsed.kind==="app"&&parsed.role==="eleve"&&parsed.page==="jeux"&&parsed.detail==="defi-du-jour")return <Suspense fallback={<Redirecting/>}><DailyChallenge currentXp={studentXp} attempts={quizAttempts} userId={studentUserId} onAwardXp={awardXp} onComplete={completeDailyChallenge} onExit={()=>navigateRoute("/eleve/jeux")}/></Suspense>;
  if(parsed.kind==="app"&&parsed.role==="eleve"&&parsed.page==="jeux"&&parsed.detail==="culture-generale")return <Suspense fallback={<Redirecting/>}><CultureQuiz currentXp={studentXp} onAwardXp={awardXp} onComplete={completeQuiz} onExit={()=>navigateRoute("/eleve/jeux")}/></Suspense>;
  if(parsed.kind==="app"&&["eleve","enseignant"].includes(parsed.role)&&parsed.page==="jeux"&&parsed.detail==="debat")return <Suspense fallback={<Redirecting/>}><DebateGameFrame role={parsed.role} userId={parsed.role==="eleve"?studentUserId:session.userId} onAwardXp={parsed.role==="eleve"?awardXp:undefined} onComplete={summary=>notify({role:parsed.role,userId:session.userId,title:"Partie Projet DÉBAT terminée",message:`${summary.roundCount||summary.completedRounds||0} manche(s) réalisée(s).`,action:`/${parsed.role}/jeux/debat`})}/></Suspense>;
  if(parsed.kind==="app")return <AppShell role={parsed.role} page={parsed.page} detail={parsed.detail} screen={parsed.screen} params={parsed.params} studentXp={studentXp}/>;
  return <NotFound route={parsed} sessionRole={session.role}/>;
}
import {DebateGameFeatureView,TeacherGamesView} from './features/games/TeacherGamesView.jsx';
