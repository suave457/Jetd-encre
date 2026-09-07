export function schoolHomework(items) {
  return items.map(item=>({...item,dueAt:item.dueDate+'T12:00:00',
    status:item.submission?.reviewedAt!=null?'Corrigé':item.submission?'Remis':'À faire'}));
}

// Only known original student routes can be translated into the school app.
export function studentSchoolPath(target) {
  const paths={'/eleve/tableau-de-bord':'accueil','/eleve/manuels':'manuels','/eleve/devoirs':'devoirs','/eleve/mediatheque':'mediatheque',
    '/eleve/jeux':'jeux','/eleve/progression':'progres','/eleve/recompenses':'recompenses','/eleve/profil':'aide'};
  if(Object.hasOwn(paths,target))return '/pilote?profil=eleve&section='+paths[target];
  const detail=target.match(/^\/eleve\/devoirs\/([a-f0-9-]{36})$/);
  if(detail)return '/pilote?profil=eleve&section=devoirs&devoir='+detail[1];
  if(target==='/eleve/jeux/mots-fleches')return '/pilote/jeux/mots-fleches';
  return target;
}
