import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Archive,
  ArrowLeft,
  Check,
  CheckCircle,
  Copy,
  Eye,
  FileText,
  Flask,
  GlobeHemisphereWest,
  Image,
  MagnifyingGlass,
  MapPin,
  Palette,
  PencilSimple,
  Plus,
  Question,
  SealCheck,
  Sparkle,
  SpeakerHigh,
  Trash,
  X,
} from "@phosphor-icons/react/ssr";
import {
  EMPTY_QUESTION_DRAFT,
  QUESTION_CATEGORIES,
  QUESTION_DIFFICULTIES,
  QUESTION_DIFFICULTY_LABELS,
  QUESTION_LEVELS,
  QUESTION_STATUSES,
  QUESTION_STATUS_LABELS,
  QUESTION_STATUS_TRANSITIONS,
} from "./questionBankConstants.js";
import {
  createEmptyQuestionDraft,
  createQuestionBank,
  filterQuestions,
  getQuestionBankStats,
} from "./questionBankCore.js";
import questionBankPreviewArtwork from "./assets/question-bank-preview-banner-1050.webp";
import "./question-bank.css";

const CATEGORY_ICONS = Object.freeze({
  "Culture marocaine": MapPin,
  "Langue française": FileText,
  Sciences: Flask,
  Géographie: GlobeHemisphereWest,
  Histoire: Archive,
  "Monde francophone": SpeakerHigh,
  "Arts et littérature": Palette,
  "Vie quotidienne": Sparkle,
});

const FILTER_DEFAULTS = Object.freeze({
  query: "",
  status: "tous",
  category: "toutes",
  level: "tous",
  difficulty: "toutes",
});

function formatDate(value) {
  if (!value) return "Aujourd’hui";
  return new Intl.DateTimeFormat("fr-MA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function errorFor(errors, field) {
  return errors[field] || "";
}

function QuestionStatus({ status }) {
  return (
    <span className={`qb-status qb-status--${status}`}>
      <span aria-hidden="true" />
      {QUESTION_STATUS_LABELS[status] || status}
    </span>
  );
}

function MetricCard({ label, value, note, tone = "navy" }) {
  return (
    <article className={`qb-metric qb-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function FieldError({ id, children }) {
  if (!children) return null;
  return <small className="qb-field-error" id={id} role="alert">{children}</small>;
}

function QuestionPreview({ draft, artworkSrc }) {
  const Icon = CATEGORY_ICONS[draft.category] || Question;
  return (
    <aside className="qb-preview" aria-label="Aperçu élève">
      <div className="qb-preview__heading">
        <div>
          <span>APERÇU ÉLÈVE</span>
          <strong>Carte de question</strong>
        </div>
        <Eye weight="duotone" aria-hidden="true" />
      </div>
      <div className="qb-preview__visual">
        {artworkSrc ? <img src={artworkSrc} alt="Cartes de quiz entourées d’emblèmes du Maroc, du français, des sciences et du monde" /> : <Icon weight="duotone" aria-hidden="true" />}
      </div>
      <div className="qb-preview__card">
        <span className="qb-preview__category"><Icon weight="fill" /> {draft.category || "Catégorie"}</span>
        <h3>{draft.prompt || "Votre question apparaîtra ici."}</h3>
        <div className="qb-preview__answers">
          {(draft.choices?.length === 4 ? draft.choices : EMPTY_QUESTION_DRAFT.choices).map((choice, index) => (
            <span className={draft.correctIndex === index ? "is-correct" : ""} key={index}>
              <i>{String.fromCharCode(65 + index)}</i>
              {choice || `Proposition ${index + 1}`}
            </span>
          ))}
        </div>
        <p>{draft.explanation || "L’explication pédagogique apparaîtra après la réponse."}</p>
      </div>
    </aside>
  );
}

function QuestionEditor({ question, artworkSrc, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => ({
    ...createEmptyQuestionDraft(question || {}),
    tagsText: (question?.tags || []).join(", "),
    mediaEnabled: Boolean(question?.media),
  }));
  const [errors, setErrors] = useState({});
  const isEditing = Boolean(question?.id);
  const statusOptions = isEditing
    ? [question.status, ...(QUESTION_STATUS_TRANSITIONS[question.status] || [])]
    : [QUESTION_STATUSES.DRAFT];

  const update = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };
  const updateChoice = (index, value) => {
    setDraft((current) => ({
      ...current,
      choices: current.choices.map((choice, choiceIndex) => choiceIndex === index ? value : choice),
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.choices;
      delete next[`choices.${index}`];
      return next;
    });
  };
  const updateMedia = (field, value) => setDraft((current) => ({
    ...current,
    media: { kind: "image", src: "", alt: "", ...(current.media || {}), [field]: value },
  }));

  const submit = (event) => {
    event.preventDefault();
    const payload = {
      ...draft,
      tags: draft.tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      media: draft.mediaEnabled ? draft.media : null,
    };
    const result = onSave(payload);
    if (!result.ok) {
      setErrors(result.fieldErrors || { form: result.error === "invalid_status_transition"
        ? "Ce changement de statut doit respecter le cycle brouillon, validé, puis publié."
        : "La question n’a pas pu être enregistrée." });
    }
  };

  return (
    <div className="qb-editor">
      <header className="qb-page-heading">
        <div>
          <span>BANQUE DE QUESTIONS · ÉDITION</span>
          <h1>{isEditing ? "Modifier la question" : "Créer une question"}</h1>
          <p>Rédigez une consigne claire, quatre réponses plausibles et une explication utile à l’élève.</p>
        </div>
        <button className="qb-button qb-button--light" type="button" onClick={onCancel}><ArrowLeft /> Retour à la liste</button>
      </header>

      <form className="qb-editor__layout" onSubmit={submit} noValidate>
        <section className="qb-form-card">
          {errors.form && <div className="qb-form-alert" role="alert">{errors.form}</div>}
          <div className="qb-form-section">
            <div className="qb-form-section__title"><span>1</span><div><h2>Question</h2><p>Une formulation courte et adaptée au niveau visé.</p></div></div>
            <label className="qb-field qb-field--wide">
              <span>Intitulé de la question</span>
              <textarea value={draft.prompt} onChange={(event) => update("prompt", event.target.value)} rows="3" aria-invalid={Boolean(errorFor(errors, "prompt"))} aria-describedby="qb-error-prompt" placeholder="Ex. Quel océan borde la côte ouest du Maroc ?" />
              <span className="qb-field__meta"><FieldError id="qb-error-prompt">{errorFor(errors, "prompt")}</FieldError><i>{draft.prompt.length}/240</i></span>
            </label>
            <div className="qb-form-grid qb-form-grid--3">
              <label className="qb-field"><span>Catégorie</span><select value={draft.category} onChange={(event) => update("category", event.target.value)}>{QUESTION_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select><FieldError>{errorFor(errors, "category")}</FieldError></label>
              <label className="qb-field"><span>Niveau</span><select value={draft.level} onChange={(event) => update("level", event.target.value)}>{QUESTION_LEVELS.map((item) => <option key={item}>{item}</option>)}</select><FieldError>{errorFor(errors, "level")}</FieldError></label>
              <label className="qb-field"><span>Difficulté</span><select value={draft.difficulty} onChange={(event) => update("difficulty", event.target.value)}>{QUESTION_DIFFICULTIES.map((item) => <option value={item} key={item}>{QUESTION_DIFFICULTY_LABELS[item]}</option>)}</select><FieldError>{errorFor(errors, "difficulty")}</FieldError></label>
            </div>
          </div>

          <div className="qb-form-section">
            <div className="qb-form-section__title"><span>2</span><div><h2>Propositions</h2><p>Cochez la bonne réponse. Les trois distracteurs doivent rester crédibles.</p></div></div>
            {errorFor(errors, "choices") && <div className="qb-inline-error" role="alert">{errorFor(errors, "choices")}</div>}
            <div className="qb-choice-fields">
              {draft.choices.map((choice, index) => (
                <label className={draft.correctIndex === index ? "qb-choice-field is-correct" : "qb-choice-field"} key={index}>
                  <input type="radio" name="correct-answer" checked={draft.correctIndex === index} onChange={() => update("correctIndex", index)} aria-label={`Marquer la réponse ${index + 1} comme correcte`} />
                  <span>{String.fromCharCode(65 + index)}</span>
                  <input value={choice} onChange={(event) => updateChoice(index, event.target.value)} aria-invalid={Boolean(errorFor(errors, `choices.${index}`))} placeholder={`Proposition ${index + 1}`} />
                  {draft.correctIndex === index && <CheckCircle weight="fill" aria-label="Bonne réponse" />}
                </label>
              ))}
            </div>
            <FieldError>{errorFor(errors, "correctIndex")}</FieldError>
          </div>

          <div className="qb-form-section">
            <div className="qb-form-section__title"><span>3</span><div><h2>Retour pédagogique</h2><p>L’élève doit comprendre la réponse, même après une erreur.</p></div></div>
            <label className="qb-field qb-field--wide"><span>Explication</span><textarea value={draft.explanation} onChange={(event) => update("explanation", event.target.value)} rows="3" aria-invalid={Boolean(errorFor(errors, "explanation"))} placeholder="Expliquez la bonne réponse en une ou deux phrases."/><FieldError>{errorFor(errors, "explanation")}</FieldError></label>
            <div className="qb-form-grid">
              <label className="qb-field"><span>Mots-clés</span><input value={draft.tagsText} onChange={(event) => update("tagsText", event.target.value)} placeholder="maroc, géographie, océan"/><small>Séparez les mots-clés par des virgules.</small><FieldError>{errorFor(errors, "tags")}</FieldError></label>
              <label className="qb-field"><span>Source éditoriale</span><input value={draft.source} onChange={(event) => update("source", event.target.value)} placeholder="Jet d’Encre Éditions"/><FieldError>{errorFor(errors, "source")}</FieldError></label>
            </div>
          </div>

          <div className="qb-form-section qb-form-section--compact">
            <div className="qb-form-grid">
              <label className="qb-field"><span>Statut après enregistrement</span><select value={draft.status} onChange={(event) => update("status", event.target.value)}>{statusOptions.map((item) => <option value={item} key={item}>{QUESTION_STATUS_LABELS[item]}</option>)}</select><small>Le cycle éditorial empêche une publication accidentelle.</small></label>
              <label className="qb-media-toggle"><input type="checkbox" checked={draft.mediaEnabled} onChange={(event) => update("mediaEnabled", event.target.checked)} /><Image weight="duotone"/><span><strong>Ajouter un média</strong><small>Image ou audio facultatif</small></span></label>
            </div>
            {draft.mediaEnabled && <div className="qb-form-grid qb-media-fields"><label className="qb-field"><span>Type de média</span><select value={draft.media?.kind || "image"} onChange={(event) => updateMedia("kind", event.target.value)}><option value="image">Image</option><option value="audio">Audio</option></select></label><label className="qb-field"><span>Adresse du média</span><input value={draft.media?.src || ""} onChange={(event) => updateMedia("src", event.target.value)} placeholder="/assets/illustration.png"/></label><label className="qb-field qb-field--wide"><span>Texte alternatif</span><input value={draft.media?.alt || ""} onChange={(event) => updateMedia("alt", event.target.value)} placeholder="Décrivez ce que l’image apporte à la question."/></label><FieldError>{errorFor(errors, "media") || errorFor(errors, "mediaAlt")}</FieldError></div>}
          </div>

          <footer className="qb-editor__actions">
            <button className="qb-button qb-button--light" type="button" onClick={onCancel}>Annuler</button>
            <button className="qb-button qb-button--dark" type="submit"><Check weight="bold"/> {isEditing ? "Enregistrer les modifications" : "Créer le brouillon"}</button>
          </footer>
        </section>
        <QuestionPreview draft={draft} artworkSrc={artworkSrc}/>
      </form>
    </div>
  );
}

function QuestionRow({ question, onEdit, onDuplicate, onDelete, onTransition }) {
  const Icon = CATEGORY_ICONS[question.category] || Question;
  const nextStatus = question.status === QUESTION_STATUSES.DRAFT
    ? QUESTION_STATUSES.APPROVED
    : question.status === QUESTION_STATUSES.APPROVED
      ? QUESTION_STATUSES.PUBLISHED
      : QUESTION_STATUSES.APPROVED;
  const nextLabel = question.status === QUESTION_STATUSES.DRAFT ? "Valider" : question.status === QUESTION_STATUSES.APPROVED ? "Publier" : "Retirer";
  return (
    <article className="qb-row" role="row">
      <div className="qb-row__question" role="cell">
        <span className="qb-category-icon"><Icon weight="duotone"/></span>
        <span><strong>{question.prompt}</strong><small>{question.category} · {question.tags.slice(0, 2).join(" · ") || "Sans mot-clé"}</small></span>
      </div>
      <span role="cell">{question.level}</span>
      <span role="cell">{QUESTION_DIFFICULTY_LABELS[question.difficulty]}</span>
      <span role="cell"><QuestionStatus status={question.status}/></span>
      <span role="cell" className="qb-row__date">{formatDate(question.updatedAt)}</span>
      <div className="qb-row__actions" role="cell">
        <button type="button" onClick={() => onTransition(question.id, nextStatus)} className="qb-icon-button qb-icon-button--primary" title={nextLabel} aria-label={`${nextLabel} : ${question.prompt}`}><SealCheck/></button>
        <button type="button" onClick={() => onEdit(question)} className="qb-icon-button" title="Modifier" aria-label={`Modifier : ${question.prompt}`}><PencilSimple/></button>
        <button type="button" onClick={() => onDuplicate(question.id)} className="qb-icon-button" title="Dupliquer" aria-label={`Dupliquer : ${question.prompt}`}><Copy/></button>
        <button type="button" onClick={() => onDelete(question)} className="qb-icon-button qb-icon-button--danger" title="Supprimer" aria-label={`Supprimer : ${question.prompt}`}><Trash/></button>
      </div>
    </article>
  );
}

export function useQuestionBank(options = {}) {
  const bankRef = useRef(null);
  if (!bankRef.current) bankRef.current = options.bank || createQuestionBank(options);
  const bank = bankRef.current;
  const state = useSyncExternalStore(bank.subscribe, bank.getSnapshot, bank.getSnapshot);
  return { state, actions: bank.actions, bank };
}

export function QuestionBankAdmin({ bank: providedBank, artworkSrc = questionBankPreviewArtwork, onQuestionsChange }) {
  const { state, actions } = useQuestionBank({ bank: providedBank, onChange: onQuestionsChange });
  const [filters, setFilters] = useState(FILTER_DEFAULTS);
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [notice, setNotice] = useState("");
  const stats = useMemo(() => getQuestionBankStats(state.questions), [state.questions]);
  const filtered = useMemo(() => filterQuestions(state.questions, filters), [state.questions, filters]);

  const changeFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const openCreate = () => { setEditing(null); setEditorOpen(true); setNotice(""); };
  const openEdit = (question) => { setEditing(question); setEditorOpen(true); setNotice(""); };
  const closeEditor = () => { setEditing(null); setEditorOpen(false); };
  const save = (payload) => {
    const result = editing
      ? actions.updateQuestion(editing.id, payload)
      : actions.createQuestion(payload);
    if (result.ok) {
      setNotice(editing ? "La question a été mise à jour." : "Le nouveau brouillon a été créé.");
      closeEditor();
    }
    return result;
  };
  const duplicate = (id) => {
    const result = actions.duplicateQuestion(id);
    setNotice(result.ok ? "Une copie brouillon a été créée." : "La copie n’a pas pu être créée.");
  };
  const transition = (id, status) => {
    const result = actions.transitionQuestionStatus(id, status);
    setNotice(result.ok ? `La question est maintenant « ${QUESTION_STATUS_LABELS[status]} ».` : "Le changement de statut a été refusé.");
  };
  const remove = () => {
    const result = actions.deleteQuestion(deleteCandidate.id);
    setNotice(result.ok ? "La question a été supprimée de la banque locale." : "La suppression a échoué.");
    setDeleteCandidate(null);
  };

  if (editorOpen) return <QuestionEditor question={editing} artworkSrc={artworkSrc} onCancel={closeEditor} onSave={save}/>;

  return (
    <section className="question-bank-admin">
      <header className="qb-page-heading">
        <div>
          <span>BANQUE DE QUESTIONS</span>
          <h1>Questions du quiz</h1>
          <p>Créez, relisez et publiez des questions adaptées aux élèves marocains.</p>
        </div>
        <button className="qb-button qb-button--dark" type="button" onClick={openCreate}><Plus weight="bold"/> Nouvelle question</button>
      </header>

      <div className="qb-local-note"><SealCheck weight="duotone"/><span><strong>Prototype éditorial local</strong><small>Les modifications restent enregistrées sur cet appareil et les questions publiées sont prêtes pour le quiz.</small></span></div>

      {notice && <div className="qb-notice" role="status"><CheckCircle weight="fill"/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fermer le message"><X/></button></div>}

      <div className="qb-metrics">
        <MetricCard label="Questions" value={stats.total} note={`${stats.coverage}/${QUESTION_CATEGORIES.length} catégories couvertes`}/>
        <MetricCard label="Publiées" value={stats.byStatus[QUESTION_STATUSES.PUBLISHED]} note="Disponibles pour les jeux" tone="teal"/>
        <MetricCard label="À publier" value={stats.publishable} note="Questions déjà validées" tone="gold"/>
        <MetricCard label="Brouillons" value={stats.byStatus[QUESTION_STATUSES.DRAFT]} note="À compléter ou relire" tone="coral"/>
      </div>

      <div className="qb-toolbar">
        <label className="qb-search"><MagnifyingGlass aria-hidden="true"/><span className="qb-sr-only">Rechercher une question</span><input type="search" value={filters.query} onChange={(event) => changeFilter("query", event.target.value)} placeholder="Rechercher dans les questions, réponses ou mots-clés…"/></label>
        <select value={filters.category} onChange={(event) => changeFilter("category", event.target.value)} aria-label="Filtrer par catégorie"><option value="toutes">Toutes les catégories</option>{QUESTION_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.level} onChange={(event) => changeFilter("level", event.target.value)} aria-label="Filtrer par niveau"><option value="tous">Tous les niveaux</option>{QUESTION_LEVELS.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={filters.difficulty} onChange={(event) => changeFilter("difficulty", event.target.value)} aria-label="Filtrer par difficulté"><option value="toutes">Toutes les difficultés</option>{QUESTION_DIFFICULTIES.map((item) => <option value={item} key={item}>{QUESTION_DIFFICULTY_LABELS[item]}</option>)}</select>
      </div>

      <div className="qb-tabs" role="tablist" aria-label="Filtrer par statut">
        {[{ value: "tous", label: "Toutes", count: stats.total }, ...Object.values(QUESTION_STATUSES).map((status) => ({ value: status, label: QUESTION_STATUS_LABELS[status], count: stats.byStatus[status] }))].map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={filters.status === item.value} className={filters.status === item.value ? "is-active" : ""} onClick={() => changeFilter("status", item.value)}>{item.label}<span>{item.count}</span></button>
        ))}
      </div>

      <div className="qb-table" role="table" aria-label="Questions disponibles">
        <div className="qb-table__head" role="row"><span role="columnheader">Question</span><span role="columnheader">Niveau</span><span role="columnheader">Difficulté</span><span role="columnheader">Statut</span><span role="columnheader">Mise à jour</span><span role="columnheader">Actions</span></div>
        {filtered.map((question) => <QuestionRow key={question.id} question={question} onEdit={openEdit} onDuplicate={duplicate} onDelete={setDeleteCandidate} onTransition={transition}/>) }
      </div>
      {filtered.length === 0 && <div className="qb-empty"><MagnifyingGlass weight="duotone"/><h2>Aucune question trouvée</h2><p>Modifiez les filtres ou créez une nouvelle question.</p><button type="button" className="qb-button qb-button--light" onClick={() => setFilters(FILTER_DEFAULTS)}>Effacer les filtres</button></div>}

      {deleteCandidate && <div className="qb-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteCandidate(null); }}><div className="qb-dialog" role="alertdialog" aria-modal="true" aria-labelledby="qb-delete-title" aria-describedby="qb-delete-copy"><span className="qb-dialog__icon"><Trash weight="duotone"/></span><h2 id="qb-delete-title">Supprimer cette question ?</h2><p id="qb-delete-copy">« {deleteCandidate.prompt} » sera retirée définitivement de la banque locale.</p><div><button className="qb-button qb-button--light" type="button" onClick={() => setDeleteCandidate(null)}>Annuler</button><button className="qb-button qb-button--danger" type="button" onClick={remove}>Supprimer</button></div></div></div>}
    </section>
  );
}

export default QuestionBankAdmin;
