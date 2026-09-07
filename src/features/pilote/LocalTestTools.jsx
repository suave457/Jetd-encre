import { useEffect, useState } from 'react';
import { schoolApi } from './schoolApi.js';
import './pilot.css';

// Loaded only by Vite's development branch, never by a deployed school route.
export default function LocalTestTools() {
  const [profiles,setProfiles]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{
    const abort=new AbortController();
    schoolApi('/local/credentials',{signal:abort.signal,headers:{'X-Local-Pilot':'1'}}).then(value=>setProfiles(value.accounts)).catch(error=>{if(!abort.signal.aborted)setError(error.message);});
    return()=>abort.abort();
  },[]);
  async function prepare() {
    if(busy)return;setBusy(true);setError('');
    try {
      const result=await schoolApi('/local/prepare-recipe',{body:{},headers:{'X-Local-Pilot':'1'}});setNotice(result.message);
    }catch(error){setError(error.message);}finally{setBusy(false);}
  }
  return <main className="pilot-main"><h1>Outils de vérification locale</h1><p>Réservé aux essais sur cet ordinateur. Ces comptes sont fictifs ; ce panneau ne fait pas partie de la connexion scolaire. N’utilisez jamais ces identifiants sur Auth0 ni pour un compte réel.</p>{error&&<p role="alert">{error}</p>}<section className="pilot-panel"><h2>Catalogue fictif pour la recette des codes</h2><p>Prépare un titre de test distinct, sans modifier les comptes ni les contenus existants. Aucun vrai manuel n’est ajouté et aucun code n’est attribué automatiquement.</p><button disabled={busy} onClick={prepare}>{busy?'Préparation…':'Préparer le catalogue fictif'}</button>{notice&&<p role="status">{notice}</p>}</section><h2>Carnet des comptes fictifs</h2><div className="pilot-school-grid">{profiles.map(profile=><section className="pilot-school" key={profile.id}><h3>{profile.name}</h3><p>{profile.schoolName||'Administration'} · {profile.role}</p><label>Identifiant fictif<input readOnly value={profile.identifier} onFocus={event=>event.target.select()}/></label><label>Mot de passe fictif<input readOnly value={profile.password} onFocus={event=>event.target.select()}/></label><a className="button button-light" href={'/recette/connexion/'+profile.role}>Tester le formulaire</a></section>)}</div><p><a href="/connexion">Retour au site</a></p></main>;
}
