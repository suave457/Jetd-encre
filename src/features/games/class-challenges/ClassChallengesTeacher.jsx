import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Crown,
  Eye,
  GameController,
  LockKey,
  Plus,
  ShieldCheck,
  Sparkle,
  Trophy,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react/ssr";
import {
  buildSafeClassLeaderboard,
  CLASS_CHALLENGE_DURATIONS,
  getChallengeTimeLabel,
  getClassChallengeStatus,
  validateClassChallengeDraft,
} from "./classChallengeEngine.js";
import {
  CLASS_CHALLENGE_THEMES,
  CLASS_OPTIONS,
  getPublishedClassChallengeBanks,
  readQuestionBankQuestions,
  selectClassChallengeQuestionIds,
} from "./classChallengeData.js";
import "./class-challenges.css";

const HERO_SRC = "/assets/games/class-challenges/defis-classes-hero.webp";

const DEFAULT_DRAFT = Object.freeze({
  title: "Le défi des explorateurs",
  classId: "classe-5a",
  classLabel: "5e AEP · Classe 5A",
  level: "5e AEP",
  theme: "Culture marocaine",
  durationHours: 72,
  bankId: "banque-culture-generale-publiee",
});

function TeacherLeaderboard({ challenge, results }) {
  const rows = buildSafeClassLeaderboard(challenge, results);
  return <section className="cc-teacher-ranking" aria-labelledby="cc-teacher-ranking-title"><div className="cc-section-heading"><div><span>APERÇU ENSEIGNANT</span><h2 id="cc-teacher-ranking-title">Classement pseudonymisé</h2></div><span className="cc-scope"><LockKey weight="fill"/> {challenge.classLabel}</span></div><div className="cc-teacher-ranking-list">{rows.map((row,index)=><article key={`${row.pseudonym}-${index}`}><span className="cc-teacher-rank">{row.rank === 1 ? <Crown weight="fill"/> : row.rank ? `#${row.rank}` : "—"}{row.tied&&<small>ex æquo</small>}</span><span className="cc-teacher-alias"><i>{row.pseudonym.split(" ").map((part)=>part[0]).join("").slice(0,2)}</i><strong>{row.pseudonym}</strong></span><span className="cc-teacher-progress"><i><b style={{width:`${row.progressPercent}%`}}/></i><small>{row.progressPercent}%</small></span><strong>{row.score} pts</strong></article>)}{!rows.length&&<p className="cc-ranking-empty">Aucune participation pour le moment.</p>}</div><p className="cc-ranking-rule"><ShieldCheck weight="fill"/> Aucun nom complet, identifiant, initiale réelle ou donnée sensible n’est affiché. Il n’y a pas de messagerie dans ce module.</p></section>;
}

export default function ClassChallengesTeacher({ challenges = [], results = [], onCreate = () => ({ ok: false }), onFinish = () => ({ ok: false }) }) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ ...DEFAULT_DRAFT });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState(challenges[0]?.id || null);
  const [confirmFinishId, setConfirmFinishId] = useState(null);
  const questions = useMemo(() => readQuestionBankQuestions(), []);
  const banks = useMemo(() => getPublishedClassChallengeBanks(questions), [questions]);
  const selectedBank = banks.find((bank) => bank.id === draft.bankId) || null;
  const selectedQuestionIds = useMemo(
    () => selectClassChallengeQuestionIds({
      bank: selectedBank,
      questions,
      level: draft.level,
      theme: draft.theme,
    }),
    [draft.level, draft.theme, questions, selectedBank],
  );
  const selected = challenges.find((item) => item.id === selectedId) || challenges[0] || null;
  const liveCount = challenges.filter((item) => getClassChallengeStatus(item) === "en_cours").length;
  const finishedCount = challenges.length - liveCount;
  const totalParticipants = new Set(results.filter((item) => challenges.some((challenge) => challenge.id === item.challengeId)).map((item) => item.participantId)).size;

  const updateClass = (classId) => {
    const option = CLASS_OPTIONS.find((item) => item.id === classId) || CLASS_OPTIONS[0];
    setDraft((current) => ({ ...current, classId: option.id, classLabel: option.label, level: option.level }));
  };

  const submit = (event) => {
    event.preventDefault();
    const validation = validateClassChallengeDraft(
      { ...draft, questionIds: selectedQuestionIds },
      banks,
    );
    if (!validation.ok) {
      setErrors(validation.fieldErrors);
      setNotice("");
      return;
    }
    const outcome = onCreate(validation.value);
    if (!outcome?.ok) {
      setErrors({ form: outcome?.message || "Le défi n’a pas pu être créé." });
      return;
    }
    setErrors({});
    setNotice(`« ${validation.value.title} » est maintenant visible par ${validation.value.classLabel}.`);
    setCreating(false);
    setDraft({ ...DEFAULT_DRAFT });
    setSelectedId(outcome.challenge?.id || null);
  };

  const finish = (challenge) => {
    if (confirmFinishId !== challenge.id) {
      setConfirmFinishId(challenge.id);
      return;
    }
    const outcome = onFinish(challenge.id);
    if (outcome?.ok) setNotice(`« ${challenge.title} » est clôturé. Les résultats restent consultables.`);
    setConfirmFinishId(null);
  };

  return <div className="cc-teacher-page">
    <header className="cc-teacher-header"><div><span className="cc-kicker"><Trophy weight="fill"/> APPRENTISSAGE COLLECTIF</span><h1>Défis de classe</h1><p>Lancez un défi à partir d’une banque publiée et suivez la participation avec des pseudonymes non identifiants.</p></div><button type="button" className="button button-green" onClick={() => setCreating((value) => !value)}>{creating ? <X/> : <Plus/>}{creating ? "Fermer" : "Créer un défi"}</button></header>

    {notice&&<div className="cc-teacher-notice" role="status"><Check weight="bold"/><span><strong>Action confirmée</strong><small>{notice}</small></span></div>}

    <section className="cc-teacher-hero"><div><span><Sparkle weight="fill"/> MODE SÛR POUR LA CLASSE</span><h2>Une émulation positive, sans exposer les élèves</h2><p>Le score repose uniquement sur les bonnes réponses. Les égalités sont conservées et signalées comme ex æquo.</p><div><span><strong>{liveCount}</strong> en cours</span><span><strong>{finishedCount}</strong> terminés</span><span><strong>{totalParticipants}</strong> pseudonymes actifs</span></div></div><img src={HERO_SRC} alt="Trophée doré entouré de figurines abstraites et de motifs marocains" width="1254" height="1254"/></section>

    {creating&&<form className="cc-create-form" onSubmit={submit} noValidate><div className="cc-form-heading"><div><span>NOUVEAU DÉFI</span><h2>Préparer le parcours</h2></div><span className="cc-published-chip"><Check weight="bold"/> Questions publiées uniquement</span></div>{errors.form&&<p className="cc-form-error" role="alert"><WarningCircle/> {errors.form}</p>}<div className="cc-form-grid"><label>Titre du défi<input value={draft.title} onChange={(event)=>setDraft({...draft,title:event.target.value})} aria-invalid={Boolean(errors.title)}/>{errors.title&&<small>{errors.title}</small>}</label><label>Classe<select value={draft.classId} onChange={(event)=>updateClass(event.target.value)}>{CLASS_OPTIONS.map((option)=><option value={option.id} key={option.id}>{option.label}</option>)}</select>{errors.classId&&<small>{errors.classId}</small>}</label><label>Niveau<select value={draft.level} disabled aria-describedby="cc-level-help"><option>{draft.level}</option></select><small id="cc-level-help">Déduit de la classe sélectionnée.</small>{errors.level&&<small>{errors.level}</small>}</label><label>Thème<select value={draft.theme} onChange={(event)=>setDraft({...draft,theme:event.target.value})}>{CLASS_CHALLENGE_THEMES.map((theme)=><option key={theme}>{theme}</option>)}</select>{errors.theme&&<small>{errors.theme}</small>}</label><label>Durée<select value={draft.durationHours} onChange={(event)=>setDraft({...draft,durationHours:Number(event.target.value)})}>{CLASS_CHALLENGE_DURATIONS.map((duration)=><option value={duration.hours} key={duration.hours}>{duration.label}</option>)}</select>{errors.durationHours&&<small>{errors.durationHours}</small>}</label><label>Banque publiée<select value={draft.bankId} onChange={(event)=>setDraft({...draft,bankId:event.target.value})}>{banks.map((bank)=><option value={bank.id} key={bank.id}>{bank.label} · {bank.questionCount} questions</option>)}</select>{errors.bankId&&<small>{errors.bankId}</small>}</label></div><div className="cc-bank-preview"><GameController weight="duotone"/><div><strong>{selectedBank?.label || "Banque indisponible"}</strong><p>{selectedBank ? `Cinq questions sélectionnées en privilégiant « ${draft.theme} » et le niveau ${draft.level}.` : "Publiez au moins cinq questions pour rendre une banque disponible."}</p></div><span>{selectedQuestionIds.length} retenues</span></div><div className="cc-form-actions"><button type="button" className="button button-light" onClick={()=>setCreating(false)}>Annuler</button><button type="submit" className="button button-dark">Lancer le défi <ArrowRight/></button></div></form>}

    <div className="cc-teacher-layout"><section className="cc-teacher-list" aria-label="Défis créés"><div className="cc-section-heading"><div><span>SUIVI</span><h2>Défis créés</h2></div><span>{challenges.length} au total</span></div>{challenges.map((challenge)=>{const status=getClassChallengeStatus(challenge);const scoped=buildSafeClassLeaderboard(challenge,results);const completed=scoped.filter((row)=>row.status==="termine").length;return <article className={selected?.id===challenge.id?"is-selected":""} key={challenge.id}><button type="button" className="cc-select-challenge" onClick={()=>setSelectedId(challenge.id)} aria-label={`Consulter ${challenge.title}`}><span className={`cc-status ${status==="en_cours"?"is-live":"is-finished"}`}><i/>{status==="en_cours"?"En cours":"Terminé"}</span><h3>{challenge.title}</h3><p>{challenge.classLabel} · {challenge.theme}</p><div><span><Clock/> {getChallengeTimeLabel(challenge)}</span><span><UsersThree/> {completed} terminés</span><span><GameController/> {challenge.questionIds.length} questions</span></div><Eye weight="bold"/></button>{status==="en_cours"&&<button type="button" className={confirmFinishId===challenge.id?"cc-finish is-confirm":"cc-finish"} onClick={()=>finish(challenge)}>{confirmFinishId===challenge.id?"Confirmer la clôture":"Clôturer maintenant"}</button>}</article>})}</section>{selected?<TeacherLeaderboard challenge={selected} results={results}/>:<section className="cc-teacher-ranking cc-no-selection"><Trophy weight="duotone"/><h2>Aucun défi</h2><p>Créez un premier défi avec une banque de questions publiée.</p></section>}</div>
  </div>;
}
