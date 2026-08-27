import {
  ArrowRight,
  Check,
  CheckCircle,
  Compass,
  Fire,
  LockSimple,
  Sparkle,
  Trophy,
} from "@phosphor-icons/react/ssr";
import { useMemo } from "react";
import { DEMO_ACCOUNTS, useDemoStore } from "../../demoStore.jsx";
import { DAILY_CATEGORIES } from "../games/dailyChallengeData.js";
import {
  buildAchievementProfile,
  getRecentDailyCalendar,
} from "./achievementEngine.js";
import "./student-achievements.css";

function formatEvidenceDate(value) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00.000Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    day: "numeric",
    month: "long",
  }).format(date);
}

function calendarLabel(dateKey, type) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    [type]: type === "weekday" ? "narrow" : "numeric",
  }).format(date);
}

function BadgeArtwork({ badge, size = "regular" }) {
  return (
    <span className={`achievement-badge-art achievement-badge-art-${size}`} aria-hidden="true">
      <img src={badge.artSrc} alt="" width="256" height="256" />
    </span>
  );
}

function AchievementMeter({ badge }) {
  return (
    <div className="achievement-meter" aria-label={`${badge.progressLabel} pour ${badge.title}`}>
      <div>
        <span>Progression</span>
        <strong>{badge.progressLabel}</strong>
      </div>
      <span className="achievement-meter-track" aria-hidden="true">
        <i style={{ width: `${badge.progressPercent}%` }} />
      </span>
    </div>
  );
}

function useAchievementProfile(now = new Date()) {
  const { quizAttempts, session } = useDemoStore();
  const userId = session.userId || DEMO_ACCOUNTS.eleve.userId;
  const profile = useMemo(
    () => buildAchievementProfile(quizAttempts, userId, now),
    [now, quizAttempts, userId],
  );
  const calendar = useMemo(
    () => getRecentDailyCalendar(quizAttempts, userId, now, 7),
    [now, quizAttempts, userId],
  );
  return { profile, calendar };
}

export function AchievementProgressPage({
  studentXp = 0,
  ui: { PageHeader, KpiGrid, RouteLink },
}) {
  const now = useMemo(() => new Date(), []);
  const { profile, calendar } = useAchievementProfile(now);
  const highlightedBadge = profile.nextBadge || profile.latestUnlocked;
  const recentBadges = [...profile.unlockedBadges]
    .sort((left, right) => String(right.unlockedAt).localeCompare(String(left.unlockedAt)))
    .slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow="MON PARCOURS"
        title="Tes progrès"
        subtitle="Tes séries et tes insignes sont calculés à partir des défis réellement terminés."
      />
      <KpiGrid items={[
        ["Défis terminés", String(profile.dailyCompletedCount), "Enregistrés dans ton profil"],
        ["Série actuelle", `${profile.currentStreak} jour${profile.currentStreak > 1 ? "s" : ""}`, profile.todayCompleted ? "Défi du jour validé" : "À poursuivre aujourd’hui", "gold"],
        ["Meilleure série", `${profile.bestStreak} jour${profile.bestStreak > 1 ? "s" : ""}`, "Ton record personnel", "gold"],
        ["XP cumulés", `${Number(studentXp).toLocaleString("fr-FR")} XP`, "Profil élève", "gold"],
      ]} />

      <div className="achievement-progress-layout">
        <section className="achievement-streak-panel" aria-labelledby="achievement-streak-title">
          <div className="achievement-streak-heading">
            <span><Fire weight="fill" /></span>
            <div>
              <small>RITUEL QUOTIDIEN</small>
              <h2 id="achievement-streak-title">Ta série en cours</h2>
            </div>
          </div>
          <div className="achievement-streak-score">
            <strong>{profile.currentStreak}</strong>
            <span>jour{profile.currentStreak > 1 ? "s" : ""}</span>
          </div>
          <p>
            {profile.todayCompleted
              ? "Ton défi d’aujourd’hui est enregistré. Reviens demain pour prolonger ta série."
              : profile.currentStreak > 0
                ? "Ta série est encore active : termine le défi d’aujourd’hui pour la prolonger."
                : "Termine le Défi du jour pour démarrer une nouvelle série."}
          </p>
          <div className="achievement-week" aria-label="Défis terminés pendant les sept derniers jours">
            {calendar.map((day) => (
              <span
                key={day.dateKey}
                className={`${day.completed ? "is-complete" : ""}${day.isToday ? " is-today" : ""}`}
                title={`${day.dateKey} : ${day.completed ? "défi terminé" : "défi non terminé"}`}
              >
                <small>{calendarLabel(day.dateKey, "weekday")}</small>
                <b>{calendarLabel(day.dateKey, "day")}</b>
                <i>{day.completed ? <Check weight="bold" /> : null}</i>
              </span>
            ))}
          </div>
          {!profile.todayCompleted && (
            <RouteLink to="/eleve/jeux/defi-du-jour" className="button button-gold">
              Relever le défi du jour <ArrowRight weight="bold" />
            </RouteLink>
          )}
        </section>

        <section className="achievement-next-panel" aria-labelledby="achievement-next-title">
          {highlightedBadge ? (
            <>
              <BadgeArtwork badge={highlightedBadge} size="large" />
              <div>
                <small>{profile.nextBadge ? "PROCHAIN INSIGNE" : "DERNIER INSIGNE"}</small>
                <h2 id="achievement-next-title">{highlightedBadge.title}</h2>
                <p>{highlightedBadge.description}</p>
                {profile.nextBadge ? (
                  <AchievementMeter badge={highlightedBadge} />
                ) : (
                  <span className="achievement-complete-label"><CheckCircle weight="fill" /> Collection complète</span>
                )}
              </div>
            </>
          ) : null}
        </section>
      </div>

      <div className="achievement-detail-layout">
        <section className="panel achievement-categories-panel" aria-labelledby="achievement-categories-title">
          <div className="panel-heading">
            <h2 id="achievement-categories-title">Horizons explorés</h2>
            <span>{profile.categoryCount}/{DAILY_CATEGORIES.length} catégories</span>
          </div>
          <p>Chaque catégorie vedette terminée laisse une trace dans ta collection.</p>
          <div className="achievement-category-list">
            {DAILY_CATEGORIES.map((category) => {
              const explored = profile.categoriesExplored.includes(category);
              return (
                <span key={category} className={explored ? "is-explored" : ""}>
                  {explored ? <CheckCircle weight="fill" /> : <Compass weight="duotone" />}
                  {category}
                </span>
              );
            })}
          </div>
        </section>

        <section className="panel achievement-recent-panel" aria-labelledby="achievement-recent-title">
          <div className="panel-heading">
            <h2 id="achievement-recent-title">Dernières réussites</h2>
            <RouteLink to="/eleve/recompenses">Voir la collection</RouteLink>
          </div>
          {recentBadges.length ? (
            <ul className="achievement-recent-list">
              {recentBadges.map((badge) => (
                <li key={badge.id}>
                  <BadgeArtwork badge={badge} size="small" />
                  <span>
                    <strong>{badge.title}</strong>
                    <small>Débloqué{formatEvidenceDate(badge.unlockedAt) ? ` le ${formatEvidenceDate(badge.unlockedAt)}` : ""}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="achievement-empty">
              <Trophy weight="duotone" />
              <span><strong>Ta collection commence ici</strong><small>Termine ton premier défi pour obtenir un insigne.</small></span>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function AchievementRewardsPage({
  studentXp = 0,
  ui: { PageHeader, RouteLink },
}) {
  const now = useMemo(() => new Date(), []);
  const { profile } = useAchievementProfile(now);
  const featuredBadge = profile.nextBadge || profile.latestUnlocked;

  return (
    <>
      <PageHeader
        eyebrow="MES RÉUSSITES"
        title="Ta collection de récompenses"
        subtitle="Chaque insigne correspond à une réussite enregistrée dans ton parcours."
        action={(
          <div className="games-xp-balance">
            <Sparkle weight="fill" />
            <span><small>XP CUMULÉS</small><strong>{Number(studentXp).toLocaleString("fr-FR")} XP</strong></span>
          </div>
        )}
      />

      {featuredBadge && (
        <section className={`achievement-reward-hero${profile.nextBadge ? "" : " is-complete"}`}>
          <BadgeArtwork badge={featuredBadge} size="hero" />
          <div>
            <span className="achievement-hero-kicker">
              {profile.nextBadge ? <Compass weight="fill" /> : <Trophy weight="fill" />}
              {profile.nextBadge ? "PROCHAIN INSIGNE" : "COLLECTION COMPLÈTE"}
            </span>
            <h2>{featuredBadge.title}</h2>
            <p>{profile.nextBadge ? featuredBadge.description : "Bravo, tous les insignes disponibles sont maintenant débloqués dans ton profil."}</p>
            {profile.nextBadge ? <AchievementMeter badge={featuredBadge} /> : (
              <span className="achievement-complete-label light"><CheckCircle weight="fill" /> Tous les défis accomplis</span>
            )}
            {profile.nextBadge && (
              <RouteLink to="/eleve/jeux/defi-du-jour" className="button button-gold">
                Continuer ma progression <ArrowRight weight="bold" />
              </RouteLink>
            )}
          </div>
        </section>
      )}

      <div className="achievement-collection-heading">
        <div>
          <h2>Tous les insignes</h2>
          <p>{profile.unlockedBadges.length} débloqué{profile.unlockedBadges.length > 1 ? "s" : ""} sur {profile.badges.length}</p>
        </div>
        <span className="achievement-collection-count"><Trophy weight="fill" /> {profile.unlockedBadges.length}/{profile.badges.length}</span>
      </div>

      <section className="achievement-badge-grid" aria-label="Collection des insignes">
        {profile.badges.map((badge) => (
          <article
            key={badge.id}
            className={badge.unlocked ? "is-unlocked" : "is-locked"}
            aria-label={`${badge.title}, ${badge.unlocked ? "débloqué" : "verrouillé"}`}
          >
            <div className="achievement-card-art">
              <BadgeArtwork badge={badge} size="card" />
              {badge.unlocked
                ? <span className="achievement-unlocked-mark"><Check weight="bold" /></span>
                : <span className="achievement-locked-mark"><LockSimple weight="fill" /></span>}
            </div>
            <span className={`achievement-state ${badge.unlocked ? "is-unlocked" : ""}`}>
              {badge.unlocked ? "DÉBLOQUÉ" : "À CONQUÉRIR"}
            </span>
            <h3>{badge.title}</h3>
            <p>{badge.description}</p>
            {badge.unlocked ? (
              <small>Obtenu{formatEvidenceDate(badge.unlockedAt) ? ` le ${formatEvidenceDate(badge.unlockedAt)}` : ""}</small>
            ) : (
              <AchievementMeter badge={badge} />
            )}
          </article>
        ))}
      </section>
    </>
  );
}
