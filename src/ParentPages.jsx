import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Bell, BookOpenText, CalendarBlank, CaretRight,
  ChatCircleDots, CheckCircle, ClipboardText, Clock, DownloadSimple,
  EnvelopeSimple, Eye, EyeSlash, FloppyDisk, GearSix, Headphones, House,
  LinkSimple, Medal, PaperPlaneTilt, ShieldCheck, Sparkle, TrendUp, Trophy,
  UserCircle, Users, WarningCircle, X,
} from "@phosphor-icons/react/ssr";
import { DEMO_ACCOUNTS, useDemoStore } from "./demoStore.jsx";
import "./parent-pages.css";

const PREFERENCES_KEY = "jde.parent.preferences.v2";
const DEFAULT_PREFERENCES = Object.freeze({ email: true, devoirs: true, progres: true, actualites: false, bilanHebdomadaire: true });

const CHILDREN = Object.freeze([
  Object.freeze({ id: "lina-mansouri", initials: "LM", name: "Lina Mansouri", school: "École Al Manar", className: "5A", level: "A2", progress: 76, activity: "Aujourd’hui · 17 h 42", teacher: "Mme Salma Idrissi" }),
  Object.freeze({ id: "adam-mansouri", initials: "AM", name: "Adam Mansouri", school: "École Al Manar", className: "3B", level: "A1", progress: 68, activity: "Hier · 18 h 05", teacher: "M. Youssef Amrani" }),
]);

const COMPETENCIES = Object.freeze([
  Object.freeze(["Compréhension orale", 82, "Très bonne progression"]),
  Object.freeze(["Vocabulaire", 74, "Objectif bientôt atteint"]),
  Object.freeze(["Expression écrite", 69, "À accompagner cette semaine"]),
  Object.freeze(["Expression orale", 62, "À pratiquer avec confiance"]),
]);

const WEEK_ACTIVITY = Object.freeze([
  Object.freeze(["L", 42]), Object.freeze(["M", 68]), Object.freeze(["M", 54]),
  Object.freeze(["J", 86]), Object.freeze(["V", 72]), Object.freeze(["S", 28]), Object.freeze(["D", 12]),
]);

const FALLBACK_HOMEWORK = Object.freeze([
  Object.freeze({ id: "parent-oral-ville", title: "Présente un lieu que tu aimes dans ta ville", subject: "Oral", dueAt: "2026-08-28T18:00:00.000Z", duration: "10 min", status: "À faire", instructions: "Enregistre une réponse de 45 à 90 secondes en décrivant un lieu de Casablanca." }),
  Object.freeze({ id: "parent-environnement", title: "Les mots de l’environnement", subject: "Quiz", dueAt: "2026-08-31T18:00:00.000Z", duration: "4 min", status: "À faire", instructions: "Révise le lexique de l’unité 3 puis réponds aux dix questions." }),
  Object.freeze({ id: "parent-unite-2", title: "Quiz de l’unité 2", subject: "Quiz", dueAt: "2026-08-21T18:00:00.000Z", duration: "9/10", status: "Terminé", instructions: "Le quiz est terminé. Lina a obtenu 9 bonnes réponses sur 10." }),
]);

const MESSAGE_SEED = Object.freeze([
  Object.freeze({ id: "message-1", initials: "SI", sender: "Mme Salma Idrissi", role: "Enseignante · 5A", subject: "Retour sur le devoir oral", child: "Lina", date: "Aujourd’hui · 09 h 24", status: "Non lu", category: "enseignants", body: "Lina participe davantage à l’oral cette semaine. Vous pouvez l’encourager à raconter un petit moment de sa journée en trois phrases." }),
  Object.freeze({ id: "message-2", initials: "AM", sender: "Administration", role: "École Al Manar", subject: "Réunion parents", child: "Famille", date: "Hier · 17 h 10", status: "Lu", category: "administration", body: "La prochaine rencontre parents–équipe pédagogique aura lieu jeudi à 17 h 30. Merci de confirmer votre présence." }),
  Object.freeze({ id: "message-3", initials: "SI", sender: "Mme Salma Idrissi", role: "Enseignante · 5A", subject: "Bravo pour sa progression", child: "Lina", date: "21 août · 16 h 48", status: "Important", category: "enseignants", body: "Lina a gagné six points ce mois-ci. Sa régularité et ses efforts à l’oral méritent d’être valorisés." }),
  Object.freeze({ id: "message-4", initials: "YA", sender: "M. Youssef Amrani", role: "Enseignant · 3B", subject: "Activité de classe", child: "Adam", date: "20 août · 15 h 31", status: "Lu", category: "enseignants", body: "Adam peut apporter une photographie de son quartier pour l’activité de description de lundi." }),
  Object.freeze({ id: "message-5", initials: "AM", sender: "École Al Manar", role: "Vie scolaire", subject: "Autorisation de sortie", child: "Adam", date: "19 août · 11 h 05", status: "À signer", category: "administration", body: "Une autorisation parentale est disponible pour la sortie pédagogique au musée. Merci de la consulter avant vendredi." }),
]);

function loadPreferences() {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const value = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) || "null");
    return value && typeof value === "object" ? { ...DEFAULT_PREFERENCES, ...value } : DEFAULT_PREFERENCES;
  } catch { return DEFAULT_PREFERENCES; }
}

function savePreferences(value) {
  if (typeof window === "undefined") return false;
  try { window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value)); return true; } catch { return false; }
}

function ParentLink({ to, className = "", children, ...props }) { return <a href={`#${to}`} className={className} {...props}>{children}</a>; }

function PageHeader({ eyebrow, title, subtitle, action }) {
  return <header className="page-header parent-page-header"><div>{eyebrow && <span className="page-eyebrow">{eyebrow}</span>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="parent-page-actions">{action}</div>}</header>;
}

function Progress({ value, label, note }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="parent-progress"><div><span>{label}</span><strong>{safeValue} %</strong></div><div className="parent-progress-track" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={safeValue}><span style={{ width: `${safeValue}%` }} /></div>{note && <small>{note}</small>}</div>;
}

function MetricCard({ icon: Icon, label, value, note, tone = "teal" }) {
  return <article className={`parent-metric-card tone-${tone}`}><span className="parent-metric-icon"><Icon weight="duotone" aria-hidden="true" /></span><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function formatDueDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date à confirmer";
  return new Intl.DateTimeFormat("fr-MA", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function visibleParentAssignments(assignments) {
  return assignments.filter((item) => item.status === "Publié" && !item.archivedAt).sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));
}

function ParentDashboard({ assignments, notifications }) {
  const nextAssignment = assignments[0] || FALLBACK_HOMEWORK[0];
  const latestNotification = notifications.find((item) => item.role === "parent");
  return <>
    <PageHeader eyebrow="FAMILLE MANSOURI · ÉCOLE AL MANAR" title="Bonjour Youssef" subtitle="L’essentiel pour accompagner Lina cette semaine." action={<><ParentLink to="/parent/enfants" className="button button-light">Voir les ressources <BookOpenText aria-hidden="true" /></ParentLink><ParentLink to="/parent/devoirs" className="button button-green">Consulter les devoirs <ArrowRight aria-hidden="true" /></ParentLink></>} />
    <ParentLink to="/parent/messages" className="parent-dashboard-alert"><span><Bell weight="fill" aria-hidden="true" /></span><strong>{latestNotification?.title || "Un message de Mme Benjelloun"}</strong><small>{latestNotification?.message || "Reçu aujourd’hui"}</small><span>Lire <ArrowRight aria-hidden="true" /></span></ParentLink>
    <div className="parent-metric-grid"><MetricCard icon={Users} label="Enfants" value="2" note="Profils actifs" /><MetricCard icon={ClipboardText} label="Devoirs" value="2" note="Avant vendredi" tone="blue" /><MetricCard icon={TrendUp} label="Progression" value="76 %" note="+ 8 points" tone="coral" /><MetricCard icon={ChatCircleDots} label="Messages" value="4" note="1 non lu" tone="green" /></div>
    <div className="parent-dashboard-layout">
      <section className="panel parent-follow-panel" aria-labelledby="parent-follow-title"><div className="panel-heading"><h2 id="parent-follow-title">À accompagner cette semaine</h2><ParentLink to="/parent/devoirs">Voir tous les devoirs</ParentLink></div>
        <article className="parent-follow-row"><span className="parent-follow-icon danger"><Headphones weight="duotone" aria-hidden="true" /></span><div><h3>Écouter la réponse audio</h3><p>Devoir oral · 54 secondes</p></div><span className="status-pill danger">Nouveau</span><ParentLink to="/parent/devoirs" className="button button-light">Écouter <ArrowRight aria-hidden="true" /></ParentLink></article>
        <article className="parent-follow-row"><span className="parent-follow-icon warning"><PaperPlaneTilt weight="duotone" aria-hidden="true" /></span><div><h3>Encourager la remise</h3><p>{nextAssignment.title} · {formatDueDate(nextAssignment.dueAt)}</p></div><span className="status-pill warning">À suivre</span><ParentLink to="/parent/devoirs" className="button button-light">Ouvrir <ArrowRight aria-hidden="true" /></ParentLink></article>
        <article className="parent-follow-row"><span className="parent-follow-icon info"><CalendarBlank weight="duotone" aria-hidden="true" /></span><div><h3>Voir la progression</h3><p>Unité 3 · Environnement</p></div><span className="status-pill info">76 %</span><ParentLink to="/parent/progres" className="button button-light">Voir <ArrowRight aria-hidden="true" /></ParentLink></article>
      </section>
      <aside className="parent-dashboard-side"><section className="panel parent-skill-summary" aria-labelledby="parent-skills-title"><div className="panel-heading"><h2 id="parent-skills-title">Progression par compétence</h2><span>7 derniers jours</span></div>{COMPETENCIES.map(([label, value]) => <Progress key={label} label={label} value={value} />)}</section><section className="parent-deadline-card" aria-labelledby="parent-deadline-title"><span>PROCHAINE ÉCHÉANCE</span><h2 id="parent-deadline-title">Devoir · vendredi 18 h</h2><p>Décrire un lieu de Casablanca</p><ParentLink to="/parent/devoirs">Ouvrir le devoir <ArrowRight aria-hidden="true" /></ParentLink></section></aside>
    </div>
  </>;
}

function ChildrenListPage({ search = "" }) {
  const [filter, setFilter] = useState("tous");
  const [linkStatus, setLinkStatus] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredChildren = CHILDREN.filter((child) => `${child.name} ${child.school} ${child.className}`.toLowerCase().includes(normalizedSearch));
  const linkChild = (event) => { event.preventDefault(); setLinkStatus("Demande enregistrée. L’établissement doit maintenant valider le rattachement."); };
  return <>
    <PageHeader eyebrow="ESPACE FAMILLE" title="Mes enfants" subtitle="Suivez le parcours scolaire et les activités de chaque enfant." action={<a href="#parent-link-child" className="button button-dark"><LinkSimple aria-hidden="true" /> Relier un enfant</a>} />
    <div className="parent-children-layout"><section className="parent-children-main" aria-label="Profils enfants"><div className="parent-filter-tabs" role="tablist" aria-label="Filtrer les profils">{[["tous", "Tous · 2"], ["actifs", "Actifs · 2"], ["attente", "En attente · 0"]].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <div className="parent-child-list">{filter === "attente" ? <div className="parent-list-empty"><Users weight="duotone" aria-hidden="true" /><h2>Aucun profil en attente</h2><p>Les demandes de rattachement apparaîtront ici.</p></div> : filteredChildren.length ? filteredChildren.map((child) => <ParentLink key={child.id} to={`/parent/enfants/${child.id}`} className="parent-child-row"><span className="parent-child-avatar" aria-hidden="true">{child.initials}</span><span><strong>{child.name}</strong><small>{child.school} · {child.className}</small></span><span><small>Progression</small><strong>{child.progress} %</strong></span><span className="status-pill success">Actif</span><CaretRight aria-hidden="true" /></ParentLink>) : <div className="parent-list-empty"><Users weight="duotone" aria-hidden="true" /><h2>Aucun enfant trouvé</h2><p>Essayez un autre nom dans la recherche.</p></div>}</div>
      <div className="parent-link-states" aria-label="États possibles du rattachement"><article className="success"><CheckCircle weight="fill" aria-hidden="true" /><span><strong>Profil synchronisé</strong><small>Mis à jour aujourd’hui</small></span></article><article className="danger"><WarningCircle weight="fill" aria-hidden="true" /><span><strong>Autorisation requise</strong><small>Validation établissement</small></span></article><article><Users weight="duotone" aria-hidden="true" /><span><strong>Aucun enfant relié</strong><small>Utilisez le code fourni par l’école</small></span></article></div>
    </section>
    <form id="parent-link-child" className="panel parent-link-child" onSubmit={linkChild}><div className="panel-heading"><div><h2>Relier un enfant</h2><p>Saisissez le code famille fourni par l’établissement.</p></div><LinkSimple aria-hidden="true" /></div><label>Code famille<input defaultValue="JDE-5A-82K" required /></label><label>Prénom de l’enfant<input defaultValue="Lina" required /></label><label>Lien parental<select defaultValue="Parent"><option>Parent</option><option>Tuteur légal</option></select></label><label>Établissement<select defaultValue="École Al Manar"><option>École Al Manar</option></select></label><p className="parent-inline-info"><ShieldCheck aria-hidden="true" /> La demande doit être validée par l’établissement.</p><button className="button button-dark" type="submit"><LinkSimple aria-hidden="true" /> Relier le profil</button><p className="parent-form-status" role="status">{linkStatus}</p></form></div>
  </>;
}

function ChildDetailPage({ childId }) {
  const child = CHILDREN.find((item) => item.id === childId) || CHILDREN[0];
  const [tab, setTab] = useState("overview");
  const [status, setStatus] = useState("");
  const submitPreferences = (event) => { event.preventDefault(); setStatus("Préférences de suivi enregistrées sur cet appareil."); };
  const tabContent = { overview: [["Expression orale", 62, "Décrire un lieu avec précision"], ["Production écrite", 69, "Organiser un récit court"], ["Lexique", 74, "Vocabulaire de l’environnement"]], progress: COMPETENCIES.map(([label, value, note]) => [label, value, note]), homework: [["Devoir oral", 54, "À rendre vendredi à 18 h"], ["Quiz environnement", 80, "À terminer lundi"], ["Quiz unité 2", 90, "Terminé · 9/10"]] }[tab];
  return <>
    <nav className="parent-breadcrumb" aria-label="Fil d’Ariane"><ParentLink to="/parent/enfants"><ArrowLeft aria-hidden="true" /> Mes enfants</ParentLink><span>/</span><span>{child.name}</span></nav>
    <PageHeader eyebrow={`${child.school} · ${child.className}`} title={child.name} subtitle={`${child.className} · Niveau ${child.level} · ${child.teacher}`} action={<><a className="button button-light" href="data:text/plain;charset=utf-8,Bilan%20de%20Lina%20Mansouri" download="bilan-lina-mansouri.txt"><DownloadSimple aria-hidden="true" /> Télécharger le bilan</a><button className="button button-dark" type="button" onClick={() => document.getElementById("parent-follow-preferences")?.focus()}><GearSix aria-hidden="true" /> Gérer le profil</button></>} />
    <div className="parent-detail-tabs" role="tablist" aria-label="Sections du profil">{[["overview", "Vue d’ensemble"], ["progress", "Progression"], ["homework", "Devoirs"]].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>
    <div className="parent-detail-metrics"><article><span>Niveau</span><strong>{child.level}</strong></article><article><span>Progression</span><strong>{child.progress} %</strong></article><article><span>Activité</span><strong>5 jours</strong></article><article><span>Devoirs en cours</span><strong>2</strong></article></div>
    <div className="parent-child-detail-layout"><section className="panel parent-focus-skills" aria-labelledby="parent-focus-title"><div className="panel-heading"><h2 id="parent-focus-title">{tab === "overview" ? "Compétences à accompagner" : tab === "progress" ? "Progression par compétence" : "Devoirs de Lina"}</h2><span>Mise à jour cette semaine</span></div>{tabContent.map(([label, value, note]) => <article key={label}><div><strong>{label}</strong><small>{note}</small></div><Progress label={label} value={value} /></article>)}<div className="parent-school-sync"><ShieldCheck weight="duotone" aria-hidden="true" /><span><strong>Suivi école–famille activé</strong><small>Vous recevez les échéances, bilans et messages de l’enseignante.</small></span></div></section>
      <form className="panel parent-follow-preferences" onSubmit={submitPreferences}><div className="panel-heading"><div><h2>Préférences de suivi</h2><p>Personnalisez les notifications pour {child.name.split(" ")[0]}.</p></div><GearSix aria-hidden="true" /></div><label>Enfant<input id="parent-follow-preferences" value={child.name} readOnly /></label><label>Rythme du bilan<select defaultValue="Chaque semaine"><option>Chaque semaine</option><option>Chaque mois</option></select></label><label>Contact principal<select defaultValue="Youssef Mansouri"><option>Youssef Mansouri</option></select></label><p className="parent-inline-info warning"><WarningCircle aria-hidden="true" /> Les données scolaires restent gérées par l’établissement.</p><button className="button button-dark" type="submit"><FloppyDisk aria-hidden="true" /> Enregistrer</button><p className="parent-form-status" role="status">{status}</p></form>
    </div>
  </>;
}

function HomeworkPage({ assignments, search = "" }) {
  const source = assignments.length ? assignments.map((item) => ({ ...item, duration: "10 min", status: "À faire" })) : FALLBACK_HOMEWORK;
  const list = [...source, ...FALLBACK_HOMEWORK].filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index).slice(0, 3);
  const [filter, setFilter] = useState("todo");
  const [expanded, setExpanded] = useState(null);
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = list
    .filter((item) => `${item.title} ${item.subject}`.toLowerCase().includes(normalizedSearch))
    .filter((item) => filter === "all" ? true : filter === "done" ? item.status === "Terminé" : filter === "corrected" ? item.status === "Corrigé" : item.status !== "Terminé");
  return <>
    <PageHeader eyebrow="SUIVI DE LINA" title="Devoirs de Lina" subtitle="Repérez les échéances et accompagnez Lina sans faire à sa place." />
    <div className="parent-homework-filters" role="tablist" aria-label="Filtrer les devoirs">{[["todo", "À faire", "2"], ["done", "Terminés", "8"], ["all", "Tous", "10"], ["corrected", "Corrigés", "6"]].map(([key, label, count]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label} <span>{count}</span></button>)}</div>
    <div className="parent-homework-layout"><section className="parent-homework-list" aria-label="Devoirs publiés">{filtered.length ? filtered.map((item, index) => { const isOpen = expanded === item.id; const tone = index === 0 ? "oral" : item.status === "Terminé" ? "done" : "quiz"; return <article key={item.id} className={`parent-homework-card ${tone}`}><span className="parent-homework-type">{item.subject || "Français"}</span><div className="parent-homework-main"><div><span>{formatDueDate(item.dueAt)} · 18 h</span><span className={`status-pill ${item.status === "Terminé" ? "success" : "warning"}`}>{item.status || "À faire"}</span></div><h2>{item.title}</h2><p>{item.status === "Terminé" ? `Terminé · ${item.duration || "9/10"}` : `À rendre · ${item.duration || "10 min"}`}</p>{isOpen && <div id={`parent-homework-${item.id}`} className="parent-homework-details"><strong>Consigne de l’enseignante</strong><p>{item.instructions || "Les consignes détaillées seront ajoutées par l’enseignante."}</p></div>}</div><button className={item.status === "Terminé" ? "button button-light" : "button button-green"} type="button" onClick={() => setExpanded(isOpen ? null : item.id)} aria-expanded={isOpen} aria-controls={`parent-homework-${item.id}`}>{isOpen ? "Masquer" : item.status === "Terminé" ? "Voir le résultat" : "Voir le devoir"} <ArrowRight aria-hidden="true" /></button></article>; }) : <div className="parent-list-empty"><ClipboardText weight="duotone" aria-hidden="true" /><h2>Aucun devoir à afficher</h2><p>Changez de filtre ou utilisez une autre recherche.</p></div>}<div className="parent-homework-reassurance"><CheckCircle weight="duotone" aria-hidden="true" /><span><strong>Lina est à jour pour le reste de la semaine</strong><small>Deux devoirs seulement demandent votre attention.</small></span></div></section>
      <aside className="parent-homework-side"><section className="parent-homework-priority" aria-labelledby="homework-priority-title"><span>À ACCOMPAGNER</span><h2 id="homework-priority-title">Vendredi · 18 h</h2><p>Devoir oral de Lina · 45–90 s</p></section><section className="panel parent-homework-timeline" aria-labelledby="homework-steps-title"><h2 id="homework-steps-title">Étapes de Lina</h2><ol><li><CheckCircle weight="fill" aria-hidden="true" /><span><strong>Lire la consigne</strong><small>Fait</small></span></li><li><Headphones weight="duotone" aria-hidden="true" /><span><strong>Enregistrer</strong><small>À faire</small></span></li><li><PaperPlaneTilt weight="duotone" aria-hidden="true" /><span><strong>Envoyer</strong><small>Avant 18 h</small></span></li></ol></section></aside>
    </div>
  </>;
}

function ProgressPage() {
  return <>
    <PageHeader eyebrow="BILAN DE LINA" title="Progression de Lina" subtitle="Suivez ses acquis, ses efforts et les compétences à renforcer." action={<a className="button button-green" href="data:text/plain;charset=utf-8,Bilan%20de%20progression%20de%20Lina" download="progression-lina.txt">Télécharger le bilan <DownloadSimple aria-hidden="true" /></a>} />
    <div className="parent-progress-overview"><section className="parent-progress-score" aria-label="Progression globale de Lina : 68 %"><div className="parent-score"><span>68 %</span><small>GLOBAL</small></div><div><strong>Lina avance bien !</strong><small>+ 6 % depuis le début du mois.</small></div></section><div className="parent-progress-kpis"><MetricCard icon={Sparkle} label="Activités" value="14" note="Terminées" /><MetricCard icon={Trophy} label="Quiz / 10" value="8,4" note="Moyenne" tone="blue" /><MetricCard icon={Clock} label="Série active" value="4 j" note="Record : 9 jours" tone="gold" /><MetricCard icon={Medal} label="Badge suivant" value="4/5" note="Encore 1 activité" tone="coral" /></div></div>
    <div className="parent-progress-layout"><section className="panel parent-week-activity" aria-labelledby="week-activity-title"><div className="panel-heading"><div><h2 id="week-activity-title">Activité de Lina cette semaine</h2><p>Temps consacré aux activités</p></div><span>Minutes actives</span></div><div className="parent-week-chart" role="img" aria-label={WEEK_ACTIVITY.map(([day, value]) => `${day} : ${value} %`).join(", ")}>{WEEK_ACTIVITY.map(([day, value], index) => <div key={`${day}-${index}`}><span style={{ height: `${value}%` }} aria-hidden="true" /><small>{day}</small></div>)}</div></section><aside className="parent-progress-side"><section className="panel parent-progress-skills" aria-labelledby="progress-skills-title"><h2 id="progress-skills-title">Compétences de Lina</h2>{COMPETENCIES.slice(0, 3).map(([label, value]) => <Progress key={label} label={label} value={value} />)}</section><section className="parent-goal-card"><Trophy weight="duotone" aria-hidden="true" /><span><strong>Prochain objectif</strong><small>Encore 1 activité pour gagner l’insigne Exploratrice.</small></span></section></aside></div>
  </>;
}

function MessagesPage({ notifications, notify, currentUser, search = "" }) {
  const [filter, setFilter] = useState("all"); const [selected, setSelected] = useState(null); const [composeOpen, setComposeOpen] = useState(false); const [draft, setDraft] = useState(""); const [status, setStatus] = useState("");
  const localMessages = notifications.filter((item) => item.role === "parent" && item.type === "message_parent").map((item) => ({ id: item.id, initials: "YM", sender: "Youssef Mansouri", role: "Parent", subject: "Message envoyé", child: "Lina", date: "Enregistré localement", status: "Envoyé", category: "enseignants", body: item.message }));
  const messages = [...localMessages, ...MESSAGE_SEED]; const normalizedSearch = search.trim().toLowerCase();
  const filtered = messages
    .filter((item) => `${item.sender} ${item.subject} ${item.child}`.toLowerCase().includes(normalizedSearch))
    .filter((item) => filter === "all" ? true : filter === "unread" ? item.status === "Non lu" : item.category === filter);
  const submit = (event) => { event.preventDefault(); const clean = draft.trim(); if (clean.length < 3) { setStatus("Écrivez un message d’au moins trois caractères."); return; } const result = notify({ role: "parent", userId: currentUser?.id || "user-parent-youssef", type: "message_parent", title: "Message à Mme Salma Idrissi", message: clean, action: "/parent/messages" }); if (result.ok) { setDraft(""); setStatus("Message enregistré sur cet appareil."); setComposeOpen(false); } else setStatus(result.message || "Le message n’a pas pu être enregistré."); };
  return <>
    <PageHeader eyebrow="ÉCOLE–FAMILLE" title="Messages" subtitle="Échangez avec l’équipe pédagogique et l’administration de l’école." action={<button className="button button-green" type="button" onClick={() => setComposeOpen(true)}><PaperPlaneTilt aria-hidden="true" /> Nouveau message</button>} />
    <section className="parent-message-summary" aria-labelledby="message-summary-title"><div><strong id="message-summary-title">4 messages lus sur 5</strong><small>1 message demande votre attention</small></div><div className="parent-message-progress"><span style={{ width: "80%" }} /></div><span>80 % lus</span></section>
    <div className="parent-message-metrics"><MetricCard icon={Bell} label="Non lu" value="1" note="Prioritaire" /><MetricCard icon={Users} label="Enseignants" value="2" note="Cette semaine" tone="blue" /><MetricCard icon={House} label="Administration" value="1" note="Information" tone="green" /><MetricCard icon={ClipboardText} label="Document" value="1" note="À signer" tone="coral" /></div>
    <div className="parent-message-filters" role="tablist" aria-label="Filtrer les messages">{[["all", "Tous", 5], ["unread", "Non lus", 1], ["enseignants", "Enseignants", 2], ["administration", "Administration", 1]].map(([key, label, count]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label} <span>{count}</span></button>)}</div>
    {composeOpen && <form className="panel parent-compose-message" onSubmit={submit}><div className="panel-heading"><div><h2>Nouveau message</h2><p>À Mme Salma Idrissi · au sujet de Lina</p></div><button type="button" className="icon-button" onClick={() => setComposeOpen(false)} aria-label="Fermer"><X aria-hidden="true" /></button></div><label htmlFor="parent-message-draft">Votre message</label><textarea id="parent-message-draft" value={draft} onChange={(event) => { setDraft(event.target.value); setStatus(""); }} maxLength={600} placeholder="Écrivez un message clair et respectueux…" required /><div><small>{draft.length} / 600</small><button className="button button-dark" type="submit"><PaperPlaneTilt aria-hidden="true" /> Enregistrer le message</button></div><p className="parent-form-status" role="status">{status}</p></form>}
    <section className="parent-inbox" aria-label="Boîte de réception"><div className="parent-inbox-head" aria-hidden="true"><span>Expéditeur</span><span>Sujet</span><span>Enfant</span><span>Date</span><span>Statut</span><span>Action</span></div>{filtered.length ? filtered.map((item) => <article className={item.status === "Non lu" ? "unread" : ""} key={item.id}><span className="parent-message-avatar" aria-hidden="true">{item.initials}</span><span className="parent-message-sender"><strong>{item.sender}</strong><small>{item.role}</small></span><span className="parent-message-subject"><strong>{item.subject}</strong><small>{item.body}</small></span><span>{item.child}</span><span>{item.date}</span><span className={`status-pill ${item.status === "Non lu" ? "danger" : item.status === "À signer" ? "warning" : "success"}`}>{item.status}</span><button className={item.status === "Non lu" ? "button button-green" : "button button-light"} type="button" onClick={() => setSelected(item)}>{item.status === "Non lu" ? "Lire" : "Ouvrir"} <ArrowRight aria-hidden="true" /></button></article>) : <div className="parent-list-empty"><EnvelopeSimple weight="duotone" aria-hidden="true" /><h2>Aucun message trouvé</h2><p>Essayez un autre filtre ou une autre recherche.</p></div>}</section>
    {selected && <section className="panel parent-message-reader" aria-live="polite"><div className="panel-heading"><div><span>{selected.sender}</span><h2>{selected.subject}</h2></div><button className="icon-button" type="button" onClick={() => setSelected(null)} aria-label="Fermer le message"><X aria-hidden="true" /></button></div><p>{selected.body}</p><div><span>{selected.child} · {selected.date}</span><button className="button button-dark" type="button" onClick={() => { setComposeOpen(true); setSelected(null); }}>Répondre <PaperPlaneTilt aria-hidden="true" /></button></div></section>}
  </>;
}

function SettingsPage() {
  const [preferences, setPreferences] = useState(loadPreferences); const [status, setStatus] = useState("");
  const update = (key) => setPreferences((current) => ({ ...current, [key]: !current[key] }));
  const handleSave = (event) => { event.preventDefault(); setStatus(savePreferences(preferences) ? "Profil et préférences enregistrés sur cet appareil." : "Le navigateur empêche l’enregistrement local."); };
  return <>
    <PageHeader eyebrow="FAMILLE MANSOURI · PARAMÈTRES" title="Profil & préférences" subtitle="Gérez vos coordonnées, notifications et options de confidentialité." action={<button className="button button-dark" type="submit" form="parent-settings-form"><FloppyDisk aria-hidden="true" /> Enregistrer les modifications</button>} />
    <form id="parent-settings-form" className="parent-settings-layout" onSubmit={handleSave}><section className="panel parent-profile-settings" aria-labelledby="parent-profile-settings-title"><div className="parent-settings-identity"><span aria-hidden="true">YM</span><div><h2 id="parent-profile-settings-title">Youssef Mansouri</h2><p>Compte parent · Lina et Adam</p></div><button className="button button-light" type="button">Modifier la photo</button></div><div className="parent-profile-fields"><label>Nom complet<input defaultValue="Youssef Mansouri" /></label><label>Lien parental<select defaultValue="Parent"><option>Parent</option><option>Tuteur légal</option></select></label><label>Ville<input defaultValue="Casablanca" /></label><label>Langue préférée<select defaultValue="Français"><option>Français</option><option>العربية</option></select></label><label>E-mail<input type="email" defaultValue="y.mansouri@example.ma" /></label><label>Téléphone<input type="tel" defaultValue="+212 6 12 34 56 78" /></label><label className="wide">Adresse<input defaultValue="Maarif · Casablanca" /></label></div><p className="parent-inline-info success"><CheckCircle aria-hidden="true" /> Dernière modification enregistrée aujourd’hui à 10 h 32.</p></section>
      <aside className="parent-settings-side"><section className="parent-security-card" aria-labelledby="parent-security-title"><div><ShieldCheck weight="duotone" aria-hidden="true" /><span><h2 id="parent-security-title">Sécurité et notifications</h2><p>Connexion sécurisée · alertes e-mail et application</p></span></div><fieldset><legend>Gérer les préférences</legend>{[["devoirs", "Nouveaux devoirs"], ["progres", "Progrès importants"], ["bilanHebdomadaire", "Bilan hebdomadaire"], ["email", "Alertes par e-mail"]].map(([key, label]) => <label className="parent-switch-row" key={key}><span><strong>{label}</strong></span><input type="checkbox" checked={preferences[key]} onChange={() => update(key)} /></label>)}</fieldset></section><section className="panel parent-help-card"><div><span><UserCircle weight="duotone" aria-hidden="true" /></span><div><h2>Besoin d’aide ?</h2><p>Notre équipe peut vous aider pour la liaison des enfants et les accès famille.</p></div></div><div><a className="button button-dark" href="mailto:contact@jetdencre.ma">Contacter</a><button className="button button-light" type="button">Centre d’aide familles</button></div></section><p className="parent-account-safe"><ShieldCheck weight="fill" aria-hidden="true" /> Votre compte est protégé</p><p className="parent-form-status" role="status">{status}</p></aside>
    </form>
  </>;
}

function UnknownParentPage() { return <section className="parent-list-empty parent-page-empty" aria-labelledby="unknown-parent-title"><House weight="duotone" aria-hidden="true" /><h1 id="unknown-parent-title">Cette page parent n’existe pas</h1><p>Revenez à l’accueil de votre espace famille.</p><ParentLink to="/parent/tableau-de-bord" className="button button-dark">Retour à l’accueil <ArrowRight aria-hidden="true" /></ParentLink></section>; }

export function ParentLoginPage() {
  const account = DEMO_ACCOUNTS.parent; const { signIn } = useDemoStore(); const [identifier, setIdentifier] = useState(account.identifier); const [password, setPassword] = useState(account.password); const [visible, setVisible] = useState(false); const [message, setMessage] = useState("");
  const submit = (event) => { event.preventDefault(); const result = signIn("parent", { identifier, password }); if (!result.ok) { setMessage(result.message); return; } const requested = sessionStorage.getItem("jde.returnTo"); sessionStorage.removeItem("jde.returnTo"); window.location.hash = `#${requested?.startsWith("/parent/") ? requested : "/parent/tableau-de-bord"}`; };
  return <div className="parent-login-page"><a className="skip-link" href="#parent-login-main">Aller au formulaire</a><aside className="parent-login-aside"><ParentLink to="/connexion" className="parent-login-back"><ArrowLeft aria-hidden="true" /> Choix du profil</ParentLink><img className="parent-login-logo" src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions" width="200" height="73" /><div className="parent-login-intro"><span className="parent-login-picture"><img src="/assets/parent-login-illustration-w07.png" alt="Illustration en pâte modelée d’une enseignante devant son tableau" width="1408" height="768" /></span><h1>Espace<br />Parent</h1><p>Accompagnez votre enfant avec une vision claire, rassurante et respectueuse de son autonomie.</p></div><ul><li><CheckCircle weight="fill" aria-hidden="true" /> Devoirs et échéances réunis</li><li><CheckCircle weight="fill" aria-hidden="true" /> Progression expliquée simplement</li><li><CheckCircle weight="fill" aria-hidden="true" /> Messagerie directe avec l’école</li></ul></aside><main id="parent-login-main" className="parent-login-main" tabIndex="-1"><section className="parent-login-card"><span className="parent-login-badge"><Users weight="fill" aria-hidden="true" /> ESPACE PARENT</span><h2>Bienvenue dans votre espace parent</h2><p>Retrouvez les informations utiles pour accompagner Lina au quotidien.</p><form onSubmit={submit}><label>Adresse e-mail du parent<input type="email" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required /></label><label>Mot de passe<span className="parent-password-field"><input type={visible ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{visible ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></span></label><div className="parent-login-options"><label><input type="checkbox" defaultChecked /> Rester connecté</label><ParentLink to="/mot-de-passe-oublie">Mot de passe oublié ?</ParentLink></div>{message && <p className="form-error" role="alert"><WarningCircle weight="fill" aria-hidden="true" /> {message}</p>}<button className="button button-green button-wide" type="submit">Accéder à ma famille <ArrowRight aria-hidden="true" /></button></form><ParentLink to="/connexion" className="button button-light button-wide">Créer un accès parent</ParentLink></section></main></div>;
}

export function ParentPages({ page, detail = null, search = "" }) {
  const { assignments, notifications, notify, currentUser } = useDemoStore();
  const parentAssignments = useMemo(() => visibleParentAssignments(assignments), [assignments]);
  if (page === "tableau-de-bord") return <ParentDashboard assignments={parentAssignments} notifications={notifications} />;
  if (page === "enfants" && detail) return <ChildDetailPage childId={detail} />;
  if (page === "enfants") return <ChildrenListPage search={search} />;
  if (page === "devoirs") return <HomeworkPage assignments={parentAssignments} search={search} />;
  if (page === "progres") return <ProgressPage />;
  if (page === "messages") return <MessagesPage notifications={notifications} notify={notify} currentUser={currentUser} search={search} />;
  if (page === "parametres") return <SettingsPage />;
  return <UnknownParentPage />;
}

export default ParentPages;
