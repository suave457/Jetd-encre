#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

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
// Bundle the entire Worker, including OIDC; the hosted artifact has no node_modules.
await build({ configFile: false, publicDir: false, ssr: { target: "webworker", noExternal: true },
  build: { outDir: path.join(dist,"server"), emptyOutDir: true, ssr: worker, target: "es2022", minify: true,
    rollupOptions: { output: { format: "es", entryFileNames: "index.js" } } } });
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));
const distMigrations = path.join(dist, ".openai", "drizzle");
if (!path.resolve(distMigrations).startsWith(path.resolve(root, "dist") + path.sep)) throw new Error("Unsafe migration build target");
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

for (const relativePath of ["assets/jet-dencre-logo-vertical-dark.png", "assets/jet-dencre-monogram-light.png", "games/projet-debat/embedded-init.js"]) {
  if (!existsSync(path.join(dist, "client", relativePath))) throw new Error(`Missing application asset: ${relativePath}`);
}
for (const relativePath of [".local-media", "__local-media", ".local-data"]) {
  if (existsSync(path.join(dist, "client", relativePath))) throw new Error("Private local media must never be packaged");
}

console.log(`Prepared Sites build and removed ${pruned} reference-only files.`);
