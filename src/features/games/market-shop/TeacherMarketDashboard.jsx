import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CaretRight,
  CheckCircle,
  DownloadSimple,
  Eye,
  Funnel,
  MagnifyingGlass,
  Sparkle,
  Storefront,
  Student,
  Target,
  TrendUp,
  WarningCircle,
  X,
} from "@phosphor-icons/react/ssr";
import {
  buildTeacherMarketCsv,
  buildTeacherMarketDashboard,
  filterTeacherMarketStudents,
} from "./teacherMarketAnalytics.js";
import "./teacher-market-dashboard.css";
import {filterSchoolMarket,summarizeSchoolMarket} from "../../pilote/teacherMarketCore.js";

const STATUS_ICONS = Object.freeze({
  autonomous: CheckCircle,
  "on-track": TrendUp,
  support: WarningCircle,
  "not-started": Student,
  completed: CheckCircle,
});

const formatActivity = (student) => {
  if (!student.lastActiveAt) return "Pas encore commencé";
  if(student.connected)return new Intl.DateTimeFormat("fr-MA",{dateStyle:"medium",timeZone:"Africa/Casablanca"}).format(new Date(student.lastActiveAt));
  if (student.daysSinceActivity === 0) return "Aujourd’hui";
  if (student.daysSinceActivity === 1) return "Hier";
  return `Il y a ${student.daysSinceActivity} jours`;
};

function StatusBadge({ student }) {
  const Icon = STATUS_ICONS[student.status] || Student;
  return (
    <span className={`tmd-status is-${student.status}`}>
      <Icon weight="fill" aria-hidden="true" />
      {student.statusLabel}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, note, tone = "teal" }) {
  return (
    <article className={`tmd-summary-card is-${tone}`}>
      <span className="tmd-summary-icon"><Icon weight="duotone" aria-hidden="true" /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function TierOverview({ tier, studentCount }) {
  return (
    <article
      className="tmd-tier-card"
      style={{ "--tmd-tier-accent": tier.theme.accent, "--tmd-tier-surface": tier.theme.surface }}
    >
      <header>
        <span>PALIER {tier.id === "discovery" ? "1" : tier.id === "consolidation" ? "2" : "3"}</span>
        <strong>{tier.completionPercent===null?"—":`${tier.completionPercent}%`}</strong>
      </header>
      <h3>{tier.label}</h3>
      <p>{tier.cardTitle}</p>
      <div className="tmd-tier-track" role="progressbar" aria-label={tier.completionPercent===null?`Palier ${tier.label} : aucun élève dans cette vue`:`Palier ${tier.label} terminé par ${tier.completionPercent} % de la cohorte`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={tier.completionPercent}>
        <i style={{ width: `${tier.completionPercent??0}%` }} />
      </div>
      <footer>
        <span><strong>{tier.completedStudents}</strong> sur {studentCount} {tier.completedStudents===1?"a terminé":"ont terminé"}</span>
        <span>{tier.inProgressStudents} en cours</span>
      </footer>
    </article>
  );
}

function MissionDots({ tier }) {
  const completed = new Set(tier.completedMissionIds);
  const autonomous = new Set(tier.autonomousMissionIds);
  return (
    <span className="tmd-mission-dots" aria-label={`${tier.completedCount} missions réussies sur ${tier.missionCount}`}>
      {tier.missionIds.map((missionId, index) => {
        const state = autonomous.has(missionId) ? "is-autonomous" : completed.has(missionId) ? "is-guided" : "";
        const label = state === "is-autonomous" ? "bonus d’autonomie obtenu" : state === "is-guided" ? "réussie, bonus d’autonomie non obtenu" : "à découvrir";
        return <i className={state} key={missionId} title={`Mission ${index + 1} : ${label}`} aria-hidden="true" />;
      })}
    </span>
  );
}

function StudentDrawer({ student, onClose }) {
  const drawer = useRef(null);
  const closeButton = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = [...(drawer.current?.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [])]
        .filter((element) => !element.disabled && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, student.id]);

  return (
    <div className="tmd-drawer-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside ref={drawer} className="tmd-drawer" role="dialog" aria-modal="true" aria-labelledby="tmd-student-title">
        <header className="tmd-drawer-header">
          <div className="tmd-student-avatar" aria-hidden="true">{student.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
          <div>
            <span>FICHE DE PROGRESSION · {student.classLabel}</span>
            <h2 id="tmd-student-title">{student.name}</h2>
            <small>{student.connected ? "Résultats confirmés sur le compte scolaire" : student.partialData ? "Donnée partielle issue d’un ancien bilan" : student.live ? "Résultats locaux mis à jour automatiquement" : "Profil fictif de démonstration"}</small>
          </div>
          <button ref={closeButton} className="tmd-close" type="button" onClick={onClose} aria-label="Fermer la fiche élève"><X /></button>
        </header>

        <div className="tmd-drawer-body">
          <section className="tmd-student-kpis" aria-label="Synthèse de l’élève">
            <article><span>Progression</span><strong>{student.completedCount}/{student.totalMissions}</strong><small>{student.progressPercent}% du parcours</small></article>
            <article><span>Sans indice</span><strong>{student.completedCount ? `${student.autonomyPercent}%` : "—"}</strong><small>{student.autonomyCount} missions sans aide</small></article>
            <article><span>{student.connected?"Premières réussites guidées":"Aides"}</span><strong>{student.helpCount??"—"}</strong><small>{student.soukXp} XP au Souk</small></article>
          </section>

          <section className="tmd-drawer-section" aria-labelledby="tmd-tier-detail-title">
            <div className="tmd-section-heading">
              <div><span>PARCOURS</span><h3 id="tmd-tier-detail-title">Progression par palier</h3></div>
              <StatusBadge student={student} />
            </div>
            <div className="tmd-student-tiers">
              {student.tiers.map((tier) => (
                <article key={tier.id} style={{ "--tmd-tier-accent": tier.theme.accent }}>
                  <div>
                    <span>{tier.label}</span>
                    <strong>{tier.completedCount}/{tier.missionCount}</strong>
                  </div>
                  <MissionDots tier={tier} />
                  <small>{tier.autonomyCount} mission{tier.autonomyCount > 1 ? "s" : ""} réalisée{tier.autonomyCount > 1 ? "s" : ""} sans aide</small>
                </article>
              ))}
            </div>
            <div className="tmd-dot-legend" aria-label="Légende des missions"><span><i className="is-autonomous" /> Réussie sans indice</span><span><i className="is-guided" /> {student.connected?'Réussie, bonus d’autonomie non obtenu':'Réussie avec indice'}</span><span><i /> À découvrir</span></div>
          </section>

          <section className={`tmd-diagnostic is-${student.status}`} aria-labelledby="tmd-diagnostic-title">
            {student.status === "support" ? <WarningCircle weight="duotone" aria-hidden="true" /> : <Target weight="duotone" aria-hidden="true" />}
            <div>
              <span>LECTURE PÉDAGOGIQUE</span>
              <h3 id="tmd-diagnostic-title">{student.supportReason}</h3>
              <p>{student.connected?"Repère fondé sur les premières réussites guidées et la dernière action du jeu. Ce n’est pas un diagnostic de compétence.":"Ce signal repose sur la progression, l’usage des aides et la date de la dernière activité."}</p>
            </div>
          </section>

          <section className="tmd-next-action" aria-labelledby="tmd-next-action-title">
            <span>PROCHAINE ACTION CONSEILLÉE</span>
            <h3 id="tmd-next-action-title">Une intervention courte et ciblée</h3>
            <p>{student.recommendation}</p>
            <div><Sparkle weight="fill" aria-hidden="true" /> À tester lors de la prochaine séance de français</div>
          </section>

          <p className="tmd-data-note">
            {student.connected?"Ce suivi analyse":"Le prototype analyse"} uniquement des indicateurs de jeu. Il ne remplace pas l’observation de l’enseignant ni une évaluation en classe.
          </p>
        </div>
      </aside>
    </div>
  );
}

export default function TeacherMarketDashboard({
  awardHistory = [],
  attemptHistory = [],
  onBack = () => {},
  school = null,
}) {
  const complete = useMemo(() => school ? {...school.snapshot,...summarizeSchoolMarket(school.snapshot.students,school.snapshot.tiers)} : buildTeacherMarketDashboard({ awardHistory, attemptHistory }), [school?.snapshot, awardHistory, attemptHistory]);
  const [classId, setClassId] = useState("all");
  const [status, setStatus] = useState("all");
  const [scopeMessage,setScopeMessage]=useState("");
  const effectiveClass=school&&classId!=="all"&&!complete.classes.some(c=>c.id===classId)?"all":classId;
  useEffect(()=>{if(effectiveClass!==classId){setClassId("all");setScopeMessage("La classe sélectionnée n’est plus accessible. La vue porte sur vos classes actuellement autorisées.");}},[effectiveClass,classId]);
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const lastTrigger = useRef(null);
  const visibleStudents = useMemo(() => school ? filterSchoolMarket(complete.students,{classId:effectiveClass,status,period,query},complete.generatedAt) : filterTeacherMarketStudents(complete.students, { classId, status, period, query }), [complete, effectiveClass,classId, status, period, query,Boolean(school)]);
  const dashboard=school?{...complete,...summarizeSchoolMarket(visibleStudents,complete.tiers)}:complete;
  const selectedStudent = complete.students.find((student) => student.id === selectedId) || null;
  const supportStudents = dashboard.students.filter((student) => student.status === "support").slice(0, 3);
  const csv = useMemo(() => school?"":buildTeacherMarketCsv(visibleStudents), [visibleStudents,Boolean(school)]);
  const exportHref = `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(csv)}`;
  const openStudent = async (studentId, event) => { lastTrigger.current = event.currentTarget; if(school&&!await school.onVerify(studentId))return; setSelectedId(studentId); };
  const closeStudent = useCallback(() => {
    setSelectedId(null);
    requestAnimationFrame(() => lastTrigger.current?.focus());
  }, []);

  return (
    <div className="teacher-market-dashboard">
      <button type="button" className="tmd-back" onClick={onBack}><ArrowLeft /> Retour aux analyses</button>

      <header className="tmd-hero">
        <div className="tmd-hero-copy">
          <span className="tmd-eyebrow"><Storefront weight="fill" aria-hidden="true" /> SUIVI PAR JEU · LE SOUK DES MOTS</span>
          <h1>Voir les progrès, puis agir</h1>
          <p>Suivez les trois paliers, repérez l’usage des aides et choisissez une intervention simple pour chaque élève.</p>
          <div className="tmd-hero-tags" aria-label="Périmètre du suivi">
            <span>{school?`${complete.classes.length} classe${complete.classes.length===1?"":"s"} autorisée${complete.classes.length===1?"":"s"}`:"5e AEP · Classes 5A et 5B"}</span>
            <span>12 missions</span>
            <span>{school?(complete.source==="pilot_local_fixture"?"Recette locale · comptes fictifs":"Comptes scolaires · accès enseignant"):"Données locales de démonstration"}</span>
          </div>
        </div>
        <div className="tmd-hero-actions">
          <div><Sparkle weight="duotone" /><span><small>MISE À JOUR</small><strong>{school?new Date(complete.generatedAt).toLocaleString("fr-MA"):"À chaque palier terminé"}</strong></span></div>
          {school&&<button type="button" className="button button-light tmd-export" onClick={school.refresh}>Actualiser le suivi</button>}
          <a className="tmd-export" href={school?"#":exportHref} onClick={school?e=>{e.preventDefault();school.onExport({classId:effectiveClass,status,period,query});}:undefined} download="progression-souk-des-mots.csv"><DownloadSimple /> Exporter la vue</a>
        </div>
      </header>

      {scopeMessage&&<p className='tmd-data-note' role='status'>{scopeMessage}</p>}
      {school&&<details className="tmd-data-note"><summary>Périmètre et définitions des indicateurs</summary>{Object.values(complete.definitions).map(text=><p key={text}>{text}</p>)}</details>}
      <section className="tmd-summary-grid" aria-label="Indicateurs du Souk des mots">
        <SummaryCard icon={Student} label="Élèves engagés" value={`${dashboard.summary.startedCount} / ${dashboard.summary.studentCount}`} note="Ont commencé au moins une mission" />
        <SummaryCard icon={CheckCircle} label={school?"Missions réussies":"Missions maîtrisées"} value={`${dashboard.summary.totalMasteries} / ${dashboard.summary.studentCount * dashboard.totalMissions}`} note={`${dashboard.summary.completedCount} parcours entièrement terminé${dashboard.summary.completedCount===1?"":"s"}`} tone="navy" />
        <SummaryCard icon={TrendUp} label="Réussies sans indice" value={`${dashboard.summary.totalAutonomousMasteries} / ${dashboard.summary.totalMasteries || 0}`} note={dashboard.summary.averageAutonomy===null?"Aucune réussite à mesurer":`${dashboard.summary.averageAutonomy}% des ${school?"réussites":"maîtrises"} documentées`} tone="gold" />
        <SummaryCard icon={WarningCircle} label="À accompagner" value={`${dashboard.summary.supportCount} / ${dashboard.summary.studentCount}`} note={school?"Repère à confirmer en classe":"Signal pédagogique prioritaire"} tone="coral" />
      </section>

      <section className="tmd-tier-overview" aria-labelledby="tmd-tier-overview-title">
        <div className="tmd-section-heading">
          <div><span>VUE DE LA COHORTE</span><h2 id="tmd-tier-overview-title">Avancement dans les trois paliers</h2></div>
          <small>{dashboard.summary.averageProgress===null?"Aucun élève dans cette vue":`${dashboard.summary.averageProgress}% de progression moyenne`}</small>
        </div>
        <div className="tmd-tier-grid">
          {dashboard.tierSummaries.map((tier) => <TierOverview key={tier.id} tier={tier} studentCount={dashboard.summary.studentCount} />)}
        </div>
      </section>

      <div className="tmd-content-grid">
        <section className="tmd-roster" aria-labelledby="tmd-roster-title">
          <div className="tmd-section-heading">
            <div><span>SUIVI INDIVIDUEL</span><h2 id="tmd-roster-title">Progression des élèves</h2></div>
            <small aria-live="polite" aria-atomic="true">{visibleStudents.length} profil{visibleStudents.length > 1 ? "s" : ""} affiché{visibleStudents.length > 1 ? "s" : ""}</small>
          </div>

          <div className="tmd-filters" aria-label="Filtrer les élèves">
            <label className="tmd-search"><span className="sr-only">Rechercher un élève</span><MagnifyingGlass /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un élève" /></label>
            <label><Funnel aria-hidden="true" /><span className="sr-only">Filtrer par classe</span><select value={effectiveClass} onChange={(event) => {setClassId(event.target.value);setScopeMessage("");}}><option value="all">Toutes les classes</option>{school?complete.classes.map(c=><option key={c.id} value={c.id}>{c.label}</option>):<><option value="classe-5a">Classe 5A</option><option value="classe-5b">Classe 5B</option></>}</select></label>
            <label><Target aria-hidden="true" /><span className="sr-only">{school?"Filtrer par activité récente":"Filtrer par période"}</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">{school?"Toute activité · cumul":"Depuis le lancement"}</option><option value="30">{school?"Actifs depuis 30 jours":"30 derniers jours"}</option><option value="7">{school?"Actifs depuis 7 jours":"7 derniers jours"}</option></select></label>
            <label><TrendUp aria-hidden="true" /><span className="sr-only">Filtrer par statut</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tous les statuts</option><option value="support">À accompagner</option><option value="on-track">{school?"En cours":"En bonne voie"}</option><option value="completed">Parcours terminés</option><option value="not-started">À démarrer</option></select></label>
          </div>

          <div className="tmd-table-wrap">
            <table>
              <caption className="sr-only">Suivi de la progression des élèves dans Le Souk des mots</caption>
              <thead><tr><th scope="col">Élève</th><th scope="col">Palier</th><th scope="col">Missions</th><th scope="col">Sans indice</th><th scope="col">{school?"Guidées au départ":"Aides"}</th><th scope="col">Statut</th><th scope="col"><span className="sr-only">Ouvrir</span></th></tr></thead>
              <tbody>
                {visibleStudents.map((student) => (
                  <tr key={student.id}>
                    <td data-label="Élève"><button type="button" className="tmd-student-link" onClick={(event) => openStudent(student.id, event)}><span>{student.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><span><strong>{student.name}</strong><small>{student.classLabel} · {formatActivity(student)}</small></span></button></td>
                    <td data-label="Palier"><strong className="tmd-tier-name">{student.currentTierLabel}</strong></td>
                    <td data-label="Missions"><div className="tmd-table-progress"><span><strong>{student.completedCount}</strong>/{student.totalMissions}</span><i><b style={{ width: `${student.progressPercent}%` }} /></i></div></td>
                    <td data-label="Sans indice"><strong>{student.completedCount ? `${student.autonomyPercent}%` : "—"}</strong></td>
                    <td data-label={school?"Guidées au départ":"Aides"}><span className={student.helpCount >= 2 ? "tmd-help-count is-high" : "tmd-help-count"}>{student.helpCount??"—"}</span></td>
                    <td data-label="Statut"><StatusBadge student={student} /></td>
                    <td><button type="button" className="tmd-open" onClick={(event) => openStudent(student.id, event)} aria-label={`Ouvrir la fiche de ${student.name}`}><Eye /><CaretRight /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleStudents.length === 0 && <div className="tmd-empty" role="status"><MagnifyingGlass /><h3>Aucun élève dans cette vue</h3><p>Modifiez les filtres ou le nom recherché.</p><button type="button" onClick={() => { setClassId("all"); setStatus("all"); setPeriod("all"); setQuery(""); }}>Réinitialiser les filtres</button></div>}
          </div>
        </section>

        <aside className="tmd-priorities" aria-labelledby="tmd-priorities-title">
          <div className="tmd-section-heading"><div><span>À VOIR D’ABORD</span><h2 id="tmd-priorities-title">Priorités pédagogiques</h2></div></div>
          <p>Ces signaux restent des repères : l’observation en classe garde la priorité.</p>
          <div className="tmd-priority-list">
            {school&&!supportStudents.length&&<p>Aucun signal prioritaire dans cette vue.</p>}
            {supportStudents.map((student) => (
              <button type="button" key={student.id} onClick={(event) => openStudent(student.id, event)}>
                <span className="tmd-priority-icon"><WarningCircle weight="fill" /></span>
                <span><strong>{student.name}</strong><small>{student.supportReason}</small></span>
                <CaretRight />
              </button>
            ))}
          </div>
          <div className="tmd-method-note"><Target weight="duotone" /><span><strong>Lecture responsable</strong><small>Aucune réponse détaillée ni donnée audio n’est affichée.</small></span></div>
        </aside>
      </div>

      {selectedStudent && <StudentDrawer student={selectedStudent} onClose={closeStudent} />}
    </div>
  );
}
