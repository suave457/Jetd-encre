import { MARKET_MISSIONS, MARKET_TIERS } from "./marketShopData.js";
import {
  MARKET_AUTONOMY_REWARD,
  buildMarketTierProgress,
  inferCompletedMarketMissionIds,
  inferCompletedMarketMissionIdsFromAttempts,
} from "./marketShopEngine.js";

const ALL_MISSION_IDS = Object.freeze(MARKET_TIERS.flatMap((tier) => tier.missionIds));
const ALL_MISSION_ID_SET = new Set(ALL_MISSION_IDS);
const TOTAL_MISSIONS = ALL_MISSION_IDS.length;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const freezeList = (items) => Object.freeze(items.map((item) => Object.freeze({ ...item })));
const firstMissionIds = (count) => Object.freeze(ALL_MISSION_IDS.slice(0, Math.max(0, count)));

/**
 * Cohorte strictement fictive destinée au prototype. Le profil de Lina est
 * recalculé à partir du registre local du jeu afin que le tableau enseignant
 * reflète immédiatement les parties réellement jouées sur cet appareil.
 */
export const MARKET_TEACHER_DEMO_STUDENTS = freezeList([
  {
    id: "user-eleve-lina",
    name: "Lina Mansouri",
    classId: "classe-5a",
    classLabel: "5A",
    completedMissionIds: firstMissionIds(0),
    autonomousMissionIds: firstMissionIds(0),
    lastActiveAt: null,
    soukXp: 0,
    live: true,
  },
  {
    id: "demo-yassine-el-idrissi",
    name: "Yassine El Idrissi",
    classId: "classe-5a",
    classLabel: "5A",
    completedMissionIds: firstMissionIds(8),
    autonomousMissionIds: firstMissionIds(6),
    lastActiveAt: "2026-08-30T16:20:00.000Z",
    soukXp: 110,
  },
  {
    id: "demo-aya-alaoui",
    name: "Aya Alaoui",
    classId: "classe-5a",
    classLabel: "5A",
    completedMissionIds: firstMissionIds(12),
    autonomousMissionIds: firstMissionIds(11),
    lastActiveAt: "2026-08-30T12:05:00.000Z",
    soukXp: 175,
  },
  {
    id: "demo-hamza-tazi",
    name: "Hamza Tazi",
    classId: "classe-5a",
    classLabel: "5A",
    completedMissionIds: firstMissionIds(2),
    autonomousMissionIds: firstMissionIds(0),
    lastActiveAt: "2026-08-20T14:40:00.000Z",
    soukXp: 20,
  },
  {
    id: "demo-nour-berrada",
    name: "Nour Berrada",
    classId: "classe-5b",
    classLabel: "5B",
    completedMissionIds: firstMissionIds(4),
    autonomousMissionIds: firstMissionIds(1),
    lastActiveAt: "2026-08-28T10:10:00.000Z",
    soukXp: 45,
  },
  {
    id: "demo-meryem-chraibi",
    name: "Meryem Chraïbi",
    classId: "classe-5b",
    classLabel: "5B",
    completedMissionIds: firstMissionIds(10),
    autonomousMissionIds: firstMissionIds(8),
    lastActiveAt: "2026-08-29T17:25:00.000Z",
    soukXp: 140,
  },
  {
    id: "demo-adam-benchekroun",
    name: "Adam Benchekroun",
    classId: "classe-5b",
    classLabel: "5B",
    completedMissionIds: firstMissionIds(12),
    autonomousMissionIds: firstMissionIds(9),
    lastActiveAt: "2026-08-29T09:15:00.000Z",
    soukXp: 165,
  },
  {
    id: "demo-salma-amrani",
    name: "Salma Amrani",
    classId: "classe-5b",
    classLabel: "5B",
    completedMissionIds: firstMissionIds(0),
    autonomousMissionIds: firstMissionIds(0),
    lastActiveAt: null,
    soukXp: 0,
  },
]);

function normalizeMissionIds(ids = []) {
  const unique = new Set(Array.isArray(ids) ? ids : []);
  return Object.freeze(ALL_MISSION_IDS.filter((missionId) => unique.has(missionId)));
}

function listStudentMarketAwards(studentId, awardHistory = []) {
  return (Array.isArray(awardHistory) ? awardHistory : []).filter((award) => (
    award
    && String(award.userId || "") === studentId
    && award.source === "souk-des-mots"
  ));
}

function listStudentMarketAttempts(studentId, attemptHistory = []) {
  return (Array.isArray(attemptHistory) ? attemptHistory : []).filter((attempt) => (
    attempt
    && String(attempt.userId || "") === studentId
    && attempt.quizId === "souk-des-mots"
  ));
}

function inferAutonomousMissionIds(studentId, awards = [], attempts = []) {
  const autonomous = new Set();
  for (const award of awards) {
    const eventId = String(award.id || award.eventId || "");
    const missionId = String(award.questionId || "");
    const isAutonomy = eventId.endsWith(`:${MARKET_AUTONOMY_REWARD}`) || Number(award.amount) === 5;
    if (isAutonomy && ALL_MISSION_ID_SET.has(missionId)) autonomous.add(missionId);
  }

  // Compatibilité avec les tentatives enregistrées avant le registre détaillé.
  for (const attempt of attempts) {
    const tier = MARKET_TIERS.find((item) => item.id === attempt.fragmentId);
    if (!tier) continue;
    const autonomyCount = attempt.assistanceLevel === "autonomous"
      ? tier.missionIds.length
      : Math.min(tier.missionIds.length, Math.max(0, Number(attempt.bestStreak || 0)));
    tier.missionIds.slice(0, autonomyCount).forEach((missionId) => autonomous.add(missionId));
  }
  return normalizeMissionIds([...autonomous]);
}

function getLatestActivityAt(attempts = [], awards = []) {
  return [...attempts.map((attempt) => attempt.completedAt), ...awards.map((award) => award.awardedAt)]
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null;
}

function calculateDaysSince(isoDate, now) {
  if (!isoDate) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(isoDate).getTime();
  const current = new Date(now).getTime();
  if (!Number.isFinite(timestamp) || !Number.isFinite(current)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((current - timestamp) / DAY_IN_MS));
}

function buildTierDetails(completedMissionIds, autonomousMissionIds) {
  const completed = new Set(completedMissionIds);
  const autonomous = new Set(autonomousMissionIds);
  return buildMarketTierProgress(MARKET_TIERS, MARKET_MISSIONS, completedMissionIds).map((tier) => ({
    id: tier.id,
    label: tier.label,
    cardTitle: tier.cardTitle,
    completedCount: tier.completedCount,
    missionCount: tier.missionCount,
    progressPercent: tier.progressPercent,
    status: tier.status,
    autonomyCount: tier.missionIds.filter((missionId) => autonomous.has(missionId)).length,
    missionIds: Object.freeze([...tier.missionIds]),
    completedMissionIds: Object.freeze(tier.missionIds.filter((missionId) => completed.has(missionId))),
    autonomousMissionIds: Object.freeze(tier.missionIds.filter((missionId) => autonomous.has(missionId))),
    theme: tier.theme,
  }));
}

function getSupportProfile({ completedCount, helpCount, progressPercent, daysSinceActivity }) {
  const notStarted = completedCount === 0;
  const inactive = !notStarted && daysSinceActivity >= 7;
  const assistanceHeavy = completedCount >= 2 && helpCount / completedCount >= 0.5;
  const completed = completedCount === TOTAL_MISSIONS;
  const autonomyPercent = completedCount ? Math.round(((completedCount - helpCount) / completedCount) * 100) : 0;

  if (inactive) return {
    status: "support",
    statusLabel: "À accompagner",
    supportReason: `Palier en cours sans activité depuis ${daysSinceActivity} jours`,
    recommendation: "Vérifier l’accès au jeu puis proposer une reprise de dix minutes sur la dernière mission réussie.",
  };
  if (assistanceHeavy) return {
    status: "support",
    statusLabel: "À accompagner",
    supportReason: `Indice utilisé sur ${helpCount} des ${completedCount} missions maîtrisées`,
    recommendation: "Reprendre les quantités et les déterminants avec des cartes-produits, puis rejouer une mission sans aide.",
  };
  if (notStarted) return {
    status: "not-started",
    statusLabel: "À démarrer",
    supportReason: "Aucune mission enregistrée",
    recommendation: "Prévoir un lancement guidé en binôme et faire verbaliser la première commande avant de jouer.",
  };
  if (completed) return {
    status: "completed",
    statusLabel: "Parcours terminé",
    supportReason: autonomyPercent >= 75
      ? "Les trois paliers sont maîtrisés avec peu d’indices"
      : "Les trois paliers sont maîtrisés ; l’autonomie peut encore progresser",
    recommendation: autonomyPercent >= 75
      ? "Confier le rôle du vendeur lors d’une courte mise en scène orale avec un camarade."
      : "Proposer une révision sans indice, puis faire reformuler la commande à voix haute.",
  };
  return {
    status: "on-track",
    statusLabel: "En bonne voie",
    supportReason: progressPercent >= 67 ? "Le palier Défi est en cours" : "La progression est régulière",
    recommendation: progressPercent >= 67
      ? "Encourager une commande complète en limitant les indices visuels."
      : "Poursuivre le palier actuel et faire reformuler la commande à voix haute.",
  };
}

function buildStudentProfile(student, { awardHistory, attemptHistory, now }) {
  let completedMissionIds = normalizeMissionIds(student.completedMissionIds);
  let autonomousMissionIds = normalizeMissionIds(student.autonomousMissionIds);
  let lastActiveAt = student.lastActiveAt || null;
  let soukXp = Math.max(0, Number(student.soukXp || 0));
  let partialData = false;

  if (student.live) {
    const awards = listStudentMarketAwards(student.id, awardHistory);
    const attempts = listStudentMarketAttempts(student.id, attemptHistory);
    const awardedMissionIds = inferCompletedMarketMissionIds(student.id, MARKET_MISSIONS, awards);
    const attemptedMissionIds = inferCompletedMarketMissionIdsFromAttempts(student.id, MARKET_TIERS, attempts);
    completedMissionIds = normalizeMissionIds([
      ...awardedMissionIds,
      ...attemptedMissionIds,
    ]);
    partialData = attemptedMissionIds.some((missionId) => !awardedMissionIds.includes(missionId));
    autonomousMissionIds = inferAutonomousMissionIds(student.id, awards, attempts)
      .filter((missionId) => completedMissionIds.includes(missionId));
    lastActiveAt = getLatestActivityAt(attempts, awards);
    soukXp = awards.reduce((total, award) => total + Math.max(0, Number(award.amount || 0)), 0);
  }

  const completedCount = completedMissionIds.length;
  const autonomyCount = autonomousMissionIds.length;
  const helpCount = Math.max(0, completedCount - autonomyCount);
  const progressPercent = Math.round((completedCount / TOTAL_MISSIONS) * 100);
  const autonomyPercent = completedCount ? Math.round((autonomyCount / completedCount) * 100) : 0;
  const daysSinceActivity = calculateDaysSince(lastActiveAt, now);
  const tiers = buildTierDetails(completedMissionIds, autonomousMissionIds);
  const currentTier = tiers.find((tier) => tier.status !== "completed" && tier.status !== "locked")
    || tiers.find((tier) => tier.status === "locked")
    || tiers.at(-1);
  const support = getSupportProfile({ completedCount, helpCount, progressPercent, daysSinceActivity });

  return Object.freeze({
    ...student,
    completedMissionIds,
    autonomousMissionIds: Object.freeze([...autonomousMissionIds]),
    completedCount,
    totalMissions: TOTAL_MISSIONS,
    progressPercent,
    autonomyCount,
    autonomyPercent,
    helpCount,
    lastActiveAt,
    daysSinceActivity,
    soukXp,
    partialData,
    currentTierId: completedCount === TOTAL_MISSIONS ? "completed" : currentTier?.id || "discovery",
    currentTierLabel: completedCount === TOTAL_MISSIONS ? "Parcours terminé" : currentTier?.label || "Découverte",
    tiers: Object.freeze(tiers.map((tier) => Object.freeze(tier))),
    ...support,
  });
}

export function buildTeacherMarketDashboard({
  awardHistory = [],
  attemptHistory = [],
  students = MARKET_TEACHER_DEMO_STUDENTS,
  now = "2026-08-30T23:00:00.000Z",
} = {}) {
  const profiles = (Array.isArray(students) ? students : []).map((student) => (
    buildStudentProfile(student, { awardHistory, attemptHistory, now })
  ));
  const startedCount = profiles.filter((student) => student.completedCount > 0).length;
  const completedCount = profiles.filter((student) => student.completedCount === TOTAL_MISSIONS).length;
  const autonomousCount = profiles.filter((student) => student.completedCount === TOTAL_MISSIONS && student.autonomyPercent >= 75).length;
  const supportCount = profiles.filter((student) => student.status === "support").length;
  const averageProgress = profiles.length
    ? Math.round(profiles.reduce((total, student) => total + student.progressPercent, 0) / profiles.length)
    : 0;
  const helpCount = profiles.reduce((total, student) => total + student.helpCount, 0);
  const totalMasteries = profiles.reduce((total, student) => total + student.completedCount, 0);
  const totalAutonomousMasteries = profiles.reduce((total, student) => total + student.autonomyCount, 0);
  const averageAutonomy = totalMasteries
    ? Math.round((totalAutonomousMasteries / totalMasteries) * 100)
    : 0;
  const tierSummaries = MARKET_TIERS.map((tier) => {
    const completedStudents = profiles.filter((student) => (
      student.tiers.find((item) => item.id === tier.id)?.status === "completed"
    )).length;
    const inProgressStudents = profiles.filter((student) => (
      student.tiers.find((item) => item.id === tier.id)?.status === "in-progress"
    )).length;
    return Object.freeze({
      id: tier.id,
      label: tier.label,
      cardTitle: tier.cardTitle,
      completedStudents,
      inProgressStudents,
      completionPercent: profiles.length ? Math.round((completedStudents / profiles.length) * 100) : 0,
      theme: tier.theme,
    });
  });

  return Object.freeze({
    generatedAt: new Date(now).toISOString(),
    gameId: "souk-des-mots",
    totalMissions: TOTAL_MISSIONS,
    students: Object.freeze(profiles),
    summary: Object.freeze({
      studentCount: profiles.length,
      startedCount,
      completedCount,
      autonomousCount,
      supportCount,
      averageProgress,
      averageAutonomy,
      helpCount,
      totalMasteries,
      totalAutonomousMasteries,
    }),
    tierSummaries: Object.freeze(tierSummaries),
  });
}

export function filterTeacherMarketStudents(students = [], { classId = "all", status = "all", period = "all", query = "" } = {}) {
  const normalizeSearch = (value) => String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("fr");
  const normalizedQuery = normalizeSearch(query);
  const statusOrder = { support: 0, "not-started": 1, "on-track": 2, completed: 3 };
  return Object.freeze((Array.isArray(students) ? students : [])
    .filter((student) => classId === "all" || student.classId === classId)
    .filter((student) => status === "all" || student.status === status)
    .filter((student) => period === "all" || (student.lastActiveAt && student.daysSinceActivity <= Number(period)))
    .filter((student) => !normalizedQuery || normalizeSearch(student.name).includes(normalizedQuery))
    .sort((left, right) => (
      (statusOrder[left.status] ?? 9) - (statusOrder[right.status] ?? 9)
      || left.name.localeCompare(right.name, "fr")
    )));
}

function escapeCsvCell(value) {
  const text = String(value ?? "").replaceAll('"', '""');
  return /[;"\n]/.test(text) ? `"${text}"` : text;
}

export function buildTeacherMarketCsv(students = []) {
  const headers = ["Élève", "Classe", "Progression", "Palier actuel", "Autonomie", "Aides", "Statut", "XP du Souk"];
  const rows = (Array.isArray(students) ? students : []).map((student) => [
    student.name,
    student.classLabel,
    `${student.completedCount}/${student.totalMissions}`,
    student.currentTierLabel,
    `${student.autonomyPercent} %`,
    student.helpCount,
    student.statusLabel,
    student.soukXp,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(";")).join("\n");
}
