import {TeacherGamesView} from '../games/TeacherGamesView.jsx';
function SchoolGameLink({to,disabled,children,...props}){
  if(disabled)return <button {...props} type="button" disabled aria-label="Projet DÉBAT : pas encore relié au compte">Pas encore relié au compte</button>;
  return <a {...props} href={to==='/enseignant/defis'?'/pilote?profil=enseignant&section=defis':to}>{children}</a>;
}
export default function SchoolTeacherGames(){return <TeacherGamesView RouteLink={SchoolGameLink} unconnected/>;}
