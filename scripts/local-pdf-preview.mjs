import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";

const PDF_ROUTE = "/__local-media/momo-chapitre-1.pdf";
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function createLocalPdfMiddleware(root) {
  const source = path.resolve(root, ".local-media", "momo-chapitre-1.pdf");
  return async (request, response, next) => {
    const pathname = String(request.url || "").split("?", 1)[0];
    if (!pathname.startsWith("/__local-media")) return next();
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    const end = (status, message) => { response.statusCode = status; response.end(message); };
    if (pathname !== PDF_ROUTE) return end(404, "Document local introuvable.");
    if (!LOOPBACK.has(request.socket?.remoteAddress)) return end(403, "Aperçu réservé à cet ordinateur.");
    let requestUrl;
    try { requestUrl = new URL(request.url, `http://${request.headers.host}`); } catch { return end(400, "Requête invalide."); }
    if (!["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname)) return end(403, "Hôte local requis.");
    if (request.headers.origin && request.headers.origin !== requestUrl.origin) return end(403, "Origine refusée.");
    if (!["GET", "HEAD"].includes(request.method)) { response.setHeader("Allow", "GET, HEAD"); return end(405, "Méthode indisponible."); }
    try {
      const actual = await realpath(source);
      if (actual !== source) return end(403, "Le document doit rester dans le dossier local prévu.");
      const file = await stat(actual);
      if (!file.isFile()) return end(404, "Document local introuvable.");
      let start = 0; let finish = file.size - 1;
      const range = request.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) { response.setHeader("Content-Range", `bytes */${file.size}`); return end(416, "Plage invalide."); }
        start = match[1] ? Number(match[1]) : Math.max(0, file.size - Number(match[2]));
        finish = match[1] && match[2] ? Math.min(Number(match[2]), finish) : finish;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(finish) || start > finish || start >= file.size || (match[1] === "" && Number(match[2]) === 0)) {
          response.setHeader("Content-Range", `bytes */${file.size}`); return end(416, "Plage invalide.");
        }
        response.statusCode = 206;
        response.setHeader("Content-Range", `bytes ${start}-${finish}/${file.size}`);
      }
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader("Content-Disposition", 'inline; filename="momo-chapitre-1.pdf"');
      response.setHeader("Accept-Ranges", "bytes");
      response.setHeader("Content-Length", finish - start + 1);
      if (request.method === "HEAD") return response.end();
      const stream = createReadStream(actual, { start, end: finish });
      stream.on("error", () => response.destroy());
      response.on("close", () => stream.destroy());
      stream.pipe(response);
    } catch {
      end(404, "Le PDF de test n’est pas disponible sur cet ordinateur.");
    }
  };
}

export function localPdfPreview() {
  return {
    name: "jet-dencre-local-pdf-preview",
    apply: "serve",
    configureServer(server) { server.middlewares.use(createLocalPdfMiddleware(server.config.root)); },
  };
}
