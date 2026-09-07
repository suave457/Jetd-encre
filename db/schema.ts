import { check, foreignKey, index, integer, primaryKey, sqliteTable, text, unique, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const betaEditorialItems = sqliteTable("beta_editorial_items", {
  id: text("id").primaryKey(),
  itemType: text("item_type").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  levelCode: text("level_code"),
  audience: text("audience").notNull().default("private"),
  revision: integer("revision").notNull().default(1),
  currentVersionId: text("current_version_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  archivedAt: text("archived_at"),
}, (table) => [
  index("beta_editorial_filters_idx").on(table.itemType, table.status, table.levelCode, table.updatedAt),
]);

export const betaContentVersions = sqliteTable("beta_content_versions", {
  id: text("id").primaryKey(),
  contentId: text("content_id").notNull().references(() => betaEditorialItems.id, { onDelete: "cascade" }),
  versionNo: integer("version_no").notNull(),
  payloadJson: text("payload_json").notNull(),
  checksum: text("checksum").notNull(),
  reason: text("reason"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("beta_content_version_unique_idx").on(table.contentId, table.versionNo),
  index("beta_content_versions_content_idx").on(table.contentId, table.createdAt),
]);

export const betaEvents = sqliteTable("beta_events", {
  eventId: text("event_id").primaryKey(),
  schemaVersion: integer("schema_version").notNull().default(1),
  eventName: text("event_name").notNull(),
  occurredAt: text("occurred_at").notNull(),
  receivedAt: text("received_at").notNull(),
  subjectKey: text("subject_key").notNull(),
  role: text("role").notNull(),
  tenantKey: text("tenant_key").notNull(),
  classKey: text("class_key"),
  sessionId: text("session_id"),
  contentId: text("content_id"),
  contentVersion: integer("content_version"),
  activityId: text("activity_id"),
  attemptId: text("attempt_id"),
  competencyCodesJson: text("competency_codes_json").notNull().default("[]"),
  propertiesJson: text("properties_json").notNull().default("{}"),
}, (table) => [
  index("beta_events_time_idx").on(table.tenantKey, table.occurredAt, table.eventName),
  index("beta_events_subject_idx").on(table.tenantKey, table.subjectKey, table.occurredAt),
]);

export const betaImportJobs = sqliteTable("beta_import_jobs", {
  id: text("id").primaryKey(),
  importType: text("import_type").notNull(),
  fileName: text("file_name").notNull(),
  status: text("status").notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  validRows: integer("valid_rows").notNull().default(0),
  invalidRows: integer("invalid_rows").notNull().default(0),
  summaryJson: text("summary_json").notNull().default("{}"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
  rolledBackAt: text("rolled_back_at"),
}, (table) => [index("beta_import_jobs_status_idx").on(table.status, table.createdAt)]);

export const betaMediaAssets = sqliteTable("beta_media_assets", {
  id: text("id").primaryKey(),
  r2Key: text("r2_key").notNull().unique(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull().default(0),
  checksumSha256: text("checksum_sha256"),
  altText: text("alt_text"),
  transcriptKey: text("transcript_key"),
  sourceLabel: text("source_label"),
  credit: text("credit"),
  licenseType: text("license_type"),
  licenseExpiresAt: text("license_expires_at"),
  status: text("status").notNull().default("uploading"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  archivedAt: text("archived_at"),
}, (table) => [index("beta_media_status_idx").on(table.status, table.updatedAt)]);

export const betaReferenceItems = sqliteTable("beta_reference_items", {
  id: text("id").primaryKey(),
  family: text("family").notNull(),
  code: text("code").notNull(),
  label: text("label").notNull(),
  metadataJson: text("metadata_json").notNull().default("{}"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  system: integer("system", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("beta_reference_family_code_idx").on(table.family, table.code)]);

export const betaActionResolutions = sqliteTable("beta_action_resolutions", {
  actionId: text("action_id").primaryKey(),
  status: text("status").notNull(),
  actorKey: text("actor_key").notNull(),
  updatedAt: text("updated_at").notNull(),
  resolvedAt: text("resolved_at"),
});

// Append-only public decisions: drafts and their current pointer stay private.
export const betaArticlePublicationEvents = sqliteTable('beta_article_publication_events', {
  id:text('id').primaryKey(),contentId:text('content_id').notNull().references(()=>betaEditorialItems.id),
  publicationNo:integer('publication_no').notNull(),action:text('action').notNull(),
  sourceVersionNo:integer('source_version_no'),imageId:text('image_id'),imageAlt:text('image_alt'),
  requestHash:text('request_hash').notNull(),actorId:text('actor_id').notNull().references(()=>pilotUsers.id),createdAt:text('created_at').notNull(),
},t=>[
  uniqueIndex('beta_article_publication_revision').on(t.contentId,t.publicationNo),
  index('beta_article_publication_date').on(t.createdAt,t.id),
  foreignKey({columns:[t.contentId,t.sourceVersionNo],foreignColumns:[betaContentVersions.contentId,betaContentVersions.versionNo]}),
  check('beta_article_publication_no',sql`${t.publicationNo}>0`),
  check('beta_article_publication_action',sql`(${t.action}='publish' AND ${t.sourceVersionNo} IS NOT NULL AND ${t.imageId} IS NOT NULL AND ${t.imageAlt} IS NOT NULL) OR (${t.action}='retract' AND ${t.sourceVersionNo} IS NULL AND ${t.imageId} IS NULL AND ${t.imageAlt} IS NULL)`),
]);

export const betaKpiSnapshots = sqliteTable("beta_kpi_snapshots", {
  id: text("id").primaryKey(),
  metricKey: text("metric_key").notNull(),
  scopeType: text("scope_type").notNull(),
  scopeKey: text("scope_key").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  value: integer("value_milli").notNull(),
  numerator: integer("numerator").notNull().default(0),
  denominator: integer("denominator").notNull().default(0),
  sourceStatus: text("source_status").notNull().default("fixture"),
  calculatedAt: text("calculated_at").notNull(),
}, (table) => [
  uniqueIndex("beta_kpi_scope_period_idx").on(table.metricKey, table.scopeType, table.scopeKey, table.periodStart, table.periodEnd),
]);

export const betaAuditEntries = sqliteTable("beta_audit_entries", {
  id: text("id").primaryKey(),
  actorKey: text("actor_key").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  summary: text("summary").notNull(),
  requestId: text("request_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("beta_audit_created_idx").on(table.createdAt, table.action)]);

// The pilot is separate from legacy browser fixtures and unverified beta telemetry.
export const pilotUsers = sqliteTable("pilot_users", {
  id: text("id").primaryKey(), displayName: text("display_name").notNull(),
  active: integer("active").notNull().default(1), createdAt: integer("created_at").notNull(),
}, t => [check("pilot_users_active", sql`${t.active} in (0,1)`)]);
export const pilotIdentities = sqliteTable("pilot_identities", {
  issuer: text("issuer").notNull(), subject: text("subject").notNull(),
  userId: text("user_id").notNull().references(() => pilotUsers.id),
}, t => [primaryKey({ columns: [t.issuer, t.subject] }), index("pilot_identity_user_idx").on(t.userId)]);
export const pilotSchools = sqliteTable("pilot_schools", {
  id: text("id").primaryKey(), name: text("name").notNull(), active: integer("active").notNull().default(1),
});
export const pilotMemberships = sqliteTable("pilot_memberships", {
  schoolId: text("school_id").notNull().references(() => pilotSchools.id),
  userId: text("user_id").notNull().references(() => pilotUsers.id), role: text("role").notNull(),
  active: integer("active").notNull().default(1),
}, t => [primaryKey({ columns: [t.schoolId, t.userId] }), index("pilot_membership_user_idx").on(t.userId, t.active),
  check("pilot_membership_role", sql`${t.role} in ('enseignant','eleve','parent','directeur')`)]);
export const pilotClasses = sqliteTable("pilot_classes", {
  id: text("id").primaryKey(), schoolId: text("school_id").notNull().references(() => pilotSchools.id),
  name: text("name").notNull(), active: integer("active").notNull().default(1),
}, t => [uniqueIndex("pilot_class_school_unique").on(t.id, t.schoolId)]);
export const pilotClassMembers = sqliteTable("pilot_class_members", {
  schoolId: text("school_id").notNull(), classId: text("class_id").notNull(), userId: text("user_id").notNull(),
}, t => [primaryKey({ columns: [t.schoolId, t.classId, t.userId] }),
  foreignKey({ columns: [t.classId, t.schoolId], foreignColumns: [pilotClasses.id, pilotClasses.schoolId] }),
  foreignKey({ columns: [t.schoolId, t.userId], foreignColumns: [pilotMemberships.schoolId, pilotMemberships.userId] }),
  index("pilot_class_member_user_idx").on(t.schoolId, t.userId)]);
export const pilotFamilyLinks = sqliteTable("pilot_family_links", {
  schoolId: text("school_id").notNull(), parentId: text("parent_id").notNull(), studentId: text("student_id").notNull(),
  active: integer("active").notNull().default(1),
}, t => [primaryKey({ columns: [t.schoolId, t.parentId, t.studentId] }),
  foreignKey({ columns: [t.schoolId, t.parentId], foreignColumns: [pilotMemberships.schoolId, pilotMemberships.userId] }),
  foreignKey({ columns: [t.schoolId, t.studentId], foreignColumns: [pilotMemberships.schoolId, pilotMemberships.userId] }),
  check("pilot_family_different_users", sql`${t.parentId} <> ${t.studentId}`)]);
export const pilotSessions = sqliteTable("pilot_sessions", {
  tokenHash: text("token_hash").primaryKey(), userId: text("user_id").notNull().references(() => pilotUsers.id),
  csrfToken: text("csrf_token").notNull(), assurance: text("assurance").notNull(),
  createdAt: integer("created_at").notNull(), expiresAt: integer("expires_at").notNull(), revokedAt: integer("revoked_at"),
}, t => [index("pilot_session_user_idx").on(t.userId), index("pilot_session_expiry_idx").on(t.expiresAt),
  check("pilot_session_assurance", sql`${t.assurance} in ('oidc','local_fixture')`)]);
export const pilotAdmins = sqliteTable("pilot_admins", {
  userId: text("user_id").primaryKey().references(() => pilotUsers.id), active: integer("active").notNull().default(1),
});
export const pilotAdminEvents = sqliteTable("pilot_admin_events", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull().references(() => pilotUsers.id),
  action: text("action").notNull(), targetId: text("target_id").notNull(), createdAt: integer("created_at").notNull(),
});
export const pilotAuthFlows = sqliteTable("pilot_auth_flows", {
  stateHash: text("state_hash").primaryKey(), browserHash: text("browser_hash").notNull(),
  verifier: text("verifier").notNull(), nonce: text("nonce").notNull(), expiresAt: integer("expires_at").notNull(),
  requestedRole: text("requested_role"),
  returnPath: text("return_path"),
}, t => [index("pilot_auth_flow_expiry_idx").on(t.expiresAt)]);
export const pilotAuthLimits = sqliteTable("pilot_auth_limits", {
  bucket: text("bucket").primaryKey(), window: integer("window").notNull(), attempts: integer("attempts").notNull(),
}, t => [index("pilot_auth_limits_window_idx").on(t.window)]);
export const pilotAssignments = sqliteTable("pilot_assignments", {
  id: text("id").primaryKey(), schoolId: text("school_id").notNull(), classId: text("class_id").notNull(),
  teacherId: text("teacher_id").notNull(), title: text("title").notNull(), instructions: text("instructions").notNull(),
  dueDate: text("due_date").notNull(), createdAt: integer("created_at").notNull(),
  requestKey: text("request_key").notNull(), requestHash: text("request_hash").notNull(),
}, t => [uniqueIndex("pilot_assignment_id_school").on(t.id,t.schoolId),
  uniqueIndex("pilot_assignment_request_unique").on(t.schoolId,t.teacherId,t.requestKey),
  index("pilot_assignment_class_idx").on(t.schoolId,t.classId,t.createdAt),
  foreignKey({ columns:[t.classId,t.schoolId], foreignColumns:[pilotClasses.id,pilotClasses.schoolId] }),
  foreignKey({ columns:[t.schoolId,t.teacherId], foreignColumns:[pilotMemberships.schoolId,pilotMemberships.userId] })]);
export const pilotSubmissions = sqliteTable("pilot_submissions", {
  id: text("id").primaryKey(), schoolId: text("school_id").notNull(), assignmentId: text("assignment_id").notNull(),
  studentId: text("student_id").notNull(), body: text("body").notNull(), requestHash: text("request_hash").notNull(),
  submittedAt: integer("submitted_at").notNull(),
}, t => [uniqueIndex("pilot_submission_id_school").on(t.id,t.schoolId),
  uniqueIndex("pilot_submission_once").on(t.assignmentId,t.studentId),
  foreignKey({ columns:[t.assignmentId,t.schoolId], foreignColumns:[pilotAssignments.id,pilotAssignments.schoolId] }),
  foreignKey({ columns:[t.schoolId,t.studentId], foreignColumns:[pilotMemberships.schoolId,pilotMemberships.userId] })]);
export const pilotReviews = sqliteTable("pilot_reviews", {
  submissionId: text("submission_id").primaryKey(), schoolId: text("school_id").notNull(), teacherId: text("teacher_id").notNull(),
  score: integer("score").notNull(), feedback: text("feedback").notNull(), requestHash: text("request_hash").notNull(),
  reviewedAt: integer("reviewed_at").notNull(),
}, t => [foreignKey({ columns:[t.submissionId,t.schoolId], foreignColumns:[pilotSubmissions.id,pilotSubmissions.schoolId] }),
  foreignKey({ columns:[t.schoolId,t.teacherId], foreignColumns:[pilotMemberships.schoolId,pilotMemberships.userId] }),
  check("pilot_review_score", sql`${t.score} >= 0 and ${t.score} <= 20`)]);

export const pilotGameProgress = sqliteTable("pilot_game_progress", {
  schoolId: text("school_id").notNull(), studentId: text("student_id").notNull(),
  gameId: text("game_id").notNull(), gridId: text("grid_id").notNull(),
  progressJson: text("progress_json").notNull(), hintCount: integer("hint_count").notNull(),
  revision: integer("revision").notNull(), lastRequestId: text("last_request_id").notNull(),
  lastRequestHash: text("last_request_hash").notNull(), updatedAt: integer("updated_at").notNull(),
}, t => [
  primaryKey({ columns: [t.schoolId, t.studentId, t.gameId, t.gridId] }),
  foreignKey({ columns: [t.schoolId, t.studentId], foreignColumns: [pilotMemberships.schoolId, pilotMemberships.userId] }),
  check("pilot_game_progress_json", sql`json_valid(${t.progressJson}) and json_type(${t.progressJson}) = 'object'`),
  check("pilot_game_progress_hints", sql`${t.hintCount} between 0 and 10000`),
  check("pilot_game_progress_revision", sql`${t.revision} >= 1`),
  check("pilot_game_progress_request", sql`length(${t.lastRequestId}) = 36 and length(${t.lastRequestHash}) = 64`),
]);

export const pilotGameAwards = sqliteTable("pilot_game_awards", {
  schoolId: text("school_id").notNull(), studentId: text("student_id").notNull(),
  gameId: text("game_id").notNull(), gridId: text("grid_id").notNull(),
  xp: integer("xp").notNull(), completedAt: integer("completed_at").notNull(),
}, t => [
  primaryKey({ columns: [t.schoolId, t.studentId, t.gameId, t.gridId] }),
  foreignKey({ columns: [t.schoolId, t.studentId], foreignColumns: [pilotMemberships.schoolId, pilotMemberships.userId] }),
  foreignKey({ columns: [t.schoolId, t.studentId, t.gameId, t.gridId], foreignColumns: [pilotGameProgress.schoolId, pilotGameProgress.studentId, pilotGameProgress.gameId, pilotGameProgress.gridId] }),
  check("pilot_game_award_xp", sql`${t.xp} in (20,35,50)`),
]);

export const pilotMarketAwards = sqliteTable("pilot_market_awards", {
  schoolId: text("school_id").notNull(), studentId: text("student_id").notNull(),
  gameId: text("game_id").notNull(), gridId: text("grid_id").notNull(),
  missionId: text("mission_id").notNull(), missionVersion: integer("mission_version").notNull(),
  rewardType: text("reward_type").notNull(), xp: integer("xp").notNull(), awardedAt: integer("awarded_at").notNull(),
}, t => [
  primaryKey({ columns: [t.schoolId, t.studentId, t.missionId, t.missionVersion, t.rewardType] }),
  foreignKey({ columns: [t.schoolId, t.studentId, t.gameId, t.gridId], foreignColumns: [pilotGameProgress.schoolId, pilotGameProgress.studentId, pilotGameProgress.gameId, pilotGameProgress.gridId] }),
  check("pilot_market_game", sql`${t.gameId} = 'souk-des-mots' and ${t.gridId} = 'v1'`),
  check("pilot_market_reward", sql`(${t.rewardType} = 'mastery' and ${t.xp} = 10) or (${t.rewardType} = 'autonomy' and ${t.xp} = 5)`),
  check("pilot_market_mission_version", sql`${t.missionVersion} >= 1`),
]);

export const pilotQuizAttempts = sqliteTable("pilot_quiz_attempts", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull(), studentId: text("student_id").notNull(),
  gameId: text("game_id").notNull(), contentVersion: text("content_version").notNull(),
  dailyKey: text("daily_key"), questionIdsJson: text("question_ids_json").notNull(),
  stateJson: text("state_json").notNull(), revision: integer("revision").notNull(),
  startRequestId: text("start_request_id").notNull(), startRequestHash: text("start_request_hash").notNull(),
  lastRequestId: text("last_request_id").notNull(), lastRequestHash: text("last_request_hash").notNull(),
  createdAt: integer("created_at").notNull(), expiresAt: integer("expires_at").notNull(),
  completedAt: integer("completed_at"),
}, t => [
  foreignKey({ columns: [t.schoolId, t.studentId], foreignColumns: [pilotMemberships.schoolId, pilotMemberships.userId] }),
  unique().on(t.schoolId, t.studentId, t.gameId, t.startRequestId),
  uniqueIndex("pilot_quiz_daily_once").on(t.schoolId, t.studentId, t.gameId, t.dailyKey).where(sql`${t.dailyKey} is not null`),
  index("pilot_quiz_owner_time").on(t.schoolId, t.studentId, t.gameId, t.createdAt),
  uniqueIndex("pilot_quiz_attempt_owner").on(t.id, t.schoolId, t.studentId, t.gameId),
  check("pilot_quiz_game", sql`${t.gameId} in ('culture-generale','defi-du-jour','mot-juste')`),
  check("pilot_quiz_question_ids_json", sql`json_valid(${t.questionIdsJson}) and json_type(${t.questionIdsJson}) = 'array'`),
  check("pilot_quiz_state_json", sql`json_valid(${t.stateJson}) and json_type(${t.stateJson}) = 'object'`),
  check("pilot_quiz_revision", sql`${t.revision} >= 1`),
  check("pilot_quiz_daily_key", sql`(${t.gameId} = 'defi-du-jour' and ${t.dailyKey} is not null) or (${t.gameId} in ('culture-generale','mot-juste') and ${t.dailyKey} is null)`),
]);

export const pilotQuizAwards = sqliteTable("pilot_quiz_awards", {
  schoolId: text("school_id").notNull(), studentId: text("student_id").notNull(),
  gameId: text("game_id").notNull(), rewardKey: text("reward_key").notNull(),
  attemptId: text("attempt_id").notNull(),
  xp: integer("xp").notNull(), awardedAt: integer("awarded_at").notNull(),
}, t => [
  primaryKey({ columns: [t.schoolId, t.studentId, t.gameId, t.rewardKey] }),
  foreignKey({ columns: [t.attemptId, t.schoolId, t.studentId, t.gameId], foreignColumns: [pilotQuizAttempts.id, pilotQuizAttempts.schoolId, pilotQuizAttempts.studentId, pilotQuizAttempts.gameId] }),
  foreignKey({ columns: [t.schoolId, t.studentId], foreignColumns: [pilotMemberships.schoolId, pilotMemberships.userId] }),
  check("pilot_quiz_award_xp", sql`${t.xp} in (10,20)`),
]);

// Class challenges never reuse demo results or a freely replayable quiz attempt.
export const pilotClassChallenges = sqliteTable('pilot_class_challenges', {
  id:text('id').primaryKey(),schoolId:text('school_id').notNull(),classId:text('class_id').notNull(),
  teacherId:text('teacher_id').notNull(),title:text('title').notNull(),classLabel:text('class_label').notNull(),
  level:text('level').notNull(),theme:text('theme').notNull(),bankId:text('bank_id').notNull(),
  contentVersion:text('content_version').notNull(),questionIdsJson:text('question_ids_json').notNull(),
  createdAt:integer('created_at').notNull(),endAt:integer('end_at').notNull(),closedAt:integer('closed_at'),
  revision:integer('revision').notNull().default(1),createRequestId:text('create_request_id').notNull(),
  createRequestHash:text('create_request_hash').notNull(),closeRequestId:text('close_request_id'),closeRequestHash:text('close_request_hash'),
},t=>[
  uniqueIndex('pilot_class_challenge_scope').on(t.id,t.schoolId,t.classId),
  uniqueIndex('pilot_class_challenge_create_once').on(t.schoolId,t.teacherId,t.createRequestId),
  index('pilot_class_challenge_list').on(t.schoolId,t.classId,t.createdAt,t.id),
  foreignKey({columns:[t.classId,t.schoolId],foreignColumns:[pilotClasses.id,pilotClasses.schoolId]}),
  foreignKey({columns:[t.schoolId,t.teacherId],foreignColumns:[pilotMemberships.schoolId,pilotMemberships.userId]}),
  check('pilot_class_challenge_dates',sql`${t.endAt}>${t.createdAt} AND (${t.closedAt} IS NULL OR ${t.closedAt}>=${t.createdAt})`),
  check('pilot_class_challenge_revision',sql`${t.revision} IN (1,2)`),
  check('pilot_class_challenge_questions',sql`json_valid(${t.questionIdsJson}) AND json_type(${t.questionIdsJson})='array' AND json_array_length(${t.questionIdsJson})=5`),
]);
export const pilotClassAttempts = sqliteTable('pilot_class_attempts', {
  id:text('id').primaryKey(),schoolId:text('school_id').notNull(),classId:text('class_id').notNull(),
  challengeId:text('challenge_id').notNull(),studentId:text('student_id').notNull(),pseudonym:text('pseudonym').notNull(),
  stateJson:text('state_json').notNull(),revision:integer('revision').notNull(),
  startRequestId:text('start_request_id').notNull(),startRequestHash:text('start_request_hash').notNull(),
  lastRequestId:text('last_request_id').notNull(),lastRequestHash:text('last_request_hash').notNull(),
  createdAt:integer('created_at').notNull(),completedAt:integer('completed_at'),
},t=>[
  uniqueIndex('pilot_class_attempt_once').on(t.challengeId,t.studentId),
  uniqueIndex('pilot_class_attempt_alias').on(t.challengeId,t.pseudonym),
  uniqueIndex('pilot_class_attempt_owner').on(t.id,t.schoolId,t.studentId),
  foreignKey({columns:[t.challengeId,t.schoolId,t.classId],foreignColumns:[pilotClassChallenges.id,pilotClassChallenges.schoolId,pilotClassChallenges.classId]}),
  foreignKey({columns:[t.schoolId,t.studentId],foreignColumns:[pilotMemberships.schoolId,pilotMemberships.userId]}),
  check('pilot_class_attempt_state',sql`json_valid(${t.stateJson}) AND json_type(${t.stateJson})='object'`),
  check('pilot_class_attempt_revision',sql`${t.revision} BETWEEN 1 AND 11`),
]);
export const pilotClassAwards = sqliteTable('pilot_class_awards', {
  attemptId:text('attempt_id').notNull(),schoolId:text('school_id').notNull(),studentId:text('student_id').notNull(),
  questionIndex:integer('question_index').notNull(),xp:integer('xp').notNull(),awardedAt:integer('awarded_at').notNull(),
},t=>[
  primaryKey({columns:[t.attemptId,t.questionIndex]}),
  foreignKey({columns:[t.attemptId,t.schoolId,t.studentId],foreignColumns:[pilotClassAttempts.id,pilotClassAttempts.schoolId,pilotClassAttempts.studentId]}),
  index('pilot_class_award_owner').on(t.schoolId,t.studentId,t.awardedAt),
  check('pilot_class_award_value',sql`${t.questionIndex} BETWEEN 0 AND 4 AND ${t.xp}=10`),
]);

export const pilotStudentProfiles = sqliteTable("pilot_student_profiles", {
  schoolId: text("school_id").notNull(), studentId: text("student_id").notNull(),
  avatar: text("avatar").notNull(), updatedAt: integer("updated_at").notNull(),
}, t => [
  primaryKey({ columns:[t.schoolId,t.studentId] }),
  foreignKey({ columns:[t.schoolId,t.studentId], foreignColumns:[pilotMemberships.schoolId,pilotMemberships.userId] }),
  check("pilot_student_avatar", sql`${t.avatar} in ('initials','sparkle','book','trophy','pencil')`),
]);

// No production catalogue seed: the owner must provide and validate the complete manual first.
export const pilotManuals = sqliteTable("pilot_manuals", {
  id: text("id").primaryKey(), title: text("title").notNull(), level: text("level").notNull(),
  active: integer("active").notNull().default(0),
}, t => [check("pilot_manual_active", sql`${t.active} in (0,1)`)]);

// Immutable private file metadata. Local test documents are never remotely readable.
export const pilotManualFiles = sqliteTable('pilot_manual_files', {
  manualId:text('manual_id').primaryKey().references(()=>pilotManuals.id),
  storageKey:text('storage_key').notNull(),sha256:text('sha256').notNull(),
  byteSize:integer('byte_size').notNull(),pageCount:integer('page_count').notNull(),
  scope:text('scope').notNull().default('local_test'),createdAt:integer('created_at').notNull(),
},t=>[
  uniqueIndex('pilot_manual_file_key').on(t.storageKey),
  check('pilot_manual_file_scope',sql`${t.scope}='local_test'`),
  check('pilot_manual_file_size',sql`${t.byteSize}>0 AND ${t.byteSize}<=209715200 AND ${t.pageCount} BETWEEN 1 AND 2000`),
  check('pilot_manual_file_digest',sql`length(${t.sha256})=64 AND ${t.storageKey}=${t.sha256}||'.pdf'`),
]);

export const pilotManualCodes = sqliteTable("pilot_manual_codes", {
  id: text("id").primaryKey(), schoolId: text("school_id").notNull().references(() => pilotSchools.id),
  manualId: text("manual_id").notNull().references(() => pilotManuals.id),
  codeHash: text("code_hash").notNull(), createdBy: text("created_by").notNull().references(() => pilotUsers.id),
  createdAt: integer("created_at").notNull(), expiresAt: integer("expires_at"), revokedAt: integer("revoked_at"),
  studentId: text("student_id"), activatedAt: integer("activated_at"),
}, t => [
  uniqueIndex("pilot_manual_code_hash").on(t.codeHash),
  uniqueIndex("pilot_manual_student_access").on(t.schoolId,t.studentId,t.manualId).where(sql`${t.revokedAt} is null and ${t.studentId} is not null`),
  foreignKey({ columns:[t.schoolId,t.studentId], foreignColumns:[pilotMemberships.schoolId,pilotMemberships.userId] }),
  check("pilot_manual_code_digest", sql`length(${t.codeHash}) = 64`),
  check("pilot_manual_code_claim", sql`(${t.studentId} is null and ${t.activatedAt} is null) or (${t.studentId} is not null and ${t.activatedAt} is not null)`),
]);

export const pilotManualAttempts = sqliteTable("pilot_manual_attempts", {
  schoolId: text("school_id").notNull(), studentId: text("student_id").notNull(),
  bucket: integer("bucket").notNull(), attempts: integer("attempts").notNull(),
}, t => [
  primaryKey({ columns:[t.schoolId,t.studentId] }),
  foreignKey({ columns:[t.schoolId,t.studentId], foreignColumns:[pilotMemberships.schoolId,pilotMemberships.userId] }),
  check("pilot_manual_attempt_bound", sql`${t.attempts} between 1 and 10`),
]);

// Local-only library management. Existing activation rows and files are retained.
export const pilotLibraryDocuments = sqliteTable('pilot_library_documents', {
  manualId:text('manual_id').primaryKey().references(()=>pilotManuals.id),
  revision:integer('revision').notNull(),assignmentMode:text('assignment_mode').notNull(),
  description:text('description').notNull().default(''),
  createdBy:text('created_by').notNull().references(()=>pilotUsers.id),
  createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},t=>[check('pilot_library_revision',sql`${t.revision}>0`),check('pilot_library_mode',sql`${t.assignmentMode} IN ('legacy','explicit')`)]);
export const pilotLibraryAssignments = sqliteTable('pilot_library_assignments', {
  manualId:text('manual_id').notNull().references(()=>pilotManuals.id),schoolId:text('school_id').notNull().references(()=>pilotSchools.id),
  active:integer('active').notNull(),updatedBy:text('updated_by').notNull().references(()=>pilotUsers.id),updatedAt:integer('updated_at').notNull(),
},t=>[primaryKey({columns:[t.manualId,t.schoolId]}),check('pilot_library_assignment_active',sql`${t.active} IN (0,1)`)]);
export const pilotLibraryVersions = sqliteTable('pilot_library_versions', {
  manualId:text('manual_id').notNull().references(()=>pilotManuals.id),sha256:text('sha256').notNull(),versionNo:integer('version_no').notNull(),
  storageKey:text('storage_key').notNull(),byteSize:integer('byte_size').notNull(),pageCount:integer('page_count').notNull(),
  note:text('note').notNull().default(''),createdBy:text('created_by').references(()=>pilotUsers.id),createdAt:integer('created_at').notNull(),
},t=>[primaryKey({columns:[t.manualId,t.sha256]}),uniqueIndex('pilot_library_version_number').on(t.manualId,t.versionNo),
  check('pilot_library_version_file',sql`length(${t.sha256})=64 AND ${t.storageKey}=${t.sha256}||'.pdf' AND ${t.byteSize} BETWEEN 1 AND 209715200 AND ${t.pageCount} BETWEEN 1 AND 2000 AND ${t.versionNo}>0`)]);
export const pilotLibraryOperations = sqliteTable('pilot_library_operations', {
  id:text('id').primaryKey(),actorId:text('actor_id').notNull().references(()=>pilotUsers.id),
  manualId:text('manual_id').notNull(),requestHash:text('request_hash').notNull(),state:text('state').notNull(),
  resultJson:text('result_json').notNull(),createdAt:integer('created_at').notNull(),
},t=>[check('pilot_library_operation_hash',sql`length(${t.requestHash})=64`),check('pilot_library_operation_state',sql`${t.state} IN ('applying','committed')`),check('pilot_library_operation_result',sql`json_valid(${t.resultJson})`)]);
