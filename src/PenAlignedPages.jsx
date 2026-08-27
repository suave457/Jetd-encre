import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpenText, Buildings, CalendarBlank, CaretRight,
  Check, CheckCircle, ChalkboardTeacher, ClipboardText, Clock, CloudArrowUp,
  Eye, FileText, FolderOpen, Headphones, Key, LockKey, MagnifyingGlass,
  Megaphone, NotePencil, PaperPlaneTilt, PlayCircle, Plus, ShieldCheck,
  Sparkle, Student, Trophy, UserCircle, UsersThree, WarningCircle,
} from "@phosphor-icons/react/ssr";
import { DEMO_ACCOUNTS, useDemoStore } from "./demoStore.jsx";

const HANDLED_SCREENS = new Set([
  "student.onboarding-profile", "student.onboarding-class", "student.manuals",
  "student.reader", "student.exercise", "student.exercise-result",
  "student.assignment-submitted", "student.profile", "student.system",
  "teacher.assignment-new", "teacher.assignment-preview", "teacher.submissions",
  "teacher.audio-correction", "director.assignments", "director.school",
  "director.activation", "admin.studio", "admin.preview", "admin.review",
  "admin.schedule", "admin.published", "admin.history", "admin.system",
]);

export function isPenHandledScreen(screen) {
  return HANDLED_SCREENS.has(screen);
}

function go(path) {
  window.location.hash = `#${path}`;
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
  const [profile, setProfile] = useState(() => ({ firstName: "Lina", lastName: "El Mansouri", language: "Français", school: "École Al Manar", className: "5A", ...(JSON.parse(sessionStorage.getItem("jde.student.onboarding.v1") || "{}")) }));
  const save = (event, next) => { event.preventDefault(); sessionStorage.setItem("jde.student.onboarding.v1", JSON.stringify(profile)); if(next==="/eleve/tableau-de-bord"){const account=DEMO_ACCOUNTS.eleve;signIn("eleve",{identifier:account.identifier,password:account.password});} go(next); };
  const profileStep = screen === "student.onboarding-profile";
  return <main className="pen-onboarding-page"><aside className="pen-onboarding-aside"><img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions"/><span>PARCOURS ÉLÈVE</span><h1>Ton espace<br/>commence ici</h1><p>Trois petites étapes et tu pourras retrouver ton manuel, tes activités et ta classe.</p><ol><li className={profileStep ? "active" : "done"}><b>1</b><span><strong>Mon profil</strong><small>Choisir comment tu apparais</small></span></li><li className={!profileStep ? "active" : ""}><b>2</b><span><strong>Mon école</strong><small>Retrouver Al Manar</small></span></li><li><b>3</b><span><strong>Ma classe</strong><small>Rejoindre la 5A</small></span></li></ol><DemoNotice>Ces informations restent sur cet appareil de démonstration.</DemoNotice></aside><section className="pen-onboarding-main"><header><RouteLink to={profileStep ? "/activation" : "/eleve/onboarding/profil"}><ArrowLeft/> Revenir en arrière</RouteLink><span>Étape {profileStep ? "1" : "2"} sur 3 <i><b style={{ width: profileStep ? "33%" : "66%" }}/></i></span></header><form className="pen-onboarding-card" onSubmit={event => save(event, profileStep ? "/eleve/onboarding/classe" : "/eleve/tableau-de-bord")}><div className="pen-card-title"><span>{profileStep ? <Sparkle/> : <Buildings/>}</span><div><h2>{profileStep ? "Faisons connaissance !" : "Retrouve ton école et ta classe"}</h2><p>{profileStep ? "Ces informations personnalisent ton espace." : "Choisis le groupe indiqué par ton établissement."}</p></div></div>{profileStep ? <><fieldset className="pen-avatar-choice"><legend>Choisis ton avatar</legend>{[Sparkle, BookOpenText, Trophy, NotePencil].map((Avatar, index) => <button type="button" className={index === 0 ? "active" : ""} key={index} aria-label={`Avatar ${index + 1}`}><Avatar/></button>)}</fieldset><div className="pen-form-grid"><label>Prénom<input value={profile.firstName} onChange={event => setProfile({ ...profile, firstName: event.target.value })} required/></label><label>Nom<input value={profile.lastName} onChange={event => setProfile({ ...profile, lastName: event.target.value })} required/></label></div><label>Langue d’aide<select value={profile.language} onChange={event => setProfile({ ...profile, language: event.target.value })}><option>Français</option><option>العربية</option><option>ⵜⴰⵎⴰⵣⵉⵖⵜ</option></select></label></> : <><label>École<select value={profile.school} onChange={event => setProfile({ ...profile, school: event.target.value })}><option>École Al Manar · Casablanca</option><option>École Al Amal · Rabat</option></select></label><fieldset className="pen-class-choice"><legend>Choisis ta classe</legend>{["5A", "5B", "6A"].map(name => <label className={profile.className === name ? "active" : ""} key={name}><input type="radio" name="class" checked={profile.className === name} onChange={() => setProfile({ ...profile, className: name })}/><strong>{name}</strong><span>{name.startsWith("5") ? "5e AEP" : "6e AEP"} · Français</span></label>)}</fieldset><DemoNotice>Ton établissement pourra seulement voir les informations nécessaires à ton suivi pédagogique.</DemoNotice></>}<div className="pen-form-actions"><button type="button" className="button button-light" onClick={() => history.back()}><ArrowLeft/> Revenir en arrière</button><button className="button button-gold" type="submit">{profileStep ? "Continuer" : "Entrer dans mon espace"} <ArrowRight/></button></div></form></section></main>;
}

function StudentManuals({ ui }) {
  const { PageHeader, ProgressBar, ResponsiveImage, RouteLink } = ui;
  return <><PageHeader eyebrow="MES MANUELS" title="Choisis ton manuel" subtitle="Retrouve tes leçons, tes activités et ta progression au même endroit." action={<RouteLink to="/activation" className="button button-light"><Plus/> Activer un manuel</RouteLink>}/><div className="pen-manual-grid"><article className="pen-manual-card featured"><ResponsiveImage fileName="generated-1774018865796.png" alt="Manuel de français Jet d’Encre niveau 5" sizes="(max-width: 900px) 100vw, 50vw"/><div><span className="status-pill success">EN COURS</span><h2>Français · 5e AEP</h2><p>Voyage au Maroc · Unité 3</p><ProgressBar value={62} label="Progression"/><RouteLink to="/eleve/manuels/francais-5/lecons/lecon-2" className="button button-gold">Continuer la leçon <ArrowRight/></RouteLink></div></article><article className="pen-manual-card locked"><BookOpenText weight="duotone"/><h2>Un autre manuel ?</h2><p>Active le code imprimé dans ton livre pour l’ajouter ici.</p><RouteLink to="/activation" className="button button-light"><Key/> Saisir un code</RouteLink></article></div></>;
}

function StudentReader({ ui }) {
  const { PageHeader, ResponsiveImage, RouteLink } = ui;
  const [tab, setTab] = useState("manuel");
  return <><PageHeader eyebrow="MES MANUELS · FRANÇAIS 5e AEP" title="Leçon 2 · Protégeons notre environnement" subtitle="Unité 3 · Pages 42–43" action={<div className="pen-reader-actions"><button className="button button-light">Marquer</button><button className="button button-light">Mes notes</button></div>}/><div className="pen-reader-tabs" role="tablist">{[["manuel","Manuel"],["activites","Activités · 3"],["ressources","Ressources · 2"],["notes","Mes notes"]].map(([key,label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div><div className="pen-reader-layout"><section className="pen-reader-viewer"><div className="pen-reader-toolbar"><button aria-label="Zoom arrière">−</button><span>100 %</span><button aria-label="Zoom avant">+</button><button>Transcription</button></div><ResponsiveImage fileName="generated-1773971894915.png" alt="Double page illustrée du manuel Voyage au Maroc" eager sizes="(max-width: 900px) 100vw, 68vw"/><footer><button><ArrowLeft/> Page précédente</button><span>Pages 42—43 sur 96</span><button>Page suivante <ArrowRight/></button></footer></section><aside className="pen-reader-resources"><h2>Autour de cette leçon</h2><RouteLink to="/eleve/activites/mots-environnement"><Headphones/><span><strong>Une journée à la plage</strong><small>Audio · 1 min 42</small></span><CaretRight/></RouteLink><RouteLink to="/eleve/activites/mots-environnement"><Sparkle/><span><strong>Les mots de l’environnement</strong><small>Quiz · 4 min</small></span><CaretRight/></RouteLink><div className="pen-tip"><Sparkle/><strong>Astuce</strong><p>Écoute l’audio puis décris un lieu près de chez toi.</p></div></aside></div><div className="pen-audio-player"><button aria-label="Lire l’audio"><PlayCircle weight="fill"/></button><span><strong>Une journée à la plage · 01:42</strong><i><b/></i></span><small>00:00 / 01:42</small></div></>;
}

function StudentExercise({ ui, params }) {
  const { PageHeader, RouteLink } = ui;
  const [answer, setAnswer] = useState("");
  return <><PageHeader eyebrow="ACTIVITÉ · UNITÉ 3" title="Les mots de l’environnement" subtitle="Question 3 sur 5 · Choisis la meilleure réponse."/><section className="pen-exercise-card"><div className="pen-exercise-progress"><span>3 / 5</span><i><b style={{ width: "60%" }}/></i><strong>+10 XP</strong></div><h2>Quel geste aide le mieux à protéger la plage ?</h2><div className="pen-answer-grid">{["Laisser les déchets près de l’eau", "Ramasser et trier les déchets", "Utiliser plus de sacs jetables", "Écrire sur les rochers"].map((option,index) => <label className={answer === option ? "selected" : ""} key={option}><input type="radio" name="answer" value={option} checked={answer === option} onChange={() => setAnswer(option)}/><b>{String.fromCharCode(65 + index)}</b><span>{option}</span></label>)}</div><div className="pen-form-actions"><RouteLink to="/eleve/manuels/francais-5/lecons/lecon-2" className="button button-light"><ArrowLeft/> Retour à la leçon</RouteLink><RouteLink aria-disabled={!answer} onClick={event => !answer && event.preventDefault()} to={`/eleve/activites/${params.activityId || "mots-environnement"}/resultat`} className={`button button-gold ${!answer ? "is-disabled" : ""}`}>Valider ma réponse <ArrowRight/></RouteLink></div></section></>;
}

function StudentExerciseResult({ ui, studentXp }) {
  const { PageHeader, ProgressBar, RouteLink } = ui;
  return <><PageHeader eyebrow="ACTIVITÉ TERMINÉE" title="Bravo Lina !" subtitle="Tu as pris le temps de répondre et de comprendre chaque correction."/><section className="pen-result-hero"><div className="pen-result-score"><Trophy weight="duotone"/><strong>8 / 10</strong><span>Très bon résultat</span></div><div><span className="eyebrow">+ 80 XP</span><h2>Tu maîtrises le vocabulaire essentiel</h2><p>Revois deux mots puis continue la leçon quand tu te sens prête.</p><ProgressBar value={80} label="Réussite"/><div><RouteLink to="/eleve/manuels/francais-5/lecons/lecon-2" className="button button-gold">Continuer la leçon <ArrowRight/></RouteLink><RouteLink to="/eleve/progression" className="button button-light">Voir mes progrès</RouteLink></div><small>Solde du profil : {studentXp} XP</small></div></section></>;
}

function StudentSubmitted({ ui, params }) {
  const { RouteLink } = ui;
  return <section className="pen-confirmation-page"><span><CheckCircle weight="duotone"/></span><small>DEVOIR REMIS</small><h1>Ton travail est bien envoyé !</h1><p>Mme Benjelloun recevra ta réponse et tu seras prévenue lorsque la correction sera disponible.</p><div><span><strong>Aventure dans ma ville</strong><small>Référence {params.assignmentId || "DEV-0042"}</small></span><span><strong>Aujourd’hui · 16:42</strong><small>Copie conservée sur cet appareil</small></span></div><RouteLink to="/eleve/devoirs" className="button button-dark">Retour à mes devoirs <ArrowRight/></RouteLink><RouteLink to="/eleve/tableau-de-bord" className="button button-light">Aller à l’accueil</RouteLink></section>;
}

function StudentProfile({ ui }) {
  const { PageHeader, RouteLink } = ui;
  const [active, setActive] = useState("profil");
  return <><PageHeader eyebrow="MON COMPTE" title="Profil & aide" subtitle="Personnalise ton espace et retrouve de l’aide quand tu en as besoin."/><div className="pen-profile-layout"><nav aria-label="Profil et aide">{[["profil",UserCircle,"Mon profil"],["accessibilite",Sparkle,"Confort de lecture"],["aide",ShieldCheck,"Aide et sécurité"]].map(([key,Icon,label]) => <button className={active === key ? "active" : ""} onClick={() => setActive(key)} key={key}><Icon/><span>{label}</span><CaretRight/></button>)}</nav><section className="panel"><h2>{active === "profil" ? "Mon profil" : active === "accessibilite" ? "Confort de lecture" : "Comment pouvons-nous t’aider ?"}</h2>{active === "profil" && <div className="pen-profile-card"><span>LM</span><div><strong>Lina Mansouri</strong><small>5A · École Al Manar</small></div><button className="button button-light" disabled>Modifier l’avatar</button></div>}{active === "accessibilite" && <div className="pen-settings-list"><label>Taille du texte<select defaultValue="Confortable"><option>Standard</option><option>Confortable</option><option>Très grande</option></select></label><label><span>Limiter les animations</span><input type="checkbox"/></label><label><span>Transcription automatique</span><input type="checkbox" defaultChecked/></label></div>}{active === "aide" && <div className="pen-help-grid"><RouteLink to="/eleve/etat-systeme/hors-connexion"><WarningCircle/><strong>Un problème de connexion</strong><span>Vérifier et réessayer</span></RouteLink><button><Megaphone/><strong>Contacter un adulte</strong><span>Demande de démonstration</span></button></div>}</section></div></>;
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
  const { assignments, submissions, createAssignment, reviewSubmission, notify } = useDemoStore();
  const assignment = assignments.find(item => item.id === params.assignmentId) || assignments[0];
  const related = submissions.filter(item => item.assignmentId === assignment?.id);
  const submission = submissions.find(item => item.id === params.submissionId) || related[0];
  const [title, setTitle] = useState(assignment?.title || "Décrire mon quartier idéal");
  const [instructions, setInstructions] = useState(assignment?.instructions || "Enregistre une description d’une minute en utilisant cinq adjectifs.");
  const [score, setScore] = useState(submission?.score ?? 16);
  const [feedback, setFeedback] = useState(submission?.feedback || "Très bonne description. Pense à articuler la dernière phrase.");
  const [notice, setNotice] = useState("");
  if (screen === "teacher.assignment-new") {
    const submit = event => { event.preventDefault(); const result = createAssignment({ title, instructions, subject: "Français", level: "5e AEP", className: "5A", dueAt: "2026-09-04T18:00:00.000Z", status: "Brouillon", expectedSubmissions: 29, submissions: 0 }); if (result.ok) go(`/enseignant/devoirs/${result.item.id}/previsualisation`); };
    return <><PageHeader eyebrow="NOUVEAU DEVOIR" title="Créer un devoir" subtitle="Préparez la consigne, le public et l’échéance avant la prévisualisation."/><div className="pen-workflow-steps"><span className="active">1 · Informations</span><span>2 · Contenu</span><span>3 · Vérification</span><span>4 · Publication</span></div><form className="panel pen-editor-form" onSubmit={submit}><div className="pen-form-grid"><label>Titre du devoir<input value={title} onChange={event => setTitle(event.target.value)} required/></label><label>Classe<select defaultValue="5A"><option>5A · 29 élèves</option><option>5B · 28 élèves</option></select></label></div><label>Consigne<textarea value={instructions} onChange={event => setInstructions(event.target.value)} required/></label><div className="pen-form-grid"><label>Type de remise<select><option>Enregistrement audio</option><option>Texte</option><option>Fichier</option></select></label><label>Échéance<input type="date" defaultValue="2026-09-04"/></label></div><DemoNotice>Aucune donnée réelle d’élève n’est utilisée dans ce scénario.</DemoNotice><div className="pen-form-actions"><RouteLink to="/enseignant/devoirs" className="button button-light">Annuler</RouteLink><button className="button button-dark" type="submit">Prévisualiser <ArrowRight/></button></div></form></>;
  }
  if (screen === "teacher.assignment-preview") {
    const publish = () => { notify({ role: "enseignant", title: `Devoir publié · ${assignment?.title}`, message: "La classe 5A peut maintenant consulter le devoir." }); go(`/enseignant/devoirs/${assignment?.id}/remises`); };
    return <><PageHeader eyebrow="PRÉVISUALISATION" title={assignment?.title || title} subtitle="Classe 5A · 29 élèves · Remise audio" action={<button className="button button-dark" onClick={publish}><PaperPlaneTilt/> Publier le devoir</button>}/><div className="pen-preview-layout"><section className="panel pen-student-preview"><span className="status-pill warning">À FAIRE</span><h2>{assignment?.title || title}</h2><p>{assignment?.instructions || instructions}</p><div className="pen-audio-drop"><Headphones weight="duotone"/><strong>Enregistrer ma réponse</strong><span>1 minute maximum · transcription disponible</span></div></section><aside className="panel"><h2>Vérifications</h2>{["Consigne claire", "Classe sélectionnée", "Échéance définie", "Format accessible"].map(item => <p className="pen-check-line" key={item}><CheckCircle weight="fill"/>{item}</p>)}<RouteLink to="/enseignant/devoirs/nouveau" className="button button-light button-wide">Modifier</RouteLink></aside></div></>;
  }
  if (screen === "teacher.submissions") {
    return <><PageHeader eyebrow="SUIVI DES REMISES" title={assignment?.title || "Devoir publié"} subtitle={`${related.length} remise${related.length > 1 ? "s" : ""} reçue${related.length > 1 ? "s" : ""} · Classe 5A`}/><div className="pen-submission-summary"><ProgressBar value={related.length ? Math.round((related.length / 29) * 100) : 0} label="Remises reçues"/><button className="button button-light" disabled><Megaphone/> Relancer les élèves</button></div><div className="list-panel">{related.length ? related.map(item => <article className="pen-submission-row" key={item.id}><span>{item.studentName.split(" ").map(part => part[0]).join("").slice(0,2)}</span><div><h3>{item.studentName}</h3><p>{item.status} · remise audio 00:54</p></div><span className={`status-pill ${item.status === "Corrigé" ? "success" : "warning"}`}>{item.status}</span><RouteLink to={`/enseignant/remises/${item.id}/correction-audio`} className="button button-light">Corriger <CaretRight/></RouteLink></article>) : <div className="empty-state"><ClipboardText/><h2>Aucune remise</h2><p>Les réponses des élèves apparaîtront ici.</p></div>}</div></>;
  }
  if (screen === "teacher.audio-correction") {
    const submit = event => { event.preventDefault(); if (submission) reviewSubmission(submission.id, { score, feedback }); setNotice("La correction et le commentaire ont été envoyés à l’élève."); };
    return <><PageHeader eyebrow="CORRECTION AUDIO" title={submission?.studentName || "Lina Mansouri"} subtitle={`${assignment?.title || "Description de mon quartier"} · Classe 5A`}/>{notice && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Correction envoyée</strong><small>{notice}</small></span></div>}<div className="pen-audio-correction"><section className="panel"><h2>Écouter la remise</h2><div className="pen-waveform"><button aria-label="Lire"><PlayCircle weight="fill"/></button>{Array.from({ length: 34 }, (_, index) => <i style={{ height: `${18 + (index * 13) % 52}%` }} key={index}/>)}</div><p className="pen-transcript"><strong>Transcription automatique</strong> « Dans mon quartier, il y a un jardin calme et une grande place… »</p></section><form className="panel" onSubmit={submit}><label>Note sur 20<input type="number" min="0" max="20" value={score} onChange={event => setScore(event.target.value)} required/></label><label>Commentaire formatif<textarea value={feedback} onChange={event => setFeedback(event.target.value)} required/></label><button className="button button-dark button-wide"><PaperPlaneTilt/> Envoyer la correction</button></form></div></>;
  }
  return null;
}

function DirectorFlow({ screen, ui }) {
  const { PageHeader, ProgressBar, RouteLink } = ui;
  const [teacher, setTeacher] = useState("Imane Ziani");
  const [classes, setClasses] = useState(["6B", "6C"]);
  const [confirmed, setConfirmed] = useState(false);
  if (screen === "director.assignments") {
    const toggle = name => setClasses(items => items.includes(name) ? items.filter(item => item !== name) : [...items, name]);
    return <><PageHeader eyebrow="ÉCOLE AL MANAR · AFFECTATIONS" title="Affecter les enseignants" subtitle="Associez un enseignant à une ou plusieurs classes en contrôlant sa charge." action={<button className="button button-dark"><Plus/> Affecter</button>}/>{confirmed && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Affectation enregistrée</strong><small>{teacher} est maintenant associée aux classes {classes.join(" et ")}.</small></span></div>}<div className="pen-assignment-columns"><section><h2>1. Enseignant</h2>{["Imane Ziani", "Salma Idrissi", "Youssef Amrani", "Nadia El Fassi"].map(name => <button className={teacher === name ? "active" : ""} onClick={() => setTeacher(name)} key={name}><span>{name.split(" ").map(x => x[0]).join("")}</span><span><strong>{name}</strong><small>{name === "Imane Ziani" ? "0 classe · disponibilité complète" : "2 classes · 12 h/semaine"}</small></span>{teacher === name && <Check/>}</button>)}</section><section><h2>2. Classes</h2>{["6B", "6C", "5B", "4C"].map(name => <label className={classes.includes(name) ? "active" : ""} key={name}><input type="checkbox" checked={classes.includes(name)} onChange={() => toggle(name)}/><span><strong>{name}</strong><small>{["6B","6C"].includes(name) ? "Sans enseignant" : "Déjà affectée"}</small></span></label>)}</section><section><h2>3. Vérification</h2><div className="pen-summary-card"><strong>{teacher}</strong><span>{classes.join(" et ")} · 59 élèves au total</span><small>12 h / semaine · charge recommandée</small></div><div className="pen-conflict"><WarningCircle/><strong>Conflit détecté</strong><p>La classe 6C est réservée par une invitation encore en attente.</p></div><label className="pen-confirm-check"><input type="checkbox" required/> J’ai vérifié la charge et le conflit.</label><button className="button button-dark" onClick={() => setConfirmed(true)}><Check/> Confirmer l’affectation</button></section></div></>;
  }
  if (screen === "director.activation") {
    return <><PageHeader eyebrow="ÉLÈVES & ACTIVATION" title="Piloter les activations" subtitle="Importez les élèves, rattachez les classes et préparez les relances." action={<button className="button button-dark"><Key/> Générer un lot</button>}/><div className="pen-activation-overview"><div><strong>94 %</strong><span>618 élèves activés</span></div><ProgressBar value={94} label="Taux global"/><button className="button button-gold" disabled><Megaphone/> Relancer 36 familles</button></div><div className="data-table"><table><caption className="sr-only">Activation des élèves</caption><thead><tr><th>Classe</th><th>Élèves</th><th>Activés</th><th>Restants</th><th>Action</th></tr></thead><tbody>{[["5A",29,28],["5B",28,26],["6B",31,27],["6C",28,25]].map(([name,total,active]) => <tr key={name}><td><strong>{name}</strong></td><td>{total}</td><td>{active}</td><td>{total-active}</td><td><button className="button button-light" disabled>Relancer</button></td></tr>)}</tbody></table></div></>;
  }
  if (screen === "director.school") {
    return <><PageHeader eyebrow="ÉTABLISSEMENT" title="École Al Manar" subtitle="Casablanca · Année scolaire 2026–2027" action={<button className="button button-dark"><Buildings/> Modifier la fiche</button>}/><div className="pen-school-grid"><section className="panel"><h2>Profil officiel</h2><dl><div><dt>Directeur</dt><dd>M. Benjelloun</dd></div><div><dt>Classes</dt><dd>18 classes actives</dd></div><div><dt>Équipe</dt><dd>42 enseignants</dd></div><div><dt>Licence</dt><dd>Valide jusqu’au 31 août 2027</dd></div></dl></section><section className="panel"><h2>Santé du service</h2><ProgressBar value={82} label="Santé globale"/><ProgressBar value={94} label="Activations"/><ProgressBar value={78} label="Synchronisation"/></section><aside className="panel pen-assistance"><ShieldCheck weight="duotone"/><h2>Besoin d’assistance ?</h2><p>Décrivez le problème rencontré. Un numéro de suivi fictif sera créé.</p><button className="button button-gold"><Megaphone/> Contacter l’assistance</button><RouteLink to="/directeur/suivi-utilisation" className="button button-light">Voir les alertes</RouteLink></aside></div></>;
  }
  return null;
}

function AdminFlow({ screen, params, ui }) {
  const { PageHeader, RouteLink } = ui;
  const { contents, updateContent, createContent, notify } = useDemoStore();
  const content = contents.find(item => item.id === params.contentId) || contents[0] || { id: "POD-0018", title: "Les voix du Maroc · Épisode 01", type: "Podcast", status: "Brouillon", level: "5e AEP" };
  const [title, setTitle] = useState(content.title);
  const [date, setDate] = useState("2026-09-15");
  const [notice, setNotice] = useState("");
  const patchAndGo = (patch, destination, message) => { if (content.id && contents.some(item => item.id === content.id)) updateContent(content.id, patch); notify({ role: "admin", title: message, message: title, action: destination }); go(destination); };
  if (screen === "admin.studio") {
    const submit = event => { event.preventDefault(); if (params.mode === "create") { const result = createContent({ title, type: "Podcast", level: "5e AEP", unit: "Unité 3", status: "Brouillon", visibility: "Élèves et enseignants" }); if (result.ok) go(`/admin/contenus/${result.item.id}/previsualisation`); } else go(`/admin/contenus/${content.id}/previsualisation`); };
    return <><PageHeader eyebrow="STUDIO DE CONTENUS" title={params.mode === "create" ? "Créer un contenu" : `Modifier · ${content.title}`} subtitle="Importez, décrivez, classez puis prévisualisez le contenu."/><div className="pen-workflow-steps"><span className="active">1 · Importer</span><span className="active">2 · Décrire</span><span>3 · Classer</span><span>4 · Prévisualiser</span></div><form className="pen-studio-layout" onSubmit={submit}><section className="panel pen-editor-form"><div className="pen-dropzone"><CloudArrowUp weight="duotone"/><strong>Déposez un fichier audio, vidéo, EPUB ou archive de jeu</strong><span>Prototype local · 2 Go maximum</span><button type="button" className="button button-light">Choisir un fichier</button></div><label>Titre public<input value={title} onChange={event => setTitle(event.target.value)} required/></label><label>Résumé<textarea defaultValue="Un épisode pour écouter les voix, les lieux et les histoires du Maroc contemporain."/></label><div className="pen-form-grid"><label>Format<select defaultValue="Podcast"><option>Podcast</option><option>Documentaire</option><option>Jeu vidéo</option><option>eBook</option><option>Article</option></select></label><label>Niveau<select><option>5e AEP</option><option>6e AEP</option></select></label></div></section><aside className="panel"><h2>Qualité éditoriale</h2>{["Titre clair", "Résumé renseigné", "Niveau associé", "Transcription à vérifier"].map((item,index) => <p className="pen-check-line" key={item}>{index < 3 ? <CheckCircle weight="fill"/> : <WarningCircle/>}{item}</p>)}<DemoNotice>Le média affiché est fictif. Aucun fichier n’est envoyé.</DemoNotice><button className="button button-dark button-wide" type="submit">Prévisualiser <ArrowRight/></button></aside></form></>;
  }
  if (screen === "admin.preview") {
    return <><PageHeader eyebrow="PRÉVISUALISATION" title={content.title} subtitle={`${content.type} · ${content.level}`} action={<RouteLink to={`/admin/contenus/${content.id}/revue`} className="button button-dark">Envoyer en revue <ArrowRight/></RouteLink>}/><div className="pen-preview-layout"><section className="pen-public-preview"><span className="eyebrow">JET D’ENCRE · PODCAST</span><h2>Les voix du Maroc : la marche du quartier</h2><p>Écoutez, observez puis réalisez une courte tâche de compréhension orale.</p><div className="pen-audio-player"><button><PlayCircle weight="fill"/></button><span><strong>Épisode 01 · 06:42</strong><i><b style={{ width: "28%" }}/></i></span></div></section><aside className="panel"><h2>Contrôles avant revue</h2>{["Rendu ordinateur", "Rendu tablette", "Texte alternatif", "Transcription disponible"].map(item => <p className="pen-check-line" key={item}><CheckCircle weight="fill"/>{item}</p>)}<RouteLink to={`/admin/contenus/${content.id}/modifier`} className="button button-light button-wide">Retour au Studio</RouteLink></aside></div></>;
  }
  if (screen === "admin.review") {
    return <><PageHeader eyebrow="CYCLE ÉDITORIAL" title={`Revue éditoriale · ${content.id}`} subtitle="Checklist, commentaires et décision journalisée." action={<div className="pen-reader-actions"><button className="button button-light" onClick={() => setNotice("Les corrections demandées ont été enregistrées.")}>Demander corrections</button><button className="button button-dark" onClick={() => go(`/admin/contenus/${content.id}/planification`)}>Valider la revue <Check/></button></div>}/>{notice && <div className="editor-success" role="status"><CheckCircle weight="fill"/><span><strong>Décision enregistrée</strong><small>{notice}</small></span></div>}<div className="pen-review-layout"><aside className="panel"><h2>Checklist éditoriale</h2>{["Informations", "Média audio", "Accessibilité", "Droits & crédits", "Diffusion"].map((item,index) => <button className={index === 1 ? "active" : ""} key={item}><FileText/><span>{item}</span>{index < 2 && <Check/>}</button>)}</aside><section className="panel"><h2>{content.title}</h2><div className="pen-comment-preview"><NotePencil/><strong>Aperçu commenté</strong><span>2 commentaires ouverts · 1 bloquant</span></div>{[["Audio · 02:14","Raccourcir le silence avant la relance"],["Transcription","Ajouter l’équivalent en darija"]].map(([title,copy]) => <article className="pen-review-comment" key={title}><span><strong>{title}</strong><small>{copy}</small></span><button className="button button-light">Répondre</button></article>)}</section><aside className="panel"><h2>Décision</h2><div className="pen-summary-card"><strong>En revue</strong><span>Assignée à 2 validateurs</span></div>{["Droits et crédits · conforme", "Transcription · à corriger", "Audience et niveau · conforme", "Visuel alternatif · conforme"].map((item,index) => <p className="pen-check-line" key={item}>{index === 1 ? <WarningCircle/> : <CheckCircle weight="fill"/>}{item}</p>)}</aside></div></>;
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
  if (screen === "student.exercise-result") return <StudentExerciseResult ui={ui} studentXp={studentXp}/>;
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
  const content = useMemo(() => contents.find(item => item.id.toLowerCase() === params.slug || String(item.slug || "") === params.slug) || contents.find(item => item.status === "Publié") || contents[0], [contents, params.slug]);
  return <div className="pen-public-content"><header><RouteLink to="/"><img src="/assets/jet-dencre-logo-horizontal-light-400.webp" alt="Jet d’Encre Éditions"/></RouteLink><nav><RouteLink to="/">Accueil</RouteLink><RouteLink to="/blog">Blog</RouteLink><RouteLink to="/connexion">Connexion</RouteLink></nav></header><main><section><div><span className="eyebrow">{content?.type || "RESSOURCE"} · JET D’ENCRE</span><h1>{content?.title || "Les voix du Maroc"}</h1><p>Une ressource éditoriale conçue pour écouter, comprendre et agir dans un contexte marocain plurilingue.</p><button className="button button-gold"><PlayCircle weight="fill"/> Commencer</button></div><ResponsiveImage fileName="generated-1774007681359.png" alt="Illustration de la ressource audio" eager sizes="(max-width: 900px) 100vw, 48vw"/></section><article><h2>À propos de cette ressource</h2><p>Cette page distingue le contenu public multi-format du Blog. Elle conserve les informations de niveau, d’audience et d’accessibilité validées dans le cycle éditorial.</p><div className="pen-public-facts"><span><strong>{content?.level || "5e AEP"}</strong>Niveau</span><span><strong>{content?.type || "Podcast"}</strong>Format</span><span><strong>Avec transcription</strong>Accessibilité</span></div></article></main></div>;
}
