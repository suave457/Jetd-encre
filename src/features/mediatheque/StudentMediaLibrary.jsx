import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Books,
  CaretDown,
  CheckCircle,
  Clock,
  FileText,
  Headphones,
  PlayCircle,
  Sparkle,
} from "@phosphor-icons/react/ssr";
import PdfReader from "./PdfReader.jsx";
import { useDemoStore } from "../../demoStore.jsx";
import {
  DEMO_MEDIA_CONTENTS,
  MEDIA_SECTION,
  filterMediaContents,
  getMediaContentById,
} from "./mediaLibraryCore.js";
import { createLocalPdfBook, getLocalTestBook, validateLocalPdfFile } from "./localPdfCore.js";
import { useTranscriptPreference } from "./useTranscriptPreference.js";
import "./mediatheque.css";

const ALL_MEDIA = "Tout voir";
const CATALOG_CONTENTS = import.meta.env.DEV ? [...DEMO_MEDIA_CONTENTS, getLocalTestBook()] : DEMO_MEDIA_CONTENTS;

const SECTION_OPTIONS = Object.freeze([
  { id: ALL_MEDIA, label: "Tout voir", Icon: Books },
  { id: MEDIA_SECTION.AUDIO, label: "Audio", Icon: Headphones },
  { id: MEDIA_SECTION.VIDEOS, label: "Vidéos", Icon: PlayCircle },
  { id: MEDIA_SECTION.BOOKS, label: "Bouquins", Icon: BookOpenText },
]);

const SECTION_DETAILS = Object.freeze({
  [MEDIA_SECTION.AUDIO]: {
    Icon: Headphones,
    action: "Écouter",
    assurance: "Transcription incluse",
    visualAlt: "Casque audio illustré pour écouter Les voix du quartier",
  },
  [MEDIA_SECTION.VIDEOS]: {
    Icon: PlayCircle,
    action: "Regarder",
    assurance: "Sous-titres français",
    visualAlt: "Scène d’une médina marocaine pour la vidéo Les secrets de la médina",
  },
  [MEDIA_SECTION.BOOKS]: {
    Icon: BookOpenText,
    action: "Lire le livre",
    assurance: "8 pages à feuilleter",
    visualAlt: "Livre illustré ouvert sur des scènes de la vie au Maroc",
  },
});

function countFor(section, contents) {
  if (section === ALL_MEDIA) return contents.length;
  return filterMediaContents(contents, section).length;
}

function mediaMeta(content) {
  if (content.section === MEDIA_SECTION.BOOKS) return content.pageCount ? `${content.pageCount} pages` : "PDF local";
  return content.durationLabel;
}

function MediaCard({ content, RouteLink }) {
  const details = SECTION_DETAILS[content.section];
  const Icon = details.Icon;
  return (
    <article className={`mediatheque-card mediatheque-card--${content.section.toLowerCase().replace("é", "e")}`}>
      <div className="mediatheque-card__visual">
        {content.coverUrl
          ? <img src={content.coverUrl} alt={details.visualAlt} width="960" height="600" loading="lazy" decoding="async" />
          : <div className="mediatheque-local-cover"><BookOpenText weight="duotone" aria-hidden="true" /><strong>Document de test</strong><span>Lecture locale uniquement</span></div>}
        <span className="mediatheque-card__type"><Icon weight="fill" /> {content.section}</span>
      </div>
      <div className="mediatheque-card__body">
        <div className="mediatheque-card__meta">
          {content.isLocalTest ? <span>Document de test</span> : <><span>{content.level}</span><span>{content.cefrLevel}</span></>}
          <span><Clock weight="bold" /> {mediaMeta(content)}</span>
        </div>
        <h2>{content.title}</h2>
        <p>{content.summary}</p>
        <div className="mediatheque-card__assurance">
          {content.isLocalTest ? <FileText weight="duotone" /> : <CheckCircle weight="fill" />}
          <span>{content.isLocalTest ? "Non publié · usage de test" : content.section === MEDIA_SECTION.BOOKS ? `${content.pageCount} pages à feuilleter` : details.assurance}</span>
        </div>
        <RouteLink className="button button-dark mediatheque-card__action" to={`/eleve/mediatheque/${content.id}`}>
          {details.action} <ArrowRight weight="bold" />
        </RouteLink>
      </div>
    </article>
  );
}

function BackToLibrary({ RouteLink }) {
  return (
    <nav className="mediatheque-back" aria-label="Retour à la médiathèque">
      <RouteLink to="/eleve/mediatheque"><ArrowLeft weight="bold" /> Retour à la médiathèque</RouteLink>
    </nav>
  );
}

function LearningAside({ content }) {
  return (
    <aside className="mediatheque-learning-card" aria-label="Objectif de cette ressource">
      <span className="mediatheque-learning-card__eyebrow"><Sparkle weight="fill" /> TA MISSION</span>
      <h2>Après la ressource</h2>
      <p>{content.task}</p>
      <div>
        <strong>Tu vas apprendre à</strong>
        <span>{content.learningGoal}</span>
      </div>
      <ul aria-label="Compétences travaillées">
        {content.competencies.map((competency) => <li key={competency}><CheckCircle weight="fill" /> {competency}</li>)}
      </ul>
    </aside>
  );
}

function DetailHeading({ content }) {
  const details = SECTION_DETAILS[content.section];
  const Icon = details.Icon;
  return (
    <header className="mediatheque-detail__heading">
      <span><Icon weight="fill" /> {content.section} · {content.cefrLevel}</span>
      <h1>{content.title}</h1>
      <p>{content.summary}</p>
      <div>
        <span>{content.level}</span>
        <span>{content.unit}</span>
        <span><Clock weight="bold" /> {mediaMeta(content)}</span>
      </div>
    </header>
  );
}

function Transcript({ content }) {
  const transcriptPreference = useTranscriptPreference();
  const lines = content.transcript.split("\n");
  return (
    <details className="mediatheque-transcript" {...transcriptPreference}>
      <summary>
        <FileText weight="duotone" />
        <span>Transcription</span>
        <CaretDown className="mediatheque-transcript__chevron" weight="bold" aria-hidden="true" />
      </summary>
      <div>
        {lines.map((line, index) => {
          const [speaker, ...copy] = line.split(" — ");
          return (
            <p key={`${speaker}-${index}`}>
              {copy.length > 0 && <strong>{speaker}</strong>}
              <span>{copy.length > 0 ? copy.join(" — ") : speaker}</span>
            </p>
          );
        })}
      </div>
    </details>
  );
}

function AudioDetail({ content, RouteLink }) {
  return (
    <div className="mediatheque-detail">
      <BackToLibrary RouteLink={RouteLink} />
      <div className="mediatheque-detail__hero mediatheque-detail__hero--audio">
        <img src={content.coverUrl} alt="Casque turquoise pour l’écoute du podcast" width="720" height="500" />
        <DetailHeading content={content} />
      </div>
      <div className="mediatheque-player-layout">
        <section className="mediatheque-audio-player" aria-labelledby="audio-player-heading">
          <span className="mediatheque-player-kicker"><Headphones weight="fill" /> ÉCOUTE GUIDÉE</span>
          <h2 id="audio-player-heading">Lance l’histoire sonore</h2>
          <p>Installe-toi au calme. Tu peux mettre en pause et relire la transcription à tout moment.</p>
          <audio controls preload="metadata" aria-label={`Écouter ${content.title}`}>
            <source src={content.audioUrl} type={content.mimeType} />
            Ton navigateur ne peut pas lire cet audio. <a href={content.audioUrl}>Télécharger le fichier</a>.
          </audio>
          <span className="mediatheque-player-footnote">Durée : {content.durationLabel} · Français</span>
        </section>
        <LearningAside content={content} />
      </div>
      <Transcript content={content} />
    </div>
  );
}

function VideoDetail({ content, RouteLink }) {
  return (
    <div className="mediatheque-detail">
      <BackToLibrary RouteLink={RouteLink} />
      <DetailHeading content={content} />
      <div className="mediatheque-video-layout">
        <section className="mediatheque-video-player" aria-label={`Lecteur vidéo pour ${content.title}`}>
          <video
            controls
            preload="metadata"
            poster={content.coverUrl}
            playsInline
            aria-label={`Regarder ${content.title}`}
          >
            <source src={content.videoUrl} type={content.mimeType} />
            <track kind="captions" src={content.captionsUrl} srcLang="fr" label="Français" default />
            Ton navigateur ne peut pas lire cette vidéo. <a href={content.videoUrl}>Télécharger le fichier</a>.
          </video>
          <div><CheckCircle weight="fill" /> Sous-titres et transcription disponibles</div>
        </section>
        <LearningAside content={content} />
      </div>
      <Transcript content={content} />
    </div>
  );
}

function BookDetail({ content, onNavigate, userId }) {
  const [pageRequest, setPageRequest] = useState(null);
  const book = {
    ...content,
    meta: content.isLocalTest
      ? ["Document de test", content.pageCount && `${content.pageCount} pages`, content.sizeLabel, "Non validé pour un usage scolaire"].filter(Boolean).join(" · ")
      : `${content.author} · ${content.pageCount} pages · ${content.cefrLevel}`,
  };
  return (
    <div className="mediatheque-reader-page">
      <h1 className="mediatheque-sr-only">Lire {content.title}</h1>
      <PdfReader
        book={book}
        userId={userId}
        onBack={() => onNavigate("/eleve/mediatheque")}
        pageRequest={pageRequest}
      />
      {content.tableOfContents?.length > 0 && <aside className="mediatheque-book-guide" aria-label="Sommaire du livre">
        <div>
          <span><BookOpenText weight="fill" /> DANS CE LIVRE</span>
          <h2>Quatre étapes de lecture</h2>
          <p>{content.task}</p>
        </div>
        <ol>
          {content.tableOfContents.map((entry) => (
            <li key={entry.page}>
              <button
                type="button"
                aria-label={`Aller à la page ${entry.page} : ${entry.title}`}
                onClick={() => setPageRequest((current) => ({ page: entry.page, token: (current?.token || 0) + 1 }))}
              >
                <span>Page {entry.page}</span>
                <strong>{entry.title}</strong>
                <ArrowRight weight="bold" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      </aside>}
    </div>
  );
}

export default function StudentMediaLibrary({ detail, onNavigate, ui }) {
  const { currentUser } = useDemoStore();
  const readerUserId = currentUser?.role === "eleve" ? currentUser.id : null;
  return <MediaLibraryView detail={detail} onNavigate={onNavigate} ui={ui} userId={readerUserId}/>;
}

// Shared reader UI; school accounts provide their identity without mounting the demo store.
export function MediaLibraryView({ detail, onNavigate, ui, userId, allowLocalImport = true }) {
  const readerUserId = userId;
  const [section, setSection] = useState(ALL_MEDIA);
  const [localBook, setLocalBook] = useState(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const importGeneration = useRef(0);
  const contents = useMemo(() => localBook ? [...CATALOG_CONTENTS, localBook] : CATALOG_CONTENTS, [localBook]);
  const content = detail ? getMediaContentById(detail, contents) : null;
  const { PageHeader, RouteLink } = ui;
  const visibleContents = useMemo(
    () => section === ALL_MEDIA ? contents : filterMediaContents(contents, section),
    [section, contents],
  );

  useEffect(() => () => { importGeneration.current += 1; }, []);
  useEffect(() => () => {
    if (localBook?.sourceUrl) URL.revokeObjectURL(localBook.sourceUrl);
  }, [localBook]);

  const openLocalPdf = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const generation = ++importGeneration.current;
    setImportError("");
    setImporting(true);
    const error = await validateLocalPdfFile(file);
    if (generation !== importGeneration.current) return;
    setImporting(false);
    if (error) { setImportError(error); return; }
    const nextBook = createLocalPdfBook(file, URL.createObjectURL(file));
    setLocalBook(nextBook);
    onNavigate(`/eleve/mediatheque/${nextBook.id}`);
  };

  if (detail && !content) {
    return (
      <div className="mediatheque">
        <BackToLibrary RouteLink={RouteLink} />
        <div className="empty-state">
          <Books weight="duotone" />
          <h1>Cette ressource n’est plus disponible</h1>
          <p>{detail === "test-pdf-local" ? "Après une actualisation, sélectionne à nouveau ton PDF local : il n’est pas conservé par le site." : "Reviens à la Médiathèque pour choisir un contenu publié."}</p>
          <RouteLink className="button button-dark" to="/eleve/mediatheque">Voir la collection</RouteLink>
        </div>
      </div>
    );
  }

  if (content?.section === MEDIA_SECTION.AUDIO) return <AudioDetail content={content} RouteLink={RouteLink} />;
  if (content?.section === MEDIA_SECTION.VIDEOS) return <VideoDetail content={content} RouteLink={RouteLink} />;
  if (content?.section === MEDIA_SECTION.BOOKS) return <BookDetail key={JSON.stringify([readerUserId, content.id])} content={content} onNavigate={onNavigate} userId={readerUserId} />;

  return (
    <div className="mediatheque">
      <PageHeader
        eyebrow="MÉDIATHÈQUE"
        title="Écoute, regarde et lis"
        subtitle="Des ressources courtes et accessibles pour apprendre le français autrement."
        action={(
          <div className="mediatheque-count" aria-label={`${contents.length} ressources dans la collection`}>
            <Books weight="duotone" />
            <span><small>TA COLLECTION</small><strong>{contents.length} ressources</strong></span>
          </div>
        )}
      />

      <section className="mediatheque-intro" aria-label="Choisir un type de ressource">
        <div>
          <span><Sparkle weight="fill" /> UNE MÉDIATHÈQUE POUR TOI</span>
          <h2>Choisis ton format préféré</h2>
          <p>Tu peux écouter une histoire, regarder une visite ou feuilleter un livre sans quitter ton espace.</p>
        </div>
        <div className="mediatheque-tabs" role="group" aria-label="Filtrer la médiathèque">
          {SECTION_OPTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={section === id}
              className={section === id ? "is-active" : ""}
              onClick={() => setSection(id)}
            >
              <Icon weight={section === id ? "fill" : "duotone"} />
              <span>{label}</span>
              <small>{countFor(id, contents)}</small>
            </button>
          ))}
        </div>
      </section>

      {import.meta.env.DEV && allowLocalImport && <section className="mediatheque-local-test" aria-label="Test local de la liseuse">
        <div><strong>Tester un autre PDF</strong><p>Le fichier reste sur cet appareil. Il n’est ni envoyé au serveur ni ajouté au catalogue publié. Limite : 100 Mio.</p></div>
        <label className="mediatheque-local-picker">{importing ? "Vérification du PDF…" : "Choisir un PDF local"}<input type="file" accept="application/pdf,.pdf" aria-label="Choisir un PDF local" onChange={openLocalPdf} disabled={importing} /></label>
        {importError && <p className="mediatheque-local-error" role="alert">{importError}</p>}
      </section>}

      <div id="mediatheque-results" className="mediatheque-grid" role="region" aria-label={`Ressources : ${section}`} aria-live="polite">
        {visibleContents.map((item) => <MediaCard key={item.id} content={item} RouteLink={RouteLink} />)}
      </div>
    </div>
  );
}
