// Offline verifier only. Never import this Node-only module from the application or Worker.
import { DatabaseSync, constants as sqlite } from "node:sqlite";
import { closeSync, lstatSync, mkdtempSync, openSync, readSync, readFileSync, readdirSync, realpathSync, rmdirSync, unlinkSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const PROJECT = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const MIGRATIONS = new URL("../drizzle/", import.meta.url);
const MAX_BYTES = 32 * 1024 * 1024;
const METADATA_TABLES = new Set(["d1_migrations", "__drizzle_migrations", "__pilot_local_migrations", "_cf_KV", "sqlite_sequence"]);
const SAFE_FUNCTIONS = new Set(["json_valid", "json_type", "json_array_length", "length", "current_timestamp"]);
const MESSAGES = {
  input_invalid: "Fournissez un fichier SQL normal, existant et non vide, de 32 Mio au maximum.",
  reference_invalid: "La référence doit être le nom exact d’une migration locale existante, sans chemin ni option supplémentaire.",
  sql_not_supported: "Cet export contient du SQL hors du format autorisé. Aucune base existante n’a été modifiée.",
  runtime_unavailable: "Node.js 24.12 ou plus récent, avec les protections SQLite requises, est nécessaire.",
  temporary_location_rejected: "Le dossier temporaire du système doit se trouver hors du projet.",
  restore_failed: "La copie temporaire n’a pas pu être restaurée. Le détail SQL est volontairement masqué.",
  cleanup_failed: "La suppression de la copie temporaire n’a pas été confirmée.",
  verification_failed: "La copie restaurée ne satisfait pas tous les contrôles.",
};

class BackupError extends Error {
  constructor(code) { super(MESSAGES[code]); this.code = code; }
}
const reject = (code) => { throw new BackupError(code); };
const inside = (root, path) => { const part = relative(root, path); return part === "" || (!part.startsWith(`..${sep}`) && part !== ".." && !isAbsolute(part)); };
const quoteIdentifier = (name) => `"${name.replaceAll('"', '""')}"`;

function readBoundedSql(path) {
  if (typeof path !== "string" || extname(path).toLowerCase() !== ".sql") reject("input_invalid");
  let fd;
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > MAX_BYTES) reject("input_invalid");
    fd = openSync(path, "r");
    const chunks = [];
    let length = 0;
    while (true) {
      const chunk = Buffer.alloc(Math.min(65536, MAX_BYTES + 1 - length));
      const count = readSync(fd, chunk);
      if (!count) break;
      length += count;
      if (length > MAX_BYTES) reject("input_invalid");
      chunks.push(chunk.subarray(0, count));
    }
    return { sql: new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)), bytes: length };
  } catch (error) {
    if (error instanceof BackupError) throw error;
    reject("input_invalid");
  } finally { if (fd !== undefined) closeSync(fd); }
}

// Quoted values and comments never become instruction keywords or statement separators.
function statements(sql) {
  const result = [];
  let tokens = [], start = 0, index = 0;
  while (index < sql.length) {
    const char = sql[index];
    if (/\s/.test(char)) { index += 1; continue; }
    if (sql.startsWith("--", index)) { const end = sql.indexOf("\n", index + 2); index = end < 0 ? sql.length : end + 1; continue; }
    if (sql.startsWith("/*", index)) { const end = sql.indexOf("*/", index + 2); if (end < 0) reject("sql_not_supported"); index = end + 2; continue; }
    if (char === ";") {
      if (tokens.length) result.push({ sql: sql.slice(start, index + 1), tokens });
      tokens = []; index += 1; start = index; continue;
    }
    if (["'", '"', "`", "["].includes(char)) {
      const endQuote = char === "[" ? "]" : char;
      let value = "", closed = false;
      index += 1;
      while (index < sql.length) {
        if (sql[index] === endQuote) {
          if (char !== "[" && sql[index + 1] === endQuote) { value += endQuote; index += 2; continue; }
          index += 1; closed = true; break;
        }
        value += sql[index++];
      }
      if (!closed) reject("sql_not_supported");
      tokens.push({ kind: char === "'" ? "string" : "identifier", value });
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z_0-9$]*/.exec(sql.slice(index));
    if (word) { tokens.push({ kind: "word", value: word[0].toUpperCase() }); index += word[0].length; continue; }
    const number = /^(?:0[xX][0-9A-Fa-f]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/.exec(sql.slice(index));
    if (number) { tokens.push({ kind: "number", value: number[0] }); index += number[0].length; continue; }
    tokens.push({ kind: "symbol", value: char }); index += 1;
  }
  if (tokens.length) result.push({ sql: sql.slice(start), tokens });
  if (result.length === 0 || result.length > 200000) reject("sql_not_supported");
  return result;
}

function supported(statement) {
  const tokens = statement.tokens;
  const word = (index, value) => tokens[index]?.kind === "word" && tokens[index].value === value;
  if (word(0, "PRAGMA")) {
    if (tokens.length === 4 && ["FOREIGN_KEYS", "DEFER_FOREIGN_KEYS"].includes(tokens[1]?.value)
      && tokens[2]?.value === "=" && ["0", "1", "ON", "OFF", "TRUE", "FALSE"].includes(tokens[3]?.value)) return false;
    reject("sql_not_supported");
  }
  if ((word(0, "BEGIN") || word(0, "COMMIT") || word(0, "END"))
    && (tokens.length === 1 || (tokens.length === 2 && word(1, "TRANSACTION")))) return false;
  // D1 exports reset SQLite's AUTOINCREMENT bookkeeping before restoring its values.
  // This exact metadata-only statement is allowed solely in the temporary copy.
  if (word(0, "DELETE") && word(1, "FROM") && tokens.length === 3
    && ["word", "identifier"].includes(tokens[2].kind) && tokens[2].value.toLowerCase() === "sqlite_sequence") return true;
  if (word(0, "CREATE") && (word(1, "TABLE") || word(1, "INDEX") || (word(1, "UNIQUE") && word(2, "INDEX")))) {
    if (tokens.some((token) => token.kind === "word" && ["SELECT", "VIRTUAL", "TRIGGER", "VIEW"].includes(token.value))) reject("sql_not_supported");
    return true;
  }
  if (word(0, "INSERT") && word(1, "INTO") && ["word", "identifier"].includes(tokens[2]?.kind)) {
    let index = 3;
    if (tokens[index]?.value === "(") {
      index += 1;
      while (index < tokens.length && tokens[index].value !== ")") {
        if (!["word", "identifier"].includes(tokens[index].kind) && tokens[index].value !== ",") reject("sql_not_supported");
        index += 1;
      }
      index += 1;
    }
    if (!word(index, "VALUES")) reject("sql_not_supported");
    const values = tokens.slice(index + 1);
    if (!values.length || values.some((token) => !["string", "number"].includes(token.kind)
      && !(token.kind === "word" && ["NULL", "TRUE", "FALSE", "X"].includes(token.value))
      && !(token.kind === "symbol" && ["(", ")", ",", "-", "+"].includes(token.value)))) reject("sql_not_supported");
    return true;
  }
  reject("sql_not_supported");
}

function canonicalSchema(sql) {
  const tokens = statements(sql)[0].tokens;
  return JSON.stringify(tokens.filter((token, index) => !(token.kind === "word" && (
    (token.value === "IF" && tokens[index + 1]?.value === "NOT" && tokens[index + 2]?.value === "EXISTS")
    || (token.value === "NOT" && tokens[index - 1]?.value === "IF" && tokens[index + 1]?.value === "EXISTS")
    || (token.value === "EXISTS" && tokens[index - 2]?.value === "IF" && tokens[index - 1]?.value === "NOT")
  ))).map((token) => token.kind === "string" ? ["literal", token.value] : token.value.toUpperCase()));
}

function referenceSchema(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)
    || Object.keys(options).some((key) => key !== "throughMigration")) reject("reference_invalid");
  const available = readdirSync(MIGRATIONS).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  const explicit = Object.hasOwn(options, "throughMigration");
  if (explicit && (typeof options.throughMigration !== "string" || !available.includes(options.throughMigration))) reject("reference_invalid");
  const migrations = explicit ? available.slice(0, available.indexOf(options.throughMigration) + 1) : available;
  const db = new DatabaseSync(":memory:");
  try {
    for (const name of migrations) db.exec(readFileSync(new URL(name, MIGRATIONS), "utf8"));
    const objects = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    return { migrations, objects, coverage: { mode: explicit ? "explicit-prefix" : "current", throughMigration: migrations.at(-1), includesAllLocalMigrations: migrations.length === available.length }, tables: new Set(objects.filter((item) => item.type === "table").map((item) => item.name)) };
  } finally { db.close(); }
}

function restoreAuthorizer(tables) {
  const allowedTables = new Set([...tables, ...METADATA_TABLES, "sqlite_master", "sqlite_schema"]);
  return (action, arg1, arg2, database, trigger) => {
    if (trigger || (database && database !== "main")) return sqlite.SQLITE_DENY;
    if (action === sqlite.SQLITE_FUNCTION) return SAFE_FUNCTIONS.has(arg2?.toLowerCase()) ? sqlite.SQLITE_OK : sqlite.SQLITE_DENY;
    if ([sqlite.SQLITE_CREATE_TABLE, sqlite.SQLITE_INSERT, sqlite.SQLITE_READ].includes(action)) return allowedTables.has(arg1) ? sqlite.SQLITE_OK : sqlite.SQLITE_DENY;
    if (action === sqlite.SQLITE_UPDATE) return ["sqlite_master", "sqlite_schema"].includes(arg1) ? sqlite.SQLITE_OK : sqlite.SQLITE_DENY;
    if (action === sqlite.SQLITE_DELETE) return arg1 === "sqlite_sequence" ? sqlite.SQLITE_OK : sqlite.SQLITE_DENY;
    if (action === sqlite.SQLITE_CREATE_INDEX) return tables.has(arg2) || METADATA_TABLES.has(arg2) ? sqlite.SQLITE_OK : sqlite.SQLITE_DENY;
    if ([sqlite.SQLITE_SELECT, sqlite.SQLITE_REINDEX].includes(action)) return sqlite.SQLITE_OK;
    return sqlite.SQLITE_DENY;
  };
}

function inspectRestored(db, reference, inputBytes, statementCount) {
  const actual = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all();
  const byName = new Map(actual.map((item) => [`${item.type}:${item.name}`, item]));
  let missingObjects = 0, mismatchedObjects = 0;
  for (const expected of reference.objects) {
    const found = byName.get(`${expected.type}:${expected.name}`);
    if (!found) missingObjects += 1;
    else if (canonicalSchema(found.sql) !== canonicalSchema(expected.sql)) mismatchedObjects += 1;
  }
  const unexpectedObjects = actual.filter((item) => !METADATA_TABLES.has(item.tbl_name)
    && !reference.objects.some((expected) => expected.type === item.type && expected.name === item.name)).length;
  const migrationTable = actual.find((item) => item.type === "table" && item.name === "d1_migrations");
  let migrationNames = [];
  if (migrationTable && db.prepare("PRAGMA table_info(d1_migrations)").all().some((column) => column.name === "name")) {
    migrationNames = db.prepare("SELECT name FROM d1_migrations").all().map((row) => row.name);
  }
  const missingMigrations = reference.migrations.filter((name) => !migrationNames.includes(name)).length;
  const unexpectedMigrations = migrationNames.filter((name) => !reference.migrations.includes(name)).length;
  const integrity = db.prepare("PRAGMA integrity_check").all();
  const integrityIssues = integrity.filter((row) => Object.values(row)[0] !== "ok").length;
  const foreignKeyViolations = db.prepare("PRAGMA foreign_key_check").all().length;
  const rows = {};
  for (const table of reference.tables) if (byName.has(`table:${table}`)) rows[table] = db.prepare(`SELECT count(*) total FROM ${quoteIdentifier(table)}`).get().total;
  const checks = { integrity: integrityIssues === 0, foreignKeys: foreignKeyViolations === 0,
    schema: missingObjects === 0 && mismatchedObjects === 0 && unexpectedObjects === 0,
    migrations: missingMigrations === 0 && unexpectedMigrations === 0 && migrationNames.length === reference.migrations.length };
  return { ok: Object.values(checks).every(Boolean), reference: reference.coverage, checks,
    counts: { inputBytes, statements: statementCount, expectedTables: reference.tables.size,
      restoredTables: actual.filter((item) => item.type === "table").length, missingObjects, mismatchedObjects, unexpectedObjects,
      expectedMigrations: reference.migrations.length, restoredMigrations: migrationNames.length, missingMigrations,
      unexpectedMigrations, integrityIssues, foreignKeyViolations, rows } };
}

export function verifyPilotBackup(inputPath, options = {}) {
  let database, directory, temporaryRoot, result;
  try {
    if (typeof DatabaseSync.prototype.setAuthorizer !== "function" || typeof DatabaseSync.prototype.enableDefensive !== "function") reject("runtime_unavailable");
    const input = readBoundedSql(inputPath);
    const restore = statements(input.sql).filter(supported);
    const reference = referenceSchema(options);
    temporaryRoot = realpathSync(tmpdir());
    if (inside(PROJECT, temporaryRoot)) reject("temporary_location_rejected");
    directory = mkdtempSync(join(temporaryRoot, "jde-pilot-backup-"));
    if (!inside(temporaryRoot, realpathSync(directory)) || inside(PROJECT, realpathSync(directory))) reject("temporary_location_rejected");
    database = new DatabaseSync(join(directory, "restore.sqlite"), { enableForeignKeyConstraints: false, allowExtension: false, enableDoubleQuotedStringLiterals: false });
    database.enableDefensive(true);
    database.exec("PRAGMA trusted_schema=OFF; PRAGMA temp_store=MEMORY; PRAGMA journal_mode=MEMORY; PRAGMA max_page_count=16384; BEGIN TRANSACTION;");
    database.setAuthorizer(restoreAuthorizer(reference.tables));
    for (const statement of restore) database.exec(statement.sql);
    database.setAuthorizer(null);
    database.exec("COMMIT; PRAGMA foreign_keys=ON;");
    result = inspectRestored(database, reference, input.bytes, restore.length);
    if (!result.ok) result.error = { code: "verification_failed", message: MESSAGES.verification_failed };
  } catch (error) {
    const code = error instanceof BackupError ? error.code : "restore_failed";
    result = { ok: false, error: { code, message: MESSAGES[code] } };
  } finally {
    try {
      if (database?.isOpen) { database.setAuthorizer(null); if (database.isTransaction) database.exec("ROLLBACK"); database.close(); }
      if (directory) {
        if (!temporaryRoot || !inside(temporaryRoot, directory) || !basename(directory).startsWith("jde-pilot-backup-")) throw new Error();
        for (const name of ["restore.sqlite", "restore.sqlite-journal", "restore.sqlite-wal", "restore.sqlite-shm"]) {
          try { unlinkSync(join(directory, name)); } catch (error) { if (error.code !== "ENOENT") throw error; }
        }
        rmdirSync(directory);
      }
      result.checks = { ...result.checks, temporaryCopyRemoved: true };
    } catch { result = { ok: false, error: { code: "cleanup_failed", message: MESSAGES.cleanup_failed }, checks: { temporaryCopyRemoved: false } }; }
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (![1, 3].includes(args.length) || args[0].startsWith("--") || (args.length === 3 && args[1] !== "--through-migration")) {
    process.stdout.write("Usage : node scripts/verify-pilot-backup.mjs <export-d1.sql> [--through-migration <nom-exact.sql>]\n");
    process.exitCode = 2;
  } else {
    const result = verifyPilotBackup(args[0], args.length === 3 ? { throughMigration: args[2] } : {});
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.ok ? 0 : result.error?.code === "verification_failed" ? 1 : 2;
  }
}
