// Frozen published corpus: retain this adapter when introducing later versions.
// No browser storage, draft questions or answer keys enter a public catalogue.
import { quizQuestionsV1 } from './quiz-content-v1.js';
import { getPublishedClassChallengeBanks, selectClassChallengeQuestionIds, CLASS_CHALLENGE_THEMES } from '../../src/features/games/class-challenges/classChallengeData.js';
import { prepareQuizQuestions } from '../../src/features/games/quizEngine.js';
export const CLASS_CONTENT_VERSION='class-2026-09-v1';
// The class resolver uses the editorial insertion order, unlike the free quiz's
// category-sorted projection. Freeze that order before the common seeded shuffle.
const originalPublishedIds=['qb-maroc-atlantique','qb-maroc-capitale','qb-langue-pluriel-journal','qb-langue-synonyme-joyeux','qb-sciences-eau','qb-geographie-detroit','qb-geographie-continent','qb-francophonie-senegal','qb-arts-petit-prince','qb-arts-zellige'];
const originalQuestions=originalPublishedIds.map(id=>quizQuestionsV1.find(q=>q.id===id));
export const classQuestionMetadata=Object.freeze(originalQuestions.map(q=>Object.freeze({id:q.id,category:q.sourceCategory,level:q.targetLevel,tags:q.tags,status:'publie'})));
export const classBanks=getPublishedClassChallengeBanks(classQuestionMetadata);
export const classThemes=CLASS_CHALLENGE_THEMES;
export function classLevel(name) {
  return typeof name==='string'?name.match(/^([1-6]e AEP)(?:\s*·|\s*$)/)?.[1]??null:null;
}
export function selectClassQuestions({id,bankId,level,theme}) {
  const bank=classBanks.find(b=>b.id===bankId);
  const ids=selectClassChallengeQuestionIds({bank,level,theme,questions:classQuestionMetadata});
  return prepareQuizQuestions(originalQuestions.filter(q=>ids.includes(q.id)),{seed:'defi-classe:'+id,limit:5});
}
export function resolveClassQuestions(version,ids) {
  if(version!==CLASS_CONTENT_VERSION||!Array.isArray(ids)||ids.length!==5||new Set(ids).size!==5)return null;
  const questions=ids.map(id=>quizQuestionsV1.find(q=>q.id===id));
  return questions.every(Boolean)?questions:null;
}
