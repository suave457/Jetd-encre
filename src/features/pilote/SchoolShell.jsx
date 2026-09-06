import { Question, ShieldCheck, SignOut, Sparkle, ArrowLeft } from '@phosphor-icons/react/ssr';
import { getResponsiveImageProps } from '../../mediaAssets.js';
import './school-shell.css';

const roleLabels={eleve:'Élève',parent:'Parent',enseignant:'Enseignant',admin:'Administration'};
export function SchoolBrand({inverse=false}) {
  return <span className={`brand ${inverse?'brand-inverse':''}`}><span className="brand-mark"><img {...getResponsiveImageProps('jet-dencre-monogram-light.png',{sizes:'44px'})} alt=""/></span><span className="brand-copy"><strong>Jet d’Encre</strong><small>ÉDITIONS</small></span></span>;
}

export default function SchoolShell({role,user,schoolName,nav=[],activeId,onLogout,busy,xp,children,onNavigate,mainId='pilot-main',secondaryNav}) {
  const initials=user?.name?.split('·')[0].trim().split(/\s+/).filter(Boolean).map(word=>word[0]).join('').slice(0,2).toLocaleUpperCase('fr')||'JE';
  function follow(event,href){
    if(!onNavigate||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();onNavigate(href);
  }
  if(!user)return <div className="school-entry zellige-section"><a className="school-skip" href={`#${mainId}`}>Aller au contenu</a><div className="auth-top"><a href="/" aria-label="Jet d’Encre — accueil"><SchoolBrand/></a><a href="/connexion" className="back-link"><ArrowLeft/> Choisir mon profil</a></div>{children}</div>;
  return <div className={`app-shell school-shell school-role-${role}`}>
    <a className="school-skip" href={`#${mainId}`}>Aller au contenu</a>
    <aside className="app-sidebar" aria-label={`Menu ${roleLabels[role]||'scolaire'}`}>
      <div className="sidebar-brand"><a href="/" aria-label="Jet d’Encre — accueil"><SchoolBrand inverse/></a><small>{role==='admin'?'ADMINISTRATION':`ESPACE ${roleLabels[role]?.toLocaleUpperCase('fr')||'SCOLAIRE'}`}</small></div>
      <nav aria-label={role==='admin'?'Navigation administrateur':`Navigation ${roleLabels[role]||'scolaire'}`}>{nav.map(({id,label,href,Icon,disabled,note})=>disabled?<span key={id} className="side-link school-nav-unavailable" aria-disabled="true">{Icon&&<Icon/>}<span>{label}{note&&<small>{note}</small>}</span></span>:<a key={id} className={`side-link ${activeId===id?'active':''}`} aria-current={activeId===id?'page':undefined} href={href} onClick={e=>follow(e,href)}>{Icon&&<Icon weight={activeId===id?'fill':'regular'}/>}<span>{label}{note&&<small>{note}</small>}</span></a>)}</nav>
      {secondaryNav&&<div className="school-secondary-nav">{secondaryNav}</div>}
      <a className="sidebar-help" href={role==='admin'?'/guide-ecole':'/pilote?section=aide'} onClick={role==='admin'?undefined:e=>follow(e,'/pilote?section=aide')}><Question weight="fill"/><span><strong>Aide & assistance</strong><small>Guides et connexion</small></span></a>
      {onLogout&&<button className="side-logout" onClick={onLogout} disabled={busy}><SignOut/> Se déconnecter</button>}
    </aside>
    <div className="app-area"><header className="app-topbar school-topbar"><span className="school-name">{schoolName||user.schoolName||'Administration Jet d’Encre'}</span><div className="topbar-meta">{typeof xp==='number'&&<span className="student-xp-chip"><Sparkle weight="fill"/><strong>{xp} XP</strong></span>}<span className="demo-badge"><ShieldCheck weight="fill"/> Site de test</span><div className="profile-button school-identity"><span aria-hidden="true">{initials}</span><span><strong>{user.name}</strong><small>{roleLabels[role]}</small></span></div></div></header>{children}</div>
  </div>;
}
