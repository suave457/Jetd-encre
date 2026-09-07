import { useEffect, useRef, useState } from 'react';
import { Copy, Key, Plus } from '@phosphor-icons/react/ssr';
import { schoolApi } from './schoolApi.js';

export default function AdminManualCodes({userId,csrf,schools}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[form,setForm]=useState(null),[issued,setIssued]=useState(null),[notice,setNotice]=useState('');
  const generation=useRef(0),lock=useRef(false);
  const [pendingIssue,setPendingIssue]=useState(null);
  useEffect(()=>{
    if(!pendingIssue&&!issued?.code)return;
    const leaving=event=>{event.preventDefault();event.returnValue='';};
    const logout=event=>{if(!window.confirm('Une génération de code est en cours de reprise, ou son secret est encore affiché. Conservez sa référence et les informations de distribution avant de vous déconnecter. Continuer ?'))event.preventDefault();};
    window.addEventListener('beforeunload',leaving);window.addEventListener('jde:before-school-logout',logout);
    return()=>{window.removeEventListener('beforeunload',leaving);window.removeEventListener('jde:before-school-logout',logout);};
  },[pendingIssue,issued]);
  function own(value){if(value.userId!==userId)throw new Error('Votre compte a changé. Reconnectez-vous.');return value;}
  async function load(offset=0){const version=++generation.current;setError('');try{const value=own(await schoolApi('/admin/manuals?offset='+offset));if(version===generation.current)setData(value);}catch(error){if(version===generation.current){setData(null);setError(error.message);}}}
  useEffect(()=>{load();return()=>{++generation.current;};},[userId]);
  async function issue(event){
    event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');const version=generation.current;
    const request=pendingIssue||{id:form.id,schoolId:form.schoolId,manualId:form.manualId,expiresAt:form.expiry?Math.floor(new Date(form.expiry+'T23:59:59Z').getTime()/1000):null};setPendingIssue(request);
    try{const result=await schoolApi('/admin/manual-codes',{body:request,csrf});if(version!==generation.current)return;
      if(result.id!==request.id||(!result.code&&result.replayed!==true))throw new Error('La génération n’a pas été confirmée. Reprenez la même demande.');
      setIssued(result);setForm(null);setPendingIssue(null);await load();
    }catch(error){if(version===generation.current){setError(error.message);if([400,422].includes(error.status)&&!error.responseUncertain)setPendingIssue(null);}}finally{lock.current=false;setBusy(false);}
  }
  function cancelIssue(){
    if(pendingIssue&&!window.confirm('La demande a peut-être été traitée. Si vous quittez cette reprise, vérifiez la référence '+pendingIssue.id+' dans le suivi et révoquez tout code perdu avant de recommencer. Abandonner cette reprise ?'))return;
    setForm(null);setPendingIssue(null);setError('');
  }
  async function revoke(code){
    if(lock.current||!window.confirm('Révoquer ce code ? S’il a été activé, l’élève perdra l’accès à ce manuel. Cette action ne peut pas être annulée.'))return;
    lock.current=true;setBusy(true);setError('');const version=generation.current;
    try{await schoolApi('/admin/manual-code-revoke',{body:{id:code.id},csrf});if(version!==generation.current)return;setNotice('Code révoqué.');await load();}catch(error){if(version===generation.current)setError(error.message);}finally{lock.current=false;setBusy(false);}
  }
  const available=data?.manuals.filter(manual=>manual.active)||[],activeSchools=schools.filter(school=>school.active);
  return <>
    {error&&<p role="alert" className="access-error">{error} {(!form||!data)&&<button onClick={()=>load()}>Réessayer le chargement</button>}</p>}
    {notice&&<p role="status">{notice}</p>}
    {!data&&!error&&<p role="status">Chargement des activations…</p>}
    {data&&<><section className="admin-metrics" aria-label="Activations enregistrées">{[['Codes générés',data.counts.total],['Codes activés',data.counts.activated],['Disponibles',data.counts.available],['Révoqués / expirés',data.counts.revoked+data.counts.expired]].map(([label,value])=><article className="access-panel" key={label}><span><Key/>{label}</span><strong>{value}</strong><small>Données enregistrées sur le serveur</small></article>)}</section>
    <section className="access-panel"><h2>Distribuer un code individuel</h2><p>Chaque code est réservé à une école et ne peut être activé que par un compte élève déjà créé. Le code secret ne s’affiche qu’une seule fois.</p>
      {!available.length?<p role="note">Aucun manuel validé n’est encore publié dans le catalogue. L’émission sera disponible après réception et raccordement du manuel scolaire ; aucun code fictif ne sera généré.</p>:<button className="access-primary" disabled={busy||!activeSchools.length||Boolean(issued)||Boolean(form)} onClick={()=>setForm({id:crypto.randomUUID(),schoolId:activeSchools[0].id,manualId:available[0].id,expiry:''})}><Plus/> Générer un code</button>}
      {form&&<form className="pilot-form" onSubmit={issue}><fieldset disabled={busy||Boolean(pendingIssue)}><label>École<select value={form.schoolId} onChange={e=>setForm({...form,schoolId:e.target.value})}>{activeSchools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Manuel<select value={form.manualId} onChange={e=>setForm({...form,manualId:e.target.value})}>{available.map(m=><option key={m.id} value={m.id}>{m.title} · {m.level}</option>)}</select></label><label>Date limite d’activation (fin du jour UTC, facultative)<input type="date" value={form.expiry} onChange={e=>setForm({...form,expiry:e.target.value})}/></label></fieldset>{pendingIssue&&!busy&&<p role="note">La demande reste figée jusqu’à sa confirmation : même référence, même école, même manuel. Aucun nouveau code ne sera demandé lors de la reprise. Référence : {pendingIssue.id}</p>}<div><button className="access-primary" disabled={busy}>{busy?'Émission…':pendingIssue?'Reprendre la même demande':'Confirmer la génération'}</button> <button type="button" disabled={busy} onClick={cancelIssue}>{pendingIssue?'Abandonner la reprise':'Annuler'}</button></div></form>}
      {issued&&<section role="status"><h3>{issued.code?'Code créé — à remettre en privé':'Demande déjà traitée'}</h3>{issued.code?<><label>Code secret<input readOnly value={issued.code} onFocus={e=>e.target.select()}/></label><button onClick={async()=>{try{await navigator.clipboard.writeText(issued.code);setNotice('Code copié. Conservez-le dans votre support de distribution privé.');}catch{setNotice('Sélectionnez le code puis copiez-le manuellement.');}}}><Copy/> Copier le code</button><p>En quittant cette page, vous ne pourrez plus afficher le secret. Ne le partagez pas publiquement.</p></>:<p>Le secret n’est pas récupérable. Vérifiez votre support de distribution ; si le code a été perdu, révoquez cette référence avant d’en créer une nouvelle.</p>}<p>Référence : {issued.id}</p><button onClick={()=>setIssued(null)}>J’ai conservé ces informations</button></section>}
    </section>
    <section className="access-panel"><h2>Suivi des codes</h2>{data.codes.length?<div className="access-table"><table><thead><tr><th>Référence</th><th>Manuel / école</th><th>État</th><th>Action</th></tr></thead><tbody>{data.codes.map(code=><tr key={code.id}><td>{code.id}</td><td><strong>{code.title}</strong><small>{code.schoolName}</small></td><td>{code.revokedAt!=null?'Révoqué':code.activatedAt!=null?'Activé':code.expiresAt!=null&&code.expiresAt<=data.generatedAt?'Expiré':'Disponible'}</td><td>{code.revokedAt==null&&<button disabled={busy||Boolean(form)} onClick={()=>revoke(code)}>Révoquer</button>}</td></tr>)}</tbody></table></div>:<p>Aucun code dans cette page.</p>}<div>{data.nextOffset!=null&&<button disabled={busy||Boolean(form)} onClick={()=>load(data.nextOffset)}>Page suivante</button>} <button disabled={busy||Boolean(form)} onClick={()=>load()}>Actualiser / première page</button></div></section></>}
  </>;
}
