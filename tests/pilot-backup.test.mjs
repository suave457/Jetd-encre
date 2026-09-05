import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, ftruncateSync, mkdtempSync, openSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { openPilotDatabase, seedLocalPilot } from "../scripts/pilot-local-store.mjs";
import { verifyPilotBackup } from "../scripts/verify-pilot-backup.mjs";

const project = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(new URL("../scripts/verify-pilot-backup.mjs", import.meta.url));
const privateText = "Texte privé fictif ; ATTACH DATABASE 'ne-rien-ouvrir' ; -- élève à préserver";
const literal = (value) => value === null ? "NULL" : typeof value === "string" ? `'${value.replaceAll("'", "''")}'` : String(value);
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;

function files(t) {
  const directory = mkdtempSync(join(tmpdir(), "jde-backup-fixture-"));
  t.after(() => { for (const name of readdirSync(directory)) unlinkSync(join(directory, name)); rmdirSync(directory); });
  return { directory, create(name, text) { const path = join(directory, name); writeFileSync(path, text, { flag: "wx" }); return path; } };
}

function exportFixture({ mutate, omitMigration } = {}) {
  const store = openPilotDatabase();
  try {
    seedLocalPilot(store.sqlite);
    store.sqlite.prepare("UPDATE pilot_users SET display_name=? WHERE id='pilot-a-student'").run(privateText);
    store.sqlite.exec("CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)");
    for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
      if (name !== omitMigration) store.sqlite.prepare("INSERT INTO d1_migrations(name) VALUES (?)").run(name);
    }
    mutate?.(store.sqlite);
    const objects = store.sqlite.prepare("SELECT type,name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name!='__pilot_local_migrations' ORDER BY type DESC,name").all();
    const output = ["PRAGMA defer_foreign_keys=TRUE;", "BEGIN TRANSACTION;"];
    for (const object of objects) {
      output.push(`${object.sql};`);
      if (object.type === "table") {
        const columns = store.sqlite.prepare(`PRAGMA table_info(${identifier(object.name)})`).all().map((column) => column.name);
        for (const row of store.sqlite.prepare(`SELECT * FROM ${identifier(object.name)}`).all()) {
          output.push(`INSERT INTO ${identifier(object.name)} (${columns.map(identifier).join(",")}) VALUES (${columns.map((column) => literal(row[column])).join(",")});`);
        }
      }
    }
    output.push("COMMIT;");
    return output.join("\n");
  } finally { store.close(); }
}

test("sauvegarde : export SQL complet restauré, schéma/migrations/FK/intégrité vérifiés puis copie supprimée", (t) => {
  const fixture = files(t);
  const path = fixture.create("complete.sql", exportFixture());
  const before = createHash("sha256").update(readFileSync(path)).digest("hex");
  const temporaryBefore = readdirSync(tmpdir()).filter((name) => name.startsWith("jde-pilot-backup-"));
  const result = verifyPilotBackup(path);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.checks, { integrity: true, foreignKeys: true, schema: true, migrations: true, temporaryCopyRemoved: true });
  assert.equal(result.counts.rows.pilot_users, 8);
  assert.equal(result.counts.rows.pilot_game_progress, 0);
  assert.equal(result.counts.rows.pilot_game_awards, 0);
  assert.equal(result.counts.restoredMigrations, result.counts.expectedMigrations);
  assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), before);
  assert.deepEqual(readdirSync(tmpdir()).filter((name) => name.startsWith("jde-pilot-backup-")), temporaryBefore);
  assert.equal(JSON.stringify(result).includes(privateText), false);
});

test("sauvegarde : suppression d'une migration ou d'une table de jeu détectée", (t) => {
  const fixture = files(t);
  const old = verifyPilotBackup(fixture.create("missing-migration.sql", exportFixture({ omitMigration: "0004_pilot_mots_fleches.sql" })));
  assert.equal(old.ok, false);
  assert.equal(old.checks.migrations, false);
  assert.equal(old.counts.missingMigrations, 1);
  const missing = exportFixture({ mutate(db) { db.exec("DROP TABLE pilot_game_awards"); } });
  const result = verifyPilotBackup(fixture.create("missing-game.sql", missing));
  assert.equal(result.ok, false);
  assert.equal(result.checks.schema, false);
  assert.equal(result.counts.missingObjects, 1);
  assert.equal(result.checks.temporaryCopyRemoved, true);
});

test("sauvegarde : dérive du schéma et lien étranger cassé signalés sans révéler les lignes", (t) => {
  const fixture = files(t);
  const drift = exportFixture().replace("`display_name` text NOT NULL", "`display_name` text");
  const altered = verifyPilotBackup(fixture.create("schema-drift.sql", drift));
  assert.equal(altered.checks.schema, false, JSON.stringify(altered));
  assert.equal(altered.counts.mismatchedObjects, 1);
  const orphan = exportFixture({ mutate(db) {
    db.exec("PRAGMA foreign_keys=OFF");
    db.prepare("INSERT INTO pilot_memberships(school_id,user_id,role) VALUES ('pilot-school-a',?,'eleve')").run(privateText);
  } });
  const broken = verifyPilotBackup(fixture.create("foreign-key.sql", orphan));
  assert.equal(broken.ok, false);
  assert.equal(broken.checks.foreignKeys, false);
  assert.equal(broken.counts.foreignKeyViolations, 1);
  assert.equal(JSON.stringify(broken).includes(privateText), false);
});

test("sauvegarde : ATTACH, VACUUM, extensions et SQL actif rejetés sans toucher un fichier existant", (t) => {
  const fixture = files(t);
  const protectedPath = fixture.create("protected.sqlite", "FICHIER EXISTANT À PRÉSERVER");
  const escaped = protectedPath.replaceAll("'", "''");
  const attacks = [
    `ATTACH DATABASE '${escaped}' AS other;`,
    `VACUUM INTO '${escaped}';`,
    "PRAGMA writable_schema=ON;",
    "PRAGMA temp_store_directory='private-directory';",
    "SELECT load_extension('private-extension');",
    "CREATE VIRTUAL TABLE pilot_users USING fts5(name);",
    "CREATE VIEW pilot_users AS SELECT 1;",
    "CREATE TABLE pilot_users AS SELECT 1;",
    "CREATE TRIGGER bad AFTER INSERT ON pilot_users BEGIN SELECT 1; END;",
    "INSERT INTO pilot_users SELECT 1;",
    "INSERT INTO pilot_users VALUES(load_extension('private-extension'));",
    "/* innocent */ ATTaCH /* comment */ DATABASE 'private-name' AS copied;",
  ];
  for (const [index, sql] of attacks.entries()) {
    const result = verifyPilotBackup(fixture.create(`attack-${index}.sql`, sql));
    assert.equal(result.ok, false, String(index));
    assert.equal(result.error.code, "sql_not_supported", String(index));
    assert.equal(result.checks.temporaryCopyRemoved, true);
    assert.equal(JSON.stringify(result).includes(escaped), false);
  }
  assert.equal(readFileSync(protectedPath, "utf8"), "FICHIER EXISTANT À PRÉSERVER");
});

test("sauvegarde : l'autoriseur SQLite bloque aussi les fonctions cachées dans un CHECK", (t) => {
  const fixture = files(t);
  const text = "CREATE TABLE pilot_users (id TEXT CHECK(load_extension('secret-extension'))); INSERT INTO pilot_users VALUES ('secret-pupil');";
  const result = verifyPilotBackup(fixture.create("hidden-function.sql", text));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "restore_failed");
  assert.equal(result.checks.temporaryCopyRemoved, true);
  assert.equal(JSON.stringify(result).includes("secret-"), false);
});

test("sauvegarde : erreur SQL nettoyée, fichiers invalides ou trop volumineux refusés", (t) => {
  const fixture = files(t);
  const result = verifyPilotBackup(fixture.create("invalid.sql", "INSERT INTO pilot_users VALUES ('private-pupil');"));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "restore_failed");
  assert.equal(JSON.stringify(result).includes("private-pupil"), false);
  for (const path of [fixture.create("empty.sql", ""), fixture.create("wrong.sqlite", "SQLite format 3"), join(fixture.directory, "absent.sql")]) {
    assert.equal(verifyPilotBackup(path).error.code, "input_invalid");
  }
  const huge = fixture.create("huge.sql", "");
  const fd = openSync(huge, "r+");
  try { ftruncateSync(fd, 32 * 1024 * 1024 + 1); } finally { closeSync(fd); }
  assert.equal(verifyPilotBackup(huge).error.code, "input_invalid");
});

test("sauvegarde : CLI sans contenu privé, code de sortie contrôlé et TMP dans le projet refusé", (t) => {
  const fixture = files(t);
  const path = fixture.create("cli.sql", exportFixture());
  const success = spawnSync(process.execPath, [cli, path], { encoding: "utf8", timeout: 15000 });
  assert.equal(success.status, 0, success.stdout + success.stderr);
  assert.equal(JSON.parse(success.stdout).ok, true);
  assert.equal(success.stdout.includes(privateText), false);
  assert.equal(success.stderr, "");
  const rejected = spawnSync(process.execPath, [cli, path], { encoding: "utf8", timeout: 15000,
    env: { ...process.env, TEMP: project, TMP: project, TMPDIR: project } });
  assert.equal(rejected.status, 2);
  assert.equal(JSON.parse(rejected.stdout).error.code, "temporary_location_rejected");
  assert.equal(rejected.stdout.includes(project), false);
  const extraArgument = spawnSync(process.execPath, [cli, path, "--output", join(fixture.directory, "protected.sqlite")], { encoding: "utf8", timeout: 15000 });
  assert.equal(extraArgument.status, 2);
});
