import { QUESTION_BANK_STORAGE_KEY } from "../question-bank/questionBankConstants.js";
import {
  migrateQuestionBankState,
  selectPublishedQuizQuestions,
} from "../question-bank/questionBankCore.js";
import { seedQuestionBank } from "../question-bank/questionBankSeed.js";

/**
 * Lit la même collection éditoriale que l'administration. Une sauvegarde locale
 * illisible ne bloque jamais les jeux : ils repartent alors de la banque livrée.
 */
export function readEditorialQuestionBank(storage = globalThis.localStorage) {
  if (!storage?.getItem) return [...seedQuestionBank];

  try {
    const raw = storage.getItem(QUESTION_BANK_STORAGE_KEY);
    if (!raw) return [...seedQuestionBank];
    return migrateQuestionBankState(JSON.parse(raw), {
      initialQuestions: seedQuestionBank,
    }).questions;
  } catch {
    return [...seedQuestionBank];
  }
}

/**
 * Projection commune utilisée par le Quiz Culture générale et le Défi du jour.
 * Les brouillons et questions seulement validées sont volontairement exclus.
 */
export function readPublishedGameQuestions(
  storage = globalThis.localStorage,
  filters = {},
) {
  return selectPublishedQuizQuestions(
    readEditorialQuestionBank(storage),
    filters,
  );
}

