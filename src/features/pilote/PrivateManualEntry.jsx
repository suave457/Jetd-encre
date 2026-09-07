import {ArrowRight} from '@phosphor-icons/react/ssr';
export const libraryPath=role=>role==='admin'?'/admin/bibliotheque':'/pilote/bibliotheque?profil='+role;
export const privateReadingPath=(id,role)=>'/pilote/lecture/'+encodeURIComponent(id)+'?profil='+role;
export function PrivateManualEntry({role}){return <section className="panel"><h2>Documents privés</h2><p>Consultez les documents autorisés pour votre compte, séparés de la collection de découverte.</p><a className="button button-light" href={libraryPath(role)}>Consulter les documents <ArrowRight/></a></section>;}
