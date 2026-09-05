import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { mkdtemp, mkdir, writeFile, unlink, rmdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createLocalPdfMiddleware } from "../scripts/local-pdf-preview.mjs";

test("local PDF preview serves only its exact loopback route, including bounded ranges", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jet-local-pdf-test-"));
  const folder = path.join(root, ".local-media");
  const file = path.join(folder, "momo-chapitre-1.pdf");
  await mkdir(folder);
  const content = Buffer.from("%PDF-1.7\nlocal test only\n%%EOF\n");
  await writeFile(file, content);
  const middleware = createLocalPdfMiddleware(root);
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const get = (pathname, headers = {}, method = "GET") => new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: "127.0.0.1", port, path: pathname, method, headers }, (res) => {
      const chunks = []; res.on("data", (part) => chunks.push(part)); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject); req.end();
  });
  const route = "/__local-media/momo-chapitre-1.pdf";
  try {
    const whole = await get(route);
    assert.equal(whole.status, 200);
    assert.deepEqual(whole.body, content);
    assert.equal(whole.headers["cache-control"], "no-store");
    assert.equal(whole.headers["x-content-type-options"], "nosniff");
    const head = await get(route, {}, "HEAD");
    assert.equal(head.headers["content-length"], String(content.length));
    assert.equal(head.body.length, 0);
    const partial = await get(route, { Range: "bytes=0-7" });
    assert.equal(partial.status, 206);
    assert.equal(partial.body.toString(), "%PDF-1.7");
    assert.equal((await get(route, { Range: "bytes=-6" })).body.toString(), "%%EOF\n");
    for (const range of ["bytes=999-", "bytes=5-3", "bytes=0-1,4-5", "bytes=-0"]) assert.equal((await get(route, { Range: range })).status, 416);
    assert.equal((await get(route, { Host: "evil.example" })).status, 403);
    assert.equal((await get(route, { Origin: "https://evil.example" })).status, 403);
    assert.equal((await get(route, {}, "POST")).status, 405);
    for (const invalid of ["/__local-media/other.pdf", "/__local-media/../secret", "/__local-media%2fmomo-chapitre-1.pdf", "/.local-media/momo-chapitre-1.pdf"]) assert.equal((await get(invalid)).status, 404);
    let ended;
    await middleware({ url: route, socket: { remoteAddress: "192.0.2.4" }, headers: {} }, { setHeader() {}, end() { ended = this.statusCode; } }, () => {});
    assert.equal(ended, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await unlink(file); await rmdir(folder); await rmdir(root);
  }
});
