import { fail, first, reply } from './session.js';

const roles = new Set(['eleve', 'parent', 'enseignant', 'directeur', 'admin']);

// A selected profile restricts a sign-in; it can never grant a role.
export function requestedProfile(url) {
  const values = url.searchParams.getAll('profil');
  if (!values.length) return null;
  if (values.length !== 1 || !roles.has(values[0])) {
    fail(400, 'invalid_profile', 'Choisissez un profil de connexion valide.');
  }
  return values[0];
}

export async function effectiveRole(db, userId) {
  const admin = await first(db, `SELECT a.user_id FROM pilot_admins a JOIN pilot_users u ON u.id=a.user_id
    WHERE a.user_id=? AND a.active=1 AND u.active=1`, userId);
  if (admin) return 'admin';
  const membership = await first(db, `SELECT m.role FROM pilot_memberships m
    JOIN pilot_schools s ON s.id=m.school_id JOIN pilot_users u ON u.id=m.user_id
    WHERE m.user_id=? AND m.active=1 AND s.active=1 AND u.active=1 ORDER BY m.school_id LIMIT 1`, userId);
  return membership?.role ?? null;
}

export function requireProfile(actual, expected, mode = 'oidc') {
  if (expected && actual !== expected) {
    throw reply({error:{code:'profile_mismatch',message:'Ce compte ne dispose pas d’un accès à cet espace. Utilisez le compte correspondant au profil choisi.'},mode},403);
  }
}

export function signInReturn(profile, reason) {
  const path = profile === 'admin' ? '/admin/accueil' : '/pilote';
  const params = new URLSearchParams();
  if (profile) params.set('profil', profile);
  if (reason) params.set('connexion', reason);
  return path + (params.size ? '?' + params : '');
}
