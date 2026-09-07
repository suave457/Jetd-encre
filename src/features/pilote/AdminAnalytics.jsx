import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Clock, DownloadSimple, Info, ShieldCheck, WarningCircle } from '@phosphor-icons/react/ssr';
import DecisionKpi from '../beta-admin/DecisionKpi.jsx';
import { analyticsCards, analyticsCsv, analyticsGameRows, analyticsPercent, analyticsRatio, fetchAdminAnalytics } from './adminAnalyticsCore.js';
import '../beta-admin/beta-admin.css';

// Connected adapter for the existing BetaAnalytics composition and CSS.
// No DemoStore, generated fixture dataset or substitute figures are used here.
export function AdminAnalyticsView({ ui, snapshot, tab, setTab }) {
  if (!snapshot) return null;
  const t = snapshot.totals, period = `${snapshot.filters.from} — ${snapshot.filters.to} · UTC`;
  const freshness = `calculé le ${new Date(snapshot.generatedAt).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC`;
  return <>
    <div className="beta-tabs" role="tablist" aria-label="Analyses">{[['overview', 'Vue générale'], ['content', 'Contenus'], ['adoption', 'Adoption'], ['quality', 'Qualité des données']].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === 'overview' && <><div className="beta-kpi-grid">{analyticsCards(snapshot).map(({ key, ...card }) => <DecisionKpi key={key} {...card} period={period} freshness={freshness} trend="Mesuré"/>)}</div><section className="beta-analytics-grid"><article className="panel"><div className="beta-section-heading"><div><span>PAR ÉTABLISSEMENT</span><h2>Participation mesurée</h2></div></div><div className="beta-horizontal-bars">{snapshot.bySchool.map(row => { const rate = analyticsRatio(row.participatingStudents, row.eligibleStudents); return <div key={row.id}><span>{row.name}{!row.active && ' · suspendu'}</span><i aria-hidden="true"><b style={{ width: `${rate ?? 0}%` }}/></i><strong title={`${row.participatingStudents} sur ${row.eligibleStudents}`}>{rate === null ? '—' : analyticsPercent(rate)}</strong></div>; })}</div>{!snapshot.bySchool.length && <p>Aucun établissement enregistré.</p>}<p>Une inscription élève par école. « — » : aucun élève actuellement éligible.</p></article><article className="panel beta-insights"><div className="beta-section-heading"><div><span>LECTURE OPÉRATIONNELLE</span><h2>Ce que les données établissent</h2></div></div><article><CheckCircle/><div><strong>{t.submissions - t.reviewedSubmissions} remises de la période sans correction</strong><span>Situation à la date de calcul, y compris les remises historiques des comptes suspendus.</span></div></article><article><Info/><div><strong>{t.eligibleStudents} inscriptions élèves actuellement actives</strong><span>Ce dénominateur reflète les accès ouverts aujourd’hui, pas un effectif historique reconstitué.</span></div></article><article><WarningCircle/><div><strong>La progression pédagogique n’est pas encore mesurée</strong><span>Devoirs, Mots fléchés, Culture générale, Défi du jour, Le Mot juste, Mission Zellige et Le Souk des mots : les activités, scores et XP ne prouvent pas une maîtrise des compétences.</span></div></article></article></section></>}
    {tab === 'content' && <section className="beta-analytics-grid"><article className="panel"><h2>Activité pédagogique enregistrée</h2><div className="beta-status-breakdown">{[['Devoirs publiés', t.assignments], ['Remises reçues', t.submissions], ...analyticsGameRows(snapshot).map(row => [row.label, row.value])].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><p>{period}. {snapshot.definitions.games}</p></article><article className="panel"><h2>Cycle éditorial et médias</h2><div className="beta-empty"><Info/><strong>Source non raccordée</strong><span>Les brouillons, publications, droits et médias de l’aperçu éditorial local ne sont pas une source de production. Aucun total n’est substitué.</span></div></article></section>}
    {tab === 'adoption' && <section className="beta-analytics-grid"><article className="panel"><h2>Activation des codes de la période</h2><div className="beta-big-ratio"><strong>{analyticsPercent(analyticsRatio(t.issuedCodesActivated, t.codesIssued))}</strong><span>{t.issuedCodesActivated} activés à ce jour sur {t.codesIssued} émis pendant la période</span></div><p>{snapshot.definitions.activation}</p><p>{t.activations} activations effectuées pendant la période, quelle que soit la date d’émission.</p></article><article className="panel"><h2>Accès scolaires actuellement ouverts</h2><div className="beta-big-ratio"><strong>{t.teachers}</strong><span>inscriptions enseignantes actives · {t.classes} classes actives · {t.eligibleStudents} inscriptions élèves actives</span></div><p>État actuel dans le périmètre sélectionné, non filtré par date de création. Le nombre de connexions historiques n’est pas disponible.</p></article></section>}
    {tab === 'quality' && <section className="panel beta-quality-panel"><div className="beta-quality-summary"><span className="blocked"><WarningCircle/></span><div><h2>Couverture de mesure partielle</h2><p>Instantané cohérent des tables du pilote · {freshness} · {period}</p></div><i>{snapshot.source === 'pilot_local_fixture' ? 'Test local fictif' : 'Source serveur'}</i></div><div className="beta-quality-list"><article><span className="status-pill warning">Couverture</span><strong>{t.undatedQuizAnswers} anciennes réponses de quiz sans date serveur</strong><small>Toutes dates confondues · exclues du calcul des réponses sur la période.</small></article>{snapshot.unavailable.map(label => <article key={label}><span className="status-pill warning">Non mesuré</span><strong>{label}</strong><small>Pas de donnée de remplacement</small></article>)}<article><span className="status-pill warning">Périmètre</span><strong>Participation : inscriptions actives aujourd’hui. Corrections et codes : cohortes historiques.</strong><small>Consultez la définition de chaque carte.</small></article></div></section>}
  </>;
}

export default function AdminAnalytics({ ui, userId }) {
  const { PageHeader } = ui;
  const [draft, setDraft] = useState({ from: '', to: '', schoolId: '' });
  const [requestFilters, setRequestFilters] = useState({});
  const [reload, setReload] = useState(0), [tab, setTab] = useState('overview');
  const [snapshot, setSnapshot] = useState(null), [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const generation = useRef(0), activeRequest = useRef(null);
  const currentSnapshot = snapshot?.userId === userId ? snapshot : null;
  useEffect(() => {
    const version = ++generation.current, controller = new AbortController();
    activeRequest.current = controller; setSnapshot(null); setSchools([]); setError(''); setLoading(true);
    if (!userId) { setError('Vérifiez votre accès administrateur avant de charger les analyses.'); setLoading(false); return () => controller.abort(); }
    fetchAdminAnalytics(requestFilters, { signal: controller.signal, expectedUserId: userId }).then(result => {
      if (version !== generation.current) return;
      setSnapshot(result); setSchools(result.schools); setDraft({ from: result.filters.from, to: result.filters.to, schoolId: result.filters.schoolId });
    }).catch(cause => { if (version === generation.current && cause.name !== 'AbortError') setError(cause.message); }).finally(() => { if (version === generation.current) setLoading(false); });
    return () => { generation.current++; controller.abort(); };
  }, [requestFilters, reload, userId]);
  useEffect(() => {
    const reset = () => { generation.current++; activeRequest.current?.abort(); setSnapshot(null); setSchools([]); setReload(value => value + 1); };
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('jde-pilot-session') : null;
    if (channel) channel.onmessage = reset;
    window.addEventListener('focus', reset);
    return () => { channel?.close(); window.removeEventListener('focus', reset); };
  }, []);
  function change(key, value) { generation.current++; activeRequest.current?.abort(); setSnapshot(null); setError(''); setLoading(false); setDraft(previous => ({ ...previous, [key]: value })); }
  function exportKpis() {
    if (!currentSnapshot || loading) return;
    const blob = new Blob([analyticsCsv(currentSnapshot)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `jet-dencre-indicateurs-${currentSnapshot.filters.from}-${currentSnapshot.filters.to}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return <>
    <PageHeader eyebrow="CENTRE DÉCISIONNEL" title="Analyses et qualité des données" subtitle="Des indicateurs définis, traçables et accompagnés de leurs dénominateurs." action={<button type="button" className="button button-light" disabled={!currentSnapshot || loading} onClick={exportKpis}><DownloadSimple/> Exporter les indicateurs</button>}/>
    <div className="beta-source-note" role="note"><ShieldCheck weight="fill"/><div><strong>{!currentSnapshot ? 'Version BETA · source en cours de vérification' : currentSnapshot.source === 'pilot_local_fixture' ? 'Version BETA · test local sur données fictives' : 'Version BETA · données enregistrées côté serveur'}</strong><span>Les résultats ne sont affichés qu’après vérification de l’accès administrateur et réponse du serveur. Les indicateurs non mesurés restent indisponibles.</span></div></div>
    <form className="beta-filter-row" onSubmit={event => { event.preventDefault(); setSnapshot(null); setRequestFilters({ ...draft }); }}><label>Périmètre<select value={draft.schoolId} disabled={loading} onChange={event => change('schoolId', event.target.value)}><option value="">Réseau</option>{schools.map(school => <option key={school.id} value={school.id}>{school.name}{!school.active && ' · suspendu'}</option>)}</select></label><label>Du (UTC)<input type="date" required value={draft.from} disabled={loading} onChange={event => change('from', event.target.value)}/></label><label>Au (UTC)<input type="date" required value={draft.to} disabled={loading} onChange={event => change('to', event.target.value)}/></label><button type="submit" className="button button-light" disabled={loading}>Appliquer</button><span><Clock/>{currentSnapshot ? `Calculé le ${new Date(currentSnapshot.generatedAt).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC` : 'En attente de calcul'}</span></form>
    {loading && <p role="status">Calcul des indicateurs…</p>}
    {error && <p className="access-error" role="alert">{error} <button type="button" onClick={() => setReload(value => value + 1)}>Réessayer</button></p>}
    {!loading && !currentSnapshot && !error && <p role="status">Appliquez les filtres pour afficher les résultats correspondants. La période ne peut pas dépasser 366 jours ni inclure de date future.</p>}
    {currentSnapshot?.totals.undatedQuizAnswers > 0 && <p className="beta-source-note" role="note"><WarningCircle/><span>{currentSnapshot.totals.undatedQuizAnswers} anciennes réponses de quiz ne peuvent pas être datées. La participation et les réponses de la période ne les incluent pas ; les fins de tentative et les XP datés restent comptés.</span></p>}
    <AdminAnalyticsView ui={ui} snapshot={currentSnapshot} tab={tab} setTab={setTab}/>
  </>;
}
