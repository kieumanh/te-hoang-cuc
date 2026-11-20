const release = "https://github.com/Maicarons/pikafish-js/releases/download/";
const assets = {
  "pikafish.js": [
    "v1.0.0/w256-single-nosimd.pikafish.js",
    "text/javascript",
    "f12b9f63b068a0b36f1c8274138f76d1ed09faecdd8b44b4edd17eecb4d321f7",
  ],
  "pikafish.wasm": [
    "v1.0.0/w256-single-nosimd.pikafish.wasm",
    "application/wasm",
    "8143e1f3087ceb082099d18ebc7800dd65cfd9e571333042c087e73369d26825",
  ],
  "pikafish.nnue": [
    "networks/pikafish-w256.nnue",
    "application/octet-stream",
    "316da3939d66edacc730a313a1bdddb0619ad1b8158b1dc5bd8244af335c552b",
  ],
};
export async function serveEngine(req, ctx) {
  const key = new URL(req.url).pathname.slice("/engine/v1/".length);
  if (req.method !== "GET" || !Object.hasOwn(assets, key))
    return new Response(null, { status: 404 });
  const cache = caches.default,
    hit = await cache.match(req);
  if (hit) return hit;
  const [url, type, expected] = assets[key];
  const upstream = await fetch(release + url, { redirect: "follow" });
  if (!upstream.ok)
    return new Response("Chưa tải được gói kỳ nghệ", { status: 503 });
  const data = await upstream.arrayBuffer(),
    hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
      (x) => x.toString(16).padStart(2, "0"),
    ).join("");
  if (hash !== expected)
    return new Response("Chưa xác minh được gói kỳ nghệ", { status: 502 });
  const r = new Response(data, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
  ctx.waitUntil(cache.put(req, r.clone()));
  return r;
}
