import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
