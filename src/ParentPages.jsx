import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Bell, BookOpenText, CalendarBlank, CaretRight,
  ChatCircleDots, CheckCircle, ClipboardText, Clock, DownloadSimple,
  EnvelopeSimple, Eye, EyeSlash, FloppyDisk, GearSix, Headphones, House,
  LinkSimple, Medal, PaperPlaneTilt, ShieldCheck, Sparkle, TrendUp, Trophy,
  UserCircle, Users, WarningCircle, X,
} from "@phosphor-icons/react/ssr";
import { DEMO_ACCOUNTS, useDemoStore } from "./demoStore.jsx";
import "./parent-pages.css";
import { buildParentHomework, getParentLearningSummary, loadParentProfile, saveParentProfile, requestDemoFamilyLink } from "./parentDataCore.js";

const PREFERENCES_KEY = "jde.parent.preferences.v2";
const DEFAULT_PREFERENCES = Object.freeze({ email: true, devoirs: true, progres: true, actualites: false, bilanHebdomadaire: true });

const CHILDREN = Object.freeze([
  Object.freeze({ id: "lina-mansouri", userId: "user-eleve-lina", initials: "LM", name: "Lina Mansouri", school: "École Al Manar", className: "5A", level: "5e AEP", teacher: "Mme Salma Benjelloun" }),
]);
function localStorageOrNull() { try { return window.localStorage; } catch { return null; } }

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

function parentNavigate(to, { replace = false } = {}) {
  window.history[replace ? "replaceState" : "pushState"]({}, "", to);
  window.dispatchEvent(new Event("jde:navigate"));
}

function ParentLink({ to, className = "", children, onClick, ...props }) {
  return <a href={to} className={className} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    parentNavigate(to);
  }} {...props}>{children}</a>;
}

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

function ParentDashboard({ assignments, notifications, summary }) {
  const nextAssignment = assignments.find(item => item.status === "À faire");
  const corrected = assignments.filter(item => item.status === "Corrigé");
  return <>
    <PageHeader eyebrow="ESPACE FAMILLE · DÉMONSTRATION LOCALE" title="Bonjour Youssef" subtitle="Les devoirs et résultats ci-dessous proviennent de ce navigateur, pas d’une école connectée." action={<ParentLink to="/parent/devoirs" className="button button-green">Consulter les devoirs <ArrowRight aria-hidden="true" /></ParentLink>} />
    <div className="parent-metric-grid"><MetricCard icon={Users} label="Profil d’exemple" value="1" note="Lina · données fictives" /><MetricCard icon={ClipboardText} label="Devoirs à faire" value={String(assignments.filter(item => item.status === "À faire").length)} note="Classe 5A · données locales" tone="blue" /><MetricCard icon={TrendUp} label="Entraînements terminés" value={String(summary.completedActivityCount)} note="Activités distinctes, hors jeux libres" tone="coral" /><MetricCard icon={ChatCircleDots} label="Notifications locales" value={String(notifications.length)} note="Aucun envoi à l’école" tone="green" /></div>
    <div className="parent-dashboard-layout"><section className="panel parent-follow-panel"><div className="panel-heading"><h2>À accompagner</h2><ParentLink to="/parent/devoirs">Tous les devoirs</ParentLink></div>
      <article className="parent-follow-row"><span className="parent-follow-icon warning"><ClipboardText aria-hidden="true" /></span><div><h3>{nextAssignment ? "Prochaine remise" : "Aucun devoir en attente"}</h3><p>{nextAssignment ? `${nextAssignment.title} · ${formatDueDate(nextAssignment.dueAt)}` : "Aucune échéance à signaler dans la démonstration locale."}</p></div><ParentLink to="/parent/devoirs" className="button button-light">Consulter <ArrowRight/></ParentLink></article>
      <article className="parent-follow-row"><span className="parent-follow-icon info"><CheckCircle/></span><div><h3>Corrections disponibles</h3><p>{corrected.length ? `${corrected.length} devoir(s) corrigé(s) à relire ensemble.` : "Pas encore de correction enregistrée."}</p></div><ParentLink to="/parent/devoirs" className="button button-light">Voir <ArrowRight/></ParentLink></article>
    </section><aside className="parent-dashboard-side"><section className="panel parent-skill-summary"><h2>Comprendre le bilan</h2><p>Les XP valorisent la pratique. Ils ne mesurent pas le niveau de français.</p><p>Une activité terminée ne signifie pas qu’une compétence est acquise. Les réponses et les commentaires de l’enseignant précisent ce qui reste à travailler.</p><ParentLink to="/parent/progres" className="button button-light">Voir les résultats réels de la démo <ArrowRight/></ParentLink></section></aside></div>
  </>;
}

function ChildrenListPage({ search = "" }) {
  const [filter, setFilter] = useState("tous");
  const [linkStatus, setLinkStatus] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredChildren = CHILDREN.filter((child) => `${child.name} ${child.school} ${child.className}`.toLowerCase().includes(normalizedSearch));
  const linkChild = (event) => { event.preventDefault(); setLinkStatus(requestDemoFamilyLink().message); };
  return <>
    <PageHeader eyebrow="ESPACE FAMILLE" title="Mes enfants" subtitle="Suivez le parcours scolaire et les activités de chaque enfant." action={<button type="button" className="button button-dark" onClick={() => { document.getElementById("parent-family-code")?.focus(); document.getElementById("parent-link-child")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><LinkSimple aria-hidden="true" /> Relier un enfant</button>} />
    <div className="parent-children-layout"><section className="parent-children-main" aria-label="Profils enfants"><div className="parent-filter-tabs" role="tablist" aria-label="Filtrer les profils">{[["tous", "Tous · 1"], ["actifs", "Démo · 1"], ["attente", "En attente · 0"]].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <div className="parent-child-list">{filter === "attente" ? <div className="parent-list-empty"><Users weight="duotone" aria-hidden="true" /><h2>Aucun profil en attente</h2><p>Les demandes de rattachement apparaîtront ici.</p></div> : filteredChildren.length ? filteredChildren.map((child) => <ParentLink key={child.id} to={`/parent/enfants/${child.id}`} className="parent-child-row"><span className="parent-child-avatar" aria-hidden="true">{child.initials}</span><span><strong>{child.name}</strong><small>{child.school} · {child.className}</small></span><span><small>Données</small><strong>Démo locale</strong></span><span className="status-pill info">Exemple</span><CaretRight aria-hidden="true" /></ParentLink>) : <div className="parent-list-empty"><Users weight="duotone" aria-hidden="true" /><h2>Aucun enfant trouvé</h2><p>Essayez un autre nom dans la recherche.</p></div>}</div>
      <p className="parent-inline-info"><ShieldCheck aria-hidden="true"/> Profil fictif d’exemple. Aucun lien parent-enfant réel n’est vérifié dans cette démonstration.</p>
    </section>
    <form id="parent-link-child" className="panel parent-link-child" onSubmit={linkChild}><div className="panel-heading"><div><h2>Relier un enfant</h2><p>Saisissez le code famille fourni par l’établissement.</p></div><LinkSimple aria-hidden="true" /></div><label>Code famille<input id="parent-family-code" placeholder="Code transmis par votre école" required /></label><label>Prénom de l’enfant<input defaultValue="Lina" required /></label><label>Lien parental<select defaultValue="Parent"><option>Parent</option><option>Tuteur légal</option></select></label><label>Établissement<select defaultValue="École Al Manar"><option>École Al Manar</option></select></label><p className="parent-inline-info"><ShieldCheck aria-hidden="true" /> Rattachement réel indisponible ici : aucun code ne sera validé ni envoyé.</p><button className="button button-dark" type="submit"><LinkSimple aria-hidden="true" /> Relier le profil</button><p className="parent-form-status" role="status">{linkStatus}</p></form></div>
  </>;
}

function ChildDetailPage({ childId, assignments, summary }) {
  const child = CHILDREN.find(item => item.id === childId);
  if (!child) return <UnknownParentPage />;
  return <><nav className="parent-breadcrumb" aria-label="Fil d’Ariane"><ParentLink to="/parent/enfants"><ArrowLeft/> Mes enfants</ParentLink><span>/</span><span>{child.name}</span></nav><PageHeader eyebrow="PROFIL FICTIF · DÉMONSTRATION" title={child.name} subtitle={`${child.school} · ${child.className} · ${child.teacher}`}/><div className="parent-detail-metrics"><article><span>Niveau scolaire</span><strong>{child.level}</strong></article><article><span>Entraînements distincts</span><strong>{summary.completedActivityCount}</strong></article><article><span>Participations, jeux inclus</span><strong>{summary.participationCount}</strong></article><article><span>Devoirs à faire</span><strong>{assignments.filter(item => item.status === "À faire").length}</strong></article></div><section className="panel"><h2>Accompagner sans faire à sa place</h2><p>Demandez à Lina de vous expliquer une réponse ou de lire le retour de l’enseignante. Le niveau de langue n’est pas déduit du nombre d’XP.</p><div className="parent-page-actions"><ParentLink to="/parent/progres" className="button button-light">Consulter les résultats <ArrowRight/></ParentLink><ParentLink to="/parent/devoirs" className="button button-green">Devoirs et corrections <ArrowRight/></ParentLink></div><p className="parent-inline-info">Ces données sont conservées sur cet appareil. Le suivi entre l’école et la famille sur des appareils différents n’est pas activé.</p></section></>;
}

function HomeworkPage({ assignments, search = "" }) {
  const [filter, setFilter] = useState("todo");
  const [expanded, setExpanded] = useState(null);
  const counts = { todo: assignments.filter(item => item.status === "À faire").length, done: assignments.filter(item => item.status === "Remis").length, corrected: assignments.filter(item => item.status === "Corrigé").length, all: assignments.length };
  const filtered = assignments.filter(item => `${item.title} ${item.subject}`.toLowerCase().includes(search.trim().toLowerCase())).filter(item => filter === "all" || item.status === ({ todo: "À faire", done: "Remis", corrected: "Corrigé" })[filter]);
  return <><PageHeader eyebrow="SUIVI LOCAL · PROFIL D’EXEMPLE" title="Devoirs de Lina" subtitle="Devoirs publiés pour la classe 5A et remises enregistrées sur cet appareil."/><div className="parent-homework-filters" role="tablist" aria-label="Filtrer les devoirs">{[["todo", "À faire"], ["done", "Remis"], ["corrected", "Corrigés"], ["all", "Tous"]].map(([key,label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label} <span>{counts[key]}</span></button>)}</div><section className="parent-homework-list" aria-label="Devoirs publiés">{filtered.length ? filtered.map(item => <article key={item.id} className={`parent-homework-card ${item.status === "À faire" ? "oral" : "done"}`}><span className="parent-homework-type">{item.subject || "Français"}</span><div className="parent-homework-main"><div><span>{formatDueDate(item.dueAt)}</span><span className={`status-pill ${item.status === "À faire" ? "warning" : "success"}`}>{item.status}</span></div><h2>{item.title}</h2><p>{item.status === "Corrigé" ? `Note : ${item.submission.score} / 20` : item.status === "Remis" ? "Le travail attend une correction." : "Lisez la consigne avec votre enfant."}</p>{expanded === item.id && <div id={`parent-homework-${item.id}`} className="parent-homework-details"><strong>Consigne</strong><p>{item.instructions}</p>{item.submission && <><strong>Réponse remise</strong><p>{item.submission.answer}</p></>}{item.status === "Corrigé" && <><strong>Retour de l’enseignant</strong><p>{item.submission.feedback}</p></>}</div>}</div><button type="button" className="button button-light" aria-expanded={expanded === item.id} aria-controls={`parent-homework-${item.id}`} onClick={() => setExpanded(expanded === item.id ? null : item.id)}>{expanded === item.id ? "Masquer" : item.status === "Corrigé" ? "Lire la correction" : "Voir le devoir"} <ArrowRight/></button></article>) : <div className="parent-list-empty"><ClipboardText/><h2>Aucun devoir dans cette catégorie</h2><p>Les devoirs remis ou corrigés ne sont pas affichés dans « À faire ».</p></div>}<p className="parent-inline-info">Démonstration locale : pas de synchronisation avec une école réelle.</p></section></>;
}

function ProgressPage({ summary, assignments }) {
  const report = ["Bilan de démonstration locale — Lina Mansouri", `${summary.participationCount} participations, jeux inclus`, `${summary.completedActivityCount} entraînements distincts terminés`, `${summary.xpEarned} XP gagnés dans les événements enregistrés`, ...summary.exercises.map(item => `${item.title || item.quizId} : ${item.correctCount}/${item.questionCount}. ${item.masteryLabel || ""}`), ...assignments.filter(item => item.status === "Corrigé").map(item => `${item.title} : ${item.submission.score}/20 — ${item.submission.feedback}`), "Ces résultats ne certifient pas une maîtrise générale. Données de ce navigateur uniquement."].join("\n");
  return <><PageHeader eyebrow="BILAN LOCAL · PROFIL D’EXEMPLE" title="Les apprentissages de Lina" subtitle="Participation, réussite et XP sont présentés séparément." action={<a className="button button-green" href={`data:text/plain;charset=utf-8,${encodeURIComponent(report)}`} download="bilan-local-lina.txt">Télécharger ce bilan <DownloadSimple/></a>}/><div className="parent-metric-grid"><MetricCard icon={Sparkle} label="Participations" value={String(summary.participationCount)} note="Jeux et entraînements, reprises incluses"/><MetricCard icon={BookOpenText} label="Entraînements distincts" value={String(summary.completedActivityCount)} note="Une reprise ne compte pas une nouvelle activité" tone="blue"/><MetricCard icon={Trophy} label="XP gagnés" value={String(summary.xpEarned)} note="Récompenses locales enregistrées, hors solde initial fictif" tone="gold"/><MetricCard icon={ClipboardText} label="Devoirs corrigés" value={String(assignments.filter(item => item.status === "Corrigé").length)} note="Commentaires à relire ensemble" tone="coral"/></div><section className="panel"><h2>Résultat du dernier entraînement par activité</h2>{summary.exercises.length ? summary.exercises.map(item => <article key={item.quizId} className="parent-follow-row"><div><h3>{item.title || item.quizId}</h3><p>{item.masteryLabel}</p><small>Dernière tentative : {formatDueDate(item.completedAt)}</small></div><strong>{item.correctCount} / {item.questionCount}</strong></article>) : <p>Aucun entraînement terminé dans cette démonstration. Aucun taux de maîtrise n’est estimé.</p>}<p className="parent-inline-info">Les jeux libres n’achèvent pas les unités du manuel. Une réussite sur quelques questions ne suffit pas à certifier une compétence : l’enseignant doit aussi observer son utilisation en situation.</p></section></>;
}

function MessagesPage({ notifications, notify, currentUser, search = "" }) {
  const [filter, setFilter] = useState("all"); const [selected, setSelected] = useState(null); const [composeOpen, setComposeOpen] = useState(false); const [draft, setDraft] = useState(""); const [status, setStatus] = useState("");
  const composeButtonRef = useRef(null);
  const composeRef = useRef(null);
  const composeDialogRef = useRef(null);
  const composeOpenerRef = useRef(null);
  const openCompose = event => { composeOpenerRef.current = event.currentTarget; setComposeOpen(true); };
  const closeCompose = () => setComposeOpen(false);
  useEffect(() => {
    if (!composeOpen) return;
    const dialog = composeDialogRef.current;
    dialog.showModal();
    const focusFrame = requestAnimationFrame(() => composeRef.current?.focus());
    return () => {
      cancelAnimationFrame(focusFrame);
      if (dialog.open) dialog.close();
      const opener = composeOpenerRef.current?.isConnected ? composeOpenerRef.current : composeButtonRef.current;
      if (opener?.isConnected) opener.focus();
    };
  }, [composeOpen]);
  const trapComposeFocus = event => {
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]')].filter(element => !element.hidden && element.getClientRects().length);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first) { event.preventDefault(); composeDialogRef.current?.focus(); return; }
    const active = event.currentTarget.ownerDocument.activeElement;
    if (event.shiftKey && (active === first || !event.currentTarget.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !event.currentTarget.contains(active))) { event.preventDefault(); first.focus(); }
  };
  const localMessages = notifications.filter((item) => item.role === "parent" && item.type === "message_parent").map((item) => ({ id: item.id, initials: "YM", sender: "Youssef Mansouri", role: "Parent", subject: "Brouillon local", child: "Lina", date: "Enregistré localement", status: "Non envoyé", category: "enseignants", body: item.message }));
  const messages = localMessages; const normalizedSearch = search.trim().toLowerCase();
  const filtered = messages
    .filter((item) => `${item.sender} ${item.subject} ${item.child}`.toLowerCase().includes(normalizedSearch))
    .filter((item) => filter === "all" ? true : filter === "unread" ? item.status === "Non lu" : item.category === filter);
  const submit = (event) => { event.preventDefault(); const clean = draft.trim(); if (clean.length < 3) { setStatus("Écrivez un message d’au moins trois caractères."); return; } const result = notify({ role: "parent", userId: currentUser?.id || "user-parent-youssef", type: "message_parent", title: "Message à Mme Salma Idrissi", message: clean, action: "/parent/messages" }); if (result.ok) { setDraft(""); setStatus("Brouillon enregistré sur cet appareil. Aucun message n’a été envoyé à l’école."); closeCompose(); } else setStatus(result.message || "Le message n’a pas pu être enregistré."); };
  return <>
    <PageHeader eyebrow="ÉCOLE–FAMILLE" title="Messages" subtitle="Démonstration : écrivez et conservez un brouillon. Aucun message n’est transmis à une école." action={<button ref={composeButtonRef} className="button button-green" type="button" onClick={openCompose}><PaperPlaneTilt aria-hidden="true" /> Nouveau message</button>} />
    <p className="parent-inline-info">{localMessages.length} brouillon(s) enregistré(s) localement · aucun envoi</p>
    <div className="parent-message-filters"><button type="button" className="active" onClick={() => setFilter("all")}>Tous les brouillons</button></div>
    {status && !composeOpen && <p role="status" className="parent-form-status">{status}</p>}
    {composeOpen && <dialog ref={composeDialogRef} aria-modal="true" aria-labelledby="parent-compose-title" style={{ padding: 0, border: 0, borderRadius: 16, width: "min(760px, calc(100vw - 40px))", maxHeight: "calc(100vh - 40px)", overflow: "auto" }} onCancel={event => { event.preventDefault(); closeCompose(); }}><form className="panel parent-compose-message" style={{ margin: 0 }} onSubmit={submit} onKeyDown={trapComposeFocus}><div className="panel-heading"><div><h2 id="parent-compose-title">Nouveau message</h2><p>Brouillon destiné à Mme Salma Benjelloun · non envoyé</p></div><button type="button" className="icon-button" onClick={closeCompose} aria-label="Fermer"><X aria-hidden="true" /></button></div><label htmlFor="parent-message-draft">Votre message</label><textarea ref={composeRef} id="parent-message-draft" value={draft} onChange={(event) => { setDraft(event.target.value); setStatus(""); }} maxLength={600} placeholder="Écrivez un message clair et respectueux…" required /><div><small>{draft.length} / 600</small><button className="button button-dark" type="submit"><PaperPlaneTilt aria-hidden="true" /> Enregistrer le brouillon</button></div><p className="parent-form-status" role="status">{status}</p></form></dialog>}
    <section className="parent-inbox" aria-label="Boîte de réception"><div className="parent-inbox-head" aria-hidden="true"><span>Expéditeur</span><span>Sujet</span><span>Enfant</span><span>Date</span><span>Statut</span><span>Action</span></div>{filtered.length ? filtered.map((item) => <article className={item.status === "Non lu" ? "unread" : ""} key={item.id}><span className="parent-message-avatar" aria-hidden="true">{item.initials}</span><span className="parent-message-sender"><strong>{item.sender}</strong><small>{item.role}</small></span><span className="parent-message-subject"><strong>{item.subject}</strong><small>{item.body}</small></span><span>{item.child}</span><span>{item.date}</span><span className={`status-pill ${item.status === "Non lu" ? "danger" : item.status === "À signer" ? "warning" : "success"}`}>{item.status}</span><button className={item.status === "Non lu" ? "button button-green" : "button button-light"} type="button" onClick={() => setSelected(item)}>{item.status === "Non lu" ? "Lire" : "Ouvrir"} <ArrowRight aria-hidden="true" /></button></article>) : <div className="parent-list-empty"><EnvelopeSimple weight="duotone" aria-hidden="true" /><h2>Aucun message trouvé</h2><p>Essayez un autre filtre ou une autre recherche.</p></div>}</section>
    {selected && <section className="panel parent-message-reader" role="region" aria-labelledby="parent-reader-title" aria-live="polite"><div className="panel-heading"><div><span>{selected.sender}</span><h2 id="parent-reader-title">{selected.subject}</h2></div><button className="icon-button" type="button" onClick={() => setSelected(null)} aria-label="Fermer le message"><X aria-hidden="true" /></button></div><p>{selected.body}</p><div><span>{selected.child} · {selected.date}</span><button className="button button-dark" type="button" onClick={event => { openCompose(event); setSelected(null); }}>Répondre <PaperPlaneTilt aria-hidden="true" /></button></div></section>}
  </>;
}

function SettingsPage() {
  const [preferences, setPreferences] = useState(loadPreferences); const [status, setStatus] = useState("");
  const [profile, setProfile] = useState(() => loadParentProfile(localStorageOrNull()));
  const field = key => ({ value: profile[key], onChange: event => setProfile(current => ({ ...current, [key]: event.target.value })) });
  const update = (key) => setPreferences((current) => ({ ...current, [key]: !current[key] }));
  const handleSave = (event) => { event.preventDefault(); const result = saveParentProfile(localStorageOrNull(), profile); if (!result.ok) { setStatus(result.message); return; } setStatus(savePreferences(preferences) ? "Profil et préférences enregistrés sur cet appareil. Aucun envoi à l’école ni alerte e-mail." : "Profil enregistré, mais les préférences n’ont pas pu être conservées."); };
  return <>
    <PageHeader eyebrow="FAMILLE MANSOURI · PARAMÈTRES" title="Profil & préférences" subtitle="Gérez vos coordonnées, notifications et options de confidentialité." action={<button className="button button-dark" type="submit" form="parent-settings-form"><FloppyDisk aria-hidden="true" /> Enregistrer les modifications</button>} />
    <form id="parent-settings-form" className="parent-settings-layout" onSubmit={handleSave}><section className="panel parent-profile-settings" aria-labelledby="parent-profile-settings-title"><div className="parent-settings-identity"><span aria-hidden="true">YM</span><div><h2 id="parent-profile-settings-title">Youssef Mansouri</h2><p>Compte parent de démonstration · Lina</p></div><button className="button button-light" type="button" onClick={() => setStatus("Dans cette version, l’avatar est représenté par les initiales du parent.")}>Modifier la photo</button></div><div className="parent-profile-fields"><label>Nom complet<input {...field("name")} required /></label><label>Lien parental<select {...field("relationship")}><option>Parent</option><option>Tuteur légal</option></select></label><label>Ville<input {...field("city")} /></label><label>Langue préférée<select {...field("language")}><option>Français</option><option>العربية</option></select></label><label>E-mail<input type="email" {...field("email")} /></label><label>Téléphone<input type="tel" {...field("phone")} /></label><label className="wide">Adresse<input {...field("address")} /></label></div><p className="parent-inline-info success"><CheckCircle aria-hidden="true" /> Les modifications seront confirmées avec le bouton Enregistrer.</p></section>
      <aside className="parent-settings-side"><section className="parent-security-card" aria-labelledby="parent-security-title"><div><ShieldCheck weight="duotone" aria-hidden="true" /><span><h2 id="parent-security-title">Sécurité et notifications</h2><p>Préférences locales · aucun e-mail automatique</p></span></div><fieldset><legend>Gérer les préférences</legend>{[["devoirs", "Nouveaux devoirs"], ["progres", "Progrès importants"], ["bilanHebdomadaire", "Bilan hebdomadaire"], ["email", "Alertes par e-mail"]].map(([key, label]) => <label className="parent-switch-row" key={key}><span><strong>{label}</strong></span><input type="checkbox" checked={preferences[key]} onChange={() => update(key)} /></label>)}</fieldset></section><section className="panel parent-help-card"><div><span><UserCircle weight="duotone" aria-hidden="true" /></span><div><h2>Besoin d’aide ?</h2><p>Aucune assistance distante n’est activée dans cette démonstration. Pour une demande réelle, utilisez le contact habituel de votre établissement.</p></div></div><div><button className="button button-dark" type="button" onClick={() => setStatus("Démonstration : aucun message n’a été envoyé. Demandez de l’aide directement à votre établissement par son canal habituel.")}>Comment demander de l’aide</button><button className="button button-light" type="button" onClick={() => setStatus("Centre d’aide : rattachement d’un enfant, accès au compte et suivi des devoirs.")}>Centre d’aide familles</button></div></section><p className="parent-account-safe"><ShieldCheck weight="fill" aria-hidden="true" /> Données fictives limitées à cet appareil</p><p className="parent-form-status" role="status">{status}</p></aside>
    </form>
  </>;
}

function UnknownParentPage() { return <section className="parent-list-empty parent-page-empty" aria-labelledby="unknown-parent-title"><House weight="duotone" aria-hidden="true" /><h1 id="unknown-parent-title">Cette page parent n’existe pas</h1><p>Revenez à l’accueil de votre espace famille.</p><ParentLink to="/parent/tableau-de-bord" className="button button-dark">Retour à l’accueil <ArrowRight aria-hidden="true" /></ParentLink></section>; }

export function ParentLoginPage() {
  const account = DEMO_ACCOUNTS.parent; const { signIn } = useDemoStore(); const [identifier, setIdentifier] = useState(account.identifier); const [password, setPassword] = useState(account.password); const [visible, setVisible] = useState(false); const [message, setMessage] = useState(""); const [accessInfo, setAccessInfo] = useState("");
  const submit = (event) => { event.preventDefault(); const result = signIn("parent", { identifier, password }); if (!result.ok) { setMessage(result.message); return; } const requested = sessionStorage.getItem("jde.returnTo"); sessionStorage.removeItem("jde.returnTo"); parentNavigate(requested?.startsWith("/parent/") ? requested : "/parent/tableau-de-bord", { replace: true }); };
  return <div className="parent-login-page"><a className="skip-link" href="#parent-login-main">Aller au formulaire</a><aside className="parent-login-aside"><ParentLink to="/connexion" className="parent-login-back"><ArrowLeft aria-hidden="true" /> Choix du profil</ParentLink><img className="parent-login-logo" src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions" width="200" height="73" /><div className="parent-login-intro"><span className="parent-login-picture"><img src="/assets/parent-login-illustration-w07.png" alt="Illustration en pâte modelée d’une enseignante devant son tableau" width="1408" height="768" /></span><h1>Espace<br />Parent</h1><p>Accompagnez votre enfant avec une vision claire, rassurante et respectueuse de son autonomie.</p></div><ul><li><CheckCircle weight="fill" aria-hidden="true" /> Devoirs et échéances réunis</li><li><CheckCircle weight="fill" aria-hidden="true" /> Progression expliquée simplement</li><li><CheckCircle weight="fill" aria-hidden="true" /> Brouillons de messages locaux</li></ul></aside><main id="parent-login-main" className="parent-login-main" tabIndex="-1"><section className="parent-login-card"><span className="parent-login-badge"><Users weight="fill" aria-hidden="true" /> ESPACE PARENT</span><h2>Bienvenue dans la démo parent</h2><p>Retrouvez les informations utiles pour accompagner Lina au quotidien.</p><form onSubmit={submit}><label>Adresse e-mail du parent<input type="email" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required /></label><label>Mot de passe<span className="parent-password-field"><input type={visible ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{visible ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></span></label><div className="parent-login-options"><label><input type="checkbox" defaultChecked /> Rester connecté</label><ParentLink to="/mot-de-passe-oublie">Mot de passe oublié ?</ParentLink></div>{message && <p className="form-error" role="alert"><WarningCircle weight="fill" aria-hidden="true" /> {message}</p>}<button className="button button-green button-wide" type="submit">Accéder à ma famille <ArrowRight aria-hidden="true" /></button></form><button type="button" className="button button-light button-wide" onClick={() => setAccessInfo("Cette démonstration ne crée aucun compte parent réel. Le rattachement sécurisé sera disponible après la mise en place du service par l’établissement.")}>Créer un accès parent</button>{accessInfo && <p className="parent-form-status" role="status">{accessInfo}</p>}</section></main></div>;
}

export function ParentPages({ page, detail = null, search = "" }) {
  const store = useDemoStore();
  const { assignments, submissions, notifications, notify, currentUser } = store;
  const studentId = DEMO_ACCOUNTS.eleve.userId;
  const parentAssignments = useMemo(() => buildParentHomework(assignments, submissions, studentId), [assignments, submissions, studentId]);
  const summary = getParentLearningSummary(store, studentId);
  const parentNotifications = notifications.filter(item => item.userId ? item.userId === currentUser?.id : item.role === "parent");
  if (page === "tableau-de-bord") return <ParentDashboard assignments={parentAssignments} notifications={parentNotifications} summary={summary}/>;
  if (page === "enfants" && detail) return <ChildDetailPage childId={detail} assignments={parentAssignments} summary={summary}/>;
  if (page === "enfants") return <ChildrenListPage search={search}/>;
  if (page === "devoirs") return <HomeworkPage assignments={parentAssignments} search={search}/>;
  if (page === "progres") return <ProgressPage summary={summary} assignments={parentAssignments}/>;
  if (page === "messages") return <MessagesPage notifications={parentNotifications} notify={notify} currentUser={currentUser} search={search}/>;
  if (page === "parametres") return <SettingsPage/>;
  return <UnknownParentPage/>;
}

export default ParentPages;
