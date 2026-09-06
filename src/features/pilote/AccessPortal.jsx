import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpenText, Buildings, ChalkboardTeacher, ShieldCheck, Student, Users } from '@phosphor-icons/react/ssr';
import './access-portal.css';

const profiles = [
  {id:'eleve',label:'Élève',Icon:Student,description:'Je retrouve mes devoirs, mes mots fléchés et mes XP.',demo:'Je découvre les jeux, les manuels et la médiathèque.'},
  {id:'parent',label:'Parent',Icon:Users,description:'Je consulte les travaux et les progrès de mon enfant.',demo:'Je découvre le suivi et les ressources pour les familles.'},
  {id:'enseignant',label:'Enseignant',Icon:ChalkboardTeacher,description:'Je retrouve mes classes, les travaux remis et mes corrections.',demo:'J’explore les classes, les ressources et les outils pédagogiques.'},
  {id:'directeur',label:'Direction d’école',Icon:Buildings,description:'Je découvre le parcours école. L’espace direction connecté est en préparation.',demo:'J’explore le tableau de bord et le suivi de l’établissement.'},
  {id:'admin',label:'Administration',Icon:ShieldCheck,description:'Je gère les écoles, les comptes et leurs accès.',demo:'J’explore les contenus, les médias et le pilotage de démonstration.'},
];

export default function AccessPortal(){
  const [demo,setDemo]=useState(()=>new URLSearchParams(window.location.search).get('mode')==='demo');
  useEffect(()=>{document.title='Choisir mon espace · Jet d’Encre';},[]);
  function chooseMode(value){setDemo(value);window.history.replaceState(null,'',value?'/connexion?mode=demo':'/connexion');}
  return <div className="entry-page">
    <a className="entry-skip" href="#entry-main">Aller au contenu</a>
    <header className="entry-top"><a href="/" className="entry-brand"><BookOpenText weight="duotone"/><span>Jet d’Encre<small>ÉDITIONS</small></span></a><a href="/"><ArrowLeft/> Retour au site</a></header>
    <main id="entry-main">
      <div className="entry-heading"><span>À CHACUN SON ESPACE</span><h1>Bienvenue chez Jet d’Encre</h1><p>Choisis ton profil pour retrouver le bon chemin.</p></div>
      <div className="entry-modes" role="group" aria-label="Type d’accès"><button aria-pressed={!demo} onClick={()=>chooseMode(false)}><ShieldCheck/> Mon compte</button><button aria-pressed={demo} onClick={()=>chooseMode(true)}><BookOpenText/> Explorer la démonstration</button></div>
      <section aria-labelledby="entry-mode-title"><div className="entry-mode-intro"><h2 id="entry-mode-title">{demo?'Quel espace veux-tu découvrir ?':'Quel est ton profil ?'}</h2><p>{demo?'Tous les écrans de démonstration restent disponibles. Les données sont fictives et restent dans ce navigateur.':'Les identifiants sont remis par l’équipe Jet d’Encre. Choisir un profil ne modifie pas les droits de ton compte.'}</p></div>
        <div className="entry-grid">{profiles.map(({id,label,Icon,description,demo:demoDescription})=><a key={id} className={'entry-card entry-'+id} href={demo?`/connexion/${id}`:id==='admin'?'/admin/accueil':id==='directeur'?'/ecoles':`/pilote?profil=${id}`}><span className="entry-icon"><Icon weight="duotone"/></span><h3>{label}</h3><p>{demo?demoDescription:description}</p><span className="entry-card-action">{demo?'Découvrir cet espace':id==='directeur'?'Découvrir le parcours école':'Accéder à mon espace'}<ArrowRight/></span></a>)}</div>
      </section>
      <aside className="entry-help"><ShieldCheck/><div><strong>{demo?'Une visite sans compte scolaire':'Besoin d’un coup de main ?'}</strong><p>{demo?'Les identifiants de démonstration sont préremplis. N’y saisis pas tes identifiants scolaires.':'Première connexion, mot de passe oublié ou ordinateur partagé : le guide explique chaque étape.'}</p></div><a href="/guide-ecole">Lire le guide <ArrowRight/></a></aside>
      <p className="entry-test-note">Site de test · comptes fictifs uniquement. Ne saisis aucune donnée personnelle d’élève.</p>
    </main>
  </div>;
}
