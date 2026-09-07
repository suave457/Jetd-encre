import { ArrowRight, Books, ClipboardText, GameController, ChartLineUp, Users, ChalkboardTeacher, House, Question } from '@phosphor-icons/react/ssr';
import { getResponsiveImageProps } from '../../mediaAssets.js';
import { useContext } from 'react';
import { SchoolRoleContext } from './SchoolShell.jsx';
import { withSchoolProfile } from './schoolNavigationCore.js';

export function schoolMenu(role){
  const items=[{id:'accueil',label:'Accueil',Icon:House}];
  if(role==='eleve')items.push({id:'manuels',label:'Mes manuels',Icon:Books});
  if(role==='enseignant')items.push({id:'classes',label:'Mes classes',Icon:ChalkboardTeacher});
  if(role==='parent')items.push({id:'enfants',label:'Mes enfants',Icon:Users});
  items.push({id:'devoirs',label:role==='parent'?'Travaux et retours':'Mes devoirs',Icon:ClipboardText},{id:'mediatheque',label:'Médiathèque',Icon:Books});
  if(['eleve','enseignant'].includes(role))items.push({id:'jeux',label:'Mes jeux',Icon:GameController});
  if(role==='enseignant')items.push({id:'analyses',label:'Analyses',Icon:ChartLineUp});
  if(['eleve','parent'].includes(role))items.push({id:'progres',label:role==='eleve'?'Mes progrès':'Les progrès',Icon:ChartLineUp});
  items.push({id:'aide',label:'Profil & aide',Icon:Question});
  return items.map(item=>({...item,href:item.id==='accueil'?'/pilote':`/pilote?section=${item.id}`}));
}

export function SchoolLink({to,onNavigate,children,...props}){
  const href=withSchoolProfile(to,useContext(SchoolRoleContext));
  return <a href={href} {...props} onClick={event=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onNavigate(href);}}}>{children}</a>;
}

export default function SchoolHome({user,workspace,onNavigate,onCreate,summary}){
  const student=user.role==='eleve',teacher=user.role==='enseignant';
  const latest=workspace.assignments[0],counts=workspace.counts;
  const latestPath=latest?'/pilote?section=devoirs&devoir='+encodeURIComponent(latest.id):'/pilote?section=devoirs';
  const action=student?'/pilote?section=jeux':'/pilote?section=devoirs';
  const game=summary.data?.children.find(child=>child.studentId===user.id);
  const shortcuts=schoolMenu(user.role).filter(item=>['mediatheque',teacher?'classes':'progres','devoirs'].includes(item.id));
  return <div className="school-dashboard">
    <section className="student-journey"><div><span>{student?'J’APPRENDS À MON RYTHME':teacher?'MON ESPACE ENSEIGNANT':'L’ÉCOLE ET LA MAISON'}</span><h2>{student?'Des mots à découvrir, des idées à partager':teacher?'Accompagner chaque progrès':'Grandir ensemble en français'}</h2><p>{student?'Retrouve tes activités, lis une histoire ou relève un défi de vocabulaire.':teacher?'Prépare les travaux de tes classes et donne à chaque élève un retour pour avancer.':'Retrouve les travaux de ton enfant, les conseils de son enseignant et ses découvertes.'}</p><SchoolLink to={action} onNavigate={onNavigate} className="button button-gold">{student?'Choisir un jeu':teacher?'Ouvrir mes devoirs':'Voir les travaux'}<ArrowRight/></SchoolLink></div><img {...getResponsiveImageProps('generated-1774018865796.png',{sizes:'230px'})} alt="Livre illustré"/></section>
    <div className="school-dashboard-grid"><section className="panel"><span className="page-eyebrow">{teacher?'TRAVAUX DE MES CLASSES':student?'MES TRAVAUX':'TRAVAUX DE MES ENFANTS'}</span><h2>{latest?.title||(teacher?'Le premier devoir de ma classe':'Aucun devoir pour le moment')}</h2><p>{latest?`À remettre pour le ${new Date(latest.dueDate+'T12:00:00').toLocaleDateString('fr-MA')}`:teacher?'Choisis une classe et prépare une consigne pour tes élèves.':'Les travaux apparaîtront ici dès leur publication par l’enseignant.'}</p><p><strong>{user.role==='parent'?'Bilan des travaux de mes enfants : ':'Bilan de tous mes travaux : '}</strong>{counts.submitted} {counts.submitted===1?'travail remis':'travaux remis'} · {counts.reviewed} {counts.reviewed===1?'retour disponible':'retours disponibles'}</p>{teacher&&!latest?<button className="button button-dark" onClick={onCreate}>Créer un devoir <ArrowRight/></button>:<SchoolLink to={latestPath} onNavigate={onNavigate} className="button button-light">{latest?'Ouvrir le devoir':'Consulter les devoirs'}<ArrowRight/></SchoolLink>}</section>
    <section className="panel school-play-card"><span className="page-eyebrow">{student?'MES DÉFIS':teacher?'MA CLASSE':'LES DÉCOUVERTES'}</span><h2>{student?'À toi de jouer !':teacher?`${workspace.classes.length} ${workspace.classes.length===1?'classe accompagnée':'classes accompagnées'}`:'Une lecture à partager'}</h2><p>{student?(game?`${game.xpTotal} XP · ${game.completedCount} ${game.completedCount===1?'grille terminée':'grilles terminées'}`:'Des mots fléchés et trois niveaux à explorer.'):teacher?'Retrouve tes classes et les travaux qui leur sont proposés.':'Des histoires, des audios et des vidéos pour prolonger les échanges à la maison.'}</p><SchoolLink to={student?'/pilote?section=jeux':teacher?'/pilote?section=classes':'/pilote?section=mediatheque'} onNavigate={onNavigate} className="button button-dark">{student?'Mes jeux':teacher?'Mes classes':'Ouvrir la médiathèque'}<ArrowRight/></SchoolLink></section></div>
    <div className="school-quick-links">{shortcuts.map(({id,label,href,Icon})=><SchoolLink key={id} to={href} onNavigate={onNavigate}><Icon weight="duotone"/><span><strong>{label}</strong><small>{id==='mediatheque'?'Audio, vidéo et livres':id==='devoirs'?'Consignes et corrections':id==='classes'?'Mes groupes de travail':'Résultats et découvertes'}</small></span></SchoolLink>)}</div>
  </div>;
}

export function SchoolGroups({user,workspace,onNavigate}){
  const teacher=user.role==='enseignant',items=teacher?workspace.classes:workspace.children;
  return <div className="school-class-list">{items.map(item=><section className="panel" key={item.id}><span className="page-eyebrow">{teacher?'MA CLASSE':'MON ENFANT'}</span><h2>{item.name}</h2><p>{user.schoolName}</p><SchoolLink to={`/pilote?section=devoirs&${teacher?'classe':'enfant'}=${encodeURIComponent(item.id)}`} onNavigate={onNavigate} className="button button-light">Voir les travaux <ArrowRight/></SchoolLink></section>)}{!items.length&&<p>Aucun {teacher?'groupe':'enfant'} rattaché à ce compte. Demande à l’équipe Jet d’Encre de vérifier tes accès.</p>}</div>;
}

export function SchoolHelp({user}){
  return <div className="school-help-list"><section className="panel"><h2>Mon compte</h2><p><strong>{user.name}</strong> · {user.schoolName}</p><p>Ton établissement et ton profil sont préparés par l’équipe Jet d’Encre.</p></section><details open><summary>Où retrouver mes activités ?</summary><p>Le menu reste à gauche : ouvre tes devoirs, la médiathèque ou tes progrès. Chaque rubrique fait partie du même espace.</p></details><details><summary>J’utilise un ordinateur partagé</summary><p>Déconnecte-toi lorsque tu as terminé. Ne communique jamais ton mot de passe et ne le saisis pas dans un devoir.</p></details><details><summary>Mes résultats et mes lectures sont-ils conservés ?</summary><p>Les devoirs remis et les mots fléchés sont enregistrés sur ton compte. La page de lecture d’un PDF est mémorisée sur cet appareil. Un texte qui n’a pas encore été remis reste dans la page : envoie-le avant de fermer ton navigateur.</p></details><a className="button button-light" href="/guide-ecole">Consulter le guide complet <ArrowRight/></a></div>;
}
