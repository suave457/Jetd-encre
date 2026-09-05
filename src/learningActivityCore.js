// Local pilot content: the score concerns this activity, never the whole unit.
export const ENVIRONMENT_ACTIVITY = Object.freeze({
  id: "mots-environnement", version: 1, title: "Les mots de l’environnement",
  questions: [
    { id: "plage", prompt: "Quel geste aide à protéger la plage ?", options: ["Laisser les déchets près de l’eau", "Ramasser et trier les déchets", "Utiliser plus de sacs jetables", "Écrire sur les rochers"], correctIndex: 1, explanation: "Ramasser les déchets évite qu’ils arrivent dans la mer. Les trier permet de recycler ceux qui peuvent l’être." },
    { id: "trier", prompt: "Que signifie « trier les déchets » ?", options: ["Tout jeter dans le même sac", "Cacher les déchets sous le sable", "Séparer les déchets selon leur matière", "Brûler les déchets dans le jardin"], correctIndex: 2, explanation: "Trier, c’est séparer et regrouper : par exemple, mettre le papier avec le papier et le verre avec le verre, selon les consignes locales." },
    { id: "reutiliser", prompt: "Quel objet peut-on réutiliser pour boire à l’école ?", options: ["Une gourde que l’on remplit", "Un mouchoir en papier usagé", "Un emballage de biscuit", "Une feuille de cahier"], correctIndex: 0, explanation: "Une gourde peut être lavée puis remplie à nouveau. Réutiliser un objet, c’est s’en servir plusieurs fois." },
    { id: "economiser", prompt: "Pour économiser l’eau en me brossant les dents, je…", options: ["laisse le robinet ouvert", "remplis la baignoire", "lave aussi le sol", "ferme le robinet pendant le brossage"], correctIndex: 3, explanation: "Économiser l’eau signifie éviter de la gaspiller. Fermer le robinet quand on n’a pas besoin d’eau limite le gaspillage." },
    { id: "proteger", prompt: "Complète : « Nous protégeons les arbres en… »", options: ["cassant leurs branches", "respectant les plantations", "gravant nos noms sur les troncs", "arrachant les jeunes pousses"], correctIndex: 1, explanation: "Protéger, c’est prendre soin et éviter les dommages. Respecter les plantations permet aux arbres de grandir." },
  ],
});

export function gradeLearningActivity(activityId, answers) {
  if (activityId !== ENVIRONMENT_ACTIVITY.id) return { ok: false, error: "unknown_activity", message: "Cette activité n’est pas disponible." };
  if (!Array.isArray(answers) || answers.length !== ENVIRONMENT_ACTIVITY.questions.length || answers.some((answer, index) => !Number.isInteger(answer) || answer < 0 || answer >= ENVIRONMENT_ACTIVITY.questions[index].options.length)) {
    return { ok: false, error: "incomplete_answers", message: "Réponds aux cinq questions avant de terminer." };
  }
  const corrections = ENVIRONMENT_ACTIVITY.questions.map((question, index) => ({ questionId: question.id, answer: answers[index], correctIndex: question.correctIndex, correct: answers[index] === question.correctIndex, explanation: question.explanation }));
  const correctCount = corrections.filter(item => item.correct).length;
  return { ok: true, correctCount, questionCount: corrections.length, scorePercent: correctCount * 20, corrections, answers: [...answers], masteryLabel: correctCount === 5 ? "Les cinq réponses sont correctes dans cette activité." : "Des mots restent à revoir dans cette activité." };
}
