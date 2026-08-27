import { useMemo, useRef, useState } from "react";
import {
  Archive, ArrowClockwise, ArrowRight, Books, Check, CheckCircle, Clock, CloudArrowUp,
  DownloadSimple, Eye, FileCsv, FileText, Funnel, Gauge, HardDrives, Image, Info,
  Key, ListChecks, PencilSimple, Plus, ShieldCheck, Tag, Trash, WarningCircle, X,
} from "@phosphor-icons/react/ssr";
import { useDemoStore } from "../../demoStore.jsx";
import { buildContentImportPlan, escapeCsvCell } from "../beta-data/csvImportCore.js";
import { buildKpiSnapshot } from "../beta-data/kpiCore.js";
import { profileLearningDataQuality } from "../beta-data/dataQualityCore.js";
import {
  BETA_ACTION_ITEMS, BETA_AS_OF, BETA_NETWORK_SCOPE, BETA_SCHOOL_SCOPE,
  BETA_TEACHER_SCOPE, createBetaFixtureDataset,
} from "../beta-data/betaFixtures.js";
import { LEARNING_COMPETENCIES } from "../beta-data/learningTaxonomy.js";
import "./beta-admin.css";

const STATUS_OPTIONS = ["Brouillon", "À réviser", "Planifié", "Publié", "Archivé"];
const FAMILY_LABELS = { levels: "Niveaux AEP", units: "Unités", domains: "Domaines", competencies: "Microcompétences", audiences: "Publics", formats: "Formats" };

function downloadText(fileName, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = fileName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(value) || 0)} %`;
}

function BetaNotice() {
  return <div className="beta-source-note" role="note"><ShieldCheck weight="fill"/><div><strong>Version BETA · données de démonstration</strong><span>Les calculs sont réels sur un jeu fictif, sans données personnelles. Connectez les sources métier avant de prendre une décision opérationnelle.</span></div></div>;
}

function DecisionKpi({ label, value, detail, definition, period, trend, tone = "green" }) {
  return <article className={`beta-decision-kpi tone-${tone}`}>
    <div><span>{label}</span><i>{trend}</i></div>
    <strong>{value}</strong>
    <p>{detail}</p>
    <details><summary>Définition et périmètre</summary><span>{definition}</span><small>{period} · actualisé le 27 août 2026 à 11 h 45</small></details>
  </article>;
}

function KpiSet({ snapshot }) {
  const activation = snapshot.usefulActivation;
  const weekly = snapshot.weeklyLearningValue;
  const progress = snapshot.competencyProgress;
  return <div className="beta-kpi-grid">
    <DecisionKpi label="Activation utile à J+7" value={formatPercent(activation.rate)} detail={`${activation.numerator} élèves actifs sur ${activation.denominator} accès arrivés à J+7 · ${activation.pending} en attente`} definition="Accès attribués, puis manuel activé et première action pédagogique de valeur dans les sept jours." period="Cohortes du 8 au 20 août · Al Manar" trend="+ 5,6 pts"/>
    <DecisionKpi label="Valeur pédagogique hebdomadaire" value={formatPercent(weekly.rate)} detail={`${weekly.numerator} élèves engagés sur ${weekly.denominator} activés éligibles`} definition="Élèves ayant terminé une leçon, une activité, un jeu ou remis un devoir durant la semaine. Une simple connexion ne compte pas." period="24–30 août · Al Manar" trend="+ 3,2 pts" tone="gold"/>
    <DecisionKpi label="Progression comparable à 28 jours" value={`+ ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(progress.medianDeltaPoints)} pts`} detail={`${progress.comparablePairs} paires comparables · couverture ${formatPercent(progress.coverageRate)}`} definition="Médiane de l’évolution normalisée, pour une même microcompétence, une même famille d’évaluation et un même élève." period="30 juillet–27 août · échantillon BETA" trend={`${formatPercent(progress.improvedRate)} en progrès`} tone="blue"/>
  </div>;
}

export function BetaAdminDashboard({ ui }) {
  const { contents, mediaAssets, importJobs, supportTickets, licenseLots, actionResolutions, resolveActionItem } = useDemoStore();
  const { RouteLink } = ui;
  const dataset = useMemo(() => createBetaFixtureDataset(), []);
  const snapshot = useMemo(() => buildKpiSnapshot(dataset, { asOf: BETA_AS_OF, weekStart: "2026-08-24T00:00:00Z", weekEnd: "2026-08-30T23:59:59Z" }), [dataset]);
  const resolved = new Map(actionResolutions.map((item) => [item.actionId, item.status]));
  const activeActions = BETA_ACTION_ITEMS.filter((item) => resolved.get(item.id) !== "resolved");
  const contentQueue = contents.filter((item) => ["À réviser", "Brouillon"].includes(item.status)).length;
  const incompleteMedia = mediaAssets.filter((item) => item.status !== "Prêt").length;
  const urgentTickets = supportTickets.filter((item) => item.priority === "Haute").length;
  const renewingLots = licenseLots.filter((item) => item.status === "À renouveler").length;
  return <>
    <div className="beta-admin-hero"><div><span>JET D’ENCRE · BETA</span><h1>Votre cockpit de pilotage</h1><p>Les priorités du jour, les résultats pédagogiques et les outils de mise à jour au même endroit.</p></div><div className="beta-release"><strong>BETA</strong><span>Socle sans IA</span></div></div>
    <BetaNotice/>
    <KpiSet snapshot={snapshot}/>
    <section className="beta-operations-grid">
      <article className="panel beta-action-center">
        <div className="beta-section-heading"><div><span>À TRAITER AUJOURD’HUI</span><h2>{activeActions.length} actions utiles</h2></div><RouteLink to="/admin/analyses" className="button button-light"><Gauge/> Voir les analyses</RouteLink></div>
        <div className="beta-action-list">{activeActions.map((item) => <article key={item.id} className={`priority-${item.priority}`}><span className="beta-action-icon">{item.type === "content" ? <Books/> : item.type === "media" ? <Image/> : item.type === "import" ? <FileCsv/> : item.type === "license" ? <Key/> : <HardDrives/>}</span><div><small>{item.dueLabel}</small><strong>{item.title}</strong><p>{item.description}</p><span><RouteLink to={item.route}>{item.actionLabel} <ArrowRight/></RouteLink><button type="button" onClick={() => resolveActionItem(item.id, "resolved")}><Check/> Marquer traité</button></span></div></article>)}</div>
        {!activeActions.length && <div className="beta-empty"><CheckCircle weight="duotone"/><strong>Tout est traité pour aujourd’hui.</strong><button type="button" onClick={() => BETA_ACTION_ITEMS.forEach((item) => resolveActionItem(item.id, "open"))}>Rouvrir la démonstration</button></div>}
      </article>
      <aside className="panel beta-update-hub"><div className="beta-section-heading"><div><span>MISE À JOUR DU SITE</span><h2>Accès directs</h2></div></div>
        <RouteLink to="/admin/imports"><FileCsv/><span><strong>Importer un fichier</strong><small>Vérification avant application</small></span><i>{importJobs.length}</i></RouteLink>
        <RouteLink to="/admin/bibliotheque"><Books/><span><strong>Gérer les contenus</strong><small>Sélection, versions et statuts</small></span><i>{contentQueue}</i></RouteLink>
        <RouteLink to="/admin/medias"><Image/><span><strong>Contrôler les médias</strong><small>Droits et accessibilité</small></span><i>{incompleteMedia}</i></RouteLink>
        <RouteLink to="/admin/referentiels"><Tag/><span><strong>Modifier les référentiels</strong><small>Niveaux, compétences, publics</small></span><ArrowRight/></RouteLink>
      </aside>
    </section>
    <div className="beta-mini-metrics">
      <article><span>Réseau</span><strong>{BETA_NETWORK_SCOPE.establishments}</strong><small>établissements actifs</small></article>
      <article><span>Contenus</span><strong>{contents.filter((item) => item.status === "Publié").length}</strong><small>publiés dans cette démonstration</small></article>
      <article><span>Support</span><strong>{urgentTickets}</strong><small>tickets prioritaires</small></article>
      <article><span>Licences</span><strong>{renewingLots}</strong><small>lot à renouveler</small></article>
    </div>
  </>;
}

export function BetaAnalytics({ ui }) {
  const { PageHeader } = ui;
  const { contents, mediaAssets, referenceItems } = useDemoStore();
  const [scope, setScope] = useState("school");
  const [tab, setTab] = useState("overview");
  const dataset = useMemo(() => createBetaFixtureDataset(), []);
  const snapshot = useMemo(() => buildKpiSnapshot(dataset, { asOf: BETA_AS_OF, weekStart: "2026-08-24T00:00:00Z", weekEnd: "2026-08-30T23:59:59Z" }), [dataset]);
  const quality = useMemo(() => profileLearningDataQuality({ ...dataset, references: { competencyCodes: LEARNING_COMPETENCIES.map((item) => item.code), contentIds: ["fixture-manual-fr5"] }, now: BETA_AS_OF }), [dataset]);
  const exportKpis = () => {
    const rows = [
      ["indicateur", "valeur", "numerateur", "denominateur", "periode", "source"],
      ["activation_utile_j7", snapshot.usefulActivation.rate, snapshot.usefulActivation.numerator, snapshot.usefulActivation.denominator, "2026-08-08/2026-08-20", "fixture_beta"],
      ["valeur_pedagogique_hebdo", snapshot.weeklyLearningValue.rate, snapshot.weeklyLearningValue.numerator, snapshot.weeklyLearningValue.denominator, "2026-08-24/2026-08-30", "fixture_beta"],
      ["progression_28j", snapshot.competencyProgress.medianDeltaPoints, snapshot.competencyProgress.comparablePairs, snapshot.competencyProgress.eligibleSubjects, "2026-07-30/2026-08-27", "fixture_beta"],
    ];
    downloadText("jet-dencre-beta-indicateurs.csv", rows.map((row) => row.map(escapeCsvCell).join(";")).join("\r\n"));
  };
  return <>
    <PageHeader eyebrow="CENTRE DÉCISIONNEL" title="Analyses et qualité des données" subtitle="Des indicateurs définis, traçables et accompagnés de leurs dénominateurs." action={<button className="button button-light" onClick={exportKpis}><DownloadSimple/> Exporter les indicateurs</button>}/>
    <BetaNotice/>
    <div className="beta-filter-row"><label>Périmètre<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="network">Réseau · {BETA_NETWORK_SCOPE.establishments} établissements</option><option value="school">{BETA_SCHOOL_SCOPE.label}</option><option value="teacher">{BETA_TEACHER_SCOPE.label}</option></select></label><label>Période<select defaultValue="28"><option value="7">7 derniers jours</option><option value="28">28 derniers jours</option><option value="school-year">Année scolaire</option></select></label><span><Clock/> Fraîcheur : 15 minutes</span></div>
    <div className="beta-tabs" role="tablist">{[["overview", "Vue générale"], ["content", "Contenus"], ["adoption", "Adoption"], ["quality", "Qualité des données"]].map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === "overview" && <><KpiSet snapshot={snapshot}/><section className="beta-analytics-grid"><article className="panel"><div className="beta-section-heading"><div><span>PAR NIVEAU</span><h2>Élèves avec une action de valeur</h2></div></div><div className="beta-horizontal-bars">{[["1re AEP", 58], ["2e AEP", 66], ["3e AEP", 71], ["4e AEP", 74], ["5e AEP", 82], ["6e AEP", 69]].map(([label, value]) => <div key={label}><span>{label}</span><i><b style={{ width: `${value}%` }}/></i><strong>{value} %</strong></div>)}</div></article><article className="panel beta-insights"><div className="beta-section-heading"><div><span>LECTURE OPÉRATIONNELLE</span><h2>Ce que les données suggèrent</h2></div></div><article><CheckCircle/><div><strong>La 5e AEP est le niveau le plus engagé</strong><span>Vérifier si les séquences et jeux de ce niveau peuvent être adaptés aux autres niveaux.</span></div></article><article><WarningCircle/><div><strong>La 1re AEP reste sous 60 %</strong><span>Contrôler l’activation, l’équipement et l’accompagnement enseignant avant d’interpréter la performance.</span></div></article><article><Info/><div><strong>La progression couvre {formatPercent(snapshot.competencyProgress.coverageRate)}</strong><span>La tendance est informative, mais pas encore représentative de tous les élèves.</span></div></article></article></section></>}
    {tab === "content" && <section className="beta-analytics-grid"><article className="panel"><h2>Cycle éditorial</h2><div className="beta-status-breakdown">{STATUS_OPTIONS.map((status) => <div key={status}><span>{status}</span><strong>{contents.filter((item) => item.status === status).length}</strong></div>)}</div></article><article className="panel"><h2>Préparation des médias</h2><div className="beta-status-breakdown"><div><span>Prêts</span><strong>{mediaAssets.filter((item) => item.status === "Prêt").length}</strong></div><div><span>À compléter</span><strong>{mediaAssets.filter((item) => item.status !== "Prêt").length}</strong></div><div><span>Référentiels actifs</span><strong>{referenceItems.filter((item) => item.active).length}</strong></div></div></article></section>}
    {tab === "adoption" && <section className="beta-analytics-grid"><article className="panel"><h2>Activation du réseau</h2><div className="beta-big-ratio"><strong>{formatPercent((BETA_NETWORK_SCOPE.licensesActivated / BETA_NETWORK_SCOPE.licensesIssued) * 100)}</strong><span>{new Intl.NumberFormat("fr-FR").format(BETA_NETWORK_SCOPE.licensesActivated)} activés sur {new Intl.NumberFormat("fr-FR").format(BETA_NETWORK_SCOPE.licensesIssued)} émis</span></div></article><article className="panel"><h2>Périmètre enseignant</h2><div className="beta-big-ratio"><strong>{formatPercent((BETA_TEACHER_SCOPE.weeklyActive / BETA_TEACHER_SCOPE.students) * 100)}</strong><span>{BETA_TEACHER_SCOPE.weeklyActive} élèves actifs sur {BETA_TEACHER_SCOPE.students} · {BETA_TEACHER_SCOPE.classes} classes</span></div></article></section>}
    {tab === "quality" && <section className="panel beta-quality-panel"><div className="beta-quality-summary"><span className={quality.readyForDecision ? "ready" : "blocked"}>{quality.readyForDecision ? <CheckCircle/> : <WarningCircle/>}</span><div><h2>{quality.readyForDecision ? "Jeu BETA calculable" : "Décision bloquée"}</h2><p>{quality.coverage.events} événements · {quality.coverage.accesses} accès · {quality.coverage.assessments} évaluations · fraîcheur {quality.freshnessHours} h</p></div><i>Données fictives</i></div><div className="beta-quality-list">{quality.findings.length ? quality.findings.map((item) => <article key={item.code}><span className={`status-pill ${item.severity === "critical" ? "danger" : "warning"}`}>{item.severity === "critical" ? "Bloquant" : "À surveiller"}</span><strong>{item.label}</strong><small>{item.count} occurrence(s) · {formatPercent(item.rate)}</small></article>) : <article><span className="status-pill success">Conforme</span><strong>Aucun défaut détecté sur le jeu BETA</strong></article>}</div></section>}
  </>;
}

const SAMPLE_CSV = "external_id;type;title;summary;language;aep_levels;unit_code;competency_codes;cefr_targets;audience;status;rights_holder;license_type;rights_valid_until;media_url;media_alt;transcript_url\r\nACT-2026-051;activity;Décrire mon quartier;Une activité orale guidée;fr;5e AEP;Unité 3;ORAL-PRO-01|LEX-01;A1|A1;Élèves;Brouillon;Jet d’Encre Éditions;Licence scolaire;2028-08-31;;;\r\nAUD-2026-019;audio;Les sons de la médina;Écouter et repérer des informations;fr;4e AEP;Unité 2;ORAL-REP-02;A1;Élèves et enseignants;Brouillon;Studio Atlas;Licence scolaire Maroc;2027-06-30;;Description du paysage sonore;transcription.pdf";

export function BetaImports({ ui }) {
  const { PageHeader } = ui;
  const { contents, importJobs, applyContentImport, rollbackImportJob } = useDemoStore();
  const [fileName, setFileName] = useState(""); const [csv, setCsv] = useState(""); const [notice, setNotice] = useState("");
  const inputRef = useRef(null);
  const plan = useMemo(() => csv ? buildContentImportPlan(contents, csv, { now: BETA_AS_OF }) : null, [contents, csv]);
  const loadFile = (file) => { if (!file) return; setFileName(file.name); const reader = new FileReader(); reader.onload = () => setCsv(String(reader.result || "")); reader.readAsText(file, "utf-8"); };
  const commitImport = () => { const result = applyContentImport(plan, { fileName: fileName || "contenus.csv" }); if (result.ok) { setNotice(`${result.job.created} contenu(s) créé(s), ${result.job.updated} mis à jour.`); setCsv(""); setFileName(""); } else setNotice(result.message); };
  return <>
    <PageHeader eyebrow="CENTRE D’IMPORT" title="Mettre le site à jour par fichier" subtitle="Prévisualisez chaque changement, corrigez les erreurs puis confirmez l’opération." action={<button className="button button-light" onClick={() => downloadText("modele-import-contenus.csv", SAMPLE_CSV)}><DownloadSimple/> Télécharger le modèle</button>}/>
    <BetaNotice/>
    {notice && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Opération terminée</strong><small>{notice}</small></span></div>}
    <section className="beta-import-grid"><article className="panel beta-import-drop"><div className="beta-section-heading"><div><span>ÉTAPE 1</span><h2>Choisir le fichier de contenus</h2></div></div><p>CSV Excel en français accepté : séparateur point-virgule ou virgule, accents et champs entre guillemets.</p><button type="button" className="beta-dropzone" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); loadFile(event.dataTransfer.files[0]); }}><input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => loadFile(event.target.files[0])}/><CloudArrowUp weight="duotone"/><strong>{fileName || "Déposer un fichier CSV"}</strong><span>{fileName ? "Fichier chargé · vérification automatique ci-contre" : "ou cliquer pour parcourir"}</span></button><button className="button button-light" type="button" onClick={() => { setFileName("exemple-contenus.csv"); setCsv(SAMPLE_CSV); }}><FileCsv/> Charger un exemple valide</button></article>
      <article className="panel beta-import-preview"><div className="beta-section-heading"><div><span>ÉTAPE 2</span><h2>Résultat de la vérification</h2></div></div>{!plan ? <div className="beta-empty"><FileCsv/><strong>Aucun fichier à vérifier</strong><span>Chargez votre CSV pour voir créations, mises à jour et erreurs avant toute modification.</span></div> : <><div className="beta-import-counts"><article><span>Créations</span><strong>{plan.summary.create}</strong></article><article><span>Mises à jour</span><strong>{plan.summary.update}</strong></article><article><span>Sans changement</span><strong>{plan.summary.unchanged}</strong></article><article className={plan.summary.rejected ? "has-error" : ""}><span>Rejets</span><strong>{plan.summary.rejected}</strong></article></div>{plan.errors.length > 0 && <div className="beta-error-list" role="alert">{plan.errors.slice(0, 8).map((error, index) => <article key={`${error.row}-${error.field}-${index}`}><WarningCircle/><span><strong>Ligne {error.row} · {error.field}</strong><small>{error.message}</small></span></article>)}</div>}<button className="button button-dark button-wide" disabled={!plan.ok || plan.operations.every((item) => item.type === "unchanged")} onClick={commitImport}><CheckCircle/> Confirmer l’import</button><small className="beta-import-safety"><ShieldCheck/> Import atomique : aucune ligne n’est appliquée tant qu’une erreur subsiste.</small></>}</article></section>
    <section className="panel beta-history"><div className="beta-section-heading"><div><span>HISTORIQUE</span><h2>Imports récents</h2></div></div>{importJobs.length ? <div>{importJobs.map((job) => <article key={job.id}><FileCsv/><span><strong>{job.fileName}</strong><small>{new Date(job.createdAt).toLocaleString("fr-FR")} · {job.created} création(s), {job.updated} mise(s) à jour</small></span><i className={`status-pill ${job.status === "rolled_back" ? "neutral" : "success"}`}>{job.status === "rolled_back" ? "Annulé" : "Terminé"}</i><button className="button button-light" disabled={job.status === "rolled_back"} onClick={() => { const result = rollbackImportJob(job.id); setNotice(result.rolledBack ? "L’import a été annulé sans supprimer son historique." : "Cet import était déjà annulé."); }}><ArrowClockwise/> Annuler</button></article>)}</div> : <div className="beta-empty"><Clock/><strong>Aucun import confirmé</strong><span>Les opérations apparaîtront ici avec une possibilité d’annulation.</span></div>}</section>
  </>;
}

export function BetaReferentials({ ui }) {
  const { PageHeader } = ui;
  const { referenceItems, upsertReferenceItem, toggleReferenceItem } = useDemoStore();
  const [family, setFamily] = useState("competencies"); const [open, setOpen] = useState(false); const [form, setForm] = useState({ label: "", code: "" }); const [notice, setNotice] = useState("");
  const items = referenceItems.filter((item) => item.family === family);
  const submit = (event) => { event.preventDefault(); const result = upsertReferenceItem({ family, label: form.label, code: form.code || undefined }); if (result.ok) { setForm({ label: "", code: "" }); setOpen(false); setNotice("Le référentiel a été mis à jour."); } else setNotice(result.message); };
  return <>
    <PageHeader eyebrow="RÉFÉRENTIELS PARTAGÉS" title="Classer une fois, réutiliser partout" subtitle="Les niveaux, domaines, microcompétences et publics alimentent le studio, la bibliothèque et les imports." action={<button className="button button-dark" onClick={() => setOpen((value) => !value)}><Plus/> Ajouter un élément</button>}/>
    {notice && <div className="editor-success" role="status"><CheckCircle/><span><strong>Mise à jour</strong><small>{notice}</small></span></div>}
    <div className="beta-tabs" role="tablist">{Object.entries(FAMILY_LABELS).map(([key, label]) => <button key={key} role="tab" aria-selected={family === key} className={family === key ? "active" : ""} onClick={() => setFamily(key)}>{label}</button>)}</div>
    {open && <form className="panel beta-reference-form" onSubmit={submit}><label>Libellé<input required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })}/></label><label>Code stable<input value={form.code} placeholder="Généré si vide" onChange={(event) => setForm({ ...form, code: event.target.value })}/></label><button className="button button-dark" type="submit"><Check/> Enregistrer</button><button className="button button-light" type="button" onClick={() => setOpen(false)}><X/> Fermer</button></form>}
    <section className="panel beta-reference-list"><div className="beta-section-heading"><div><span>{FAMILY_LABELS[family]?.toUpperCase()}</span><h2>{items.filter((item) => item.active).length} actifs sur {items.length}</h2></div><span className="status-pill neutral">Source unique BETA</span></div><div>{items.map((item) => <article key={item.id}><span className="beta-code">{item.code}</span><div><strong>{item.label}</strong>{item.domainCode && <small>Domaine : {item.domainCode}</small>}</div>{item.system && <i>Système</i>}<button type="button" className={item.active ? "active" : ""} aria-pressed={item.active} onClick={() => { const result = toggleReferenceItem(item.id, !item.active); setNotice(result.ok ? `${item.label} est maintenant ${!item.active ? "actif" : "inactif"}.` : result.message); }}><span>{item.active ? "Actif" : "Inactif"}</span><b/></button></article>)}</div></section>
  </>;
}

export function BetaMedia({ ui }) {
  const { PageHeader } = ui;
  const { mediaAssets, upsertMediaAsset } = useDemoStore();
  const [editingId, setEditingId] = useState(mediaAssets[0]?.id || null); const selected = mediaAssets.find((item) => item.id === editingId) || mediaAssets[0];
  const [draft, setDraft] = useState(selected || {}); const [notice, setNotice] = useState("");
  const edit = (asset) => { setEditingId(asset.id); setDraft(asset); setNotice(""); };
  const save = (event) => { event.preventDefault(); const result = upsertMediaAsset(draft); if (result.ok) { setDraft(result.asset); setNotice("La fiche média a été enregistrée."); } else setNotice(result.message); };
  const incomplete = mediaAssets.filter((item) => item.status !== "Prêt").length;
  return <>
    <PageHeader eyebrow="MÉDIATHÈQUE ADMIN" title="Droits, accessibilité et médias" subtitle="Aucun média ne peut être publié sans une fiche exploitable et vérifiée."/>
    <BetaNotice/>
    <div className="beta-media-metrics"><article><CheckCircle/><span><strong>{mediaAssets.length - incomplete}</strong><small>médias prêts</small></span></article><article><WarningCircle/><span><strong>{incomplete}</strong><small>fiches à compléter</small></span></article><article><ShieldCheck/><span><strong>{mediaAssets.filter((item) => item.owner && item.license).length}</strong><small>droits renseignés</small></span></article></div>
    <section className="beta-media-layout"><div className="panel beta-media-list"><h2>Fichiers référencés</h2>{mediaAssets.map((asset) => <button key={asset.id} className={editingId === asset.id ? "active" : ""} onClick={() => edit(asset)}><Image/><span><strong>{asset.name}</strong><small>{asset.type} · {asset.owner || "Titulaire manquant"}</small></span><i className={`status-pill ${asset.status === "Prêt" ? "success" : "warning"}`}>{asset.status}</i></button>)}</div>
      {selected && <form className="panel beta-media-form" onSubmit={save}><div className="beta-section-heading"><div><span>FICHE MÉDIA</span><h2>{draft.name}</h2></div><span className={`status-pill ${draft.status === "Prêt" ? "success" : "warning"}`}>{draft.status}</span></div><div className="form-two"><label>Type<select value={draft.type || "image"} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option>image</option><option>audio</option><option>video</option><option>ebook</option></select></label><label>Échéance des droits<input type="date" value={draft.validUntil || ""} onChange={(event) => setDraft({ ...draft, validUntil: event.target.value })}/></label></div><label>Titulaire des droits<input value={draft.owner || ""} onChange={(event) => setDraft({ ...draft, owner: event.target.value })}/></label><label>Licence / autorisation<input value={draft.license || ""} onChange={(event) => setDraft({ ...draft, license: event.target.value })}/></label><div className="beta-check-grid"><label><input type="checkbox" checked={Boolean(draft.altReady)} onChange={(event) => setDraft({ ...draft, altReady: event.target.checked })}/> Description accessible prête</label>{["audio", "video"].includes(draft.type) && <label><input type="checkbox" checked={Boolean(draft.transcriptReady)} onChange={(event) => setDraft({ ...draft, transcriptReady: event.target.checked })}/> Transcription prête</label>}{draft.type === "video" && <label><input type="checkbox" checked={Boolean(draft.captionsReady)} onChange={(event) => setDraft({ ...draft, captionsReady: event.target.checked })}/> Sous-titres prêts</label>}</div>{notice && <p className="beta-form-notice" role="status">{notice}</p>}<button className="button button-dark" type="submit"><Check/> Enregistrer la fiche</button></form>}
    </section>
  </>;
}

export function BetaContentStudio({ ui }) {
  const { PageHeader, RouteLink } = ui;
  const { referenceItems, createContent, notify } = useDemoStore();
  const active = (family) => referenceItems.filter((item) => item.family === family && item.active);
  const levels = active("levels"), units = active("units"), competencies = active("competencies"), audiences = active("audiences"), formats = active("formats");
  const [form, setForm] = useState({ title: "", summary: "", format: formats[0]?.label || "Documentaire", level: levels[0]?.label || "1re AEP", unit: units[0]?.label || "Unité 1", competencyCodes: [], visibility: audiences[2]?.label || "Élèves et enseignants", objective: "", rightsHolder: "", license: "", rightsUntil: "2027-08-31", altReady: false, transcriptReady: false, captionsReady: false });
  const [file, setFile] = useState(null); const [notice, setNotice] = useState("");
  const requiresTranscript = form.format === "Podcast" || form.format === "Documentaire";
  const requiresCaptions = form.format === "Documentaire";
  const readiness = [
    [Boolean(form.title.trim() && form.summary.trim()), "Titre et résumé"],
    [form.competencyCodes.length > 0 && Boolean(form.objective.trim()), "Objectif et microcompétence"],
    [Boolean(form.rightsHolder.trim() && form.license.trim() && form.rightsUntil), "Droits du média"],
    [form.format === "Article" || Boolean(file), "Fichier média"],
    [form.format === "Article" || form.altReady, "Description accessible"],
    [!requiresTranscript || form.transcriptReady, "Transcription"],
    [!requiresCaptions || form.captionsReady, "Sous-titres"],
  ];
  const ready = readiness.every(([ok]) => ok);
  const toggleCompetency = (code) => setForm((current) => ({ ...current, competencyCodes: current.competencyCodes.includes(code) ? current.competencyCodes.filter((item) => item !== code) : [...current.competencyCodes, code] }));
  const save = (status) => {
    const result = createContent({ title: form.title, summary: form.summary, type: form.format, level: form.level, unit: form.unit, competencies: form.competencyCodes, learningObjectives: [form.objective].filter(Boolean), visibility: form.visibility, status, fileName: file?.name || null, rights: { holder: form.rightsHolder, licenseType: form.license, validUntil: form.rightsUntil, territories: ["MA"] }, accessibility: { altReady: form.altReady, transcriptReady: form.transcriptReady, captionsReady: form.captionsReady } });
    if (result.ok) { setNotice(status === "À réviser" ? "Le contenu a été créé, versionné et envoyé dans la file éditoriale." : "Le brouillon a été créé et versionné."); notify({ role: "admin", title: status === "À réviser" ? "Contenu à valider" : "Brouillon enregistré", message: form.title, action: "/admin/bibliotheque" }); }
    else setNotice(result.message);
  };
  return <>
    <PageHeader eyebrow="STUDIO BETA" title="Créer un contenu administrable" subtitle="Tous les champs de classement utilisent les référentiels partagés de l’administration." action={<RouteLink to="/admin/bibliotheque" className="button button-light"><ArrowRight/> Voir la bibliothèque</RouteLink>}/>
    {notice && <div className="editor-success" role="status"><CheckCircle/><span><strong>Contenu enregistré</strong><small>{notice}</small></span></div>}
    <section className="beta-studio-layout"><form className="panel beta-studio-form" onSubmit={(event) => { event.preventDefault(); if (ready) save("À réviser"); }}><div className="beta-section-heading"><div><span>FICHE ÉDITORIALE</span><h2>Décrire et classer</h2></div><span className="status-pill neutral">Référentiels BETA</span></div><label>Titre public<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label><label>Résumé pédagogique<textarea required value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })}/></label><div className="form-two"><label>Format<select value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })}>{formats.map((item) => <option key={item.id}>{item.label}</option>)}</select></label><label>Public<select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>{audiences.map((item) => <option key={item.id}>{item.label}</option>)}</select></label></div><div className="form-two"><label>Niveau AEP<select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>{levels.map((item) => <option key={item.id}>{item.label}</option>)}</select></label><label>Unité<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{units.map((item) => <option key={item.id}>{item.label}</option>)}</select></label></div><label>Objectif d’apprentissage<input value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} placeholder="À la fin, l’élève sera capable de…"/></label><fieldset className="beta-competency-picker"><legend>Microcompétences</legend>{competencies.map((item) => <label key={item.id}><input type="checkbox" checked={form.competencyCodes.includes(item.code)} onChange={() => toggleCompetency(item.code)}/><span><strong>{item.code}</strong>{item.label}</span></label>)}</fieldset><div className="beta-file-field"><span>Fichier source</span><label><input type="file" accept=".pdf,.epub,.mp3,.mp4,.webm,.png,.jpg,.webp" onChange={(event) => setFile(event.target.files[0] || null)}/><CloudArrowUp/><strong>{file?.name || "Choisir un fichier"}</strong></label><small>La prévisualisation locale conserve seulement le nom ; le Worker BETA est prêt pour le stockage privé R2.</small></div><div className="form-two"><label>Titulaire des droits<input value={form.rightsHolder} onChange={(event) => setForm({ ...form, rightsHolder: event.target.value })}/></label><label>Licence / autorisation<input value={form.license} onChange={(event) => setForm({ ...form, license: event.target.value })}/></label></div><label>Échéance des droits<input type="date" value={form.rightsUntil} onChange={(event) => setForm({ ...form, rightsUntil: event.target.value })}/></label><div className="beta-check-grid"><label><input type="checkbox" checked={form.altReady} onChange={(event) => setForm({ ...form, altReady: event.target.checked })}/> Description accessible prête</label>{requiresTranscript && <label><input type="checkbox" checked={form.transcriptReady} onChange={(event) => setForm({ ...form, transcriptReady: event.target.checked })}/> Transcription prête</label>}{requiresCaptions && <label><input type="checkbox" checked={form.captionsReady} onChange={(event) => setForm({ ...form, captionsReady: event.target.checked })}/> Sous-titres prêts</label>}</div><div className="beta-studio-actions"><button type="button" className="button button-light" disabled={!form.title.trim()} onClick={() => save("Brouillon")}><PencilSimple/> Enregistrer le brouillon</button><button type="submit" className="button button-dark" disabled={!ready}><CheckCircle/> Envoyer en validation</button></div></form><aside className="panel beta-readiness"><span>PRÉPARATION À LA REVUE</span><strong>{readiness.filter(([ok]) => ok).length} / {readiness.length}</strong><div>{readiness.map(([ok, label]) => <p key={label} className={ok ? "ready" : ""}>{ok ? <CheckCircle/> : <WarningCircle/>}<span>{label}</span></p>)}</div><small>Une publication directe est volontairement impossible. Le contenu passe d’abord par la revue FLE, pédagogique et accessibilité.</small></aside></section>
  </>;
}

export function BetaContentLibrary({ search = "", ui }) {
  const { PageHeader, RouteLink } = ui;
  const { contents, contentVersions, bulkUpdateContents, duplicateContent, archiveContent, restoreContentVersion } = useDemoStore();
  const [status, setStatus] = useState("Tous"); const [selected, setSelected] = useState([]); const [bulkStatus, setBulkStatus] = useState("À réviser"); const [notice, setNotice] = useState(""); const [historyId, setHistoryId] = useState(null);
  const filtered = contents.filter((item) => (status === "Tous" ? item.status !== "Archivé" : item.status === status) && item.title.toLowerCase().includes(search.toLowerCase()));
  const allSelected = filtered.length > 0 && filtered.every((item) => selected.includes(item.id));
  const versions = contentVersions.filter((item) => item.contentId === historyId).sort((a, b) => Number(b.version) - Number(a.version));
  const toggleAll = () => setSelected(allSelected ? selected.filter((id) => !filtered.some((item) => item.id === id)) : [...new Set([...selected, ...filtered.map((item) => item.id)])]);
  const applyBulk = () => { const result = bulkUpdateContents(selected, { status: bulkStatus }); if (result.ok) { setNotice(`${result.count} contenu(s) mis à jour et versionnés.`); setSelected([]); } else setNotice(result.message); };
  return <>
    <PageHeader eyebrow="GESTION ÉDITORIALE BETA" title="Bibliothèque de contenus" subtitle="Filtrez, sélectionnez, versionnez et restaurez sans perdre l’historique." action={<RouteLink to="/admin/studio" className="button button-dark"><Plus/> Ajouter un contenu</RouteLink>}/>
    {notice && <div className="editor-success" role="status"><CheckCircle/><span><strong>Bibliothèque mise à jour</strong><small>{notice}</small></span></div>}
    <div className="beta-library-toolbar"><div className="beta-tabs">{["Tous", ...STATUS_OPTIONS].map((item) => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item}</button>)}</div><span>{filtered.length} résultat(s)</span></div>
    {selected.length > 0 && <div className="beta-bulk-bar"><strong>{selected.length} sélectionné(s)</strong><label>Statut<select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>{STATUS_OPTIONS.filter((item) => item !== "Publié").map((item) => <option key={item}>{item}</option>)}</select></label><button className="button button-dark" onClick={applyBulk}><Check/> Appliquer</button><button className="button button-light" onClick={() => setSelected([])}><X/> Annuler</button><small>La publication groupée directe reste bloquée : chaque contenu doit terminer son cycle de validation.</small></div>}
    <div className="beta-content-table"><div className="beta-content-head"><label><input type="checkbox" checked={allSelected} onChange={toggleAll}/><span className="sr-only">Tout sélectionner</span></label><span>Contenu</span><span>Format</span><span>Niveau</span><span>Statut</span><span>Mise à jour</span><span>Actions</span></div>{filtered.map((item) => <article key={item.id}><label><input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}/><span className="sr-only">Sélectionner {item.title}</span></label><span><strong>{item.title}</strong><small>{item.id} · {(item.competencies || []).join(", ") || "Compétences à compléter"}</small></span><span>{item.type}</span><span>{item.level || "Tous"}</span><span><i className={`status-pill ${item.status === "Publié" ? "success" : item.status === "Brouillon" ? "neutral" : "warning"}`}>{item.status}</i></span><span>{new Date(item.updatedAt).toLocaleDateString("fr-FR")}</span><span className="row-actions"><RouteLink to={`/admin/bibliotheque/${item.id}`} title="Aperçu"><Eye/></RouteLink><button title="Historique" onClick={() => setHistoryId(item.id)}><Clock/></button><button title="Dupliquer" onClick={() => { duplicateContent(item.id); setNotice("Une copie brouillon versionnée a été créée."); }}><FileText/></button><button title="Archiver" onClick={() => { archiveContent(item.id); setNotice(`« ${item.title} » a été archivé.`); }}><Archive/></button></span></article>)}</div>
    {historyId && <div className="beta-history-drawer" role="dialog" aria-modal="true" aria-label="Historique du contenu"><div><span>HISTORIQUE RÉEL</span><h2>{contents.find((item) => item.id === historyId)?.title}</h2></div><button className="icon-button" aria-label="Fermer" onClick={() => setHistoryId(null)}><X/></button>{versions.length ? <section>{versions.map((version) => <article key={version.id}><Clock/><span><strong>Version {version.version} · {version.reason}</strong><small>{new Date(version.createdAt).toLocaleString("fr-FR")} · {version.actorRole}</small></span><button className="button button-light" onClick={() => { const result = restoreContentVersion(version.id); setNotice(result.ok ? `La version ${version.version} a été restaurée dans un nouveau brouillon.` : result.message); setHistoryId(null); }}><ArrowClockwise/> Restaurer en brouillon</button></article>)}</section> : <div className="beta-empty"><Clock/><strong>Aucune version antérieure</strong><span>La prochaine modification créera automatiquement une version.</span></div>}</div>}
  </>;
}

export function BetaAdminPage({ page, search, ui }) {
  if (page === "pilotage") return <BetaAdminDashboard ui={ui}/>;
  if (page === "analyses") return <BetaAnalytics ui={ui}/>;
  if (page === "imports") return <BetaImports ui={ui}/>;
  if (page === "referentiels") return <BetaReferentials ui={ui}/>;
  if (page === "medias") return <BetaMedia ui={ui}/>;
  if (page === "studio") return <BetaContentStudio ui={ui}/>;
  if (page === "bibliotheque" || page === "contenus") return <BetaContentLibrary search={search} ui={ui}/>;
  return null;
}
