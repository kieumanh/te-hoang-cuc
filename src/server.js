import { replay } from "./engine.js";
import { ranks, eligible, stats, lessons, puzzle } from "./academy.js";
const enc = new TextEncoder(),
  hex = (b) =>
    Array.from(new Uint8Array(b), (v) => v.toString(16).padStart(2, "0")).join(
      "",
    );
const token = () => crypto.randomUUID() + crypto.randomUUID();
async function digest(v) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(v)));
}
async function hash(v, s) {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(v),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: enc.encode(s),
        iterations: 100000,
      },
      k,
      256,
    ),
  );
}
const fail = (msg, status = 400) => {
  throw Object.assign(new Error(msg), { status });
};
export async function api(req, env) {
  const path = new URL(req.url).pathname.slice(5),
    post = req.method === "POST",
    db = env.DB;
  const reply = (v, headers = {}) =>
    Response.json(v, { headers: { "Cache-Control": "no-store", ...headers } });
  try {
    if (!["GET", "POST"].includes(req.method))
      fail("Phương thức không hợp lệ", 405);
    if (post && req.headers.get("origin") !== new URL(req.url).origin)
      fail("Nguồn yêu cầu không hợp lệ", 403);
    if (post && Number(req.headers.get("content-length")) > 100000)
      fail("Dữ liệu quá lớn", 413);
    const raw = post ? await req.text() : "{}";
    if (raw.length > 100000) fail("Dữ liệu quá lớn", 413);
    const body = JSON.parse(raw);
    const email = String(body.email || "")
        .trim()
        .toLowerCase(),
      password = String(body.password || "");
    const cookie = (req.headers.get("cookie") || "").match(
      /(?:^|;\s*)thc=([\w-]+)/,
    )?.[1];
    const sk = cookie ? await digest(cookie) : "",
      now = Date.now();
    const user = cookie
      ? await db
          .prepare(
            "SELECT u.id,u.email,u.role FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.status='active'",
          )
          .bind(sk, now)
          .first()
      : null;
    if (path === "me" && !post) return reply({ user });
    if (post && ["login", "register", "recover"].includes(path)) {
      const key =
        path +
        ":" +
        (req.headers.get("cf-connecting-ip") || "local") +
        ":" +
        Math.floor(now / 900000);
      const rate = await db
        .prepare(
          "INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET n=n+1 RETURNING n",
        )
        .bind(key, now + 900000)
        .first();
      if (rate.n > 25) fail("Vui lòng thử lại sau 15 phút", 429);
      await db.prepare("DELETE FROM limits WHERE until<?").bind(now).run();
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        password.length > 256
      )
        fail("Kiểm tra lại email và mật khẩu");
      if (path === "login") {
        const u = await db
          .prepare("SELECT * FROM users WHERE email=?")
          .bind(email)
          .first();
        if (!u || (await hash(password, u.salt)) !== u.hash)
          fail("Email hoặc mật khẩu chưa đúng", 401);
        if (u.status !== "active")
          fail("Tài khoản đang chờ quản trị viên duyệt", 403);
        const key = token();
        await db
          .prepare("INSERT INTO sessions VALUES(?,?,?)")
          .bind(await digest(key), u.id, now + 14 * 86400000)
          .run();
        return reply(
          { user: { id: u.id, email: u.email, role: u.role } },
          {
            "Set-Cookie":
              "thc=" +
              key +
              "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1209600",
          },
        );
      }
      if (password.length < 10) fail("Mật khẩu cần ít nhất 10 ký tự");
      const salt = crypto.randomUUID(),
        h = await hash(password, salt),
        code = token().slice(0, 24),
        rc = await digest(code);
      if (path === "register") {
        const r = await db
          .prepare(
            "INSERT OR IGNORE INTO users(id,email,hash,salt,recovery) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM users WHERE status='pending')<20",
          )
          .bind(crypto.randomUUID(), email, h, salt, rc)
          .run();
        if (!r.meta.changes) fail("Email đã đăng ký hoặc danh sách chờ đã đầy");
        return reply({ code });
      }
      const old = await digest(String(body.code || ""));
      const u = await db
        .prepare("SELECT id FROM users WHERE email=? AND recovery=?")
        .bind(email, old)
        .first();
      if (!u) fail("Mã khôi phục không hợp lệ");
      const batch = await db.batch([
        db
          .prepare(
            "UPDATE users SET hash=?,salt=?,recovery=? WHERE id=? AND recovery=?",
          )
          .bind(h, salt, rc, u.id, old),
        db.prepare("DELETE FROM sessions WHERE user_id=?").bind(u.id),
      ]);
      if (!batch[0].meta.changes) fail("Mã đã dùng");
      return reply({ code });
    }
    if (!user) fail("Vui lòng đăng nhập", 401);
    if (path === "logout" && post) {
      await db.prepare("DELETE FROM sessions WHERE token=?").bind(sk).run();
      return reply(
        { ok: true },
        {
          "Set-Cookie":
            "thc=; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Path=/",
        },
      );
    }
    if (path === "recovery-code" && post) {
      const u = await db
        .prepare("SELECT * FROM users WHERE id=?")
        .bind(user.id)
        .first();
      if ((await hash(password, u.salt)) !== u.hash) fail("Mật khẩu chưa đúng");
      const code = token().slice(0, 24);
      await db
        .prepare("UPDATE users SET recovery=? WHERE id=?")
        .bind(await digest(code), user.id)
        .run();
      return reply({ code });
    }
    if (path === "members" && user.role === "admin") {
      if (post) {
        if (!["approve", "reject"].includes(body.action))
          fail("Thao tác không hợp lệ");
        const q =
          body.action === "approve"
            ? "UPDATE users SET status='active' WHERE id=? AND status='pending' AND (SELECT count(*) FROM users WHERE status='active')<5"
            : "DELETE FROM users WHERE id=? AND status='pending'";
        const r = await db.prepare(q).bind(body.id).run();
        if (!r.meta.changes) fail("Đã đủ 5 tài khoản hoặc yêu cầu đã xử lý");
      }
      return reply({
        members: (
          await db
            .prepare("SELECT id,email,status,role FROM users ORDER BY email")
            .all()
        ).results,
      });
    }
    if (path === "mentor") {
      const day = new Date(now + 7 * 3600000).toISOString().slice(0, 10),
        counter = "mentor:" + day;
      const enabled = Boolean(
        env.GEMINI_FREE_KEY &&
          env.GEMINI_FREE_MODEL &&
          env.MENTOR_FREE_ONLY === "confirmed",
      );
      const used = async () =>
        Number(
          (
            await db
              .prepare("SELECT n FROM limits WHERE key=?")
              .bind(counter)
              .first()
          )?.n || 0,
        );
      if (!post || !enabled)
        return reply({ enabled, remaining: 75 - (await used()) });
      const g = body.game,
        move = String(body.move || "");
      if (
        !["go", "chess", "xiangqi"].includes(g) ||
        !/^([A-S][0-9]{1,2})(-[A-S][0-9]{1,2})?$/.test(move) ||
        !Number.isInteger(body.level) ||
        !ranks[body.level]
      )
        fail("Nước đi không hợp lệ");
      const slot = crypto.randomUUID();
      await db.prepare("DELETE FROM limits WHERE until<?").bind(now).run();
      const lock = await db
        .prepare(
          "INSERT INTO limits SELECT ?,1,? WHERE (SELECT COUNT(*) FROM limits WHERE key LIKE 'mentor-live:%')<2",
        )
        .bind("mentor-live:" + slot, now + 20000)
        .run();
      if (!lock.meta.changes)
        return reply({ enabled, remaining: 75 - (await used()), busy: true });
      try {
        const inc = await db
          .prepare(
            "INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET n=n+1 WHERE n<75 RETURNING n",
          )
          .bind(counter, now + 86400000)
          .first();
        if (!inc) return reply({ enabled, remaining: 0 });
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" +
            encodeURIComponent(env.GEMINI_FREE_MODEL) +
            ":generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": env.GEMINI_FREE_KEY,
            },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text:
                        "Bạn là thầy cờ nói tiếng Việt. Người học đang chơi " +
                        g +
                        ", cấp " +
                        (body.level + 1) +
                        ". Engine gợi ý " +
                        move +
                        ". Viết một câu hỏi ngắn để người học tự kiểm tra nước này. Không khẳng định tình thế bàn hoặc đề xuất nước khác.",
                    },
                  ],
                },
              ],
              generationConfig: { maxOutputTokens: 160 },
            }),
          },
        );
        if (!res.ok) return reply({ enabled, remaining: 75 - inc.n });
        const j = await res.json();
        return reply({
          enabled,
          remaining: 75 - inc.n,
          advice: String(
            j.candidates?.[0]?.content?.parts?.[0]?.text || "",
          ).slice(0, 800),
        });
      } finally {
        await db
          .prepare("DELETE FROM limits WHERE key=?")
          .bind("mentor-live:" + slot)
          .run();
      }
    }
    if (path === "activity") {
      if (post) {
        const e = body.event;
        if (
          !e ||
          !/^[-\w]{1,90}$/.test(e.id) ||
          !Number.isInteger(e.level) ||
          !ranks[e.level] ||
          !["match", "lesson", "exam"].includes(e.type)
        )
          fail("Hoạt động không hợp lệ");
        if (
          await db
            .prepare("SELECT id FROM activity WHERE user_id=? AND id=?")
            .bind(user.id, e.id)
            .first()
        )
          return reply({ ok: true });
        if (e.type !== "match") {
          const past = (
            await db
              .prepare(
                "SELECT data FROM activity WHERE user_id=? ORDER BY rowid",
              )
              .bind(user.id)
              .all()
          ).results.map((v) => JSON.parse(v.data));
          if (
            e.level > stats(past).rank ||
            e.id !== e.type + "-" + e.level ||
            e.answer !== lessons[e.level][4]
          )
            fail("Bài học chưa đủ điều kiện");
          if (
            e.type === "exam" &&
            (!eligible(past, e.level) || e.cell !== puzzle(e.level).answer)
          )
            fail("Chưa đủ điều kiện thăng cấp");
        }
        if (e.type === "match") {
          if (
            !["ai", "bot", "master", "duo"].includes(e.mode) ||
            !Array.isArray(e.moves) ||
            e.moves.length > 1500 ||
            ![0, 1].includes(e.rival)
          )
            fail("Kỳ phổ không hợp lệ");
          const s = replay(e.game, e.w, e.moves);
          if (
            e.result !== (s.end ?? (e.resign ? -s.turn : null)) ||
            e.result === null
          )
            fail("Kết quả không khớp kỳ phổ");
        }
        await db
          .prepare("INSERT OR IGNORE INTO activity VALUES(?,?,?)")
          .bind(user.id, e.id, JSON.stringify(e))
          .run();
        return reply({ ok: true });
      }
      return reply({
        events: (
          await db
            .prepare("SELECT data FROM activity WHERE user_id=? ORDER BY rowid")
            .bind(user.id)
            .all()
        ).results.map((r) => JSON.parse(r.data)),
      });
    }
    fail("Không có quyền truy cập", 403);
  } catch (e) {
    return Response.json(
      { error: e.status ? e.message : "Không thể xử lý yêu cầu" },
      { status: e.status || 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
