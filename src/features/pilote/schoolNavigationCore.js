const sections = Object.freeze({
  eleve: ['accueil', 'devoirs', 'jeux', 'mediatheque', 'progres', 'aide'],
  parent: ['accueil', 'enfants', 'devoirs', 'mediatheque', 'progres', 'aide'],
  enseignant: ['accueil', 'classes', 'devoirs', 'mediatheque', 'aide'],
});

// This is presentation routing only. Every request retains server authorization.
export function getSchoolSection(search, role) {
  const params = new URLSearchParams(search);
  const requested = params.get('section');
  return params.getAll('section').length === 1 && Object.hasOwn(sections, role) && sections[role].includes(requested) ? requested : 'accueil';
}

export function getAutomaticSignInPath(session, search) {
  const params = new URLSearchParams(search);
  return session?.authenticated === false && session.mode === 'oidc'
    && session.signInPath === '/api/pilot/auth/start'
    && params.getAll('connexion').length === 1 && params.get('connexion') === '1'
    ? '/api/pilot/auth/start' : null;
}
