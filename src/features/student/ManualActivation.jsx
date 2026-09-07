import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Key, Question, WarningCircle } from '@phosphor-icons/react/ssr';
import { AuthLayout } from '../../App.jsx';
import { PenAccessPage } from '../../PenAlignedPages.jsx';
import { schoolApi } from '../pilote/schoolApi.js';
import { getSignInFailure } from '../pilote/schoolNavigationCore.js';
import { localRecipePath } from '../pilote/localRecipePath.js';

const screens={'/activation/code-invalide':'activation.invalid','/activation/acces-deja-active':'activation.used','/activation/deja-actif':'activation.used','/activation/code-expire':'activation.expired','/activation/succes':'activation.success'};
const errors={code_invalid:'/activation/code-invalide',code_used:'/activation/acces-deja-active',code_expired:'/activation/code-expire'};
const Layout=props=><AuthLayout connected {...props}/>;
function Link({to,...props}){return <a href={to==='/connexion/eleve'?(localRecipePath('eleve',true)||'/api/pilot/auth/start?profil=eleve&retour=activation'):to} {...props}/>;}

export default function ManualActivation(){
  const [location,setLocation]=useState(()=>window.location.pathname+window.location.search);
  const [session,setSession]=useState(null),[loading,setLoading]=useState(true),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[retry,setRetry]=useState(0);
  const write=useRef(null),generation=useRef(0),owner=useRef(null);
  const path=location.split('?')[0].replace(/\/$/,''),failure=getSignInFailure(location.includes('?')?location.slice(location.indexOf('?')):'');
  useEffect(()=>{const update=()=>setLocation(window.location.pathname+window.location.search);window.addEventListener('popstate',update);window.addEventListener('jde:navigate',update);return()=>{window.removeEventListener('popstate',update);window.removeEventListener('jde:navigate',update);write.current?.abort();};},[]);
  useEffect(()=>{
    document.title='Activation du manuel · Jet d’Encre';
    const refresh=()=>{if(!write.current)setRetry(value=>value+1);};
    const changed=()=>{++generation.current;write.current?.abort();write.current=null;setBusy(false);setCode('');setSession(null);setConfirmed(false);setLoading(true);setRetry(value=>value+1);};
    const visible=()=>{if(document.visibilityState==='visible')refresh();};
    const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('jde-pilot-session'):null;
    if(channel)channel.onmessage=changed;
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);
    return()=>{channel?.close();window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};
  },[]);
  useEffect(()=>{
    const abort=new AbortController(),version=++generation.current;
    setConfirmed(false);setLoading(true);setSession(null);setError(failure||'');
    if(failure){setLoading(false);return()=>abort.abort();}
    schoolApi('/session?profil=eleve',{signal:abort.signal}).then(async value=>{
      if(abort.signal.aborted||version!==generation.current)return;
      const nextOwner=value.authenticated?value.user.id+':'+value.user.schoolId:null;
      if(nextOwner!==owner.current)setCode('');
      owner.current=nextOwner;
      setSession(value);
      if(path==='/activation/succes'&&value.authenticated){
        const response=await schoolApi('/manuals',{signal:abort.signal});
        if(abort.signal.aborted||version!==generation.current)return;
        const id=window.history.state?.activationId;
        if(response.userId!==value.user.id||response.schoolId!==value.user.schoolId)throw Object.assign(new Error('Le compte a changé. Reconnecte-toi avant de continuer.'),{status:403});
        if(response.manuals.some(item=>item.id===id))setConfirmed(true);
        else setError('Aucune activation confirmée pour cette page. Consulte Mes manuels ou saisis ton code.');
      }
    }).catch(error=>{if(!abort.signal.aborted){setError(error.message);if([401,403].includes(error.status)){setSession(null);setConfirmed(false);setCode('');owner.current=null;}}}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[location,retry]);
  const signIn=localRecipePath('eleve',true)||'/api/pilot/auth/start?profil=eleve&retour=activation';
  function go(to,state={}){window.history.pushState(state,'',to);window.dispatchEvent(new Event('jde:navigate'));}
  async function submit(event){
    event.preventDefault();if(loading||write.current)return;
    if(!session?.authenticated){window.location.assign(signIn);return;}
    const abort=new AbortController(),version=generation.current;write.current=abort;setBusy(true);setError('');
    try{
      const result=await schoolApi('/manuals/activate',{csrf:session.csrfToken,body:{code},signal:abort.signal});
      if(abort.signal.aborted||version!==generation.current)return;
      if(result.userId!==session.user.id||result.schoolId!==session.user.schoolId)throw Object.assign(new Error('Le compte a changé. Reconnecte-toi avant de continuer.'),{status:403});
      setCode('');go('/activation/succes',{activationId:result.manual.id});
    }catch(error){
      if(abort.signal.aborted||version!==generation.current)return;
      if(errors[error.code])go(errors[error.code]);
      else {setError(error.message);if([401,403].includes(error.status)){setSession(null);setConfirmed(false);setCode('');owner.current=null;}}
    }finally{if(write.current===abort){write.current=null;setBusy(false);}}
  }
  // The URL alone never proves an activation. Success is re-read from this pupil's server rights.
  if(session?.authenticated&&!loading&&screens[path]&&(path!=='/activation/succes'||confirmed))return <PenAccessPage screen={screens[path]} connected ui={{AuthLayout:Layout,RouteLink:Link}}/>;
  return <Layout title="Activez votre manuel" intro="Le code se trouve sur la carte d’activation à l’intérieur du manuel.">
    <form className="activation-form" onSubmit={submit}>
      <label>Code d’activation<div className="code-input"><Key weight="duotone"/><input value={code} onChange={event=>{setCode(event.target.value.toUpperCase());setError('');}} placeholder="Recopie le code de ton manuel" disabled={!session?.authenticated||loading||busy} autoComplete="off" spellCheck={false} maxLength={100} aria-invalid={Boolean(error)} aria-describedby={'activation-help'+(error?' activation-error':'')} required/></div></label>
      {error&&<p id="activation-error" className="form-error" role="alert"><WarningCircle weight="fill"/> {error}</p>}
      <button className="button button-gold button-wide" type="submit" disabled={loading||busy}>{loading?'Vérification du compte…':busy?'Vérification du code…':session?.authenticated?'Vérifier mon code':'Me connecter avec mon compte Élève'} <ArrowRight weight="bold"/></button>
      <div id="activation-help" className="activation-help"><Question weight="fill"/><span>{session?.authenticated?`Compte : ${session.user.name} · ${session.user.schoolName}. Le code ajoute le manuel à ce compte uniquement.`:'Utilise le compte élève déjà créé par Jet d’Encre. Le code ne crée aucun compte et ne permet pas de choisir un établissement.'}</span></div>
      {error&&<button className="text-action" type="button" onClick={()=>setRetry(value=>value+1)}>Revérifier mon accès</button>}
      {session?.authenticated&&<a className="back-choice" href="/pilote?profil=eleve&section=manuels">Retour à mes manuels</a>}
    </form>
  </Layout>;
}
