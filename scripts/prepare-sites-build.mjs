#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");
const migrations = path.join(root, "drizzle");

for (const file of [index, worker, hosting, migrations]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

mkdirSync(path.join(dist, "server"), { recursive: true });
mkdirSync(path.join(dist, ".openai"), { recursive: true });
copyFileSync(worker, path.join(dist, "server", "index.js"));
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));
const distMigrations = path.join(dist, ".openai", "drizzle");
rmSync(distMigrations, { recursive: true, force: true });
cpSync(migrations, distMigrations, { recursive: true });

// Keep the editable Pen export and PNG masters in `public/`, but do not ship
// those heavy reference files with the React prototype.
const referenceOnlyFiles = [
  "pencil-export.html",
  "prototype-config.js",
  "prototype.css",
  "prototype.js",
  ...[
    "generated-1773971687495.png",
    "generated-1773971894915.png",
    "generated-1774007656775.png",
    "generated-1774007681359.png",
    "generated-1774007817252.png",
    "generated-1774007838586.png",
    "generated-1774018325276.png",
    "generated-1774018768922.png",
    "generated-1774018865796.png",
    "generated-1774018887348.png",
    "jet-dencre-logo-horizontal-light.png",
    "jet-dencre-logo-vertical-dark.png",
    "jet-dencre-monogram-light.png",
  ].map((name) => path.join("assets", name)),
];

let pruned = 0;
for (const relativePath of referenceOnlyFiles) {
  const target = path.resolve(dist, "client", relativePath);
  const clientRoot = path.resolve(dist, "client") + path.sep;
  if (!target.startsWith(clientRoot)) throw new Error(`Unsafe build prune target: ${target}`);
  if (existsSync(target)) {
    rmSync(target);
    pruned += 1;
  }
}

console.log(`Prepared Sites build and removed ${pruned} reference-only files.`);
