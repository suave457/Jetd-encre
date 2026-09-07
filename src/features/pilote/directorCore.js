import { escapeCsvCell } from '../beta-data/csvImportCore.js';
export const DIRECTOR_SECTIONS=['accueil','actions','classes','enseignants','affectations','eleves','suivi-utilisation','etablissement','rapports','aide'];
export const directorPath=(section='accueil',detail=null)=>'/pilote?profil=directeur&section='+section+(detail?'&fiche='+encodeURIComponent(detail):'');
export const directorPercent=(n,d)=>d?Math.round(n/d*100):null;
export const directorPercentLabel=value=>value===null?'—':value+' %';
export function directorSelection(search){
 const params=new URLSearchParams(search),sections=params.getAll('section'),details=params.getAll('fiche');
 const section=sections[0]||'accueil';
 const invalid=sections.length>1||!DIRECTOR_SECTIONS.includes(section)||details.length>1||(details.length&&(!details[0]||!['classes','enseignants','rapports'].includes(section)));
 return {section,detail:details[0]||null,invalid};
}
const fold=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
export function directorModel(snapshot,{days='7',query=''}={}){
 const start=Date.parse(snapshot.generatedAt)-Number(days)*86400000,end=Date.parse(snapshot.generatedAt);
 const active=p=>Boolean(p.lastActiveAt&&Date.parse(p.lastActiveAt)>=start&&Date.parse(p.lastActiveAt)<=end);
 const classes=snapshot.classes.map(c=>{const students=snapshot.students.filter(s=>s.classIds.includes(c.id)),teachers=snapshot.teachers.filter(t=>t.classIds.includes(c.id));return {...c,students,teachers,activated:students.filter(s=>s.manuals>0).length,recent:students.filter(active).length,xp:students.reduce((n,s)=>n+s.xp,0)};});
 const totals={students:snapshot.students.length,teachers:snapshot.teachers.length,classes:classes.length,activated:snapshot.students.filter(s=>s.manuals>0).length,recent:snapshot.students.filter(active).length,xp:snapshot.students.reduce((n,s)=>n+s.xp,0),unassigned:classes.filter(c=>!c.teachers.length).length,unplaced:snapshot.students.filter(s=>!s.classIds.length).length};
 const priorities=[];
 if(totals.unassigned)priorities.push({id:'unassigned',title:'Vérifier les classes sans enseignant',count:totals.unassigned,description:'Faire confirmer les rattachements par Jet d’Encre avant d’interpréter l’activité.',section:'affectations'});
 if(totals.unplaced)priorities.push({id:'unplaced',title:'Vérifier les élèves sans classe active',count:totals.unplaced,description:'Le compte est actif, mais aucun rattachement à une classe active n’est enregistré.',section:'eleves'});
 if(totals.students>totals.activated)priorities.push({id:'activation',title:'Accompagner l’activation des manuels',count:totals.students-totals.activated,description:'Vérifier si un manuel est attendu, puis la remise du code et les conditions d’accès.',section:'eleves'});
 if(totals.students>totals.recent)priorities.push({id:'activity',title:'Comprendre l’absence d’activité récente',count:totals.students-totals.recent,description:'Vérifier le calendrier pédagogique, l’équipement et les consignes avant toute conclusion.',section:'suivi-utilisation'});
 const matches=row=>fold(row.name).includes(fold(query.trim()));
 return {classes,totals,priorities,active,visibleClasses:classes.filter(matches),visibleTeachers:snapshot.teachers.filter(matches),visibleStudents:snapshot.students.filter(matches)};
}
export function directorCsv(snapshot,{kind='summary',days='7'}={}){
 const model=directorModel(snapshot,{days}),{totals}=model;
 const meta=[snapshot.schoolName,snapshot.generatedAt,snapshot.source,days+' jours glissants'];
 let rows;
 if(kind==='classes')rows=[['Classe','Élèves','Enseignants','Manuel activé','Activité récente','XP cumulés','Définition du périmètre','Établissement','Calculé le','Source','Période activité'],...model.classes.map(c=>[c.name,c.students.length,c.teachers.length,c.activated,c.recent,c.xp,'Rattachements actifs. Un élève peut figurer dans plusieurs classes : lignes non additionnables. XP cumulés dans cette école.',...meta])];
 else if(kind==='activation')rows=[['Élève','Classes actives','Manuels activés distincts','Établissement','Calculé le','Source','Période activité'],...snapshot.students.map(s=>[s.name,snapshot.classes.filter(c=>s.classIds.includes(c.id)).map(c=>c.name).join(' · ')||'Sans classe active',s.manuals,...meta])];
 else rows=[['Indicateur','Valeur','Définition','Établissement','Calculé le','Source','Période activité'],...[
 ['Élèves actifs',totals.students,snapshot.definitions.scope],['Enseignants actifs',totals.teachers,snapshot.definitions.scope],['Classes actives',totals.classes,snapshot.definitions.scope],['Élèves avec manuel activé',totals.activated,snapshot.definitions.activation],['Élèves avec activité récente',totals.recent,snapshot.definitions.activity],['XP cumulés',totals.xp,snapshot.definitions.xp],['Classes sans enseignant',totals.unassigned,'Aucun enseignant actif rattaché à la classe'],['Élèves sans classe active',totals.unplaced,'Compte actif sans classe active rattachée']].map(row=>[...row,...meta])];
 return '\uFEFF'+rows.map(row=>row.map(escapeCsvCell).join(';')).join('\r\n');
}
