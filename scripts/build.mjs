import { build } from "esbuild";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/app.js"],
  outfile: "dist/app.js",
  bundle: true,
  minify: true,
  format: "esm",
});
const files = [
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "chess-js-LICENSE.txt",
  ...[
    "go.webp",
    "xiangqi.webp",
    "chess.webp",
    "hero.webp",
    "master.svg",
    "logo.svg",
    "icon-192.png",
    "icon-512.png",
  ].map((x) => "art/" + x),
];
await cp("public", "dist/static", { recursive: true });
const assets = {};
for (const path of files.concat("app.js")) {
  const bytes = await readFile(
    path === "app.js" ? "dist/app.js" : "public/" + path,
  );
  assets["/" + path] = [
    bytes.toString("base64"),
    {
      js: "text/javascript",
      css: "text/css",
      html: "text/html",
      txt: "text/plain",
      webmanifest: "application/manifest+json",
      webp: "image/webp",
      svg: "image/svg+xml",
      png: "image/png",
    }[path.split(".").pop()],
  ];
}
for (const [name, file, type] of [
  ["engine.worker.js", "dist/engine.worker.js", "text/javascript"],
  ["pikafish-LICENSE.txt", "LICENSE", "text/plain"],
  ["pikafish-NOTICE.txt", "NOTICE", "text/plain"],
]) {
  const data = await readFile("node_modules/pikafish-js/" + file);
  assets["/" + name] = [data.toString("base64"), type];
  await writeFile("dist/static/" + name, data);
}
const version = createHash("sha256")
  .update(JSON.stringify(assets))
  .digest("hex")
  .slice(0, 12);
const sw = `const CACHE='te-hoang-cuc-${version}',FILES=${JSON.stringify(["/", ...Object.keys(assets)])};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('te-hoang-cuc-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method==='GET'&&u.origin===location.origin&&u.pathname.startsWith('/engine/v1/')){e.respondWith(caches.open('pikafish-w256-v1').then(async c=>{const hit=await c.match(e.request);if(hit)return hit;const res=await fetch(e.request);if(res.ok)await c.put(e.request,res.clone());return res}));return}if(e.request.method==='GET'&&u.origin===location.origin&&FILES.includes(u.pathname))e.respondWith(caches.open(CACHE).then(c=>c.match(u.pathname)).then(r=>r||fetch(e.request)))})`;
assets["/sw.js"] = [Buffer.from(sw).toString("base64"), "text/javascript"];
await writeFile("dist/static/sw.js", sw);
await cp("dist/app.js", "dist/static/app.js");
await writeFile("dist/assets.json", JSON.stringify(assets));
await build({
  entryPoints: ["src/worker.js"],
  outfile: "dist/worker.mjs",
  format: "esm",
  bundle: true,
  minify: true,
});
