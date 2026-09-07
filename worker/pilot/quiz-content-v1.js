// Immutable answer-key snapshot of the existing published corpus, not new content.
// Keep this version when adding another one, so existing attempts remain valid.
export const quizQuestionsV1 = Object.freeze([
  {
    "id": "qb-sciences-eau",
    "theme": "Sciences",
    "sourceCategory": "Sciences",
    "level": "facile",
    "targetLevel": "4e AEP",
    "tags": [
      "eau",
      "états de la matière"
    ],
    "prompt": "À quelle température l’eau pure gèle-t-elle normalement ?",
    "choices": [
      "0 °C",
      "10 °C",
      "50 °C",
      "100 °C"
    ],
    "correctIndex": 0,
    "explanation": "À pression normale, l’eau pure passe de l’état liquide à l’état solide à 0 °C."
  },
  {
    "id": "qb-arts-zellige",
    "theme": "Arts et littérature",
    "sourceCategory": "Arts et littérature",
    "level": "facile",
    "targetLevel": "4e AEP",
    "tags": [
      "maroc",
      "patrimoine",
      "arts"
    ],
    "prompt": "Comment appelle-t-on l’art décoratif marocain composé de petits carreaux colorés ?",
    "choices": [
      "Le vitrail",
      "Le zellige",
      "La mosaïque romaine",
      "La fresque"
    ],
    "correctIndex": 1,
    "explanation": "Le zellige assemble des morceaux de carreaux taillés pour former des motifs géométriques colorés."
  },
  {
    "id": "qb-geographie-detroit",
    "theme": "Géographie",
    "sourceCategory": "Géographie",
    "level": "intermédiaire",
    "targetLevel": "6e AEP",
    "tags": [
      "maroc",
      "méditerranée"
    ],
    "prompt": "Quel détroit sépare le Maroc de l’Espagne ?",
    "choices": [
      "Le détroit de Gibraltar",
      "Le détroit du Bosphore",
      "Le canal de Suez",
      "Le détroit de Béring"
    ],
    "correctIndex": 0,
    "explanation": "Le détroit de Gibraltar relie l’Atlantique à la Méditerranée et sépare le Maroc de l’Espagne."
  },
  {
    "id": "qb-langue-pluriel-journal",
    "theme": "Langue française",
    "sourceCategory": "Langue française",
    "level": "facile",
    "targetLevel": "4e AEP",
    "tags": [
      "grammaire",
      "pluriel"
    ],
    "prompt": "Quel est le pluriel correct du mot « journal » ?",
    "choices": [
      "Des journals",
      "Des journaux",
      "Des journales",
      "Des journails"
    ],
    "correctIndex": 1,
    "explanation": "Le nom « journal » forme son pluriel en -aux : un journal, des journaux."
  },
  {
    "id": "qb-langue-synonyme-joyeux",
    "theme": "Langue française",
    "sourceCategory": "Langue française",
    "level": "facile",
    "targetLevel": "3e AEP",
    "tags": [
      "vocabulaire",
      "synonymes"
    ],
    "prompt": "Quel mot est un synonyme de « joyeux » ?",
    "choices": [
      "Heureux",
      "Fatigué",
      "Silencieux",
      "Lointain"
    ],
    "correctIndex": 0,
    "explanation": "« Heureux » et « joyeux » expriment tous les deux un sentiment de joie."
  },
  {
    "id": "qb-maroc-atlantique",
    "theme": "Culture marocaine",
    "sourceCategory": "Culture marocaine",
    "level": "facile",
    "targetLevel": "5e AEP",
    "tags": [
      "maroc",
      "géographie"
    ],
    "prompt": "Quel océan borde la côte ouest du Maroc ?",
    "choices": [
      "La mer Méditerranée",
      "L’océan Atlantique",
      "L’océan Indien",
      "L’océan Pacifique"
    ],
    "correctIndex": 1,
    "explanation": "L’océan Atlantique borde toute la côte ouest du Maroc, de Tanger à Lagouira."
  },
  {
    "id": "qb-maroc-capitale",
    "theme": "Culture marocaine",
    "sourceCategory": "Culture marocaine",
    "level": "facile",
    "targetLevel": "4e AEP",
    "tags": [
      "maroc",
      "villes"
    ],
    "prompt": "Quelle ville est la capitale administrative du Maroc ?",
    "choices": [
      "Casablanca",
      "Marrakech",
      "Rabat",
      "Fès"
    ],
    "correctIndex": 2,
    "explanation": "Rabat est la capitale administrative du Maroc ; Casablanca en est la plus grande ville."
  },
  {
    "id": "qb-francophonie-senegal",
    "theme": "Monde francophone",
    "sourceCategory": "Monde francophone",
    "level": "intermédiaire",
    "targetLevel": "5e AEP",
    "tags": [
      "francophonie",
      "afrique"
    ],
    "prompt": "Quelle ville est la capitale du Sénégal ?",
    "choices": [
      "Dakar",
      "Bamako",
      "Tunis",
      "Abidjan"
    ],
    "correctIndex": 0,
    "explanation": "Dakar est la capitale du Sénégal, un pays francophone situé sur la côte atlantique de l’Afrique."
  },
  {
    "id": "qb-arts-petit-prince",
    "theme": "Arts et littérature",
    "sourceCategory": "Arts et littérature",
    "level": "intermédiaire",
    "targetLevel": "5e AEP",
    "tags": [
      "littérature",
      "auteur"
    ],
    "prompt": "Qui a écrit le récit « Le Petit Prince » ?",
    "choices": [
      "Victor Hugo",
      "Antoine de Saint-Exupéry",
      "Jules Verne",
      "Molière"
    ],
    "correctIndex": 1,
    "explanation": "Antoine de Saint-Exupéry a écrit et illustré « Le Petit Prince », publié en 1943."
  },
  {
    "id": "qb-geographie-continent",
    "theme": "Géographie",
    "sourceCategory": "Géographie",
    "level": "facile",
    "targetLevel": "3e AEP",
    "tags": [
      "maroc",
      "continents"
    ],
    "prompt": "Sur quel continent se trouve le Maroc ?",
    "choices": [
      "L’Europe",
      "L’Afrique",
      "L’Asie",
      "L’Amérique"
    ],
    "correctIndex": 1,
    "explanation": "Le Maroc se trouve au nord-ouest du continent africain."
  }
].map(question => Object.freeze({
  ...question, choices: Object.freeze(question.choices),
})));
