const profiles = new Set(['eleve', 'parent', 'enseignant', 'admin', 'directeur']);

// Presentation routing only. Node-only endpoints independently enforce the local boundary.
export function localRecipePath(profile, activation = false) {
  if (!import.meta.env?.DEV || !['127.0.0.1','localhost','[::1]'].includes(globalThis.location?.hostname) || !profiles.has(profile)) return null;
  if (activation && profile !== 'eleve') return null;
  return '/recette/connexion/' + profile + (activation ? '?retour=activation' : '');
}
