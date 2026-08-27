export const AEP_LEVELS = Object.freeze([
  { code: "aep1", label: "1re AEP" },
  { code: "aep2", label: "2e AEP" },
  { code: "aep3", label: "3e AEP" },
  { code: "aep4", label: "4e AEP" },
  { code: "aep5", label: "5e AEP" },
  { code: "aep6", label: "6e AEP" },
]);

export const CEFR_LEVELS = Object.freeze([
  { code: "pre_a1", label: "Pré-A1" },
  { code: "a1", label: "A1" },
  { code: "a2", label: "A2" },
  { code: "b1", label: "B1" },
]);

export const LEARNING_DOMAINS = Object.freeze([
  { code: "oral_reception", label: "Compréhension de l’oral" },
  { code: "oral_production", label: "Production orale" },
  { code: "spoken_interaction", label: "Interaction orale" },
  { code: "reading", label: "Lecture" },
  { code: "writing", label: "Écriture" },
  { code: "mediation", label: "Médiation" },
  { code: "lexicon", label: "Lexique" },
  { code: "grammar", label: "Grammaire" },
  { code: "phonology", label: "Phonologie" },
  { code: "plurilingual_intercultural", label: "Plurilinguisme et interculturel" },
]);

export const LEARNING_COMPETENCIES = Object.freeze([
  { code: "ORAL-REP-01", label: "Repérer les informations essentielles d’un message court", domainCode: "oral_reception", aepLevels: ["aep1", "aep2", "aep3"], cefrTargets: ["pre_a1", "a1"], descriptor: "Identifie le thème, les personnes et quelques informations explicites.", status: "active" },
  { code: "ORAL-REP-02", label: "Comprendre des consignes et récits contextualisés", domainCode: "oral_reception", aepLevels: ["aep4", "aep5", "aep6"], cefrTargets: ["a1", "a2"], descriptor: "Suit une consigne ou restitue la trame d’un récit adapté.", status: "active" },
  { code: "ORAL-PRO-01", label: "Décrire une personne, un lieu ou une expérience", domainCode: "oral_production", aepLevels: ["aep2", "aep3", "aep4", "aep5", "aep6"], cefrTargets: ["a1", "a2"], descriptor: "Produit un message oral compréhensible et organisé.", status: "active" },
  { code: "INTER-01", label: "Participer à un échange bref", domainCode: "spoken_interaction", aepLevels: ["aep1", "aep2", "aep3", "aep4"], cefrTargets: ["pre_a1", "a1"], descriptor: "Pose une question, répond et demande une clarification.", status: "active" },
  { code: "INTER-02", label: "Coopérer dans une discussion ou une tâche", domainCode: "spoken_interaction", aepLevels: ["aep5", "aep6"], cefrTargets: ["a1", "a2"], descriptor: "Prend et garde la parole en respectant les tours.", status: "active" },
  { code: "LECT-01", label: "Comprendre un texte court illustré", domainCode: "reading", aepLevels: ["aep1", "aep2", "aep3"], cefrTargets: ["pre_a1", "a1"], descriptor: "Repère des mots, personnages et informations explicites.", status: "active" },
  { code: "LECT-02", label: "Prélever et relier des informations écrites", domainCode: "reading", aepLevels: ["aep4", "aep5", "aep6"], cefrTargets: ["a1", "a2"], descriptor: "Sélectionne, classe et relie des informations d’un document.", status: "active" },
  { code: "ECRIT-01", label: "Rédiger un message adapté au destinataire", domainCode: "writing", aepLevels: ["aep3", "aep4", "aep5", "aep6"], cefrTargets: ["a1", "a2"], descriptor: "Écrit un texte bref, cohérent et compréhensible.", status: "active" },
  { code: "MED-01", label: "Reformuler une information pour aider autrui", domainCode: "mediation", aepLevels: ["aep4", "aep5", "aep6"], cefrTargets: ["a1", "a2"], descriptor: "Transmet simplement le sens utile d’un message ou document.", status: "active" },
  { code: "LEX-01", label: "Mobiliser le lexique du quotidien et du patrimoine", domainCode: "lexicon", aepLevels: ["aep1", "aep2", "aep3", "aep4", "aep5", "aep6"], cefrTargets: ["pre_a1", "a1", "a2"], descriptor: "Choisit des mots précis dans une situation familière.", status: "active" },
  { code: "GRAM-01", label: "Construire une phrase française intelligible", domainCode: "grammar", aepLevels: ["aep1", "aep2", "aep3", "aep4", "aep5", "aep6"], cefrTargets: ["pre_a1", "a1", "a2"], descriptor: "Utilise les structures travaillées pour communiquer.", status: "active" },
  { code: "PLURI-01", label: "S’appuyer sur son répertoire plurilingue", domainCode: "plurilingual_intercultural", aepLevels: ["aep1", "aep2", "aep3", "aep4", "aep5", "aep6"], cefrTargets: ["pre_a1", "a1", "a2"], descriptor: "Compare, reformule et valorise la darija, l’arabe, l’amazighe et le français.", status: "active" },
]);

function ascii(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function normalizeAepLevel(value) {
  const text = ascii(value).replace(/annee|primaire|niveau/g, "").trim();
  const match = text.match(/(?:aep\s*)?([1-6])|([1-6])(?:re|e|eme)?\s*aep/);
  const number = match?.[1] || match?.[2];
  return number ? `aep${number}` : null;
}

export function normalizeCefrLevel(value) {
  const code = ascii(value).replace(/[\s-]+/g, "_");
  const aliases = { prea1: "pre_a1", pre_a1: "pre_a1", a1: "a1", a2: "a2", b1: "b1" };
  return aliases[code] || null;
}

export function getCompetency(code) {
  const expected = String(code ?? "").trim().toUpperCase();
  return LEARNING_COMPETENCIES.find((item) => item.code === expected) || null;
}

export function validateCompetencyCodes(codes = []) {
  const normalized = [...new Set((Array.isArray(codes) ? codes : [codes]).map((code) => String(code).trim().toUpperCase()).filter(Boolean))];
  const unknown = normalized.filter((code) => !getCompetency(code));
  return { ok: unknown.length === 0, codes: normalized.filter((code) => !unknown.includes(code)), unknown };
}

export function groupCompetenciesByDomain(competencies = LEARNING_COMPETENCIES) {
  return LEARNING_DOMAINS.map((domain) => ({ ...domain, competencies: competencies.filter((item) => item.domainCode === domain.code) }));
}

export function calculateTaxonomyCoverage(contents = []) {
  const activeCodes = new Set(LEARNING_COMPETENCIES.filter((item) => item.status === "active").map((item) => item.code));
  const coveredCodes = new Set();
  for (const content of contents) {
    for (const target of content.competencyTargets || []) {
      const code = typeof target === "string" ? target : target?.competencyCode;
      if (activeCodes.has(code)) coveredCodes.add(code);
    }
  }
  return { covered: coveredCodes.size, total: activeCodes.size, rate: activeCodes.size ? Math.round((coveredCodes.size / activeCodes.size) * 100) : 0, missing: [...activeCodes].filter((code) => !coveredCodes.has(code)) };
}
