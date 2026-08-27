import { selectPublishedQuizQuestions } from "../question-bank/questionBankCore.js";
import { seedQuestionBank } from "../question-bank/questionBankSeed.js";

// Export conservé pour les intégrations existantes et les tests. Cette liste
// n'est plus une seconde banque : elle est la projection des contenus publiés.
export const cultureQuizQuestions = Object.freeze(
  selectPublishedQuizQuestions(seedQuestionBank),
);

export default cultureQuizQuestions;
