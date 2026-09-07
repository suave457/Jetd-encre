import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { DemoProvider } from "./demoStore.jsx";
import { AppErrorBoundary } from "./AppErrorBoundary.jsx";
import { applyAccessibilityPreferences, readAccessibilityPreferences } from "./accessibilityPreferences.js";
import {interceptSchoolNavigation} from './features/pilote/schoolNavigationGuard.js';
import "./styles.css";
import "./pen-aligned-pages.css";
import "./launch-preparation.css";

applyAccessibilityPreferences(readAccessibilityPreferences());

const AdminManualLibrary = lazy(() => import("./features/pilote/AdminManualLibrary.jsx"));
const SchoolManualLibrary = lazy(() => import("./features/pilote/SchoolManualLibrary.jsx"));
const SchoolDirector = lazy(() => import("./features/pilote/SchoolDirector.jsx"));
const PilotApp = lazy(() => import("./features/pilote/PilotApp.jsx"));
const AccessAdmin = lazy(() => import('./features/pilote/AccessAdmin.jsx'));
const PilotCrosswords = lazy(() => import('./features/pilote/PilotCrosswords.jsx'));
const SchoolClassChallenges = lazy(() => import('./features/pilote/SchoolClassChallenges.jsx'));
const SchoolMarket = lazy(() => import('./features/pilote/SchoolMarket.jsx'));
const SchoolZellige = lazy(() => import('./features/pilote/SchoolZellige.jsx'));
const SchoolQuiz = lazy(() => import('./features/pilote/SchoolQuiz.jsx'));
const AccessPortal = lazy(() => import('./features/pilote/AccessPortal.jsx'));
const ManualActivation = lazy(() => import('./features/student/ManualActivation.jsx'));
const LocalTestTools = import.meta.env.DEV ? lazy(() => import('./features/pilote/LocalTestTools.jsx')) : null;
const LocalRecipeLogin = import.meta.env.DEV ? lazy(() => import('./features/pilote/LocalRecipeLogin.jsx')) : null;
function ApplicationRoot() {
  const [path, setPath] = useState(window.location.pathname+window.location.search);
  useEffect(() => { const update = event => {if(!interceptSchoolNavigation(event))setPath(window.location.pathname+window.location.search);}; window.addEventListener("popstate", update); window.addEventListener('jde:navigate', update); return () => {window.removeEventListener("popstate", update);window.removeEventListener('jde:navigate', update);}; }, []);
  const currentPath=path.split('?')[0].replace(/\/$/,'')||'/';
  const recipeProfile=currentPath.match(/^\/recette\/connexion\/(eleve|parent|enseignant|directeur|admin)$/)?.[1];
  if (import.meta.env.DEV && LocalRecipeLogin && recipeProfile && ['127.0.0.1','localhost','[::1]'].includes(window.location.hostname)) return <Suspense fallback={<p role="status">Chargement du formulaire…</p>}><LocalRecipeLogin key={path} profile={recipeProfile}/></Suspense>;
  if (import.meta.env.DEV && LocalTestTools && currentPath==='/outils-test' && ['127.0.0.1','localhost','[::1]'].includes(window.location.hostname)) return <Suspense fallback={<p role="status">Chargement des outils locaux…</p>}><LocalTestTools/></Suspense>;
  if ((currentPath==='/activation'||currentPath.startsWith('/activation/'))&&new URLSearchParams(window.location.search).get('mode')!=='demo') return <Suspense fallback={<p role="status">Chargement de l’activation…</p>}><ManualActivation/></Suspense>;
  if (currentPath === '/connexion') return <Suspense fallback={<p role="status">Chargement des espaces…</p>}><AccessPortal /></Suspense>;
  if (currentPath==='/admin/bibliotheque'&&new URLSearchParams(window.location.search).get('mode')!=='demo') return <Suspense fallback={<p role="status">Ouverture de la bibliothèque…</p>}><AdminManualLibrary/></Suspense>;
  if (currentPath==='/pilote/bibliotheque'||/^\/pilote\/lecture\/[a-zA-Z0-9_-]{1,100}$/.test(currentPath)) return <Suspense fallback={<p role="status">Ouverture des documents privés…</p>}><SchoolManualLibrary key={path}/></Suspense>;
  if (currentPath === "/pilote" && new URLSearchParams(window.location.search).get('profil') === 'directeur') return <Suspense fallback={<p role="status">Chargement de la Direction…</p>}><SchoolDirector/></Suspense>;
  if (currentPath === "/pilote") return <Suspense fallback={<p role="status">Chargement du pilote…</p>}><PilotApp /></Suspense>;
  if (currentPath === '/pilote/jeux/mots-fleches') return <Suspense fallback={<p role="status">Chargement des grilles…</p>}><PilotCrosswords /></Suspense>;
  if (currentPath==='/pilote/jeux/defis-classe') return <Suspense fallback={<p role="status">Chargement des défis…</p>}><SchoolClassChallenges/></Suspense>;
  if (currentPath==='/pilote/jeux/souk-des-mots') return <Suspense fallback={<p role="status">Chargement du Souk…</p>}><SchoolMarket/></Suspense>;
  if (currentPath==='/pilote/jeux/mission-zellige') return <Suspense fallback={<p role="status">Chargement de la mission…</p>}><SchoolZellige/></Suspense>;
  if (['/pilote/jeux/culture-generale','/pilote/jeux/defi-du-jour','/pilote/jeux/mot-juste'].includes(currentPath)) return <Suspense fallback={<p role="status">Chargement du jeu…</p>}><SchoolQuiz key={currentPath} gameId={currentPath.split('/').at(-1)}/></Suspense>;
  if (['/admin','/admin/accueil','/admin/ecoles-acces','/admin/licences','/admin/analyses','/admin/blog'].includes(currentPath)&&new URLSearchParams(window.location.search).get('mode')!=='demo') return <Suspense fallback={<p role="status">Chargement de l’administration…</p>}><AccessAdmin key={currentPath} home={['/admin','/admin/accueil'].includes(currentPath)} licences={currentPath==='/admin/licences'} analytics={currentPath==='/admin/analyses'} editorial={currentPath==='/admin/blog'}/></Suspense>;
  return <DemoProvider><App /></DemoProvider>;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
    <ApplicationRoot />
    </AppErrorBoundary>
  </React.StrictMode>,
);
