import test from "node:test";
import assert from "node:assert/strict";
import {
  MARKET_TEACHER_DEMO_STUDENTS,
  buildTeacherMarketCsv,
  buildTeacherMarketDashboard,
  filterTeacherMarketStudents,
} from "../src/features/games/market-shop/teacherMarketAnalytics.js";
import { MARKET_MISSIONS } from "../src/features/games/market-shop/marketShopData.js";
import { createMarketRewardClaimId } from "../src/features/games/market-shop/marketShopEngine.js";

const LINA_ID = "user-eleve-lina";

test("construit une cohorte enseignante et ses trois synthèses de palier", () => {
  const dashboard = buildTeacherMarketDashboard();

  assert.equal(dashboard.students.length, MARKET_TEACHER_DEMO_STUDENTS.length);
  assert.equal(dashboard.tierSummaries.length, 3);
  assert.equal(dashboard.totalMissions, 12);
  assert.equal(dashboard.summary.studentCount, 8);
  assert.ok(dashboard.summary.supportCount >= 2);
  assert.deepEqual(dashboard.tierSummaries.map((tier) => tier.id), ["discovery", "consolidation", "challenge"]);
});

test("recalcule Lina à partir des récompenses et tentatives réellement enregistrées", () => {
  const discoveryMissions = MARKET_MISSIONS.filter((mission) => mission.tierId === "discovery");
  const awardHistory = discoveryMissions.flatMap((mission, index) => {
    const masteryId = createMarketRewardClaimId(LINA_ID, mission, "mastery");
    const awards = [{ id: masteryId, userId: LINA_ID, source: "souk-des-mots", questionId: mission.id, amount: 10 }];
    if (index < 3) awards.push({
      id: createMarketRewardClaimId(LINA_ID, mission, "autonomy"),
      userId: LINA_ID,
      source: "souk-des-mots",
      questionId: mission.id,
      amount: 5,
    });
    return awards;
  });
  const attemptHistory = [{
    id: "attempt-lina-discovery",
    userId: LINA_ID,
    quizId: "souk-des-mots",
    fragmentId: "discovery",
    correctCount: 4,
    questionCount: 4,
    bestStreak: 3,
    completedAt: "2026-08-30T18:00:00.000Z",
  }];

  const dashboard = buildTeacherMarketDashboard({ awardHistory, attemptHistory });
  const lina = dashboard.students.find((student) => student.id === LINA_ID);

  assert.equal(lina.completedCount, 4);
  assert.equal(lina.progressPercent, 33);
  assert.equal(lina.autonomyCount, 3);
  assert.equal(lina.helpCount, 1);
  assert.equal(lina.currentTierId, "consolidation");
  assert.equal(lina.lastActiveAt, "2026-08-30T18:00:00.000Z");
  assert.equal(lina.soukXp, 55);
});

test("filtre la classe, le statut et la recherche puis priorise les élèves à accompagner", () => {
  const dashboard = buildTeacherMarketDashboard();
  const classStudents = filterTeacherMarketStudents(dashboard.students, { classId: "classe-5b" });
  const supportStudents = filterTeacherMarketStudents(dashboard.students, { status: "support" });
  const recentStudents = filterTeacherMarketStudents(dashboard.students, { period: "7" });
  const searchedStudents = filterTeacherMarketStudents(dashboard.students, { query: "chraibi" });

  assert.ok(classStudents.every((student) => student.classId === "classe-5b"));
  assert.ok(supportStudents.every((student) => student.status === "support"));
  assert.ok(recentStudents.every((student) => student.lastActiveAt && student.daysSinceActivity <= 7));
  assert.equal(searchedStudents.length, 1);
  assert.equal(searchedStudents[0].name, "Meryem Chraïbi");
  assert.equal(filterTeacherMarketStudents(dashboard.students)[0].status, "support");
  assert.equal(dashboard.summary.averageAutonomy, Math.round((dashboard.summary.totalAutonomousMasteries / dashboard.summary.totalMasteries) * 100));
});

test("produit un export CSV lisible par les outils scolaires", () => {
  const dashboard = buildTeacherMarketDashboard();
  const csv = buildTeacherMarketCsv(dashboard.students.slice(0, 2));

  assert.match(csv, /^Élève;Classe;Progression;Palier actuel;Autonomie;Aides;Statut;XP du Souk/);
  assert.match(csv, /Lina Mansouri/);
  assert.equal(csv.split("\n").length, 3);
});
