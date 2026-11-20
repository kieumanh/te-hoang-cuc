import { pickPikafish } from "./pikafish.js";
import { boardlines } from "./boardlines.js";
import {
  games,
  start,
  play,
  legal,
  replay,
  suggest,
  scoreGo,
} from "./engine.js";
import {
  ranks,
  lessons,
  stats,
  milestones,
  eligible,
  puzzle,
} from "./academy.js";
const $ = (s) => document.querySelector(s),
  main = $("#main"),
  modal = $("#modal"),
  dbody = $("#dialogbody");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const read = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem("thc." + k)) ?? d;
    } catch {
      return d;
    }
  },
  write = (k, v) => localStorage.setItem("thc." + k, JSON.stringify(v));
const icons = {
  home: "M3 10l9-7 9 7 M5 9v11h5v-6h4v6h5V9",
  board: "M4 3h16v17H4z M9 3v17m6-17v17M4 9h16M4 15h16",
  book: "M2 5q5-2 10 1 5-3 10-1v14q-5-2-10 1-5-3-10-1z M12 6v14",
  scroll: "M6 4h12v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3h12 M9 8h6m-6 4h6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21a8 8 0 0 1 16 0",
  swords: "M3 3l5 2 11 12-2 2L5 8z M20 3l-4 2-3 4m-4 4-5 5m10-1 5-5M5 13l6 6",
  leaf: "M4 18C1 6 13 4 21 3c0 11-6 18-14 15m-3 3L16 9",
  award: "M7 9a5 5 0 1 1 10 0 5 5 0 0 1-10 0 M8 14l-2 7 6-3 6 3-2-7",
  grid: "M3 4h18v16H3z M9 4v16m6-16v16M3 9h18m-18 6h18",
  clock: "M12 3a9 9 0 1 0 .1 0 M12 7v5l4 2",
  sound: "M3 9h4l5-4v14l-5-4H3z M16 8q5 4 0 8",
};
const icon = (k) =>
  '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="' +
  icons[k] +
  '"/></svg>';
const btn = (label, act, kind = "", extra = "") =>
  '<button class="btn ' +
  kind +
  '" data-act="' +
  act +
  '" ' +
  extra +
  ">" +
  label +
  "</button>";
const action = (s, a) =>
  '<button class="link" data-act="' + a + '">' + s + "</button>";
const pages = [
  ["home", "home", "Kỳ viện"],
  ["arena", "board", "Kỳ trường"],
  ["academy", "book", "Học viện"],
  ["history", "scroll", "Kỳ phổ"],
];
const modes = {
  bot: "Mộc Đồng · Bot",
  ai: "Kỳ Sĩ · AI local",
  master: "Sư phụ",
  duo: "Song Hiệp",
};
const details = {
  go: ["Vây đất, giữ khí và đọc ý đối phương.", "9 · 13 · 19 đường"],
  xiangqi: ["Điều binh qua sông, giữ vững cung tướng.", "9 × 10 giao điểm"],
  chess: ["Phối hợp quân lực, tìm đường chiếu hết.", "8 × 8 ô"],
};
let user = null,
  owner = read("owner", "guest"),
  events = read("events." + owner, []),
  opts = read("settings", {
    sound: true,
    voice: false,
    mark: true,
    depth: false,
    split: false,
  }),
  active = null,
  game = null,
  sel = null,
  hint = null,
  viewGame = "go",
  mentor = null,
  mentorText = "",
  mentorSeq = 0,
  timer,
  toastTimer,
  authMode = "login",
  live = false,
  waiting = false;
const key = (k) => k + "." + owner;
function loadOwner(id) {
  owner = id;
  write("owner", owner);
  events = read(key("events"), []);
  active = read(key("active"), null);
  game = active ? replay(active.game, active.w, active.moves) : null;
  sel = hint = null;
}
loadOwner(owner);
const rank = () => stats(events).rank;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.style.display = "none"), 4000);
}
function dialog(title, html) {
  dbody.innerHTML = "<h2>" + title + "</h2>" + html;
  if (!modal.open) modal.showModal();
}
function go(page) {
  if (location.hash === "#" + page) render();
  else location.hash = page;
}
const page = () => location.hash.slice(1) || "home";
function storeGame() {
  if (active && game) active.moves = game.moves;
  write(key("active"), active);
}
async function api(path, data) {
  const r = await fetch(
    "/api/" + path,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
  );
  const j = await r.json();
  if (!r.ok) throw Error(j.error || "Không kết nối được");
  return j;
}
let syncChain = Promise.resolve();
function sync() {
  const who = user?.id;
  if (!who) return Promise.resolve();
  syncChain = syncChain
    .catch(() => {})
    .then(async () => {
      if (user?.id !== who) return;
      const remote = (await api("activity")).events;
      if (user?.id !== who) return;
      const ids = new Set(remote.map((e) => e.id));
      const all = new Map([...remote, ...events].map((e) => [e.id, e]));
      events = [...all.values()].sort((a, b) => a.at - b.at);
      write(key("events"), events);
      for (const e of events)
        if (!ids.has(e.id) && user?.id === who)
          await api("activity", { event: e });
    });
  return syncChain;
}
function record(e) {
  if (events.some((v) => v.id === e.id)) return;
  events.push({ ...e, at: Date.now() });
  write(key("events"), events);
  sync().catch(() => toast("Đã lưu trên máy. Sẽ đồng bộ khi kết nối lại."));
}
function card(k) {
  return (
    '<button class="gamecard" data-act="setup" data-game="' +
    k +
    '"><div class="cover"><img alt="" src="/art/' +
    k +
    '.webp"></div><div class="cardtext"><h3>' +
    games[k] +
    "</h3><p>" +
    details[k][0] +
    '</p><div class="cardfoot"><span class="meta">' +
    icon("grid") +
    details[k][1] +
    "</span><span>Vào bàn</span></div></div></button>"
  );
}
function cards() {
  return (
    '<div class="cards">' + Object.keys(games).map(card).join("") + "</div>"
  );
}
function head(k, title, sub) {
  return (
    '<div class="pagehead"><div class="eyebrow">' +
    k +
    "</div><h1>" +
    title +
    "</h1><p>" +
    sub +
    "</p></div>"
  );
}
function progress(n, total) {
  return (
    '<div class="progress" role="meter" aria-label="Tiến độ" aria-valuenow="' +
    n +
    '" aria-valuemin="0" aria-valuemax="' +
    total +
    '"><i style="width:' +
    Math.min(100, (n / total) * 100) +
    '%"></i></div>'
  );
}
function home() {
  const r = rank();
  return (
    '<section class="hero"><div><div class="eyebrow">Kỳ viện gia đình</div><h1>Tĩnh tâm,<br>sáng nước cờ.</h1><p>Gặp nhau bên bàn cờ, luyện kỳ nghệ qua từng nước đi.</p><div class="actions">' +
    btn(
      icon("swords") + (active ? "Tiếp tục ván" : "Vào kỳ trường"),
      active ? "resume" : "arena",
      "primary",
    ) +
    btn(icon("book") + "Khám phá học viện", "academy", "secondary") +
    '</div></div></section><div class="sectionhead"><h2>Chọn môn cờ</h2><small>Ba môn kỳ nghệ</small></div>' +
    cards() +
    '<div class="homebottom"><section class="panel"><div class="panelhead"><h3>Hành trình kỳ đạo</h3><span class="stamp">Cấp ' +
    (r + 1) +
    "/10</span></div><p>" +
    ranks[r] +
    " · " +
    lessons[r][0] +
    "</p>" +
    progress(
      milestones(events, r).reduce((a, b) => a + b, 0),
      6,
    ) +
    action("Vào học viện", "academy") +
    '</section><section class="panel"><div class="panelhead"><h3>Thế cờ trong ngày</h3>' +
    icon("board") +
    "</div><p>Đen đi trước. Hãy tìm nước bắt trọn nhóm trắng.</p>" +
    action("Thử giải cục", "daily") +
    "</section></div>"
  );
}
function setup(k) {
  viewGame = k;
  const nick = read("names", ["Kỳ thủ một", "Kỳ thủ hai"]);
  dialog(
    "Khai cuộc · " + games[k],
    '<form id="setupform" class="method"><label>Đối thủ<select name="mode">' +
      Object.entries(modes)
        .map(([v, n]) => '<option value="' + v + '">' + n + "</option>")
        .join("") +
      '</select></label><label id="rivallabel">Kỳ thủ đồng cấp<select name="rival"><option value="0">Thanh Trúc</option><option value="1">Bạch Vân</option></select></label><div id="duonames" hidden><label>Kỳ thủ thứ nhất<input name="p1" maxlength="30" value="' +
      esc(nick[0]) +
      '"></label><label>Kỳ thủ thứ hai<input name="p2" maxlength="30" value="' +
      esc(nick[1]) +
      '"></label></div>' +
      (k === "go"
        ? '<label>Bàn cờ<select name="width"><option>9</option><option>13</option><option>19</option></select></label>'
        : "") +
      '<p class="note">' +
      (active
        ? "Bắt đầu sẽ thay ván đang dở trên thiết bị này."
        : "Tiến trình ván được lưu sau mỗi nước đi.") +
      '</p><button class="btn primary">Bắt đầu ván</button></form>',
  );
  $("#setupform select").onchange = (e) => {
    $("#duonames").hidden = e.target.value !== "duo";
    $("#rivallabel").hidden = e.target.value === "duo";
  };
  $("#setupform").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      mode = f.get("mode"),
      names = [
        f.get("p1").trim() || "Kỳ thủ một",
        f.get("p2").trim() || "Kỳ thủ hai",
      ];
    if (mode === "duo") write("names", names);
    game = start(k, Number(f.get("width") || 9));
    active = {
      id: crypto.randomUUID(),
      game: k,
      w: game.w,
      mode,
      names,
      rival: +f.get("rival"),
      level: rank(),
      moves: [],
    };
    sel = hint = null;
    storeGame();
    modal.close();
    go("play");
  };
}
const chessChars = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
  chessWhite = { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  xRed = { k: "帥", a: "仕", e: "相", n: "傌", r: "俥", c: "炮", p: "兵" },
  xBlack = { k: "將", a: "士", e: "象", n: "馬", r: "車", c: "砲", p: "卒" };
const coord = (i, w, h) =>
  String.fromCharCode(65 + (i % w)) + (h - Math.floor(i / w));
function board(s, act = "cell", marks = [], flip = false) {
  const last = s.moves?.at(-1)?.t;
  return (
    '<div class="board ' +
    s.game +
    (opts.depth ? " depth" : "") +
    (flip ? " facing" : "") +
    '" style="--cols:' +
    s.w +
    ";--ratio:" +
    s.w +
    "/" +
    s.h +
    '">' +
    boardlines(s.game, s.w, s.h) +
    s.b
      .map((v, i) => {
        const chars =
          s.game === "chess"
            ? v?.side === 1
              ? chessWhite
              : chessChars
            : v?.side === 1
              ? xRed
              : xBlack;
        const piece = !v
          ? ""
          : s.game === "go"
            ? '<span class="disc ' + (v === 1 ? "black" : "white") + '"></span>'
            : s.game === "chess"
              ? '<span class="piece">' + chars[v.p] + "</span>"
              : '<span class="disc ' +
                (v.side === 1 ? "red" : "") +
                '">' +
                chars[v.p] +
                "</span>";
        const tag = act ? "button" : "span";
        return (
          "<" +
          tag +
          (act ? ' data-act="' + act + '" data-cell="' + i + '"' : "") +
          ' class="cell ' +
          (((i % s.w) + Math.floor(i / s.w)) % 2 ? "dark " : "") +
          (opts.mark && last === i ? "last " : "") +
          (act === "cell" && sel === i ? "selected " : "") +
          (marks.includes(i) ? "target" : "") +
          '" aria-label="' +
          coord(i, s.w, s.h) +
          (v
            ? " · " +
              (s.game === "go" ? (v === 1 ? "đen" : "trắng") : chars[v.p])
            : " · trống") +
          '">' +
          piece +
          "</" +
          tag +
          ">"
        );
      })
      .join("") +
    "</div>"
  );
}
function say(msg) {
  if (!opts.voice || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(msg);
  u.lang = "vi-VN";
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
let audio;
function tap() {
  if (!opts.sound) return;
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator(),
      gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(510, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(130, audio.currentTime + 0.06);
    gain.gain.setValueAtTime(0.11, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.085);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.09);
  } catch {}
}
const outcome = (x) =>
  x === 1 ? "Bên đi trước thắng" : x === -1 ? "Bên đi sau thắng" : "Hòa cờ";
function finish(resign = false) {
  const e = {
    ...active,
    type: "match",
    moves: game.moves.slice(),
    result: resign ? -game.turn : game.end,
    resign,
  };
  record(e);
  active = null;
  storeGame();
  say(outcome(e.result));
  toast(outcome(e.result) + " · Đã lưu kỳ phổ");
  go("history");
}
function move(m) {
  if (!play(game, m)) {
    toast("Nước đi chưa hợp lệ");
    return;
  }
  tap();
  hint = sel = null;
  mentorText = "";
  mentorSeq++;
  storeGame();
  if (game.end !== null) {
    finish();
    return;
  }
  render();
}
function schedule() {
  clearTimeout(timer);
  if (page() !== "play" || !active || active.mode === "duo" || game.turn !== -1)
    return;
  timer = setTimeout(async () => {
    if (!active || page() !== "play") return;
    if (active.mode === "master" && game.game === "xiangqi" && opts.pika) {
      if (waiting) return;
      waiting = true;
      const id = active.id,
        ply = game.moves.length;
      let selected;
      try {
        selected = await pickPikafish(game, active.level, active.rival);
      } catch {
        toast("Pikafish chưa sẵn sàng. Sư phụ dùng bộ não tích hợp.");
      } finally {
        waiting = false;
      }
      if (page() !== "play" || active?.id !== id || game.moves.length !== ply) {
        schedule();
        return;
      }
      if (
        selected &&
        legal(game).some((m) => m.f === selected.f && m.t === selected.t)
      ) {
        move(selected);
        return;
      }
    }
    move(
      suggest(
        game,
        (active.mode === "bot" ? 1 : active.mode === "ai" ? 2 : 4) +
          Math.floor(active.level / 3),
        active.rival,
      ),
    );
  }, 280);
}
function cell(i) {
  if (!active || (active.mode !== "duo" && game.turn !== 1)) return;
  if (game.game === "go") {
    move({ t: i });
    return;
  }
  if (game.b[i]?.side === game.turn) {
    sel = i;
    hint = null;
    render();
    return;
  }
  if (sel === null) return;
  const choices = legal(game).filter((m) => m.f === sel && m.t === i);
  if (!choices.length) {
    toast("Ô này nằm ngoài các nước hợp lệ");
    return;
  }
  if (choices.length > 1) {
    dialog(
      "Chọn quân phong cấp",
      '<div class="actions">' +
        choices
          .map((m) =>
            btn(
              { q: "Hậu", n: "Mã", b: "Tượng", r: "Xe" }[m.promotion],
              "promotion",
              "",
              'data-to="' + i + '" data-p="' + m.promotion + '"',
            ),
          )
          .join("") +
        "</div>",
    );
    return;
  }
  move(choices[0]);
}
function budget() {
  const d = new Date().toLocaleDateString("sv-SE");
  return { key: "hints." + d, used: read("hints." + d, 0) };
}
function playpage() {
  if (!active)
    return (
      head("Kỳ trường", "Chọn bàn cờ", "Mở một ván mới để bắt đầu.") + cards()
    );
  const s = game,
    b = budget(),
    marks = hint
      ? [hint.t, hint.f].filter(Number.isInteger)
      : sel !== null && opts.mark
        ? legal(s)
            .filter((m) => m.f === sel)
            .map((m) => m.t)
        : [];
  const duo = active.mode === "duo",
    n = duo
      ? active.names[s.turn === 1 ? 0 : 1]
      : s.turn === 1
        ? "Bạn"
        : modes[active.mode];
  return (
    head(
      "Kỳ trường",
      games[s.game],
      (duo
        ? active.names.join(" · ")
        : modes[active.mode] +
          " · " +
          ["Thanh Trúc", "Bạch Vân"][active.rival]) +
        " · " +
        ranks[active.level],
    ) +
    '<div class="playlayout"><section class="panel boardpanel"><h3>Lượt ' +
    esc(n) +
    '</h3><div class="' +
    (duo && opts.split ? "splitboards" : "") +
    '">' +
    board(s, "cell", marks) +
    (duo && opts.split ? board(s, "cell", marks, true) : "") +
    '</div><div class="controls">' +
    (s.game === "go" ? btn("Bỏ lượt", "pass") : "") +
    btn("Xin thua", "resign") +
    btn("Lưu và rời bàn", "arena") +
    "</div><small>Nước " +
    (s.moves.length + 1) +
    (s.game === "go"
      ? " · Đen bắt " + s.taken[0] + " · Trắng bắt " + s.taken[1]
      : "") +
    '</small></section><aside class="panel"><div class="panelhead"><h3>Sư phụ chỉ điểm</h3><img alt="" class="master" src="/art/master.svg"></div><p>' +
    (hint
      ? hint.pass
        ? "Có thể bỏ lượt."
        : "Hãy xét " +
          (hint.f !== undefined ? coord(hint.f, s.w, s.h) + " tới " : "") +
          coord(hint.t, s.w, s.h) +
          "."
      : s.game === "go"
        ? "Đếm khí của nhóm mình, rồi nhìn sang nhóm quân bên cạnh."
        : s.game === "chess"
          ? "Kiểm tra các nước chiếu, bắt quân và đe dọa trước khi đi."
          : "Quan sát lộ xe, chân mã và khoảng trống trước mặt tướng.") +
    "</p>" +
    btn("Gợi ý nước đi", "hint") +
    progress(75 - b.used, 75) +
    "<small>Còn " +
    (75 - b.used) +
    "/75 gợi ý hôm nay trên thiết bị</small>" +
    (mentor?.enabled
      ? "<p>Quỹ giải thích chung · " + mentor.remaining + "/75</p>"
      : "") +
    (mentorText ? "<p>" + esc(mentorText) + "</p>" : "") +
    '<hr><div class="checks">' +
    [
      ["depth", "Góc nhìn 3D"],
      ["mark", "Đánh dấu nước đi"],
      ["sound", "Âm thanh hạ quân"],
      ["voice", "Giọng Sư phụ tiếng Việt"],
      ...(s.game === "xiangqi" && active.mode === "master"
        ? [["pika", "Dùng Pikafish WASM (tải lần đầu khoảng 13 MB)"]]
        : []),
      ...(duo ? [["split", "Hai bàn đối diện"]] : []),
    ]
      .map(
        ([k, n]) =>
          '<label><input type="checkbox" data-setting="' +
          k +
          '" ' +
          (opts[k] ? "checked" : "") +
          ">" +
          n +
          "</label>",
      )
      .join("") +
    '</div><p class="rules">' +
    (s.game === "go"
      ? "Hai lần bỏ lượt kết thúc ván. Tính diện tích quân và đất, trắng cộng 6,5 điểm. Hãy bắt hết quân chết trước khi hai bên bỏ lượt."
      : s.game === "chess"
        ? "Chạm quân rồi chọn ô đích. Có nhập thành, bắt tốt qua đường và phong cấp."
        : "Chọn quân rồi chạm giao điểm đích. Mã bị cản chân, tượng không qua sông. Lặp thế ba lần được xử hòa theo luật kỳ viện.") +
    "</p></aside></div>"
  );
}
function academy() {
  const r = rank(),
    ms = milestones(events, r);
  return (
    head(
      "Học viện",
      "Hành trình kỳ đạo",
      "Mười cấp kỳ nghệ, từ đếm khí đầu tiên đến đọc thế toàn bàn.",
    ) +
    '<div class="twocol"><article class="panel"><div class="panelhead"><span class="stamp">Cấp ' +
    (r + 1) +
    "</span>" +
    icon("award") +
    "</div><h2>" +
    ranks[r] +
    "</h2><p>" +
    lessons[r][0] +
    " · " +
    lessons[r][1] +
    "</p>" +
    progress(Math.min(6, ms[0] + Math.min(2, ms[1]) + ms[2]), 6) +
    "<p>" +
    ms[0] +
    "/3 ván · " +
    Math.min(2, ms[1]) +
    "/2 đối thủ đã thắng · " +
    ms[2] +
    '/1 bài học</p><div class="actions">' +
    btn("Học bài", "lesson", "primary", 'data-i="' + r + '"') +
    btn(
      "Thi thăng cấp",
      "exam",
      "",
      'data-i="' + r + '" ' + (eligible(events, r) ? "" : "disabled"),
    ) +
    '</div></article><article class="panel"><h3>Bí kíp đã mở</h3><p>' +
    lessons
      .slice(
        0,
        r + (events.some((e) => e.type === "exam" && e.level === 9) ? 1 : 0),
      )
      .map((v, i) => "<b>" + ranks[i] + "</b> · " + v[5])
      .join("<br>") +
    "</p>" +
    (!r ? "<p>Vượt kỳ thi đầu tiên để nhận bí kíp và chứng nhận.</p>" : "") +
    action("Xem chứng nhận", "cert") +
    '</article></div><h2>Lộ trình mười cấp</h2><div class="ranklist">' +
    ranks
      .map(
        (n, i) =>
          '<button class="panel" data-act="lesson" data-i="' +
          i +
          '" ' +
          (i > r ? "disabled" : "") +
          "><small>Cấp " +
          (i + 1) +
          " · " +
          (i < r ? "Hoàn thành" : i === r ? "Đang học" : "Chưa mở") +
          "</small><b>" +
          n +
          "</b><p>" +
          lessons[i][0] +
          "</p></button>",
      )
      .join("") +
    "</div>"
  );
}
let challenge = null;
function lesson(i, exam = false) {
  if (i > rank() || (exam && !eligible(events, i))) return;
  const l = lessons[i];
  challenge = { i, exam };
  dialog(
    exam ? "Kỳ thi · " + ranks[i] : l[0],
    (exam ? "" : "<p>" + l[1] + "</p>") +
      "<h3>" +
      l[2] +
      '</h3><div class="method" style="margin-top:18px">' +
      l[3].map((v, k) => btn(v, "answer", "", 'data-i="' + k + '"')).join("") +
      "</div>",
  );
}
function puzzleDialog(i, exam = false) {
  challenge = { i, exam, p: puzzle(i) };
  const p = challenge.p;
  dialog(
    exam ? "Giải cục thăng cấp" : "Thế cờ trong ngày",
    "<p>Đen đi trước. Chọn giao điểm lấy khí cuối cùng của nhóm trắng.</p>" +
      board({ game: "go", w: p.size, h: p.size, b: p.b }, "solve"),
  );
}
function historyPage() {
  const s = stats(events),
    matches = events.filter((e) => e.type === "match").reverse();
  return (
    head(
      "Kỳ phổ",
      "Nhật ký kỳ thủ",
      "Xem lại từng nước đi và hành trình luyện cờ của bạn.",
    ) +
    '<div class="panel statgrid"><div><strong>' +
    s.played +
    "</strong><small>Ván đã chơi</small></div><div><strong>" +
    s.wins +
    "</strong><small>Ván đi trước thắng</small></div><div><strong>" +
    s.points +
    '</strong><small>Điểm kỳ nghệ</small></div></div><section class="panel"><h3>Ván đã lưu</h3>' +
    (matches.length
      ? matches
          .map(
            (e) =>
              '<div class="tile row"><div><b>' +
              games[e.game] +
              " · " +
              modes[e.mode] +
              "</b><br><small>" +
              new Date(e.at).toLocaleDateString("vi-VN") +
              " · " +
              outcome(e.result) +
              " · " +
              e.moves.length +
              " nước</small></div>" +
              btn("Xem kỳ phổ", "review", "", 'data-id="' + esc(e.id) + '"') +
              "</div>",
          )
          .join("")
      : "<p>Kỳ phổ đầu tiên sẽ xuất hiện khi bạn kết thúc một ván.</p>" +
        btn("Chọn môn cờ", "arena")) +
    "</section>"
  );
}
function review(id, n) {
  const e = events.find((v) => v.id === id);
  if (!e) return;
  n = Math.min(e.moves.length, Math.max(0, n ?? e.moves.length));
  const s = replay(e.game, e.w, e.moves.slice(0, n));
  dialog(
    "Kỳ phổ · " + games[e.game],
    board(s, null) +
      '<div class="controls">' +
      btn(
        "Trước",
        "review",
        "",
        'data-id="' +
          esc(id) +
          '" data-n="' +
          (n - 1) +
          '" ' +
          (!n ? "disabled" : ""),
      ) +
      "<span>" +
      n +
      " / " +
      e.moves.length +
      "</span>" +
      btn(
        "Sau",
        "review",
        "",
        'data-id="' +
          esc(id) +
          '" data-n="' +
          (n + 1) +
          '" ' +
          (n === e.moves.length ? "disabled" : ""),
      ) +
      "</div><p>" +
      outcome(e.result) +
      (e.resign ? " · Xin thua" : "") +
      "</p>",
  );
}
function auth(mode = "login") {
  authMode = mode;
  const n = {
    login: "Đăng nhập",
    register: "Đăng ký kỳ thủ",
    recover: "Khôi phục tài khoản",
  };
  dialog(
    n[mode],
    '<form id="authform" class="method"><label>Email<input required type="email" name="email" autocomplete="username"></label>' +
      (mode === "recover"
        ? '<label>Mã khôi phục<input required name="code"></label>'
        : "") +
      "<label>" +
      (mode === "recover" ? "Mật khẩu mới" : "Mật khẩu") +
      '<input required type="password" name="password" minlength="' +
      (mode === "login" ? 1 : 10) +
      '" autocomplete="' +
      (mode === "login" ? "current-password" : "new-password") +
      '"></label>' +
      (mode === "register"
        ? "<small>Kỳ viện có 5 chỗ, gồm quản trị viên. Tài khoản mới cần được duyệt.</small>"
        : "") +
      '<small id="autherr" role="status"></small><button class="btn primary">' +
      n[mode] +
      '</button></form><div class="actions">' +
      Object.entries(n)
        .filter(([k]) => k !== mode)
        .map(([k, v]) => action(v, k))
        .join("") +
      "</div>",
  );
  $("#authform").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target,
      button = form.querySelector("button");
    button.disabled = true;
    try {
      const d = await api(mode, Object.fromEntries(new FormData(form)));
      if (mode === "login") {
        const before = owner;
        user = d.user;
        live = true;
        loadOwner(user.id);
        await sync();
        mentor = await api("mentor");
        render();
        if (
          before === "guest" &&
          (read("events.guest", []).length || read("active.guest", null))
        )
          dialog(
            "Liên kết hồ sơ khách",
            "<p>Nhập kỳ phổ và kết quả học trên máy này vào tài khoản vừa đăng nhập?</p>" +
              btn("Liên kết", "linkguest", "primary"),
          );
        else modal.close();
        toast("Đã đăng nhập");
      } else {
        dialog(
          mode === "register" ? "Đã gửi yêu cầu duyệt" : "Đã đổi mật khẩu",
          "<p>Lưu mã khôi phục riêng của anh để đặt lại mật khẩu lần sau.</p><code>" +
            esc(d.code) +
            "</code><div>" +
            action("Đăng nhập", "login") +
            "</div>",
        );
      }
    } catch (err) {
      const target = $("#autherr");
      if (target) target.textContent = err.message;
      else toast(err.message);
    } finally {
      button.disabled = false;
    }
  };
}
function profile() {
  if (!user) {
    auth();
    return;
  }
  dialog(
    "Hồ sơ kỳ thủ",
    "<p>" +
      esc(user.email) +
      " · " +
      (user.role === "admin" ? "Quản trị viên" : "Thành viên") +
      '</p><div class="tile"><b>♜ ' +
      ranks[rank()] +
      "</b><p>" +
      stats(events).points +
      ' điểm kỳ nghệ</p></div><div class="method">' +
      (user.role === "admin" ? btn("Quản trị thành viên", "members") : "") +
      btn("Tạo mã khôi phục", "newcode") +
      (read("events.guest", []).length || read("active.guest", null)
        ? btn("Liên kết kỳ phổ khách", "linkguest")
        : "") +
      btn("Đăng xuất", "logout") +
      "</div>",
  );
}
async function members(body) {
  const d = await api("members", body);
  dialog(
    "Quản trị thành viên",
    "<p>" +
      d.members.filter((u) => u.status === "active").length +
      "/5 tài khoản đang hoạt động.</p>" +
      d.members
        .map(
          (u) =>
            '<div class="tile"><b>' +
            esc(u.email) +
            "</b><p>" +
            (u.role === "admin"
              ? "Quản trị viên"
              : u.status === "active"
                ? "Đã duyệt"
                : "Chờ duyệt") +
            "</p>" +
            (u.status === "pending"
              ? btn("Duyệt", "approve", "", 'data-id="' + esc(u.id) + '"') +
                " " +
                btn("Từ chối", "reject", "", 'data-id="' + esc(u.id) + '"')
              : "") +
            "</div>",
        )
        .join(""),
  );
}
function render() {
  const p = page();
  $("#nav").innerHTML = pages
    .map(
      ([k, i, n]) =>
        '<a href="#' +
        k +
        '" class="' +
        (p === k || (p === "play" && k === "arena") ? "on" : "") +
        '">' +
        icon(i) +
        n +
        "</a>",
    )
    .join("");
  $("#account").innerHTML =
    icon("user") +
    (user
      ? "Hồ sơ"
      : owner !== "guest" && !live
        ? "Hồ sơ ngoại tuyến"
        : "Đăng nhập");
  main.innerHTML =
    p === "arena"
      ? head(
          "Kỳ trường",
          "Chọn bàn giao đấu",
          "Chơi với máy, thỉnh giáo Sư phụ hoặc mời bạn cùng ngồi vào bàn.",
        ) +
        (active
          ? '<div class="tile row"><b>Ván đang dở · ' +
            games[active.game] +
            "</b>" +
            btn("Tiếp tục", "resume", "primary") +
            "</div>"
          : "") +
        cards()
      : p === "academy"
        ? academy()
        : p === "history"
          ? historyPage()
          : p === "play"
            ? playpage()
            : home();
  schedule();
}
document.addEventListener("change", (e) => {
  const k = e.target.dataset.setting;
  if (!k) return;
  opts[k] = e.target.checked;
  write("settings", opts);
  if (k === "voice" && opts.voice) say("Mời kỳ thủ hạ quân.");
  render();
});
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act,
    i = Number(el.dataset.i),
    id = el.dataset.id;
  try {
    if (["home", "arena", "academy", "history"].includes(a)) {
      modal.close();
      go(a);
    } else if (a === "resume") go("play");
    else if (a === "setup") setup(el.dataset.game);
    else if (a === "cell") cell(+el.dataset.cell);
    else if (a === "pass" && (active.mode === "duo" || game.turn === 1))
      move({ pass: true });
    else if (a === "promotion") {
      modal.close();
      move({ f: sel, t: +el.dataset.to, promotion: el.dataset.p });
    } else if (a === "resign") {
      if (active.mode !== "duo" && game.turn !== 1) return;
      dialog(
        "Xin thua ván này?",
        "<p>Kết quả sẽ được ghi vào kỳ phổ.</p>" +
          btn("Xác nhận xin thua", "endresign", "primary"),
      );
    } else if (a === "endresign") {
      modal.close();
      finish(true);
    } else if (a === "hint") {
      if (active.mode !== "duo" && game.turn !== 1) return;
      const b = budget();
      if (b.used >= 75) {
        toast("Đã dùng hết lượt gợi ý hôm nay");
        return;
      }
      hint = suggest(game, 4);
      write(b.key, b.used + 1);
      say(hint.pass ? "Hãy cân nhắc bỏ lượt" : "Hãy xem nước cờ được đánh dấu");
      render();
      if (mentor?.enabled && !hint.pass) {
        const seq = ++mentorSeq;
        const move =
          (Number.isInteger(hint.f)
            ? coord(hint.f, game.w, game.h) + "-"
            : "") + coord(hint.t, game.w, game.h);
        try {
          const r = await api("mentor", {
            game: game.game,
            move,
            level: rank(),
          });
          if (seq === mentorSeq) {
            mentor = r;
            mentorText = r.advice || "Đang dùng hướng dẫn trên thiết bị.";
            render();
          }
        } catch {}
      }
    } else if (a === "lesson" || a === "exam") lesson(i, a === "exam");
    else if (a === "daily")
      puzzleDialog(Math.floor(Date.now() / 86400000) % 10);
    else if (a === "answer") {
      const { i: l, exam } = challenge;
      if (i !== lessons[l][4]) {
        toast("Hãy suy nghĩ thêm rồi thử lại");
        return;
      }
      if (exam) puzzleDialog(l, true);
      else {
        record({ type: "lesson", level: l, id: "lesson-" + l, answer: i });
        modal.close();
        render();
        toast("Đã hoàn thành bài học");
      }
    } else if (a === "solve") {
      const { i: l, exam, p } = challenge;
      if (+el.dataset.cell !== p.answer) {
        toast("Nhóm trắng vẫn còn khí. Hãy đếm lại.");
        return;
      }
      if (exam)
        record({
          type: "exam",
          level: l,
          id: "exam-" + l,
          answer: lessons[l][4],
          cell: p.answer,
        });
      dialog(
        exam ? "Đã vượt kỳ thi" : "Giải cục thành công",
        "<h3>" +
          lessons[l][0] +
          "</h3><p>" +
          lessons[l][5] +
          "</p>" +
          (exam ? btn("Xem chứng nhận", "cert", "primary") : ""),
      );
      render();
    } else if (a === "cert") {
      const v = events
        .filter((x) => x.type === "exam")
        .sort((a, b) => b.level - a.level)[0];
      dialog(
        "Chứng nhận kỳ nghệ",
        v
          ? '<div class="tile"><img width="48" src="/art/logo.svg" alt=""><h3>' +
              esc(user?.email || read("names", ["Kỳ thủ"])[0]) +
              "</h3><p>Đã vượt kỳ thi " +
              esc(ranks[v.level]) +
              " của Tê Hoàng Cục.</p><p>" +
              new Date(v.at).toLocaleDateString("vi-VN") +
              "</p></div>" +
              btn("In chứng nhận", "print")
          : "<p>Chứng nhận sẽ mở sau kỳ thi thăng cấp đầu tiên.</p>",
      );
    } else if (a === "print") window.print();
    else if (a === "review")
      review(id, el.dataset.n === undefined ? undefined : +el.dataset.n);
    else if (["login", "register", "recover"].includes(a)) auth(a);
    else if (a === "members") await members();
    else if (a === "approve" || a === "reject")
      await members({ id, action: a });
    else if (a === "linkguest") {
      if (!user) return;
      const merged = new Map(
        [...read("events.guest", []), ...events].map((v) => [v.id, v]),
      );
      events = [...merged.values()];
      write(key("events"), events);
      if (!active && read("active.guest", null)) {
        active = read("active.guest", null);
        game = replay(active.game, active.w, active.moves);
        storeGame();
      }
      await sync();
      write("events.guest", []);
      write("active.guest", null);
      modal.close();
      render();
      toast("Đã liên kết hồ sơ khách");
    } else if (a === "logout") {
      await sync();
      await api("logout", {});
      user = null;
      loadOwner("guest");
      modal.close();
      go("home");
      render();
    } else if (a === "newcode") {
      dialog(
        "Tạo mã khôi phục",
        '<form id="rcform" class="method"><label>Mật khẩu hiện tại<input type="password" name="password" required autocomplete="current-password"></label><button class="btn primary">Tạo mã riêng</button></form>',
      );
      $("#rcform").onsubmit = async (ev) => {
        ev.preventDefault();
        try {
          const r = await api(
            "recovery-code",
            Object.fromEntries(new FormData(ev.target)),
          );
          dialog(
            "Mã khôi phục",
            "<p>Lưu mã này ở nơi riêng tư.</p><code>" + esc(r.code) + "</code>",
          );
        } catch (err) {
          toast(err.message);
        }
      };
    } else if (a === "brand")
      dialog(
        "Ấn Sơn Đình",
        '<img src="/art/logo.svg" width="72" alt="Ấn Sơn Đình"><h3>Tĩnh tâm, sáng nước cờ.</h3><p>Mái đình là nơi bạn cờ gặp gỡ. Quân cờ dưới mái nhắc người chơi dừng một nhịp trước khi hạ quân.</p><p><b>Xanh tùng #183F36 · Vàng cổ #C69D58</b></p><p>Núi, thông và các lớp sương gợi tranh sơn thủy trên nền giấy gạo.</p>',
      );
  } catch (err) {
    toast(err.message);
  }
});
$("#close").onclick = () => modal.close();
$("#account").onclick = profile;
window.addEventListener("hashchange", () => {
  modal.close();
  render();
  window.scrollTo(0, 0);
});
async function online() {
  try {
    const d = await api("me");
    live = true;
    user = d.user;
    loadOwner(user?.id || "guest");
    await sync();
    mentor = user ? await api("mentor") : null;
    render();
  } catch {
    live = false;
    render();
  }
}
render();
online();
window.addEventListener("online", online);
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
