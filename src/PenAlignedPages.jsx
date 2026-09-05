import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpenText, Buildings, CalendarBlank, CaretRight,
  Check, CheckCircle, ChalkboardTeacher, ClipboardText, Clock, CloudArrowUp,
  Eye, FileText, FolderOpen, Headphones, Key, LockKey, MagnifyingGlass,
  Megaphone, NotePencil, PaperPlaneTilt, PlayCircle, Plus, ShieldCheck,
  Sparkle, Student, Trophy, UserCircle, UsersThree, WarningCircle,
} from "@phosphor-icons/react/ssr";
import { DEMO_ACCOUNTS, useDemoStore } from "./demoStore.jsx";
import { ENVIRONMENT_ACTIVITY } from "./learningActivityCore.js";
import { isPublicDemoContent } from "./demoStoreCore.js";
import { readAccessibilityPreferences, saveAccessibilityPreferences, applyAccessibilityPreferences } from "./accessibilityPreferences.js";

const HANDLED_SCREENS = new Set([
  "student.onboarding-profile", "student.onboarding-class", "student.manuals",
  "student.reader", "student.exercise", "student.exercise-result",
  "student.assignment-submitted", "student.profile", "student.system",
  "teacher.assignment-new", "teacher.assignment-preview", "teacher.submissions",
  "teacher.audio-correction", "director.assignments", "director.class", "director.school",
  "director.activation", "admin.studio", "admin.preview", "admin.review",
  "admin.schedule", "admin.published", "admin.history", "admin.system",
]);

export function isPenHandledScreen(screen) {
  return HANDLED_SCREENS.has(screen);
}

function go(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("jde:navigate"));
}

function DemoNotice({ children }) {
  return <div className="pen-demo-notice" role="note"><ShieldCheck weight="fill"/><span>{children}</span></div>;
}

export function PenAccessPage({ screen, ui }) {
  const { AuthLayout, RouteLink } = ui;
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  if (screen === "auth.forgot-password") {
    return <AuthLayout title="Retrouver mon accès" intro="Indiquez l’adresse associée à votre espace. Nous simulons ici l’envoi d’un lien sécurisé.">
      {done ? <div className="pen-access-success" role="status"><CheckCircle weight="fill"/><h2>Lien de démonstration prêt</h2><p>Aucun e-mail réel n’a été envoyé. Vous pouvez poursuivre le scénario.</p><RouteLink to="/reinitialisation" className="button button-dark">Réinitialiser le mot de passe <ArrowRight/></RouteLink></div> :
      <form className="login-form" onSubmit={event => { event.preventDefault(); setDone(true); }}><label>Adresse e-mail<input type="email" defaultValue="demo@jetdencre.ma" autoComplete="email" required/></label><button className="button button-dark button-wide" type="submit"><PaperPlaneTilt/> Recevoir le lien</button><RouteLink to="/connexion" className="button button-light button-wide"><ArrowLeft/> Retour à la connexion</RouteLink></form>}
    </AuthLayout>;
  }
  if (screen === "auth.reset-password") {
    const submit = event => { event.preventDefault(); if (password.length < 8 || password !== confirm) { setError("Utilisez au moins 8 caractères et saisissez deux fois le même mot de passe."); return; } setError(""); setDone(true); };
    return <AuthLayout title="Créer un nouveau mot de passe" intro="Choisissez un mot de passe de démonstration. Il ne sera jamais transmis.">
      {done ? <div className="pen-access-success" role="status"><CheckCircle weight="fill"/><h2>Mot de passe mis à jour</h2><p>Le scénario est terminé. Reconnectez-vous avec les identifiants affichés dans le prototype.</p><RouteLink to="/connexion" className="button button-dark">Revenir à la connexion <ArrowRight/></RouteLink></div> :
      <form className="login-form" onSubmit={submit}><label>Nouveau mot de passe<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required/></label><label>Confirmer<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" required/></label>{error && <p className="form-error" role="alert"><WarningCircle/>{error}</p>}<button className="button button-dark button-wide" type="submit"><LockKey/> Enregistrer</button></form>}
    </AuthLayout>;
  }
  if (screen === "auth.session-expired") {
    return <AuthLayout title="Votre session a expiré" intro="Pour protéger votre espace, reconnectez-vous avant de reprendre votre travail."><div className="pen-access-success warning" role="status"><Clock weight="fill"/><h2>Votre travail est conservé</h2><p>Les données fictives déjà enregistrées sur cet appareil restent disponibles.</p><RouteLink to="/connexion" className="button button-dark">Me reconnecter <ArrowRight/></RouteLink><RouteLink to="/" className="button button-light">Retour à l’accueil</RouteLink></div></AuthLayout>;
  }
  if (screen === "auth.invitation") {
    return <AuthLayout title="Rejoindre Jet d’Encre" intro="L’École Al Manar vous invite à rejoindre son équipe pédagogique."><div className="pen-invitation-card"><span><UsersThree weight="duotone"/></span><div><small>INVITATION ENSEIGNANT</small><h2>Français · 5e AEP</h2><p>École Al Manar · Casablanca · Année scolaire 2026–2027</p></div></div><DemoNotice>Invitation fictive : aucun jeton ni compte réel n’est créé.</DemoNotice><button className="button button-dark button-wide" onClick={() => go("/connexion/enseignant")}>Accepter et me connecter <ArrowRight/></button><RouteLink to="/" className="button button-light button-wide">Décliner et revenir à l’accueil</RouteLink></AuthLayout>;
  }
  if (["activation.invalid", "activation.used", "activation.expired", "activation.success"].includes(screen)) {
    const states = {
      "activation.invalid": [WarningCircle, "Ce code n’est pas reconnu", "Vérifiez les lettres et les chiffres, puis recommencez.", "/activation", "Corriger le code"],
      "activation.used": [UserCircle, "Ce manuel est déjà activé", "Connectez-vous avec le compte qui a activé ce code pour retrouver le manuel.", "/connexion/eleve", "Me connecter"],
      "activation.expired": [Clock, "Ce code a expiré", "Demandez un nouveau code à votre établissement ou contactez l’assistance.", "/activation", "Essayer un autre code"],
      "activation.success": [CheckCircle, "Ton manuel est prêt !", "Créons maintenant ton profil pour personnaliser ton parcours.", "/eleve/onboarding/profil", "Créer mon profil"],
    };
    const [Icon, title, copy, to, label] = states[screen];
    return <AuthLayout title="Activation du manuel" intro="Un état clair pour savoir exactement quoi faire ensuite."><div className={`pen-activation-state ${screen === "activation.success" ? "success" : ""}`} role="status"><span><Icon weight="duotone"/></span><h2>{title}</h2><p>{copy}</p><RouteLink to={to} className="button button-dark">{label} <ArrowRight/></RouteLink>{screen !== "activation.success" && <RouteLink to="/" className="button button-light">Retour à l’accueil</RouteLink>}</div></AuthLayout>;
  }
  return null;
}

function Onboarding({ screen, ui }) {
  const { RouteLink } = ui;
  const { signIn } = useDemoStore();
  const [profile, setProfile] = useState(() => {
    let saved = {};
    try {
      saved = JSON.parse(sessionStorage.getItem("jde.student.onboarding.v1") || "{}");
    } catch {
      sessionStorage.removeItem("jde.student.onboarding.v1");
    }
    return { firstName: "Lina", lastName: "El Mansouri", language: "Français", school: "École Al Manar", className: "5A", avatar: 0, ...saved };
  });
  const save = (event, next) => { event.preventDefault(); sessionStorage.setItem("jde.student.onboarding.v1", JSON.stringify(profile)); if(next==="/eleve/tableau-de-bord"){const account=DEMO_ACCOUNTS.eleve;signIn("eleve",{identifier:account.identifier,password:account.password});} go(next); };
  const profileStep = screen === "student.onboarding-profile";
  return <main className="pen-onboarding-page"><aside className="pen-onboarding-aside"><img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions"/><span>PARCOURS ÉLÈVE</span><h1>Ton espace<br/>commence ici</h1><p>Deux étapes simples suffisent pour retrouver ton manuel, tes activités et ta classe.</p><ol><li className={profileStep ? "active" : "done"}><b>1</b><span><strong>Mon profil</strong><small>Choisir comment tu apparais</small></span></li><li className={!profileStep ? "active" : ""}><b>2</b><span><strong>Mon école et ma classe</strong><small>Rejoindre le bon groupe</small></span></li></ol><DemoNotice>Ces informations restent sur cet appareil de démonstration.</DemoNotice></aside><section className="pen-onboarding-main"><header><RouteLink to={profileStep ? "/activation" : "/eleve/onboarding/profil"}><ArrowLeft/> Revenir en arrière</RouteLink><span>Étape {profileStep ? "1" : "2"} sur 2 <i><b style={{ width: profileStep ? "50%" : "100%" }}/></i></span></header><form className="pen-onboarding-card" onSubmit={event => save(event, profileStep ? "/eleve/onboarding/classe" : "/eleve/tableau-de-bord")}><div className="pen-card-title"><span>{profileStep ? <Sparkle/> : <Buildings/>}</span><div><h2>{profileStep ? "Faisons connaissance !" : "Retrouve ton école et ta classe"}</h2><p>{profileStep ? "Ces informations personnalisent ton espace." : "Choisis le groupe indiqué par ton établissement."}</p></div></div>{profileStep ? <><fieldset className="pen-avatar-choice"><legend>Choisis ton avatar</legend>{[Sparkle, BookOpenText, Trophy, NotePencil].map((Avatar, index) => <button type="button" className={profile.avatar === index ? "active" : ""} aria-pressed={profile.avatar === index} onClick={() => setProfile({ ...profile, avatar: index })} key={index} aria-label={`Avatar ${index + 1}`}><Avatar/></button>)}</fieldset><div className="pen-form-grid"><label>Prénom<input value={profile.firstName} onChange={event => setProfile({ ...profile, firstName: event.target.value })} required/></label><label>Nom<input value={profile.lastName} onChange={event => setProfile({ ...profile, lastName: event.target.value })} required/></label></div><label>Langue d’aide<select value={profile.language} onChange={event => setProfile({ ...profile, language: event.target.value })}><option>Français</option><option>العربية</option><option>ⵜⴰⵎⴰⵣⵉⵖⵜ</option></select></label></> : <><label>École<select value={profile.school} onChange={event => setProfile({ ...profile, school: event.target.value })}><option>École Al Manar · Casablanca</option><option>École Al Amal · Rabat</option></select></label><fieldset className="pen-class-choice"><legend>Choisis ta classe</legend>{["5A", "5B", "6A"].map(name => <label className={profile.className === name ? "active" : ""} key={name}><input type="radio" name="class" checked={profile.className === name} onChange={() => setProfile({ ...profile, className: name })}/><strong>{name}</strong><span>{name.startsWith("5") ? "5e AEP" : "6e AEP"} · Français</span></label>)}</fieldset><DemoNotice>Ton établissement pourra seulement voir les informations nécessaires à ton suivi pédagogique.</DemoNotice></>}<div className="pen-form-actions"><button type="button" className="button button-light" onClick={() => profileStep ? go("/activation") : go("/eleve/onboarding/profil")}><ArrowLeft/> Revenir en arrière</button><button className="button button-gold" type="submit">{profileStep ? "Continuer" : "Entrer dans mon espace"} <ArrowRight/></button></div></form></section></main>;
}

function StudentManuals({ ui }) {
  const { PageHeader, ProgressBar, ResponsiveImage, RouteLink } = ui;
  const { manualActivations, manualProgress, session } = useDemoStore();
  const activation = [...manualActivations].reverse().find(item => item.userId === session.userId);
  const progress = [...manualProgress].reverse().find(item => item.userId === session.userId && (!activation || item.activationId === activation.id));
  const percent = Math.max(0, Math.min(100, Number(progress?.percent || 0)));
  return <><PageHeader eyebrow="MES MANUELS" title="Choisis ton manuel" subtitle="Retrouve tes leçons, tes activités et ta progression au même endroit." action={<RouteLink to="/activation" className="button button-light"><Plus/> Activer un manuel</RouteLink>}/><div className="pen-manual-grid"><article className="pen-manual-card featured"><ResponsiveImage fileName="generated-1774018865796.png" alt="Manuel de français Jet d’Encre niveau 5" sizes="(max-width: 900px) 100vw, 50vw"/><div><span className="status-pill success">EN COURS</span><h2>{activation?.manualTitle || "Français · 5e AEP"}</h2><p>Voyage au Maroc · Unité 3</p><ProgressBar value={percent} label="Progression"/><RouteLink to="/eleve/manuels/francais-5/lecons/lecon-2" className="button button-gold">Continuer la leçon <ArrowRight/></RouteLink></div></article><article className="pen-manual-card locked"><BookOpenText weight="duotone"/><h2>Un autre manuel ?</h2><p>Active le code imprimé dans ton livre pour l’ajouter ici.</p><RouteLink to="/activation" className="button button-light"><Key/> Saisir un code</RouteLink></article></div></>;
}

function StudentReader({ ui }) {
  const { PageHeader, ResponsiveImage, RouteLink } = ui;
  const [tab, setTab] = useState("manuel");
  const [zoom, setZoom] = useState(100);
  const [marked, setMarked] = useState(() => { try { return localStorage.getItem("jde.reader.bookmark") === "true"; } catch { return false; } });
  const [notes, setNotes] = useState(() => { try { return localStorage.getItem("jde.reader.notes") || ""; } catch { return ""; } });
  const [notice, setNotice] = useState("");
  const [showTranscript, setShowTranscript] = useState(() => readAccessibilityPreferences().autoTranscript);
  const [playing, setPlaying] = useState(false);
  const transcript = "Sur la plage, Lina observe les déchets laissés près de l’eau. Avec ses camarades, elle les ramasse, les trie et explique pourquoi chaque geste protège la mer.";
  const tabs = [["manuel","Manuel"],["activites","Activités · 3"],["ressources","Ressources · 2"],["notes","Mes notes"]];
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  const toggleBookmark = () => {
    const next = !marked;
    setMarked(next);
    try { localStorage.setItem("jde.reader.bookmark", String(next)); setNotice(next ? "Aperçu ajouté à tes favoris sur cet appareil." : "Aperçu retiré de tes favoris."); } catch { setNotice("Le navigateur empêche l’enregistrement du favori. Il sera perdu à la fermeture."); }
  };
  const saveNotes = () => {
    try { localStorage.setItem("jde.reader.notes", notes); setNotice("Tes notes sont enregistrées sur cet appareil."); } catch { setNotice("Tes notes n’ont pas pu être enregistrées. Garde cette page ouverte et copie-les avant de partir."); }
  };
  const toggleAudio = () => {
    if (!("speechSynthesis" in window)) {
      setNotice("La lecture vocale n’est pas disponible dans ce navigateur.");
      return;
    }
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      setNotice("Lecture arrêtée.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(transcript);
    utterance.lang = "fr-FR";
    utterance.rate = 0.9;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => { setPlaying(false); setNotice("La lecture vocale n’a pas pu démarrer."); };
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
    setNotice("Lecture vocale en cours.");
  };
  const moveTab = event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = tabs.findIndex(([key]) => key === tab);
    const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[index][0]);
    event.currentTarget.querySelectorAll('[role="tab"]')[index]?.focus();
  };
  return <><PageHeader eyebrow="MES MANUELS · FRANÇAIS 5e AEP" title="Leçon 2 · Protégeons notre environnement" subtitle="Aperçu illustratif du projet éditorial · manuel complet non disponible dans cette démonstration" action={<div className="pen-reader-actions"><button className="button button-light" onClick={toggleBookmark}><CheckCircle weight={marked ? "fill" : "regular"}/> {marked ? "Marquée" : "Marquer"}</button><button className="button button-light" onClick={() => setTab("notes")}><NotePencil/> Mes notes</button></div>}/>{notice && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Mise à jour</strong><small>{notice}</small></span></div>}<div className="pen-reader-tabs" role="tablist" aria-label="Contenu de la leçon" onKeyDown={moveTab}>{tabs.map(([key,label]) => <button id={"reader-tab-" + key} aria-controls={"reader-panel-" + key} tabIndex={tab === key ? 0 : -1} key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>
  {tab === "manuel" && <div id="reader-panel-manuel" role="tabpanel" aria-labelledby="reader-tab-manuel"><div className="pen-reader-layout"><section className="pen-reader-viewer"><div className="pen-reader-toolbar"><button type="button" aria-label="Zoom arrière" disabled={zoom <= 80} onClick={() => setZoom(value => Math.max(80, value - 10))}>−</button><span>{zoom} %</span><button type="button" aria-label="Zoom avant" disabled={zoom >= 140} onClick={() => setZoom(value => Math.min(140, value + 10))}>+</button><button type="button" aria-pressed={showTranscript} onClick={() => setShowTranscript(value => !value)}>Transcription</button></div><div className="pen-reader-zoom" style={{ width: zoom + "%" }}><ResponsiveImage fileName="generated-1773971894915.png" alt="Maquette illustrative de double page, sans correspondance avec un manuel publié" eager sizes="(max-width: 900px) 100vw, 68vw"/></div>{showTranscript && <div className="pen-reader-transcript"><strong>Texte d’entraînement indépendant de l’illustration</strong><p>{transcript}</p></div>}<footer><span>Illustration fixe · aucune pagination de manuel</span><RouteLink to="/eleve/mediatheque">Ouvrir un vrai PDF dans la Médiathèque <ArrowRight/></RouteLink></footer></section><aside className="pen-reader-resources"><h2>Autour de cette leçon</h2><button type="button" onClick={toggleAudio}><Headphones/><span><strong>Une journée à la plage</strong><small>Synthèse vocale · texte d’entraînement</small></span><CaretRight/></button><RouteLink to="/eleve/activites/mots-environnement"><Sparkle/><span><strong>Les mots de l’environnement</strong><small>Quiz · 4 min</small></span><CaretRight/></RouteLink><div className="pen-tip"><Sparkle/><strong>Astuce</strong><p>Écoute l’audio puis décris un lieu près de chez toi.</p></div></aside></div><div className="pen-audio-player"><button type="button" aria-label={playing ? "Arrêter la lecture vocale" : "Lire le texte de la leçon"} onClick={toggleAudio}><PlayCircle weight="fill"/></button><span><strong>Une journée à la plage · lecture vocale</strong><i><b style={{ width: playing ? "45%" : "0%" }}/></i></span><small>{playing ? "Lecture en cours" : "Prêt"}</small></div></div>}
  {tab === "activites" && <section id="reader-panel-activites" role="tabpanel" aria-labelledby="reader-tab-activites" className="pen-reader-panel-grid"><RouteLink to="/eleve/activites/mots-environnement"><Sparkle weight="duotone"/><span><strong>Les mots de l’environnement</strong><small>Quiz · 5 questions · 50 XP</small></span><ArrowRight/></RouteLink><RouteLink to="/eleve/jeux/mot-juste"><NotePencil weight="duotone"/><span><strong>Le Mot juste</strong><small>Lexique et accords · 10 questions</small></span><ArrowRight/></RouteLink><RouteLink to="/eleve/devoirs"><PaperPlaneTilt weight="duotone"/><span><strong>Décrire mon quartier</strong><small>Tâche finale · production écrite</small></span><ArrowRight/></RouteLink></section>}
  {tab === "ressources" && <section id="reader-panel-ressources" role="tabpanel" aria-labelledby="reader-tab-ressources" className="pen-reader-panel-grid"><button type="button" onClick={toggleAudio}><Headphones weight="duotone"/><span><strong>Dialogue : une journée à la plage</strong><small>Lecture vocale et transcription</small></span><PlayCircle/></button><RouteLink to="/eleve/mediatheque"><BookOpenText weight="duotone"/><span><strong>Livres PDF disponibles</strong><small>Ouvrir le catalogue de la Médiathèque</small></span><ArrowRight/></RouteLink></section>}
  {tab === "notes" && <section id="reader-panel-notes" role="tabpanel" aria-labelledby="reader-tab-notes" className="panel pen-reader-notes"><h2>Mes notes sur la leçon</h2><p>Écris les mots importants ou une phrase que tu veux réutiliser.</p><label htmlFor="reader-notes">Notes personnelles</label><textarea id="reader-notes" value={notes} maxLength={1200} onChange={event => setNotes(event.target.value)} placeholder="Exemple : protéger, trier, réutiliser…"/><div><small>{notes.length} / 1 200</small><button className="button button-dark" type="button" onClick={saveNotes}><Check/> Enregistrer mes notes</button></div></section>}</>;
}

function StudentExercise({ ui, params }) {
  const { PageHeader, RouteLink } = ui;
  const { completeLearningActivity } = useDemoStore();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [checked, setChecked] = useState(false);
  const [notice, setNotice] = useState("");
  const [attemptId] = useState(() => `learning-${globalThis.crypto.randomUUID()}`);
  const activity = ENVIRONMENT_ACTIVITY;
  const question = activity.questions[questionIndex];
  if (params.activityId !== activity.id) return <SystemState params={{ systemState: "page-introuvable" }} ui={ui}/>;
  const next = () => {
    if (!checked) { setChecked(true); return; }
    const nextAnswers = [...answers, answer];
    if (questionIndex === activity.questions.length - 1) {
      const result = completeLearningActivity({ attemptId, activityId: activity.id, answers: nextAnswers });
      if (result.ok) go(`/eleve/activites/${activity.id}/resultat`);
      else setNotice(result.message);
      return;
    }
    setAnswers(nextAnswers); setQuestionIndex(index => index + 1); setAnswer(null); setChecked(false);
  };
  return <><PageHeader eyebrow="ENTRAÎNEMENT · VOCABULAIRE" title={activity.title} subtitle="Lis la question, choisis une réponse, puis prends le temps de lire la correction."/><section className="pen-exercise-card"><div className="pen-exercise-progress"><span>{questionIndex + 1} / {activity.questions.length}</span><i><b style={{ width: `${(questionIndex + 1) * 20}%` }}/></i><strong>10 XP par réponse réussie une première fois</strong></div><h2>{question.prompt}</h2><div className="pen-answer-grid">{question.options.map((option,index) => <label className={answer === index ? "selected" : ""} key={question.id + index}><input type="radio" name="answer" value={index} disabled={checked} checked={answer === index} onChange={() => setAnswer(index)}/><b>{String.fromCharCode(65 + index)}</b><span>{option}</span></label>)}</div>{checked && <div className="pen-reader-transcript" role="status"><strong>{answer === question.correctIndex ? "Bonne réponse !" : "La bonne réponse : " + question.options[question.correctIndex]}</strong><p>{question.explanation}</p></div>}{notice && <p role="alert">{notice}</p>}<div className="pen-form-actions"><RouteLink to="/eleve/manuels/francais-5/lecons/lecon-2" className="button button-light"><ArrowLeft/> Retour à l’aperçu</RouteLink><button type="button" disabled={answer === null} className="button button-gold" onClick={next}>{!checked ? "Vérifier ma réponse" : questionIndex === 4 ? "Voir mon bilan" : "Question suivante"} <ArrowRight/></button></div></section></>;
}

function StudentExerciseResult({ ui, params, studentXp }) {
  const { PageHeader, ProgressBar, RouteLink } = ui;
  const { quizAttempts, session } = useDemoStore();
  const attempt = quizAttempts.find(item => item.quizId === params.activityId && item.userId === session.userId && item.experienceType === "learning-activity");
  if (!attempt) return <><PageHeader title="Pas encore de résultat" subtitle="Termine les cinq questions pour obtenir ton bilan."/><RouteLink to="/eleve/activites/mots-environnement" className="button button-gold">Commencer l’activité <ArrowRight/></RouteLink></>;
  return <><PageHeader eyebrow="ACTIVITÉ TERMINÉE · BILAN LOCAL" title={attempt.correctCount === 5 ? "Les cinq réponses sont justes !" : "Voici ton bilan"} subtitle="Chaque réponse compte. Une erreur t’aide à repérer les mots à revoir."/><section className="pen-result-hero"><div className="pen-result-score">{attempt.correctCount === 5 ? <Trophy weight="duotone"/> : <BookOpenText weight="duotone"/>}<strong>{attempt.correctCount} / {attempt.questionCount}</strong><span>Réponses correctes</span></div><div><span className="eyebrow">+ {attempt.xpEarned} XP lors de cette tentative</span><h2>{attempt.correctCount === 5 ? "Tu as réussi cette activité" : "Relis les corrections avant de réessayer"}</h2><p>Ce score concerne uniquement ces cinq questions. Il ne valide pas à lui seul une unité ou une compétence entière. Chaque question ne rapporte ses XP qu’une fois.</p><ProgressBar value={attempt.scorePercent} label="Réussite dans cette activité"/><div><RouteLink to="/eleve/activites/mots-environnement" className="button button-gold">M’entraîner à nouveau <ArrowRight/></RouteLink><RouteLink to="/eleve/progression" className="button button-light">Voir mes progrès</RouteLink></div><small>Solde du profil : {studentXp} XP · Démonstration enregistrée sur cet appareil</small></div></section><section className="panel"><h2>Mes réponses et leurs explications</h2>{attempt.corrections.map((correction,index) => <article key={correction.questionId} className="pen-reader-transcript"><h3>{index + 1}. {ENVIRONMENT_ACTIVITY.questions[index].prompt}</h3><p><strong>{correction.correct ? "Réponse correcte" : "À revoir"} :</strong> {ENVIRONMENT_ACTIVITY.questions[index].options[correction.answer]}</p>{!correction.correct && <p><strong>Bonne réponse :</strong> {ENVIRONMENT_ACTIVITY.questions[index].options[correction.correctIndex]}</p>}<p>{correction.explanation}</p></article>)}</section></>;
}

function StudentSubmitted({ ui, params }) {
  const { RouteLink } = ui;
  const { assignments, submissions, session } = useDemoStore();
  const assignment = assignments.find(item => item.id === params.assignmentId);
  const submission = [...submissions].reverse().find(item => item.assignmentId === params.assignmentId && item.studentId === session.userId);
  if (!assignment || !submission) return <SystemState params={{ systemState: "page-introuvable" }} ui={ui}/>;
  const submittedAt = new Date(submission.submittedAt);
  const dateLabel = Number.isNaN(submittedAt.getTime()) ? "À l’instant" : submittedAt.toLocaleString("fr-MA", { dateStyle: "medium", timeStyle: "short" });
  return <section className="pen-confirmation-page"><span><CheckCircle weight="duotone"/></span><small>DEVOIR REMIS</small><h1>Ton travail est enregistré ici !</h1><p>Démonstration : la remise est consultable dans l’espace enseignant sur ce même navigateur. Aucun envoi à une école réelle n’a été effectué.</p><div><span><strong>{assignment.title}</strong><small>Référence {assignment.id}</small></span><span><strong>{dateLabel}</strong><small>Copie conservée sur cet appareil</small></span></div><RouteLink to="/eleve/devoirs" className="button button-dark">Retour à mes devoirs <ArrowRight/></RouteLink><RouteLink to="/eleve/tableau-de-bord" className="button button-light">Aller à l’accueil</RouteLink></section>;
}

function StudentProfile({ ui }) {
  const { PageHeader, RouteLink } = ui;
  const [active, setActive] = useState("profil");
  const [textSize, setTextSize] = useState(() => readAccessibilityPreferences().textSize);
  const [reduceMotion, setReduceMotion] = useState(() => readAccessibilityPreferences().reduceMotion);
  const [autoTranscript, setAutoTranscript] = useState(() => readAccessibilityPreferences().autoTranscript);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const preferences = { textSize, reduceMotion, autoTranscript };
    applyAccessibilityPreferences(preferences);
    const result = saveAccessibilityPreferences(preferences);
    if (!result.ok) setNotice("Préférences appliquées pour cette visite, mais le navigateur empêche leur enregistrement.");
  }, [textSize, reduceMotion, autoTranscript]);
  const requestAdult = () => setNotice("Démonstration : aucun message n’a été envoyé. Si tu as besoin d’aide, préviens directement un parent, ton enseignant ou un adulte de confiance.");
  return <><PageHeader eyebrow="MON COMPTE" title="Profil & aide" subtitle="Personnalise ton espace et retrouve de l’aide quand tu en as besoin."/>{notice && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Information</strong><small>{notice}</small></span></div>}<div className="pen-profile-layout"><nav aria-label="Profil et aide">{[["profil",UserCircle,"Mon profil"],["accessibilite",Sparkle,"Confort de lecture"],["aide",ShieldCheck,"Aide et sécurité"]].map(([key,Icon,label]) => <button type="button" aria-current={active === key ? "page" : undefined} className={active === key ? "active" : ""} onClick={() => setActive(key)} key={key}><Icon/><span>{label}</span><CaretRight/></button>)}</nav><section className="panel"><h2>{active === "profil" ? "Mon profil" : active === "accessibilite" ? "Confort de lecture" : "Comment pouvons-nous t’aider ?"}</h2>{active === "profil" && <div className="pen-profile-card"><span>LM</span><div><strong>Lina Mansouri</strong><small>5A · École Al Manar</small></div><button className="button button-light" type="button" onClick={() => setNotice("Choisis un nouvel avatar lors de ton prochain passage dans l’onboarding.")}>Modifier l’avatar</button></div>}{active === "accessibilite" && <div className="pen-settings-list"><label>Taille du texte<select value={textSize} onChange={event => setTextSize(event.target.value)}><option>Standard</option><option>Confortable</option><option>Grand</option></select></label><label><span>Limiter les animations</span><input type="checkbox" checked={reduceMotion} onChange={event => setReduceMotion(event.target.checked)}/></label><label><span>Transcription automatique</span><input type="checkbox" checked={autoTranscript} onChange={event => setAutoTranscript(event.target.checked)}/></label><p className="pen-setting-preview">Aperçu : le français devient plus confortable à lire.</p></div>}{active === "aide" && <div className="pen-help-grid"><RouteLink to="/eleve/etat-systeme/hors-connexion"><WarningCircle/><strong>Un problème de connexion</strong><span>Vérifier et réessayer</span></RouteLink><button type="button" onClick={requestAdult}><Megaphone/><strong>Contacter un adulte</strong><span>Savoir comment demander de l’aide</span></button></div>}</section></div></>;
}

function SystemState({ screen, params, ui, role = "eleve" }) {
  const { RouteLink } = ui;
  const state = params.systemState || "vide";
  const admin = role === "admin";
  const variants = {
    "hors-connexion": [CloudArrowUp, "Tu es hors connexion", "Vérifie le Wi-Fi puis réessaie. Ton travail enregistré reste disponible."],
    "page-introuvable": [MagnifyingGlass, "Cette page n’existe pas", "Le lien est peut-être ancien. Reviens à ton espace pour continuer."],
    forbidden: [LockKey, "Accès non autorisé", "Ton rôle ne permet pas de réaliser cette action."],
    failed: [WarningCircle, "La publication a échoué", "Le contenu est conservé. Tu peux réessayer sans perdre les modifications."],
    refuse: [NotePencil, "Corrections demandées", "Consulte les commentaires éditoriaux avant de renvoyer le contenu."],
    vide: [FolderOpen, admin ? "Aucun élément à afficher" : "Rien à afficher pour le moment", "Modifie les filtres ou reviens plus tard."],
  };
  const [Icon,title,copy] = variants[state] || variants.vide;
  return <section className="pen-system-state"><span><Icon weight="duotone"/></span><small>{admin ? "ÉTAT DU CYCLE ÉDITORIAL" : "BESOIN D’AIDE ?"}</small><h1>{title}</h1><p>{copy}</p><RouteLink to={admin ? "/admin/bibliotheque" : "/eleve/tableau-de-bord"} className="button button-dark">Revenir à mon espace <ArrowRight/></RouteLink><button className="button button-light" onClick={() => location.reload()}>Réessayer</button></section>;
}

function TeacherFlow({ screen, params, ui }) {
  const { PageHeader, ProgressBar, RouteLink } = ui;
  const { assignments, submissions, createAssignment, updateAssignment, reviewSubmission, notify } = useDemoStore();
  const assignment = params.assignmentId ? assignments.find(item => item.id === params.assignmentId) : null;
  const related = assignment ? submissions.filter(item => item.assignmentId === assignment.id) : [];
  const submission = params.submissionId ? submissions.find(item => item.id === params.submissionId) : null;
  const resolvedAssignment = assignment || (submission ? assignments.find(item => item.id === submission.assignmentId) : null);
  const [title, setTitle] = useState(assignment?.title || "Décrire mon quartier idéal");
  const [instructions, setInstructions] = useState(assignment?.instructions || "Décris ton quartier idéal en cinq phrases. Utilise cinq adjectifs pour parler des rues, des bâtiments ou des espaces verts.");
  const [assignmentClass, setAssignmentClass] = useState("5A");
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [score, setScore] = useState(submission?.score ?? "");
  const [feedback, setFeedback] = useState(submission?.feedback || "");
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  if (screen === "teacher.assignment-new") {
    const submit = event => { event.preventDefault(); const result = createAssignment({ title, instructions, subject: "Français", level: "5e AEP", classId: `classe-${assignmentClass.toLowerCase()}`, className: assignmentClass, dueAt: dueDate, submissionType: "text", status: "Brouillon", expectedSubmissions: assignmentClass === "5A" ? 29 : 28, submissions: 0 }); if (result.ok) go(`/enseignant/devoirs/${result.item.id}/previsualisation`); else setNotice(result.message); };
    return <><PageHeader eyebrow="NOUVEAU DEVOIR" title="Créer un devoir" subtitle="Préparez la consigne, le public et l’échéance avant la prévisualisation."/><div className="pen-workflow-steps"><span className="active">1 · Informations</span><span>2 · Contenu</span><span>3 · Vérification</span><span>4 · Publication</span></div><form className="panel pen-editor-form" onSubmit={submit}><div className="pen-form-grid"><label>Titre du devoir<input value={title} onChange={event => setTitle(event.target.value)} required/></label><label>Classe<select value={assignmentClass} onChange={event => setAssignmentClass(event.target.value)}><option value="5A">5A · groupe de démonstration</option><option value="5B">5B · groupe de démonstration</option></select></label></div><label>Consigne<textarea value={instructions} onChange={event => setInstructions(event.target.value)} required/></label><div className="pen-form-grid"><label>Type de remise<select value="text" onChange={() => {}}><option value="text">Texte court · disponible</option><option disabled>Audio · à venir</option><option disabled>Fichier · à venir</option></select></label><label>Échéance (jour)<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} required/></label></div><DemoNotice>Démonstration locale : aucun devoir n’est transmis à une école réelle.</DemoNotice>{notice && <p role="alert">{notice}</p>}<div className="pen-form-actions"><RouteLink to="/enseignant/devoirs" className="button button-light">Annuler</RouteLink><button className="button button-dark" type="submit">Prévisualiser <ArrowRight/></button></div></form></>;
  }
  if (screen === "teacher.assignment-preview") {
    if (!assignment) return <SystemState params={{ systemState: "page-introuvable" }} ui={ui}/>;
    const publish = () => { const result = updateAssignment(assignment.id, { status: "Publié" }); if (!result.ok) { setNotice(result.message); return; } if (assignment.classId === "classe-5a") notify({ role: "eleve", userId: DEMO_ACCOUNTS.eleve.userId, title: `Devoir local publié · ${assignment.title}`, message: "Le devoir est disponible dans la démonstration sur cet appareil.", action: `/eleve/devoirs/${assignment.id}` }); go(`/enseignant/devoirs/${assignment.id}/remises`); };
    return <><PageHeader eyebrow="PRÉVISUALISATION" title={assignment.title} subtitle={`Classe ${assignment.className} · Remise texte · ${new Date(assignment.dueAt).toLocaleDateString("fr-MA")}`} action={<button className="button button-dark" onClick={publish}><PaperPlaneTilt/> Publier dans la démo</button>}/><div className="pen-preview-layout"><section className="panel pen-student-preview"><span className="status-pill warning">À FAIRE</span><h2>{assignment.title}</h2><p>{assignment.instructions}</p><div className="pen-audio-drop"><Headphones weight="duotone"/><strong>Répondre à la consigne</strong><span>Réponse écrite, enregistrée dans ce navigateur</span></div></section><aside className="panel"><h2>À relire avant publication</h2><p>La consigne est-elle compréhensible ? Vérifiez la classe, l’échéance et les aides nécessaires avant de publier cette démonstration.</p><p>La remise est un texte court. Aucun enregistrement audio n’est demandé par l’interface.</p>{notice && <p role="alert">{notice}</p>}<RouteLink to="/enseignant/devoirs" className="button button-light button-wide">Revenir à la liste</RouteLink></aside></div></>;
  }
  if (screen === "teacher.submissions") {
    if (!assignment) return <SystemState params={{ systemState: "page-introuvable" }} ui={ui}/>;
    const remind = () => { notify({ role: "eleve", title: `Rappel · ${assignment.title}`, userId: assignment.classId === "classe-5b" ? "demo-no-student-in-5b" : DEMO_ACCOUNTS.eleve.userId, message: "Pense à remettre ta réponse avant l’échéance (démonstration locale).", action: `/eleve/devoirs/${assignment.id}` }); setNotice("Rappel ajouté localement dans ce navigateur. Aucun message envoyé à des élèves réels."); };
    return <><PageHeader eyebrow="SUIVI DES REMISES" title={assignment.title} subtitle={`${related.length} remise${related.length > 1 ? "s" : ""} reçue${related.length > 1 ? "s" : ""} · Classe ${assignment.className}`}/>{notice && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Rappel préparé</strong><small>{notice}</small></span></div>}<div className="pen-submission-summary"><ProgressBar value={assignment.expectedSubmissions ? Math.min(100, Math.round((related.length / assignment.expectedSubmissions) * 100)) : 0} label="Remises reçues · effectif de démonstration"/><button className="button button-light" onClick={remind}><Megaphone/> Relancer les élèves</button></div><div className="list-panel">{related.length ? related.map(item => <article className="pen-submission-row" key={item.id}><span>{item.studentName.split(" ").map(part => part[0]).join("").slice(0,2)}</span><div><h3>{item.studentName}</h3><p>{item.status} · {item.mediaType === "audio" ? "remise audio" : "remise texte"}</p></div><span className={`status-pill ${item.status === "Corrigé" ? "success" : "warning"}`}>{item.status}</span><RouteLink to={`/enseignant/remises/${item.id}/correction-audio`} className="button button-light">Corriger <CaretRight/></RouteLink></article>) : <div className="empty-state"><ClipboardText/><h2>Aucune remise</h2><p>Les réponses des élèves apparaîtront ici.</p></div>}</div></>;
  }
  if (screen === "teacher.audio-correction") {
    if (!submission || !resolvedAssignment) return <SystemState params={{ systemState: "page-introuvable" }} ui={ui}/>;
    const submit = event => { event.preventDefault(); const result = reviewSubmission(submission.id, { score, feedback }); setNoticeError(!result.ok); setNotice(result.ok ? "Correction enregistrée dans la démonstration de cet appareil. Aucun envoi à une école réelle." : result.message); };
    return <><PageHeader eyebrow="CORRECTION DE LA REMISE" title={submission.studentName} subtitle={`${resolvedAssignment.title} · Classe ${resolvedAssignment.className}`}/>{notice && <div className={noticeError ? "form-error" : "editor-success"} role={noticeError ? "alert" : "status"}>{noticeError ? <WarningCircle weight="fill"/> : <CheckCircle weight="fill"/>}<span><strong>État de la correction</strong><small>{notice}</small></span></div>}<div className="pen-audio-correction"><section className="panel"><h2>{submission.mediaType === "audio" ? "Écouter la remise" : "Lire la remise"}</h2>{submission.mediaType === "audio" ? <><p>Le fichier audio n’est pas disponible dans cette remise de démonstration.</p><p className="pen-transcript"><strong>Texte associé, non transcrit automatiquement :</strong> {submission.answer}</p></> : <blockquote className="pen-text-submission">{submission.answer}</blockquote>}</section><form className="panel" onSubmit={submit}><label>Note sur 20<input type="number" min="0" max="20" value={score} onChange={event => setScore(event.target.value)} required/></label><label>Commentaire formatif<textarea value={feedback} onChange={event => setFeedback(event.target.value)} required/></label><button className="button button-dark button-wide"><PaperPlaneTilt/> Enregistrer la correction</button></form></div></>;
  }
  return null;
}

function DirectorFlow({ screen, params = {}, ui }) {
  const { PageHeader, ProgressBar, RouteLink } = ui;
  const { notify } = useDemoStore();
  const [teacher, setTeacher] = useState("Imane Ziani");
  const [classes, setClasses] = useState(["6B", "6C"]);
  const [confirmed, setConfirmed] = useState(false);
  const [verified, setVerified] = useState(false);
  const [actionNotice, setActionNotice] = useState("");
  const [batchCount, setBatchCount] = useState(0);
  const [schoolEditing, setSchoolEditing] = useState(false);
  const [school, setSchool] = useState({ name: "École Al Manar", city: "Casablanca", director: "M. Benjelloun" });
  const [classDraft, setClassDraft] = useState({
    name: params.classId ? String(params.classId).toUpperCase() : "",
    level: params.classId?.startsWith("4") ? "4e AEP" : params.classId?.startsWith("6") ? "6e AEP" : "5e AEP",
    teacher: params.classId === "4b" ? "Non affecté" : "Salma Benjelloun",
  });
  useEffect(() => {
    if (screen !== "director.class") return;
    setClassDraft({
      name: params.classId ? String(params.classId).toUpperCase() : "",
      level: params.classId?.startsWith("4") ? "4e AEP" : params.classId?.startsWith("6") ? "6e AEP" : "5e AEP",
      teacher: params.classId === "4b" ? "Non affecté" : "Salma Benjelloun",
    });
    setActionNotice("");
  }, [params.classId, params.mode, screen]);
  if (screen === "director.class") {
    const creating = params.mode === "create";
    const submit = event => {
      event.preventDefault();
      const name = classDraft.name.trim().toUpperCase();
      if (!name) return;
      setActionNotice(creating ? `La classe ${name} a été créée dans la démonstration.` : `La fiche de la classe ${name} a été mise à jour.`);
      notify({ role: "directeur", title: creating ? `Classe ${name} créée` : `Classe ${name} mise à jour`, message: `${classDraft.level} · ${classDraft.teacher}`, action: "/directeur/classes" });
    };
    return <><PageHeader eyebrow={creating ? "NOUVELLE CLASSE" : "ORGANISATION"} title={creating ? "Créer une classe" : `Classe ${classDraft.name}`} subtitle="Groupe scolaire Al Manar · Année scolaire 2026–2027" action={<RouteLink to="/directeur/classes" className="button button-light"><ArrowLeft/> Retour aux classes</RouteLink>}/>{actionNotice && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Classe enregistrée</strong><small>{actionNotice}</small></span></div>}<form className="panel pen-editor-form" onSubmit={submit}><div className="form-two"><label>Nom de la classe<input value={classDraft.name} onChange={event => setClassDraft({ ...classDraft, name: event.target.value })} placeholder="Ex. 5C" required/></label><label>Niveau<select value={classDraft.level} onChange={event => setClassDraft({ ...classDraft, level: event.target.value })}><option>4e AEP</option><option>5e AEP</option><option>6e AEP</option></select></label></div><label>Enseignant principal<select value={classDraft.teacher} onChange={event => setClassDraft({ ...classDraft, teacher: event.target.value })}><option>Non affecté</option><option>Salma Benjelloun</option><option>Omar El Idrissi</option><option>Nadia Bakkali</option><option>Mehdi Amrani</option></select></label><DemoNotice>Cette opération est enregistrée localement. La synchronisation avec le référentiel de l’établissement fait partie du raccordement de production.</DemoNotice><button className="button button-dark" type="submit"><Check/> {creating ? "Créer la classe" : "Enregistrer les changements"}</button></form></>;
  }
  if (screen === "director.assignments") {
    const toggle = name => setClasses(items => items.includes(name) ? items.filter(item => item !== name) : [...items, name]);
    const confirm = () => {
      if (!verified || classes.length === 0) return;
      setConfirmed(true);
      notify({ role: "directeur", title: "Affectation enregistrée", message: teacher + " · " + classes.join(", "), action: "/directeur/affectations" });
    };
    return <><PageHeader eyebrow="ÉCOLE AL MANAR · AFFECTATIONS" title="Affecter les enseignants" subtitle="Associez un enseignant à une ou plusieurs classes en contrôlant sa charge." action={<button className="button button-dark" onClick={() => document.getElementById("director-confirm-assignment")?.focus()}><Plus/> Affecter</button>}/>{confirmed && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Affectation enregistrée</strong><small>{teacher} est maintenant associée aux classes {classes.join(" et ")}.</small></span></div>}<div className="pen-assignment-columns"><section><h2>1. Enseignant</h2>{["Imane Ziani", "Salma Idrissi", "Youssef Amrani", "Nadia El Fassi"].map(name => <button type="button" className={teacher === name ? "active" : ""} onClick={() => { setTeacher(name); setConfirmed(false); }} key={name}><span>{name.split(" ").map(x => x[0]).join("")}</span><span><strong>{name}</strong><small>{name === "Imane Ziani" ? "0 classe · disponibilité complète" : "2 classes · 12 h/semaine"}</small></span>{teacher === name && <Check/>}</button>)}</section><section><h2>2. Classes</h2>{["6B", "6C", "5B", "4C"].map(name => <label className={classes.includes(name) ? "active" : ""} key={name}><input type="checkbox" checked={classes.includes(name)} onChange={() => { toggle(name); setConfirmed(false); }}/><span><strong>{name}</strong><small>{["6B","6C"].includes(name) ? "Sans enseignant" : "Déjà affectée"}</small></span></label>)}</section><section><h2>3. Vérification</h2><div className="pen-summary-card"><strong>{teacher}</strong><span>{classes.length ? classes.join(" et ") : "Aucune classe"} · charge à confirmer</span><small>12 h / semaine · charge recommandée</small></div><div className="pen-conflict"><WarningCircle/><strong>Conflit détecté</strong><p>La classe 6C est réservée par une invitation encore en attente.</p></div><label className="pen-confirm-check"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)}/> J’ai vérifié la charge et le conflit.</label><button id="director-confirm-assignment" type="button" className="button button-dark" disabled={!verified || classes.length === 0} onClick={confirm}><Check/> Confirmer l’affectation</button></section></div></>;
  }
  if (screen === "director.activation") {
    const generate = () => { const next = batchCount + 1; setBatchCount(next); setActionNotice("Lot fictif LOT-ALM-" + String(next).padStart(3, "0") + " généré sans exposer de codes."); notify({ role: "directeur", title: "Lot d’activation préparé", message: "36 accès à distribuer", action: "/directeur/eleves/activation" }); };
    const remind = name => { setActionNotice("Relance préparée pour la classe " + name + "."); notify({ role: "directeur", title: "Relance activation · " + name, message: "Le message est prêt pour les familles.", action: "/directeur/eleves/activation" }); };
    return <><PageHeader eyebrow="ÉLÈVES & ACTIVATION" title="Piloter les activations" subtitle="Importez les élèves, rattachez les classes et préparez les relances." action={<button type="button" className="button button-dark" onClick={generate}><Key/> Générer un lot</button>}/>{actionNotice && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Action terminée</strong><small>{actionNotice}</small></span></div>}<div className="pen-activation-overview"><div><strong>94 %</strong><span>618 élèves activés sur 654</span></div><ProgressBar value={94} label="Taux global"/><button type="button" className="button button-gold" onClick={() => remind("toutes les classes")}><Megaphone/> Relancer 36 familles</button></div><div className="data-table"><table><caption className="sr-only">Activation des élèves</caption><thead><tr><th>Classe</th><th>Élèves</th><th>Activés</th><th>Restants</th><th>Action</th></tr></thead><tbody>{[["5A",29,28],["5B",28,26],["6B",31,27],["6C",28,25]].map(([name,total,active]) => <tr key={name}><td><strong>{name}</strong></td><td>{total}</td><td>{active}</td><td>{total-active}</td><td><button type="button" className="button button-light" onClick={() => remind(name)}>Relancer</button></td></tr>)}</tbody></table></div></>;
  }
  if (screen === "director.school") {
    const saveSchool = event => { event.preventDefault(); setSchoolEditing(false); setActionNotice("Fiche établissement mise à jour."); notify({ role: "directeur", title: "Fiche établissement mise à jour", message: school.name, action: "/directeur/etablissement" }); };
    const support = () => { const reference = "SUP-" + String(Date.now()).slice(-6); setActionNotice("Demande d’assistance " + reference + " enregistrée."); notify({ role: "directeur", title: "Demande d’assistance", message: reference, action: "/directeur/etablissement" }); };
    return <><PageHeader eyebrow="ÉTABLISSEMENT" title={school.name} subtitle={school.city + " · Année scolaire 2026–2027"} action={<button type="button" className="button button-dark" onClick={() => setSchoolEditing(value => !value)}><Buildings/> {schoolEditing ? "Fermer l’édition" : "Modifier la fiche"}</button>}/>{actionNotice && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Action confirmée</strong><small>{actionNotice}</small></span></div>}<div className="pen-school-grid"><section className="panel"><h2>Profil officiel</h2>{schoolEditing ? <form className="pen-editor-form" onSubmit={saveSchool}><label>Nom<input value={school.name} onChange={event => setSchool({ ...school, name: event.target.value })} required/></label><label>Ville<input value={school.city} onChange={event => setSchool({ ...school, city: event.target.value })} required/></label><label>Direction<input value={school.director} onChange={event => setSchool({ ...school, director: event.target.value })} required/></label><button className="button button-dark" type="submit"><Check/> Enregistrer</button></form> : <dl><div><dt>Directeur</dt><dd>{school.director}</dd></div><div><dt>Classes</dt><dd>18 classes actives</dd></div><div><dt>Équipe</dt><dd>42 enseignants</dd></div><div><dt>Licence</dt><dd>Valide jusqu’au 31 août 2027</dd></div></dl>}</section><section className="panel"><h2>Santé du service</h2><ProgressBar value={82} label="Santé globale"/><ProgressBar value={94} label="Activations"/><ProgressBar value={78} label="Synchronisation"/></section><aside className="panel pen-assistance"><ShieldCheck weight="duotone"/><h2>Besoin d’assistance ?</h2><p>Décrivez le problème rencontré. Un numéro de suivi fictif sera créé.</p><button type="button" className="button button-gold" onClick={support}><Megaphone/> Contacter l’assistance</button><RouteLink to="/directeur/suivi-utilisation" className="button button-light">Voir les alertes</RouteLink></aside></div></>;
  }
  return null;
}

function AdminFlow({ screen, params, ui }) {
  const { PageHeader, RouteLink } = ui;
  const { contents, updateContent, createContent, notify } = useDemoStore();
  const existingContent = params.contentId ? contents.find(item => item.id === params.contentId) : null;
  const content = existingContent || { id: "", title: "Nouveau contenu Jet d’Encre", type: "Podcast", status: "Brouillon", level: "5e AEP" };
  const [title, setTitle] = useState(content.title);
  const [date, setDate] = useState("2026-09-15");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState(null);
  const [playing, setPlaying] = useState(false);
  const fileRef = useRef(null);
  const patchAndGo = (patch, destination, message) => { if (content.id && contents.some(item => item.id === content.id)) updateContent(content.id, patch); notify({ role: "admin", title: message, message: title, action: destination }); go(destination); };
  const togglePreviewAudio = () => {
    if (!("speechSynthesis" in window)) { setNotice("La lecture vocale n’est pas disponible dans ce navigateur."); return; }
    if (playing) { window.speechSynthesis.cancel(); setPlaying(false); return; }
    const utterance = new SpeechSynthesisUtterance("Bienvenue dans Les voix du Maroc. Écoutez les sons du quartier, repérez les lieux puis racontez votre propre trajet.");
    utterance.lang = "fr-FR";
    utterance.onend = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  };
  if (screen !== "admin.studio" && screen !== "admin.system" && !existingContent) return <SystemState params={{ systemState: "page-introuvable" }} ui={ui} role="admin"/>;
  if (screen === "admin.studio" && params.mode === "edit" && !existingContent) return <SystemState params={{ systemState: "page-introuvable" }} ui={ui} role="admin"/>;
  if (screen === "admin.studio") {
    const submit = event => { event.preventDefault(); if (params.mode === "create") { const result = createContent({ title, type: "Podcast", level: "5e AEP", unit: "Unité 3", status: "Brouillon", visibility: "Élèves et enseignants", fileName: file?.name || null, mediaReady: Boolean(file) }); if (result.ok) go(`/admin/contenus/${result.item.id}/previsualisation`); } else { updateContent(content.id, { title, fileName: file?.name || content.fileName || null, mediaReady: Boolean(file || content.mediaReady) }); go(`/admin/contenus/${content.id}/previsualisation`); } };
    return <><PageHeader eyebrow="STUDIO DE CONTENUS" title={params.mode === "create" ? "Créer un contenu" : `Modifier · ${content.title}`} subtitle="Importez, décrivez, classez puis prévisualisez le contenu."/><div className="pen-workflow-steps"><span className="active">1 · Importer</span><span className="active">2 · Décrire</span><span>3 · Classer</span><span>4 · Prévisualiser</span></div><form className="pen-studio-layout" onSubmit={submit}><section className="panel pen-editor-form"><div className="pen-dropzone"><CloudArrowUp weight="duotone"/><strong>{file ? file.name : content.fileName || "Déposez un fichier audio, vidéo, EPUB ou archive de jeu"}</strong><span>{file ? Math.max(1, Math.round(file.size / 1024 / 1024)) + " Mo · prêt pour la fiche" : "Prototype local · métadonnées du fichier uniquement"}</span><button type="button" className="button button-light" onClick={() => fileRef.current?.click()}>{file ? "Remplacer le fichier" : "Choisir un fichier"}</button><input ref={fileRef} className="sr-only" type="file" accept=".pdf,.epub,.mp3,.wav,.mp4,.webm,.zip,image/*" onChange={event => setFile(event.target.files?.[0] || null)}/></div><label>Titre public<input value={title} onChange={event => setTitle(event.target.value)} required/></label><label>Résumé<textarea defaultValue="Un épisode pour écouter les voix, les lieux et les histoires du Maroc contemporain."/></label><div className="pen-form-grid"><label>Format<select defaultValue="Podcast"><option>Podcast</option><option>Documentaire</option><option>Jeu vidéo</option><option>eBook</option><option>Article</option></select></label><label>Niveau<select><option>5e AEP</option><option>6e AEP</option><option>1re–2e AEP</option></select></label></div></section><aside className="panel"><h2>Qualité éditoriale</h2>{["Titre clair", "Résumé renseigné", "Niveau associé", file || content.mediaReady ? "Média sélectionné" : "Média à sélectionner"].map((item,index) => <p className="pen-check-line" key={item}>{index < 3 || file || content.mediaReady ? <CheckCircle weight="fill"/> : <WarningCircle/>}{item}</p>)}<DemoNotice>Le prototype mémorise la fiche et le nom du fichier. Le stockage R2 sera raccordé lors de l’intégration production.</DemoNotice><button className="button button-dark button-wide" type="submit">Prévisualiser <ArrowRight/></button></aside></form></>;
  }
  if (screen === "admin.preview") {
    return <><PageHeader eyebrow="PRÉVISUALISATION" title={content.title} subtitle={`${content.type} · ${content.level}`} action={<RouteLink to={`/admin/contenus/${content.id}/revue`} className="button button-dark">Envoyer en revue <ArrowRight/></RouteLink>}/>{notice && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Aperçu média</strong><small>{notice}</small></span></div>}<div className="pen-preview-layout"><section className="pen-public-preview"><span className="eyebrow">JET D’ENCRE · PODCAST</span><h2>{content.title}</h2><p>Écoutez, observez puis réalisez une courte tâche de compréhension orale.</p><div className="pen-audio-player"><button type="button" onClick={togglePreviewAudio} aria-label={playing ? "Arrêter l’aperçu" : "Lire l’aperçu"}><PlayCircle weight="fill"/></button><span><strong>Aperçu vocal · transcription incluse</strong><i><b style={{ width: playing ? "45%" : "0%" }}/></i></span></div></section><aside className="panel"><h2>Contrôles avant revue</h2>{["Rendu ordinateur", "Rendu tablette", "Texte alternatif", "Transcription disponible"].map(item => <p className="pen-check-line" key={item}><CheckCircle weight="fill"/>{item}</p>)}<RouteLink to={`/admin/contenus/${content.id}/modifier`} className="button button-light button-wide">Retour au Studio</RouteLink></aside></div></>;
  }
  if (screen === "admin.review") {
    const requestChanges = () => { updateContent(content.id, { status: "Brouillon", reviewDecision: "changes_requested" }); notify({ role: "admin", title: "Corrections demandées", message: content.title, action: `/admin/contenus/${content.id}/modifier` }); setNotice("Le contenu repasse en brouillon avec les commentaires de revue."); };
    const approve = () => { updateContent(content.id, { status: "À réviser", reviewDecision: "approved" }); go(`/admin/contenus/${content.id}/planification`); };
    return <><PageHeader eyebrow="CYCLE ÉDITORIAL" title={`Revue éditoriale · ${content.id}`} subtitle="Checklist, commentaires et décision journalisée." action={<div className="pen-reader-actions"><button className="button button-light" onClick={requestChanges}>Demander corrections</button><button className="button button-dark" onClick={approve}>Valider la revue <Check/></button></div>}/>{notice && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Décision enregistrée</strong><small>{notice}</small></span></div>}<div className="pen-review-layout"><aside className="panel"><h2>Checklist éditoriale</h2>{["Informations", "Média audio", "Accessibilité", "Droits & crédits", "Diffusion"].map((item,index) => <button type="button" className={index === 1 ? "active" : ""} onClick={() => setNotice("Section « " + item + " » ouverte.")} key={item}><FileText/><span>{item}</span>{index < 2 && <Check/>}</button>)}</aside><section className="panel"><h2>{content.title}</h2><div className="pen-comment-preview"><NotePencil/><strong>Aperçu commenté</strong><span>2 commentaires ouverts · 1 bloquant</span></div>{[["Audio · 02:14","Raccourcir le silence avant la relance"],["Transcription","Ajouter l’équivalent en darija"]].map(([commentTitle,copy]) => <article className="pen-review-comment" key={commentTitle}><span><strong>{commentTitle}</strong><small>{copy}</small></span><button type="button" className="button button-light" onClick={() => setNotice("Réponse enregistrée pour « " + commentTitle + " ».")}>Répondre</button></article>)}</section><aside className="panel"><h2>Décision</h2><div className="pen-summary-card"><strong>En revue</strong><span>Assignée à 2 validateurs</span></div>{["Droits et crédits · conforme", "Transcription · à corriger", "Audience et niveau · conforme", "Visuel alternatif · conforme"].map((item,index) => <p className="pen-check-line" key={item}>{index === 1 ? <WarningCircle/> : <CheckCircle weight="fill"/>}{item}</p>)}</aside></div></>;
  }
  if (screen === "admin.schedule") {
    return <><PageHeader eyebrow="PLANIFICATION" title="Choisir la diffusion" subtitle={content.title}/><form className="pen-schedule-layout" onSubmit={event => { event.preventDefault(); patchAndGo({ status: "Planifié", scheduledAt: `${date}T08:00:00.000Z` }, `/admin/contenus/${content.id}/publication-reussie`, "Publication planifiée"); }}><section className="panel pen-editor-form"><label>Date de publication<input type="date" value={date} onChange={event => setDate(event.target.value)} required/></label><div className="pen-form-grid"><label>Heure<input type="time" defaultValue="08:00"/></label><label>Fuseau<select><option>Casablanca · GMT+1</option></select></label></div><label>Audience<select><option>Élèves et enseignants · 5e AEP</option><option>Public</option></select></label><DemoNotice>La planification est fictive et reste dans ce navigateur.</DemoNotice></section><aside className="panel"><CalendarBlank weight="duotone"/><h2>15 septembre · 08:00</h2><p>Le contenu sera visible dans les espaces autorisés et dans la médiathèque.</p><button className="button button-dark button-wide" type="submit">Planifier la publication</button><button type="button" className="button button-light button-wide" onClick={() => patchAndGo({ status: "Publié", publishedAt: new Date().toISOString() }, `/admin/contenus/${content.id}/publication-reussie`, "Contenu publié")}>Publier maintenant</button></aside></form></>;
  }
  if (screen === "admin.published") {
    return <section className="pen-confirmation-page admin"><span><CheckCircle weight="duotone"/></span><small>PUBLICATION RÉUSSIE</small><h1>Le contenu est prêt à être découvert</h1><p>La version publiée est conservée et les espaces autorisés ont été mis à jour.</p><div><span><strong>{content.title}</strong><small>{content.type} · {content.level}</small></span><span><strong>{content.status}</strong><small>Journal éditorial enregistré</small></span></div><RouteLink to={`/contenus/${content.id.toLowerCase()}`} className="button button-dark">Voir le contenu publié <Eye/></RouteLink><RouteLink to={`/admin/contenus/${content.id}/historique`} className="button button-light">Historique des versions</RouteLink></section>;
  }
  if (screen === "admin.history") {
    const versions = [["v4","Version publiée","Aujourd’hui · 10:42","Publié"],["v3","Revue validée","Aujourd’hui · 09:18","Validé"],["v2","Transcription ajoutée","Hier · 16:05","Brouillon"],["v1","Création du contenu","Hier · 14:22","Brouillon"]];
    return <><PageHeader eyebrow="HISTORIQUE" title={`Versions · ${content.id}`} subtitle="Comparez ou restaurez sans supprimer l’historique."/><div className="pen-history-layout"><section className="panel"><h2>4 versions conservées</h2>{versions.map(([version,title,time,status],index) => <article className="pen-version-row" key={version}><span>{version}</span><div><strong>{title}</strong><small>{time}</small></div><span className={`status-pill ${index === 0 ? "success" : "neutral"}`}>{status}</span><button className="button button-light" onClick={() => setNotice(`Comparaison ${version} / v4 ouverte dans la démonstration.`)}>Comparer</button></article>)}</section><aside className="panel"><h2>Restauration non destructive</h2><p>La version choisie devient un nouveau brouillon. Les versions précédentes restent disponibles.</p><button className="button button-dark button-wide" onClick={() => { updateContent(content.id, { status: "Brouillon" }); setNotice("La v3 a été clonée comme nouveau brouillon v5."); }}>Restaurer la v3</button>{notice && <DemoNotice>{notice}</DemoNotice>}</aside></div></>;
  }
  if (screen === "admin.system") return <SystemState screen={screen} params={params} ui={ui} role="admin"/>;
  return null;
}

export function PenRolePage({ screen, params = {}, ui, studentXp = 0 }) {
  if (screen === "student.onboarding-profile" || screen === "student.onboarding-class") return <Onboarding screen={screen} ui={ui}/>;
  if (screen === "student.manuals") return <StudentManuals ui={ui}/>;
  if (screen === "student.reader") return <StudentReader ui={ui}/>;
  if (screen === "student.exercise") return <StudentExercise ui={ui} params={params}/>;
  if (screen === "student.exercise-result") return <StudentExerciseResult ui={ui} params={params} studentXp={studentXp}/>;
  if (screen === "student.assignment-submitted") return <StudentSubmitted ui={ui} params={params}/>;
  if (screen === "student.profile") return <StudentProfile ui={ui}/>;
  if (screen === "student.system") return <SystemState screen={screen} params={params} ui={ui}/>;
  if (screen.startsWith("teacher.")) return <TeacherFlow screen={screen} params={params} ui={ui}/>;
  if (screen.startsWith("director.")) return <DirectorFlow screen={screen} params={params} ui={ui}/>;
  if (screen.startsWith("admin.")) return <AdminFlow screen={screen} params={params} ui={ui}/>;
  return null;
}

export function PublicContentPage({ params, ui }) {
  const { ResponsiveImage, RouteLink } = ui;
  const { contents } = useDemoStore();
  const content = useMemo(() => contents.find(item => (item.id.toLowerCase() === params.slug || String(item.slug || "") === params.slug) && isPublicDemoContent(item)), [contents, params.slug]);
  const [started, setStarted] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  if (!content) return <div className="pen-public-content"><header><RouteLink to="/"><img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions"/></RouteLink></header><SystemState params={{ systemState: "page-introuvable" }} ui={ui}/></div>;
  const start = () => {
    if (!("speechSynthesis" in window)) { setNotice("Cette ressource ne peut pas être lue dans ce navigateur."); return; }
    if (started) { window.speechSynthesis.cancel(); setStarted(false); setNotice("Lecture arrêtée."); return; }
    const utterance = new SpeechSynthesisUtterance("Bienvenue dans cette ressource Jet d’Encre. Écoutez les voix du quartier, puis racontez un trajet que vous connaissez.");
    utterance.lang = "fr-FR";
    utterance.onend = () => setStarted(false);
    window.speechSynthesis.speak(utterance);
    setStarted(true);
    setNotice("Lecture vocale en cours. La transcription est affichée plus bas.");
  };
  return <div className="pen-public-content"><header><RouteLink to="/"><img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions"/></RouteLink><nav><RouteLink to="/">Accueil</RouteLink><RouteLink to="/blog">Blog</RouteLink><RouteLink to="/connexion">Connexion</RouteLink></nav></header><main><section><div><span className="eyebrow">{content.type} · JET D’ENCRE</span><h1>{content.title}</h1><p>Une ressource éditoriale conçue pour écouter, comprendre et agir dans un contexte marocain plurilingue.</p><button type="button" className="button button-gold" onClick={start}><PlayCircle weight="fill"/> {started ? "Arrêter" : "Commencer"}</button>{notice && <p role="status">{notice}</p>}</div><ResponsiveImage fileName="generated-1774007681359.png" alt="Illustration de la ressource audio" eager sizes="(max-width: 900px) 100vw, 48vw"/></section><article><h2>À propos de cette ressource</h2><p>Écoutez les voix du quartier, repérez les lieux évoqués puis préparez une courte description de votre propre environnement. La lecture vocale sert d’aperçu accessible tant que le média définitif n’est pas publié.</p><div className="pen-public-facts"><span><strong>{content.level || "5e AEP"}</strong>Niveau</span><span><strong>{content.type}</strong>Format</span><span><strong>Avec transcription</strong>Accessibilité</span></div></article></main></div>;
}
