import { createEngine } from "pikafish-js";
let ready;
const root = "/engine/v1/";
export function loadEngine() {
  if (!ready) {
    ready = createEngine({
      build: "single-nosimd",
      builds: {
        "single-nosimd": {
          js: location.origin + root + "pikafish.js",
          wasm: location.origin + root + "pikafish.wasm",
        },
      },
      netUrl: location.origin + root + "pikafish.nnue",
      netSha256:
        "316da3939d66edacc730a313a1bdddb0619ad1b8158b1dc5bd8244af335c552b",
      workerFactory: () => new Worker("/engine.worker.js"),
    }).catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
export async function pickPikafish(s, rank, rival) {
  const engine = await loadEngine();
  const square = (i) => "abcdefghi"[i % 9] + (9 - Math.floor(i / 9));
  const index = (a, b) => "abcdefghi".indexOf(a) + (9 - Number(b)) * 9;
  const result = await engine.play({
    fen: "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1",
    moves: s.moves.map((m) => square(m.f) + square(m.t)),
    depth: Math.min(12, 3 + rank + rival),
    movetime: 900,
  });
  const m = result.bestmove;
  if (!/^[a-i][0-9][a-i][0-9]$/.test(m)) throw Error("Chưa có nước Pikafish");
  return { f: index(m[0], m[1]), t: index(m[2], m[3]) };
}
