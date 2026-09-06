import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Buildings, CaretRight, ChalkboardTeacher, ShieldCheck, Student, Users } from '@phosphor-icons/react/ssr';
import { getResponsiveImageProps } from '../../mediaAssets.js';
import './access-portal.css';

const profiles = [
  { id: 'eleve', label: 'Élève', Icon: Student, description: 'Je retrouve mes devoirs, mes jeux et mes progrès.', demo: 'Je découvre mon manuel, mes devoirs et mes jeux.' },
  { id: 'parent', label: 'Parent', Icon: Users, description: 'Je suis les travaux et les progrès de mon enfant.', demo: 'Je découvre le suivi et les ressources pour les familles.' },
  { id: 'enseignant', label: 'Enseignant', Icon: ChalkboardTeacher, description: 'Je prépare les devoirs et j’accompagne mes classes.', demo: 'J’explore les classes et les ressources pédagogiques.' },
  { id: 'directeur', label: 'Direction', Icon: Buildings, description: 'Espace connecté en préparation.', demo: 'Je découvre le suivi de mon établissement.' },
  { id: 'admin', label: 'Administration', Icon: ShieldCheck, description: 'Je gère les écoles, les comptes et leurs accès.', demo: 'J’explore les contenus, les médias et le pilotage.' },
];

export default function AccessPortal() {
  const demo = new URLSearchParams(window.location.search).get('mode') === 'demo';
  useEffect(() => { document.title = `${demo ? 'Découvrir les espaces' : 'Connexion'} · Jet d’Encre`; }, [demo]);

  return <div className="auth-page zellige-section entry-page">
    <a className="entry-skip" href="#entry-main">Aller au contenu</a>
    <header className="auth-top">
      <a href="/" aria-label="Jet d’Encre — accueil"><span className="brand"><span className="brand-mark"><img {...getResponsiveImageProps('jet-dencre-monogram-light.png', { sizes: '44px' })} alt=""/></span><span className="brand-copy"><strong>Jet d’Encre</strong><small>ÉDITIONS</small></span></span></a>
      <a href="/" className="back-link"><ArrowLeft/> Retour à l’accueil</a>
    </header>
    <main id="entry-main" className="auth-card" tabIndex="-1">
      <div className="auth-heading">
        <span className="demo-badge"><ShieldCheck weight="fill"/>{demo ? 'Démonstration · données fictives' : 'Site de test · accès scolaire'}</span>
        <h1>{demo ? 'Quel espace veux-tu découvrir ?' : 'Qui se connecte aujourd’hui ?'}</h1>
        <p>{demo ? 'Explore les espaces avec des profils fictifs.' : 'Choisis ton profil, puis connecte-toi avec ton identifiant.'}</p>
      </div>
      <nav className="role-grid" aria-label={demo ? 'Profils de démonstration' : 'Choisir mon profil'}>
        {profiles.map(({ id, label, Icon, description, demo: demoDescription }) => <a key={id} className={`role-card role-${id}`} href={demo ? `/connexion/${id}` : id === 'admin' ? '/admin/accueil?connexion=1' : id === 'directeur' ? '/ecoles' : `/pilote?profil=${id}&connexion=1`}>
          <span className="role-icon"><Icon weight="duotone"/></span>
          <span><strong>{label}</strong><small>{demo ? demoDescription : description}</small>{id === 'directeur' && !demo && <span className="entry-coming-soon">Découvrir le parcours école</span>}</span>
          <CaretRight weight="bold"/>
        </a>)}
      </nav>
      <div className="entry-secondary">
        <p>{demo ? 'Les essais restent sur cet appareil, séparés du compte scolaire.' : 'Ton accès est préparé par Jet d’Encre et remis en privé.'}</p>
        <a className="entry-mode-link" href={demo ? '/connexion' : '/connexion?mode=demo'}>{demo ? 'J’ai un compte scolaire' : 'Explorer la démonstration'}<ArrowRight/></a>
      </div>
      <a href="/guide-ecole" className="entry-help-link">Besoin d’aide pour te connecter ?</a>
    </main>
    <p className="auth-note entry-test-note"><ShieldCheck weight="fill"/>Comptes fictifs uniquement · Aucune donnée personnelle d’élève.</p>
  </div>;
}
