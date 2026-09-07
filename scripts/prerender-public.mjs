import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createServer, loadEnv } from "vite";
import { PUBLIC_PREVIEW_PATHS, getPageMetadata, getSiteOrigin, isPublicIndexingEnabled, buildPublicSitemap, buildPublicRobots } from "../src/publicContent.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const client = join(root, "dist", "client");
const template = await readFile(join(client, "index.html"), "utf8");
if (!template.includes('<div id="root"></div>')) throw new Error("Rebuild before prerender: missing empty application root.");
const environment = { ...loadEnv("production", root, "VITE_"), ...process.env };
const origin = getSiteOrigin(environment.VITE_PUBLIC_SITE_URL);
const indexable = isPublicIndexingEnabled({ origin, indexable: environment.VITE_PUBLIC_INDEXING_ENABLED === "true" });
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const server = await createServer({ root, mode: "production", server: { middlewareMode: true, hmr: false, watch: null, preTransformRequests: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom" });
try {
  const { PublicPreview } = await server.ssrLoadModule("/src/App.jsx");
  for (const path of PUBLIC_PREVIEW_PATHS) {
    const metadata = getPageMetadata(path, { origin, indexable });
    const markup = renderToString(createElement(PublicPreview, { path }));
    if (!markup.includes("<h1") || !markup.includes("<main")) throw new Error("Incomplete public prerender: " + path);
    let html = template.replace('<div id="root"></div>', '<div id="root" data-prerendered="true">' + markup + "</div><!--jde-prerender-end-->")
      .replace(/<title>[\s\S]*?<\/title>/, "<title>" + escape(metadata.title) + "</title>")
      .replace(/(<meta name="description" content=")[^"]*(")/, "$1" + escape(metadata.description) + "$2")
      .replace(/(<meta name="robots" content=")[^"]*(")/, "$1" + metadata.robots + "$2");
    for (const key of ["og:title", "twitter:title"]) html = html.replace(new RegExp('(<meta (?:property|name)="' + key + '" content=")[^"]*(")'), "$1" + escape(metadata.title) + "$2");
    for (const key of ["og:description", "twitter:description"]) html = html.replace(new RegExp('(<meta (?:property|name)="' + key + '" content=")[^"]*(")'), "$1" + escape(metadata.description) + "$2");
    if (metadata.canonical) html = html.replace("</head>", '<link rel="canonical" href="' + escape(metadata.canonical) + '" />\n<meta property="og:url" content="' + escape(metadata.canonical) + '" />\n</head>');
    const file = join(client, path === "/" ? "index.html" : path.slice(1) + "/index.html");
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
  }
  await writeFile(join(client, "sitemap.xml"), buildPublicSitemap({ origin, indexable }));
  await writeFile(join(client, "robots.txt"), buildPublicRobots({ origin, indexable }));
  console.log("Public prerender: " + PUBLIC_PREVIEW_PATHS.length + " pages; indexing " + (indexable ? "enabled" : "disabled (demonstration)") + ".");
} finally {
  await server.close();
}
