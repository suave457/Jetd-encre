import { ArrowRight, Books, ChartLineUp, ChatCircleDots, CheckCircle, Clock, GameController, GridNine, PlayCircle, PresentationChart, Question, Sparkle, Student, Trophy } from '@phosphor-icons/react/ssr';
import PageHeader from '../../PageHeader.jsx';

function UnconnectedGame({title,gold=false}) {
  return <button type="button" disabled className={'button '+(gold?'button-gold':'button-light')} aria-label={title+' : pas encore relié au compte'}>Pas encore relié au compte</button>;
}

// Original StudentGames composition, classes and illustrations. The demo wrapper
// stays unchanged; this catalogue never imports DemoStore or local quiz history.
export default function SchoolGamesCatalogue({user,summary}) {
  if(user?.role!=='eleve')return <p role="alert">Ce catalogue est réservé à ton espace élève.</p>;
  const data=summary?.data;
  const own=data&&typeof user.id==='string'&&typeof user.schoolId==='string'&&data.userId===user.id&&data.schoolId===user.schoolId&&Array.isArray(data.children)?data.children.find(child=>child.studentId===user.id):null;
  const xp=Number.isSafeInteger(own?.xpTotal)&&own.xpTotal>=0?own.xpTotal:null;
  const balance=summary?.error?'Indisponible':xp===null?'En attente':xp+' XP';
  return <>
    <PageHeader eyebrow="APPRENDRE EN JOUANT" title="Mes jeux" subtitle="Teste tes connaissances, découvre de nouveaux repères et fais progresser ton profil." action={<div className="games-xp-balance"><Sparkle weight="fill"/><span><small>MON PROFIL</small><strong>{balance}</strong></span></div>}/>
    {summary?.error&&<p className="form-error" role="alert">Le total de tes XP n’a pas pu être confirmé. Tu peux ouvrir un jeu pour retrouver ta partie enregistrée.</p>}
    <section className="game-feature-card debate-game-feature" data-game="debat">
      <div className="game-feature-copy">
        <span className="game-kicker"><ChatCircleDots weight="fill"/> EXPRESSION ORALE · A1 À B2</span>
        <h2>Projet DÉBAT</h2>
        <p>Choisis ton camp, trouve tes arguments et fais vivre le débat en duo ou en équipe, avec des sujets proches de ton quotidien.</p>
        <div className="game-facts" aria-label="Caractéristiques de Projet DÉBAT"><span><Student weight="fill"/> 6–12 ans</span><span><Books weight="fill"/> 74 cartes · 18 thèmes</span><span><ChartLineUp weight="bold"/> A1 à B2</span><span><Clock weight="bold"/> 10–30 min</span></div>
        <UnconnectedGame title="Projet DÉBAT" gold/>
      </div>
      <div className="debate-game-card-art">
        <img src="/games/projet-debat/assets/illustrations/welcome-debat.webp" alt="Livre ouvert, plume et bulles de parole pour lancer un débat" width="512" height="512" loading="eager" decoding="async"/>
        <span><PresentationChart weight="fill"/> Duel ou équipes</span>
      </div>
    </section>
    <section className="game-feature-card mission-zellige-feature" data-game="mission-zellige">
      <div className="game-feature-copy">
        <span className="game-kicker"><Sparkle weight="fill"/> MISSION ZELLIGE · AVENTURE GUIDÉE</span>
        <h2>Mission Zellige</h2>
        <p>Observe une scène marocaine illustrée, écoute un indice et construis une phrase utile pour aider Lina dans son quartier.</p>
        <div className="game-facts" aria-label="Caractéristiques de Mission Zellige"><span><PlayCircle weight="bold"/> 4 situations illustrées</span><span><Clock weight="bold"/> 3–5 min</span></div>
        <a href="/pilote/jeux/mission-zellige" className="button button-gold">Commencer la mission <PlayCircle weight="fill"/></a>
      </div>
      <div className="mission-zellige-card-art">
        <img src="/assets/games/mission-zellige/mission-bibliotheque-v1-640.webp" alt="" width="640" height="400" loading="lazy" decoding="async"/>
        <span>BÊTA · 5e AEP</span>
      </div>
    </section>
    <section className="game-feature-card daily-game-feature zellige-section" data-game="defi-du-jour">
      <div className="game-feature-copy">
        <span className="game-kicker"><Trophy weight="fill"/> DÉFI DU JOUR</span>
        <h2>Cinq questions, une nouvelle aventure</h2>
        <p>Retrouve les cinq questions du jour et leur catégorie à l’ouverture du jeu. Termine le parcours, puis consulte ton résultat enregistré sur ton compte.</p>
        <div className="game-facts" aria-label="Caractéristiques du défi"><span><Question weight="bold"/> 5 questions</span><span><Clock weight="bold"/> 10 s par question</span><span><Sparkle weight="fill"/> +20 XP de complétion</span></div>
        <a href="/pilote/jeux/defi-du-jour" className="button button-gold">Relever le défi <PlayCircle weight="fill"/></a>
      </div>
      <div className="daily-game-art" aria-hidden="true"><img src="/assets/defi-du-jour-hero.webp" alt="" width="768" height="768" loading="eager" decoding="async"/></div>
    </section>
    <section className="game-secondary-card" data-game="culture-generale">
      <span className="game-secondary-icon"><GameController weight="duotone"/></span>
      <div><span className="game-kicker">ENTRAÎNEMENT LIBRE</span><h2>Quiz Culture générale</h2><p>Dix questions sur le Maroc, le monde francophone, les sciences, l’histoire et les arts. Rejoue quand tu veux et gagne 10 XP par bonne réponse.</p></div>
      <a href="/pilote/jeux/culture-generale" className="button button-light">Jouer librement <ArrowRight/></a>
    </section>
    <section className="game-secondary-card word-choice-entry" data-game="mot-juste">
      <span className="game-secondary-icon word-choice-thumb"><img src="/assets/games/word-choice/le-mot-juste-hero.webp" alt="" width="160" height="160" loading="lazy" decoding="async"/></span>
      <div><span className="game-kicker">VOCABULAIRE &amp; GRAMMAIRE</span><h2>Le Mot juste</h2><p>Complète des phrases proches du quotidien marocain, choisis parmi quatre mots et découvre une explication simple après chaque réponse.</p></div>
      <a href="/pilote/jeux/mot-juste" className="button button-light">Jouer avec les mots <ArrowRight/></a>
    </section>
    <section className="game-secondary-card mots-fleches-entry" data-game="mots-fleches">
      <span className="game-secondary-icon mots-fleches-thumb"><GridNine weight="duotone"/></span>
      <div><span className="game-kicker">LEXIQUE &amp; ORTHOGRAPHE · 18 GRILLES</span><h2>Mots fléchés</h2><p>Retrouve les mots grâce aux définitions placées dans la grille. Explore 6 grilles par niveau et gagne de 20 à 50 XP après chaque grille complète.</p></div>
      <a href="/pilote/jeux/mots-fleches" className="button button-light">Choisir une grille <ArrowRight/></a>
    </section>
    <section className="game-secondary-card market-shop-entry" data-game="souk-des-mots">
      <span className="game-secondary-icon market-shop-thumb"><img src="/assets/games/market-shop/market-vendor-scene.webp" alt="" width="160" height="160" loading="lazy" decoding="async"/></span>
      <div><span className="game-kicker">COMMUNIQUER AU QUOTIDIEN</span><h2>Le Souk des mots</h2><p>Écoute une commande, prépare le bon panier et utilise une formule polie avec le vendeur. Trois paliers et douze missions permettent de t’entraîner.</p></div>
      <a href="/pilote/jeux/souk-des-mots" className="button button-light">Entrer dans le souk <ArrowRight/></a>
    </section>
    <section className="game-secondary-card class-challenge-entry" data-game="defis-classe">
      <span className="game-secondary-icon class-challenge-thumb"><img src="/assets/games/class-challenges/defis-classes-hero.webp" alt="" width="160" height="160" loading="lazy" decoding="async"/></span>
      <div><span className="game-kicker">DÉFI DE LA CLASSE · PSEUDONYME PRIVÉ</span><h2>La classe avance ensemble</h2><p>Des défis de classe avec un classement par pseudonymes, à partir d’une banque de questions publiée.</p></div>
      <a href="/pilote/jeux/defis-classe" className="button button-light">Découvrir les défis <ArrowRight/></a>
    </section>
    <div className="game-guidance" aria-label="Principes du quiz">
      <article><CheckCircle weight="duotone"/><div><strong>Apprendre après chaque réponse</strong><span>Une explication courte complète la correction.</span></div></article>
      <article><Clock weight="duotone"/><div><strong>Un défi différent chaque jour</strong><span>La sélection du jour est confirmée à l’ouverture du jeu.</span></div></article>
      <article><Sparkle weight="duotone"/><div><strong>Une récompense équilibrée</strong><span>Les récompenses des sept jeux reliés sont enregistrées sur ton compte.</span></div></article>
    </div>
  </>;
}
