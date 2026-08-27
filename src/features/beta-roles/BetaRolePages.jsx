import { useMemo } from "react";
import {
  ArrowRight, Books, ChalkboardTeacher, ChartLineUp, Check, CheckCircle, ClipboardText,
  Gauge, GraduationCap, Key, PresentationChart, Student, Users, WarningCircle,
} from "@phosphor-icons/react/ssr";
import { useDemoStore } from "../../demoStore.jsx";
import { BETA_AS_OF, BETA_SCHOOL_SCOPE, BETA_TEACHER_SCOPE, createBetaFixtureDataset } from "../beta-data/betaFixtures.js";
import { buildKpiSnapshot } from "../beta-data/kpiCore.js";
import "./beta-roles.css";

function percent(value) { return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(value) || 0)} %`; }

function RoleDataNotice({ scope }) {
  return <div className="beta-role-notice"><CheckCircle weight="fill"/><div><strong>Indicateurs BETA calculés · {scope}</strong><span>Données pédagogiques fictives et pseudonymisées. Les dénominateurs restent visibles pour éviter les interprétations trompeuses.</span></div></div>;
}

function RoleKpis({ items }) {
  return <div className="beta-role-kpis">{items.map(([label, value, note, tone = "green"]) => <article key={label} className={`tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>;
}

function RoleActionList({ actions, resolutions, onResolve, RouteLink }) {
  const open = actions.filter((item) => resolutions.get(item.id) !== "resolved");
  return <div className="beta-role-actions">{open.map((item) => <article key={item.id} className={`priority-${item.priority}`}><span>{item.icon}</span><div><small>{item.meta}</small><strong>{item.title}</strong><p>{item.description}</p><footer><RouteLink to={item.route}>{item.action} <ArrowRight/></RouteLink><button onClick={() => onResolve(item.id, "resolved")}><Check/> Marquer traité</button></footer></div></article>)}{!open.length && <div className="beta-role-empty"><CheckCircle/><strong>Toutes les priorités sont traitées.</strong><span>Elles resteront enregistrées après rechargement.</span></div>}</div>;
}

export function BetaTeacherDashboard({ ui }) {
  const { PageHeader, RouteLink } = ui;
  const { assignments, submissions, classes } = useDemoStore();
  const teacherClasses = classes.filter((item) => item.teacherId === "user-enseignante-salma");
  const openReviews = submissions.filter((item) => item.status === "À corriger").length;
  const missingSubmissions = assignments.filter((item) => item.status === "Publié").reduce((sum, item) => sum + Math.max(0, Number(item.expectedSubmissions || 0) - Number(item.submissions || 0)), 0);
  return <>
    <PageHeader eyebrow="GROUPE SCOLAIRE AL MANAR · BETA" title="Bonjour Mme Benjelloun" subtitle="Un tableau de bord centré sur les prochaines décisions pédagogiques." action={<RouteLink to="/enseignant/devoirs" className="button button-green"><ClipboardText/> Créer un devoir</RouteLink>}/>
    <RoleDataNotice scope="4 classes · 112 élèves"/>
    <RoleKpis items={[["Élèves suivis", String(BETA_TEACHER_SCOPE.students), `${BETA_TEACHER_SCOPE.classes} classes`], ["Actifs cette semaine", String(BETA_TEACHER_SCOPE.weeklyActive), percent((BETA_TEACHER_SCOPE.weeklyActive / BETA_TEACHER_SCOPE.students) * 100)], ["Remises attendues", String(missingSubmissions), "Sur les devoirs publiés", "gold"], ["Corrections à faire", String(openReviews), "Remises enregistrées", openReviews ? "gold" : "green"]]}/>
    <section className="beta-role-grid"><article className="panel"><div className="beta-role-heading"><div><span>MES CLASSES</span><h2>Engagement de la semaine</h2></div><RouteLink to="/enseignant/classes">Voir toutes</RouteLink></div><div className="beta-role-class-list">{teacherClasses.map((item) => <article key={item.id}><span>{item.name.split(" · ").at(-1)}</span><div><strong>{item.name}</strong><small>{item.students} élèves · {item.activated} activés</small></div><i className={item.weeklyUsage < 60 ? "warning" : ""}>{item.weeklyUsage} % actifs</i></article>)}</div>{teacherClasses.length < BETA_TEACHER_SCOPE.classes && <p className="beta-role-footnote">Deux classes supplémentaires seront affichées après raccordement du référentiel établissement.</p>}</article><article className="panel beta-role-next"><span>PROCHAINE ACTION</span><PresentationChart weight="duotone"/><h2>Préparer les relances de devoirs</h2><p>{missingSubmissions} remises restent attendues. Commencez par les élèves dont l’échéance arrive cette semaine.</p><RouteLink to="/enseignant/actions" className="button button-light">Ouvrir mon centre d’actions <ArrowRight/></RouteLink></article></section>
  </>;
}

export function BetaTeacherActions({ ui }) {
  const { PageHeader, RouteLink } = ui;
  const { assignments, submissions, actionResolutions, resolveActionItem } = useDemoStore();
  const missing = assignments.filter((item) => item.status === "Publié").reduce((sum, item) => sum + Math.max(0, Number(item.expectedSubmissions || 0) - Number(item.submissions || 0)), 0);
  const reviews = submissions.filter((item) => item.status === "À corriger").length;
  const actions = [
    { id: "teacher-missing-submissions", priority: "high", icon: <ClipboardText/>, meta: `${missing} remises`, title: "Relancer les devoirs non remis", description: "Priorisez les échéances proches, puis proposez une aide adaptée sans stigmatiser l’élève.", route: "/enseignant/devoirs", action: "Voir les devoirs" },
    { id: "teacher-reviews", priority: reviews ? "high" : "low", icon: <CheckCircle/>, meta: `${reviews} correction(s)`, title: reviews ? "Corriger les remises reçues" : "Aucune remise en attente", description: reviews ? "Donnez un retour court, précis et actionnable avant la prochaine séance." : "La file de correction est à jour dans cette démonstration.", route: "/enseignant/devoirs", action: "Ouvrir les remises" },
    { id: "teacher-lexicon", priority: "medium", icon: <GraduationCap/>, meta: "Microcompétence LEX-01", title: "Renforcer le lexique en 5e B", description: "La réussite observée est sous 60 % sur l’échantillon BETA. Prévoir une activité de réemploi à l’oral.", route: "/enseignant/ressources", action: "Choisir une ressource" },
    { id: "teacher-inactivity", priority: "medium", icon: <Student/>, meta: "8 élèves", title: "Comprendre une baisse d’activité", description: "Vérifiez d’abord l’accès, l’équipement et la compréhension de la consigne avant toute relance.", route: "/enseignant/eleves", action: "Voir les élèves" },
  ];
  const resolutions = new Map(actionResolutions.map((item) => [item.actionId, item.status]));
  return <><PageHeader eyebrow="CENTRE D’ACTIONS ENSEIGNANT" title="Que faire maintenant ?" subtitle="Des priorités calculées, expliquées et traitables une par une."/><RoleDataNotice scope="Mme Benjelloun · semaine du 24 août"/><section className="panel"><div className="beta-role-heading"><div><span>PRIORITÉS</span><h2>{actions.filter((item) => resolutions.get(item.id) !== "resolved").length} actions ouvertes</h2></div></div><RoleActionList actions={actions} resolutions={resolutions} onResolve={resolveActionItem} RouteLink={RouteLink}/></section></>;
}

export function BetaDirectorDashboard({ ui }) {
  const { PageHeader, RouteLink } = ui;
  const { classes, staff } = useDemoStore();
  const dataset = useMemo(() => createBetaFixtureDataset(), []);
  const snapshot = useMemo(() => buildKpiSnapshot(dataset, { asOf: BETA_AS_OF, weekStart: "2026-08-24T00:00:00Z", weekEnd: "2026-08-30T23:59:59Z" }), [dataset]);
  const weakClasses = classes.filter((item) => item.weeklyUsage < 40 || item.activated / Math.max(1, item.students) < .85);
  const unassigned = classes.filter((item) => !item.teacherId).length;
  const activeStaff = Math.max(0, BETA_SCHOOL_SCOPE.teachers - staff.filter((item) => item.status === "À accompagner").length);
  return <>
    <PageHeader eyebrow="GROUPE SCOLAIRE AL MANAR · BETA" title="Piloter l’adoption pédagogique" subtitle="Une vue cohérente de l’activation, de l’usage utile et des points à accompagner." action={<RouteLink to="/directeur/actions" className="button button-dark">Voir les priorités <ArrowRight/></RouteLink>}/>
    <RoleDataNotice scope="654 élèves · 18 classes · 42 enseignants"/>
    <RoleKpis items={[["Élèves activés", `${BETA_SCHOOL_SCOPE.activated} / ${BETA_SCHOOL_SCOPE.students}`, percent((BETA_SCHOOL_SCOPE.activated / BETA_SCHOOL_SCOPE.students) * 100)], ["Activation utile J+7", percent(snapshot.usefulActivation.rate), `${snapshot.usefulActivation.numerator}/${snapshot.usefulActivation.denominator} sur l’échantillon BETA`], ["Valeur pédagogique", percent(snapshot.weeklyLearningValue.rate), `${snapshot.weeklyLearningValue.numerator}/${snapshot.weeklyLearningValue.denominator} cette semaine`], ["Enseignants actifs", `${activeStaff} / ${BETA_SCHOOL_SCOPE.teachers}`, "30 derniers jours", "gold"]]}/>
    <section className="beta-role-grid"><article className="panel"><div className="beta-role-heading"><div><span>CLASSES À ACCOMPAGNER</span><h2>{weakClasses.length} priorité(s) détectée(s)</h2></div><RouteLink to="/directeur/classes">Voir les classes</RouteLink></div><div className="beta-role-class-list">{weakClasses.map((item) => <article key={item.id}><span>{item.name.split(" · ").at(-1)}</span><div><strong>{item.name}</strong><small>{item.teacherId ? "Enseignant affecté" : "Aucun enseignant affecté"} · {item.activated}/{item.students} activés</small></div><i className="warning">{item.weeklyUsage} % actifs</i></article>)}</div></article><article className="panel beta-role-next"><span>À TRAITER</span><WarningCircle weight="duotone"/><h2>{unassigned} classe sans enseignant</h2><p>L’affectation est prioritaire avant d’interpréter le faible usage de la classe concernée.</p><RouteLink to="/directeur/actions" className="button button-light">Voir les actions <ArrowRight/></RouteLink></article></section>
  </>;
}

export function BetaDirectorActions({ ui }) {
  const { PageHeader, RouteLink } = ui;
  const { classes, staff, actionResolutions, resolveActionItem } = useDemoStore();
  const unassigned = classes.filter((item) => !item.teacherId);
  const lowUsage = classes.filter((item) => item.weeklyUsage < 40);
  const lowActivation = classes.filter((item) => item.activated / Math.max(1, item.students) < .85);
  const staffToSupport = staff.filter((item) => item.status === "À accompagner");
  const actions = [
    { id: "director-unassigned", priority: "high", icon: <ChalkboardTeacher/>, meta: `${unassigned.length} classe`, title: "Affecter un enseignant à la 6e AEP A", description: "Sans affectation, les relances d’usage et les comparaisons pédagogiques seraient trompeuses.", route: "/directeur/classes/classe-6a", action: "Gérer l’affectation" },
    { id: "director-low-activation", priority: "high", icon: <Key/>, meta: `${lowActivation.length} classe`, title: "Faire progresser l’activation sous 85 %", description: "Vérifiez la distribution des codes et les familles à accompagner avant une relance générale.", route: "/directeur/eleves/activation", action: "Voir les activations" },
    { id: "director-low-usage", priority: "medium", icon: <Gauge/>, meta: `${lowUsage.length} classe`, title: "Comprendre un usage inférieur à 40 %", description: "Croisez l’affectation, l’activation et le calendrier pédagogique avant de conclure à un manque d’engagement.", route: "/directeur/suivi-utilisation", action: "Analyser l’usage" },
    { id: "director-staff-support", priority: "medium", icon: <Users/>, meta: `${staffToSupport.length} enseignant`, title: "Organiser un accompagnement pédagogique", description: "Proposez un échange court sur les ressources et les tâches actionnelles les plus adaptées.", route: "/directeur/enseignants", action: "Voir l’équipe" },
  ];
  const resolutions = new Map(actionResolutions.map((item) => [item.actionId, item.status]));
  return <><PageHeader eyebrow="CENTRE D’ACTIONS DIRECTION" title="Priorités de l’établissement" subtitle="Chaque alerte relie un constat, une précaution d’interprétation et une action."/><RoleDataNotice scope="Groupe scolaire Al Manar"/><section className="panel"><div className="beta-role-heading"><div><span>PRIORITÉS</span><h2>{actions.filter((item) => resolutions.get(item.id) !== "resolved").length} actions ouvertes</h2></div></div><RoleActionList actions={actions} resolutions={resolutions} onResolve={resolveActionItem} RouteLink={RouteLink}/></section></>;
}

export function BetaRolePage({ role, page, ui }) {
  if (role === "enseignant" && page === "tableau-de-bord") return <BetaTeacherDashboard ui={ui}/>;
  if (role === "enseignant" && page === "actions") return <BetaTeacherActions ui={ui}/>;
  if (role === "directeur" && page === "tableau-de-bord") return <BetaDirectorDashboard ui={ui}/>;
  if (role === "directeur" && page === "actions") return <BetaDirectorActions ui={ui}/>;
  return null;
}
