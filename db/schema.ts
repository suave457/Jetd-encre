import { check, foreignKey, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
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
