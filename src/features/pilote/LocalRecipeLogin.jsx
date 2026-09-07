import { useEffect, useRef, useState } from 'react';
import { RoleLoginView } from '../../App.jsx';
import { ParentLoginView } from '../../ParentPages.jsx';
import { schoolApi } from './schoolApi.js';

// DEV + loopback entry in main.jsx; never a replacement password provider in the Worker.
export default function LocalRecipeLogin({profile}) {
  const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const pending=useRef(null);
  const values=new URLSearchParams(window.location.search).getAll('retour');
  const activation=profile==='eleve'&&values.length===1&&values[0]==='activation';
  useEffect(()=>{document.title='Connexion · recette locale Jet d’Encre';return()=>pending.current?.abort();},[]);
  async function submit(event) {
    event.preventDefault();if(pending.current)return;
    if(values.length&&(values.length!==1||!activation)){setMessage('Le retour demandé n’est pas disponible. Revenez au choix du profil.');return;}
    const abort=new AbortController();pending.current=abort;setBusy(true);setMessage('');
    try {
      const result=await schoolApi('/local/credential-login',{body:{identifier,password,profile,...(activation?{returnTo:'activation'}:{})},headers:{'X-Local-Pilot':'1'},signal:abort.signal});
      if(abort.signal.aborted)return;
      const destination=activation?'/activation':profile==='admin'?'/admin/accueil?profil=admin':'/pilote?profil='+profile;
      if(result.ok!==true||result.destination!==destination)throw new Error('La connexion n’a pas été confirmée. Réessayez.');
      setPassword('');
      if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('jde-pilot-session');channel.postMessage('changed');channel.close();}
      window.location.replace(destination);
    } catch(error) { if(!abort.signal.aborted){setPassword('');setMessage(error.message);} }
    finally {if(pending.current===abort){pending.current=null;if(!abort.signal.aborted)setBusy(false);}}
  }
  const props={identifier,password,setIdentifier,setPassword,message,submit,busy,recipe:true,onRecovery:()=>setMessage('Recette fictive : aucun e-mail n’est envoyé et aucun mot de passe réel n’est modifié. Reprenez les identifiants du carnet local remis pour les essais.')};
  return profile==='parent'?<ParentLoginView {...props}/>:<RoleLoginView role={profile} {...props}/>;
}
