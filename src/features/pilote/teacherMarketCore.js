import {escapeCsvCell} from '../beta-data/csvImportCore.js';

export function summarizeSchoolMarket(students,tiers){
 const totalMissions=tiers.reduce((n,t)=>n+t.missionIds.length,0),totalMasteries=students.reduce((n,s)=>n+s.completedCount,0);
 const totalAutonomousMasteries=students.reduce((n,s)=>n+s.autonomyCount,0),count=students.length;
 return {students,totalMissions,summary:{studentCount:count,startedCount:students.filter(s=>s.started).length,
  completedCount:students.filter(s=>s.completedCount===totalMissions).length,supportCount:students.filter(s=>s.status==='support').length,
  totalMasteries,totalAutonomousMasteries,averageProgress:count?Math.round(totalMasteries/(count*totalMissions)*100):null,
  averageAutonomy:totalMasteries?Math.round(totalAutonomousMasteries/totalMasteries*100):null},
  tierSummaries:tiers.map(t=>{const completedStudents=students.filter(s=>s.tiers.find(p=>p.id===t.id).completedCount===t.missionIds.length).length;
   return {...t,completedStudents,inProgressStudents:students.filter(s=>{const p=s.tiers.find(p=>p.id===t.id);return p.started&&p.completedCount<t.missionIds.length;}).length,
    completionPercent:count?Math.round(completedStudents/count*100):null};})};
}
const normalize=text=>String(text??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLocaleLowerCase('fr');
export function filterSchoolMarket(students,{classId='all',status='all',period='all',query=''},generatedAt){
 const oldest=period==='all'?null:new Date(generatedAt).getTime()-Number(period)*86400000;
 return students.filter(s=>(classId==='all'||s.classIds.includes(classId))&&(status==='all'||s.status===status)&&
  (oldest===null||(s.lastActiveAt&&new Date(s.lastActiveAt).getTime()>=oldest))&&(!query||normalize(s.name).includes(normalize(query))));
}
export function schoolMarketCsv(snapshot,students,filters){
 const rows=[['Élève','Classes autorisées','Missions réussies','Missions proposées','Bonus autonomie','Premières réussites guidées','XP du Souk','Statut','Dernière activité','Calculé le','Source','Filtre classe','Filtre activité','Filtre statut','Recherche']];
 for(const s of students)rows.push([s.name,s.classLabel,s.completedCount,s.totalMissions,s.autonomyCount,s.helpCount??'Non documenté',s.soukXp,s.statusLabel,s.lastActiveAt??'',snapshot.generatedAt,snapshot.source,filters.classId,filters.period,filters.status,filters.query]);
 return '\uFEFF'+rows.map(row=>row.map(escapeCsvCell).join(';')).join('\r\n');
}
