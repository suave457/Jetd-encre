// Node/Vite only. Deliberately fictitious, public test credentials, never Auth0 credentials.
import { createHash, timingSafeEqual } from 'node:crypto';
import { LOCAL_PROFILES } from './pilot-local-store.mjs';
import { effectiveRole, requireProfile, signInReturn } from '../worker/pilot/access-role.js';
import { fail, hash, issueSession, now, readCookie, readInput, reply, run, sameOrigin, TOKEN } from '../worker/pilot/session.js';

const identifiers = ['admin', 'salma', 'lina', 'youssef', 'adam', 'amine', 'nora', 'imane', 'samira', 'karim'];
export const LOCAL_CREDENTIALS = Object.freeze(LOCAL_PROFILES.map((profile, index) => Object.freeze({
  profileId: profile.id, identifier: identifiers[index] + '@recette.invalid', password: 'JetEncre-Test-2026!',
})));
const roles = new Set(['eleve', 'parent', 'enseignant', 'directeur', 'admin']);
const digest = value => createHash('sha256').update(value).digest();

export function requireLocalRecipeRequest(request, mutation = false) {
  const url = new URL(request.url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || request.headers.get('X-Local-Pilot') !== '1') {
    fail(403, 'local_request_required', 'Ce parcours est réservé aux essais locaux.');
  }
  if (mutation) sameOrigin(request);
}

export async function credentialRecipe(request, DB) {
  requireLocalRecipeRequest(request, true);
  const input = await readInput(request, 2048);
  if (Object.keys(input).some(key => !['identifier', 'password', 'profile', 'returnTo'].includes(key)) ||
      typeof input.identifier !== 'string' || !input.identifier.trim() || input.identifier.length > 254 ||
      typeof input.password !== 'string' || !input.password || input.password.length > 128 || !roles.has(input.profile) ||
      (input.returnTo !== undefined && input.returnTo !== 'activation') || (input.returnTo === 'activation' && input.profile !== 'eleve')) {
    fail(422, 'invalid_recipe_input', 'Vérifiez les champs du formulaire de test.');
  }
  const account = LOCAL_CREDENTIALS.find(item => item.identifier === input.identifier.trim().toLowerCase());
  const passwordMatches = timingSafeEqual(digest(input.password), digest(account?.password ?? 'unknown-test-account'));
  if (!account || !passwordMatches) fail(403, 'invalid_credentials', 'Identifiant ou mot de passe de test incorrect.');
  const actual = await effectiveRole(DB, account.profileId);
  if (!actual) fail(403, 'invalid_credentials', 'Identifiant ou mot de passe de test incorrect.');
  requireProfile(actual, input.profile, 'local_fixture');
  // The database checks the requested role again during insertion. A rejected login never clears the old session.
  const result = await issueSession(DB, account.profileId, 'local_fixture', true, input.profile);
  const old = readCookie(request, 'jde_local_pilot');
  if (old && TOKEN.test(old)) await run(DB, 'UPDATE pilot_sessions SET revoked_at=? WHERE token_hash=?', now(), await hash(old));
  return reply({ ok: true, destination: input.returnTo === 'activation' ? '/activation' : signInReturn(input.profile) }, 200, { 'Set-Cookie': result.cookie });
}
