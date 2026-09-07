import { escapeCsvCell } from '../beta-data/csvImportCore.js';

export function analyticsRatio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator * 100 : null;
}
export function analyticsPercent(value) {
  return value === null ? 'Non calculable' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value)} %`;
}
export function analyticsCards(snapshot) {
  const t = snapshot.totals;
  return [
    { key: 'participation', label: 'Participation mesurée', numerator: t.participatingStudents, denominator: t.eligibleStudents, detail: `${t.participatingStudents} inscriptions participantes sur ${t.eligibleStudents} actives · devoirs et sept jeux raccordés`, tone: 'green' },
    { key: 'reviews', label: 'Remises corrigées à ce jour', numerator: t.reviewedSubmissions, denominator: t.submissions, detail: `${t.reviewedSubmissions} correction${t.reviewedSubmissions>1?'s':''} sur ${t.submissions} remise${t.submissions>1?'s':''} de la période`, tone: 'gold' },
    { key: 'activation', label: 'Codes activés à ce jour', numerator: t.issuedCodesActivated, denominator: t.codesIssued, detail: `${t.issuedCodesActivated} activation${t.issuedCodesActivated>1?'s':''} sur ${t.codesIssued} code${t.codesIssued>1?'s':''} émis pendant la période`, tone: 'blue' },
  ].map(card => ({ ...card, value: analyticsPercent(analyticsRatio(card.numerator, card.denominator)), definition: snapshot.definitions[card.key] }));
}
export function analyticsGameRows(snapshot) {
  const t = snapshot.totals;
  return [
    { key: 'crossword_completions', label: 'Mots fléchés · grilles terminées', value: t.gameCompletions, unit: 'nombre' },
    { key: 'culture_answers', label: 'Culture générale · réponses confirmées datées', value: t.cultureAnswers, unit: 'nombre' },
    { key: 'culture_completions', label: 'Culture générale · tentatives terminées', value: t.cultureCompletions, unit: 'nombre' },
    { key: 'daily_answers', label: 'Défi du jour · réponses confirmées datées', value: t.dailyAnswers, unit: 'nombre' },
    { key: 'daily_completions', label: 'Défi du jour · tentatives terminées', value: t.dailyCompletions, unit: 'nombre' },
    { key: 'word_choice_answers', label: 'Le Mot juste · réponses confirmées datées', value: t.wordChoiceAnswers, unit: 'nombre' },
    { key: 'word_choice_completions', label: 'Le Mot juste · tentatives terminées', value: t.wordChoiceCompletions, unit: 'nombre' },
    { key: 'word_choice_xp', label: 'XP · Le Mot juste', value: t.wordChoiceXp, unit: 'XP' },
    { key: 'crossword_xp', label: 'XP · Mots fléchés', value: t.crosswordXp, unit: 'XP' },
    { key: 'culture_xp', label: 'XP · Culture générale', value: t.cultureXp, unit: 'XP' },
    { key: 'daily_xp', label: 'XP · Défi du jour', value: t.dailyXp, unit: 'XP' },
    { key: 'zellige_completions', label: 'Mission Zellige · missions du jour récompensées', value: t.zelligeCompletions, unit: 'nombre' },
    { key: 'zellige_xp', label: 'XP · Mission Zellige', value: t.zelligeXp, unit: 'XP' },
    { key: 'market_completions', label: 'Le Souk des mots · missions réussies pour la première fois', value: t.marketCompletions, unit: 'nombre' },
    { key: 'market_autonomy_bonuses', label: 'Le Souk des mots · bonus d’autonomie obtenus', value: t.marketAutonomyBonuses, unit: 'nombre' },
    { key: 'market_xp', label: 'XP · Le Souk des mots', value: t.marketXp, unit: 'XP' },
    { key: 'class_created', label: 'Défis de classe · défis lancés', value: t.classChallengesCreated??0, unit: 'nombre' },
    { key: 'class_answers', label: 'Défis de classe · réponses confirmées datées', value: t.classAnswers??0, unit: 'nombre' },
    { key: 'class_completions', label: 'Défis de classe · participations terminées', value: t.classCompletions??0, unit: 'nombre' },
    { key: 'class_xp', label: 'XP · Défis de classe', value: t.classXp??0, unit: 'XP' },
    { key: 'total_xp', label: 'XP · total des sept jeux', value: t.xp, unit: 'XP' },
  ];
}
export function analyticsCsv(snapshot) {
  const rows = [['indicateur','valeur','numerateur','denominateur','du','au','fuseau','ecole_id','source','calcule_le','definition','unite']];
  for (const card of analyticsCards(snapshot)) rows.push([card.key, analyticsRatio(card.numerator, card.denominator) ?? 'non_calculable', card.numerator, card.denominator, snapshot.filters.from, snapshot.filters.to, snapshot.filters.timezone, snapshot.filters.schoolId || 'reseau', snapshot.source, snapshot.generatedAt, card.definition, '%']);
  for (const row of analyticsGameRows(snapshot)) rows.push([row.key, row.value, '', '', snapshot.filters.from, snapshot.filters.to, snapshot.filters.timezone, snapshot.filters.schoolId || 'reseau', snapshot.source, snapshot.generatedAt, snapshot.definitions.games, row.unit]);
  rows.push(['undated_quiz_answers', snapshot.totals.undatedQuizAnswers, '', '', '', '', snapshot.filters.timezone, snapshot.filters.schoolId || 'reseau', snapshot.source, snapshot.generatedAt, snapshot.definitions.undatedQuizAnswers, 'nombre']);
  return '\uFEFF' + rows.map(row => row.map(escapeCsvCell).join(';')).join('\r\n');
}
export async function fetchAdminAnalytics(filters, { signal, expectedUserId } = {}) {
  const params = new URLSearchParams();
  if (filters.from || filters.to) { params.set('from', filters.from); params.set('to', filters.to); }
  if (filters.schoolId) params.set('schoolId', filters.schoolId);
  const response = await fetch('/api/pilot/admin/analytics?' + params, { credentials: 'same-origin', cache: 'no-store', signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'L’analyse n’a pas pu être chargée.');
  if (body.schemaVersion !== 2 || !['pilot_database', 'pilot_local_fixture'].includes(body.source) || !body.userId || (expectedUserId && body.userId !== expectedUserId)) throw new Error('Le compte a changé ou la source est incompatible. Actualisez votre accès.');
  return body;
}
