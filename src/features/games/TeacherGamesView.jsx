import {ArrowRight,Books,ChartLineUp,ChatCircleDots,CheckCircle,Clock,PresentationChart,Student} from '@phosphor-icons/react/ssr';
import PageHeader from '../../PageHeader.jsx';

export function DebateGameFeatureView({role="eleve",RouteLink,unconnected=false}){
  const teacher=role==="enseignant";
  return <section className="game-feature-card debate-game-feature">
    <div className="game-feature-copy">
      <span className="game-kicker"><ChatCircleDots weight="fill"/> EXPRESSION ORALE · A1 À B2</span>
      <h2>Projet DÉBAT</h2>
      <p>{teacher?"Préparez une séance de débat adaptée à votre classe, projetez une consigne claire et pilotez le temps, les aides et l’évaluation depuis le pupitre professeur.":"Choisis ton camp, trouve tes arguments et fais vivre le débat en duo ou en équipe, avec des sujets proches de ton quotidien."}</p>
      <div className="game-facts" aria-label="Caractéristiques de Projet DÉBAT"><span><Student weight="fill"/> 6–12 ans</span><span><Books weight="fill"/> 74 cartes · 18 thèmes</span><span><ChartLineUp weight="bold"/> A1 à B2</span><span><Clock weight="bold"/> 10–30 min</span></div>
      <RouteLink disabled={unconnected} to={`/${role}/jeux/debat`} className="button button-gold">{teacher?"Préparer une séance":"Lancer le jeu"} <ArrowRight weight="bold"/></RouteLink>
    </div>
    <div className="debate-game-card-art">
      <img src="/games/projet-debat/assets/illustrations/welcome-debat.webp" alt="Livre ouvert, plume et bulles de parole pour lancer un débat" width="512" height="512" loading="eager" decoding="async"/>
      <span><PresentationChart weight="fill"/> {teacher?"Projection + pupitre professeur":"Duel ou équipes"}</span>
    </div>
  </section>
}

export function TeacherGamesView({RouteLink,unconnected=false}){return <><PageHeader eyebrow="ENSEIGNER PAR LE JEU" title="Mes jeux" subtitle="Préparez une activité orale, lancez-la en classe et gardez les consignes bien visibles pour tous les élèves."/><DebateGameFeatureView role="enseignant" RouteLink={RouteLink} unconnected={unconnected}/><section className="game-secondary-card class-challenge-entry"><span className="game-secondary-icon class-challenge-thumb"><img src="/assets/games/class-challenges/defis-classes-hero.webp" alt="" width="160" height="160" loading="lazy" decoding="async"/></span><div><span className="game-kicker">DÉFIS DE CLASSE · PARTICIPATION PRIVÉE</span><h2>La classe avance ensemble</h2><p>Créez un défi à partir d’une banque publiée, suivez les résultats par pseudonyme et valorisez les réussites sans exposer l’identité des élèves.</p></div><RouteLink to="/enseignant/defis" className="button button-light">Gérer les défis <ArrowRight/></RouteLink></section><div className="game-guidance teacher-game-guidance" aria-label="Repères pédagogiques"><article><PresentationChart weight="duotone"/><div><strong>Projection lisible</strong><span>La consigne et le temps restent visibles pour toute la classe.</span></div></article><article><Student weight="duotone"/><div><strong>Différenciation immédiate</strong><span>Choisissez le niveau oral, les aides et le parcours scolaire.</span></div></article><article><CheckCircle weight="duotone"/><div><strong>Évaluation formative</strong><span>Le pupitre guide une observation simple et encourageante.</span></div></article></div></>}
