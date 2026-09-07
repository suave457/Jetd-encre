const sections = Object.freeze({
  eleve: ['accueil', 'manuels', 'devoirs', 'jeux', 'mediatheque', 'progres', 'aide'],
  parent: ['accueil', 'enfants', 'devoirs', 'mediatheque', 'progres', 'aide'],
  enseignant: ['accueil', 'classes', 'devoirs', 'jeux', 'defis', 'analyses', 'souk', 'mediatheque', 'aide'],
});

// This is presentation routing only. Every request retains server authorization.
export function getSchoolSection(search, role) {
  const params = new URLSearchParams(search);
  const requested = params.get('section');
  return params.getAll('section').length === 1 && Object.hasOwn(sections, role) && sections[role].includes(requested) ? requested : 'accueil';
}

const assignmentUuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

// URL identity is explicit: a malformed link must never choose another assignment.
export function getAssignmentRequest(search) {
  const values = new URLSearchParams(search).getAll('devoir');
  if (!values.length) return { present: false, id: null, error: '' };
  if (values.length !== 1 || !assignmentUuid.test(values[0])) {
    return { present: true, id: null, error: 'Le lien de ce devoir est invalide. Reviens à la liste pour choisir un devoir.' };
  }
  return { present: true, id: values[0].toLowerCase(), error: '' };
}

export function assignmentMatchesSelection(assignment, selection) {
  return Boolean(assignment && !selection.error && (!selection.classIds || selection.classIds.includes(assignment.classId)));
}

// These filters narrow display only; the detail API independently checks access.
export function getSchoolAssignmentSelection(search, role, workspace = {}) {
  const params = new URLSearchParams(search), request = getAssignmentRequest(search);
  const classes = params.getAll('classe'), children = params.getAll('enfant');
  let error = request.error, requestedClass = null, requestedChild = null, classIds = null;
  if (classes.length) {
    requestedClass = workspace.classes?.find(group => group.id === classes[0]) || null;
    if (classes.length !== 1 || role !== 'enseignant' || !requestedClass) error = 'Cette classe n’est pas disponible dans ton espace.';
    else classIds = [requestedClass.id];
  }
  if (children.length) {
    const groups = workspace.children?.filter(child => child.id === children[0]) || [];
    requestedChild = groups[0] || null;
    if (children.length !== 1 || role !== 'parent' || !requestedChild || classes.length) error = 'Cet enfant n’est pas disponible dans ton espace.';
    else classIds = [...new Set(groups.map(child => child.classId))];
  }
  const selection = { error, classIds, requestedClass, requestedChild, explicit: request.present };
  const listed = (workspace.assignments || []).filter(assignment => assignmentMatchesSelection(assignment, selection));
  return { ...selection, assignmentId: error ? null : request.id || listed[0]?.id || null };
}

export function schoolAssignmentPath(search, assignmentId) {
  const params = new URLSearchParams(search);
  params.set('section', 'devoirs');
  params.delete('devoir');
  if (assignmentId) params.set('devoir', assignmentId);
  return '/pilote?' + params;
}

const loginProfiles = new Set(['eleve', 'parent', 'enseignant', 'directeur', 'admin']);

// Preserve the selected space even for native navigation (new tab / copied link).
// This never grants a role: the server independently checks the session.
export function withSchoolProfile(target, role) {
  if (!loginProfiles.has(role) || !/^\/pilote(?:\?|#|$)/.test(target)) return target;
  const url = new URL(target, 'https://school.invalid');
  url.searchParams.set('profil', role);
  return url.pathname + url.search + url.hash;
}

export function getSignInFailure(search) {
  const params=new URLSearchParams(search);
  if(params.getAll('connexion').length>1)return 'Le retour de connexion est invalide. Recommencez pour ouvrir votre espace.';
  const messages={
    'profil-incompatible':'Ce compte ne dispose pas d’un accès à cet espace. Utilisez le compte correspondant au profil choisi.',
    'non-autorisee':'Ce compte ne dispose pas encore d’un accès actif. Vérifiez votre identifiant auprès de votre établissement.',
    'expiree':'La connexion a expiré. Recommencez pour ouvrir votre espace.',
    'echec':'La connexion n’a pas abouti. Vous pouvez réessayer.',
  };
  return Object.hasOwn(messages,params.get('connexion'))?messages[params.get('connexion')]:null;
}

export function getProfileQuery(search, fixedProfile = null) {
  if (fixedProfile) return '?profil=' + encodeURIComponent(fixedProfile);
  const params = new URLSearchParams(search), query = new URLSearchParams();
  for (const profile of params.getAll('profil')) query.append('profil', profile);
  return query.size ? '?' + query : '';
}

export function getProfileSignInPath(search, fixedProfile = null) {
  const query = getProfileQuery(search, fixedProfile), params = new URLSearchParams(query);
  const profiles = params.getAll('profil');
  if (profiles.length > 1 || (profiles.length === 1 && !loginProfiles.has(profiles[0]))) return null;
  return '/api/pilot/auth/start' + query;
}

export function getAutomaticSignInPath(session, search, fixedProfile = null) {
  const params = new URLSearchParams(search);
  return session?.authenticated === false && session.mode === 'oidc'
    && session.signInPath === '/api/pilot/auth/start'
    && params.getAll('connexion').length === 1 && params.get('connexion') === '1'
    ? getProfileSignInPath(search, fixedProfile) : null;
}
