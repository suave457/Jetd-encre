export const PARENT_PROFILE_KEY = "jde.parent.profile.v1";
export const DEFAULT_PARENT_PROFILE = Object.freeze({ name: "Youssef Mansouri", relationship: "Parent", city: "Casablanca", language: "Français", email: "y.mansouri@example.ma", phone: "", address: "" });

export function loadParentProfile(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(PARENT_PROFILE_KEY) || "null");
    return Object.fromEntries(Object.entries(DEFAULT_PARENT_PROFILE).map(([key, fallback]) => [key, typeof saved?.[key] === "string" ? saved[key] : fallback]));
  } catch { return { ...DEFAULT_PARENT_PROFILE }; }
}

export function saveParentProfile(storage, profile) {
  try {
    const clean = Object.fromEntries(Object.keys(DEFAULT_PARENT_PROFILE).map(key => [key, String(profile[key] || "").trim().slice(0, 200)]));
    if (!clean.name) return { ok: false, message: "Indiquez votre nom." };
    if (!storage) throw new Error("storage_unavailable");
    storage.setItem(PARENT_PROFILE_KEY, JSON.stringify(clean));
    if (storage.getItem(PARENT_PROFILE_KEY) !== JSON.stringify(clean)) throw new Error("write_not_retained");
    return { ok: true, profile: clean };
  } catch { return { ok: false, message: "Le profil n’a pas pu être enregistré. Vérifiez le stockage du navigateur." }; }
}

export function requestDemoFamilyLink() {
  return { ok: false, error: "demo_only", message: "Démonstration : ce code n’a pas été vérifié et aucun rattachement n’a été demandé. Aucun envoi à l’école. Utilisez le contact habituel de l’établissement pour un accès réel." };
}

export function buildParentHomework(assignments, submissions, studentId, classId = "classe-5a") {
  return assignments.filter(item => item.status === "Publié" && !item.archivedAt && (item.studentIds ? item.studentIds.includes(studentId) : item.classId ? item.classId === classId : /5A/.test(item.className || "")))
    .map(item => {
      const submission = submissions.filter(entry => entry.assignmentId === item.id && entry.studentId === studentId).sort((a, b) => String(b.updatedAt || b.submittedAt).localeCompare(String(a.updatedAt || a.submittedAt)))[0];
      return { ...item, status: submission?.status === "Corrigé" ? "Corrigé" : submission ? "Remis" : "À faire", submission: submission || null };
    }).sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));
}

export function getParentLearningSummary(state, studentId) {
  const attempts = state.quizAttempts.filter(item => item.userId === studentId);
  const exercises = attempts.filter(item => item.experienceType === "learning-activity");
  const latestByActivity = [...new Map([...exercises].reverse().map(item => [item.quizId, item])).values()];
  const xpEarned = state.quizAwards.filter(item => item.userId === studentId).reduce((total, item) => total + Number(item.amount || 0), 0);
  return { attempts, exercises: latestByActivity, participationCount: attempts.length, completedActivityCount: latestByActivity.length, xpEarned };
}
