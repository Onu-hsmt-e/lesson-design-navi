import type { OutgoingHttpHeaders } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, type AppOptions } from "../app.js";
import {
  createFakeSessionStore,
  createFakeUserStore,
} from "../testing/fakes.js";
import {
  createPasswordService,
  type PasswordService,
} from "./password-service.js";
import { DEFAULT_AUTH_LIMITS, type AuthLimits } from "./routes.js";
import { hashSessionToken, type SessionStore } from "./session.js";
import type { UserStore } from "./user-store.js";

const ORIGIN = "https://example.com";
const VALID_PW = "correct-horse-battery";
const EMAIL = "test@example.com";

// 本物の argon2 を使う(1回だけ作り、各テストで使い回す)
const passwords = await createPasswordService();

type App = Awaited<ReturnType<typeof buildApp>>;
type MakeOptions = AppOptions & {
  isProduction?: boolean;
  passwords?: PasswordService;
  userStore?: UserStore;
  sessionStore?: SessionStore;
};

const opened: { close: () => Promise<unknown> }[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((a) => a.close()));
});

async function makeApp(opts: MakeOptions = {}) {
  const users = createFakeUserStore();
  const sessions = createFakeSessionStore();
  const {
    isProduction = false,
    passwords: p,
    userStore,
    sessionStore,
    ...appOptions
  } = opts;
  const app = await buildApp(
    { appOrigin: ORIGIN, isProduction },
    {
      userStore: userStore ?? users.store,
      sessionStore: sessionStore ?? sessions.store,
      passwords: p ?? passwords,
    },
    appOptions,
  );
  await app.ready();
  opened.push(app);
  return { app, users, sessions };
}

const loose = { max: 1000, timeWindow: 60_000 };
function limits(overrides: Partial<AuthLimits> = {}): AuthLimits {
  return {
    login: loose,
    register: loose,
    globalLogin: loose,
    globalRegister: loose,
    ...overrides,
  };
}

function post(
  app: App,
  url: string,
  payload?: object,
  headers: Record<string, string> = {},
) {
  return app.inject({
    method: "POST",
    url,
    payload,
    headers: { origin: ORIGIN, ...headers },
  });
}

function getMe(app: App, token?: string) {
  return app.inject({
    method: "GET",
    url: "/auth/me",
    headers: token ? { cookie: `session=${token}` } : {},
  });
}

function setCookieLines(headers: OutgoingHttpHeaders): string[] {
  const raw = headers["set-cookie"];
  if (Array.isArray(raw)) return raw;
  return typeof raw === "string" ? [raw] : [];
}

function sessionCookieLine(headers: OutgoingHttpHeaders): string | undefined {
  return setCookieLines(headers).find((line) => line.startsWith("session="));
}

function sessionToken(headers: OutgoingHttpHeaders): string {
  const first = (sessionCookieLine(headers) ?? "").split(";")[0] ?? "";
  return first.slice("session=".length);
}

describe("設定の固定", () => {
  it("回数制限の上限(IP ごと・全体)", () => {
    expect(DEFAULT_AUTH_LIMITS).toEqual({
      login: { max: 10, timeWindow: 15 * 60 * 1000 },
      register: { max: 5, timeWindow: 60 * 60 * 1000 },
      globalLogin: { max: 600, timeWindow: 15 * 60 * 1000 },
      globalRegister: { max: 200, timeWindow: 60 * 60 * 1000 },
    });
  });
});

describe("POST /auth/register", () => {
  it("登録でき、メールは小文字にそろい、ログインした状態になる", async () => {
    const { app, users, sessions } = await makeApp();
    const res = await post(app, "/auth/register", {
      email: " Test@Example.com ",
      password: VALID_PW,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ user: { id: "user-1", email: EMAIL } });

    const line = sessionCookieLine(res.headers) ?? "";
    expect(line).toContain("HttpOnly");
    expect(line).toContain("SameSite=Lax");
    expect(line).toContain("Path=/");
    expect(line).toContain("Expires=");
    expect(line).not.toContain("Secure");

    // DB には、パスワードもトークンも、そのままでは入らない
    const hash = users.users.get("user-1")?.passwordHash ?? "";
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain(VALID_PW);
    const token = sessionToken(res.headers);
    expect(sessions.records.has(token)).toBe(false);
    expect(sessions.records.has(hashSessionToken(token))).toBe(true);
  });

  it("本番では Cookie に Secure が付く", async () => {
    const { app } = await makeApp({ isProduction: true });
    const res = await post(app, "/auth/register", {
      email: EMAIL,
      password: VALID_PW,
    });
    expect(sessionCookieLine(res.headers)).toContain("Secure");
  });

  it("登録済みのメール(大文字小文字違いも)は、ハッシュ計算をせずに 409 で、Cookie は付かない", async () => {
    let hashCalls = 0;
    const counting: PasswordService = {
      ...passwords,
      hash: (pw) => {
        hashCalls += 1;
        return passwords.hash(pw);
      },
    };
    const { app } = await makeApp({ passwords: counting });
    await post(app, "/auth/register", { email: EMAIL, password: VALID_PW });
    expect(hashCalls).toBe(1);

    const res = await post(app, "/auth/register", {
      email: "TEST@example.com",
      password: VALID_PW,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: "email_taken",
      message: "このメールアドレスは登録済みです",
    });
    expect(sessionCookieLine(res.headers)).toBeUndefined();
    expect(hashCalls).toBe(1);
  });

  it("入力が不正なら 400", async () => {
    const { app, users } = await makeApp();
    const shortPw = await post(app, "/auth/register", {
      email: EMAIL,
      password: "short",
    });
    const badEmail = await post(app, "/auth/register", {
      email: "nope",
      password: VALID_PW,
    });
    const noBody = await post(app, "/auth/register");
    expect([
      shortPw.statusCode,
      badEmail.statusCode,
      noBody.statusCode,
    ]).toEqual([400, 400, 400]);
    expect(users.users.size).toBe(0);
  });

  it("Origin が無い POST は 403", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: EMAIL, password: VALID_PW },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("POST /auth/login", () => {
  it("ログインでき、メールの大文字小文字は問わない", async () => {
    const { app, sessions } = await makeApp();
    await post(app, "/auth/register", { email: EMAIL, password: VALID_PW });
    const res = await post(app, "/auth/login", {
      email: "TEST@EXAMPLE.COM",
      password: VALID_PW,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ user: { id: "user-1", email: EMAIL } });
    expect(
      sessions.records.has(hashSessionToken(sessionToken(res.headers))),
    ).toBe(true);
  });

  it("パスワード違いと、存在しないメールは、同じ 401 と同じ文言", async () => {
    const { app } = await makeApp();
    await post(app, "/auth/register", { email: EMAIL, password: VALID_PW });
    const wrongPw = await post(app, "/auth/login", {
      email: EMAIL,
      password: "wrong-horse-battery",
    });
    const noUser = await post(app, "/auth/login", {
      email: "nobody@example.com",
      password: VALID_PW,
    });
    expect(wrongPw.statusCode).toBe(401);
    expect(noUser.statusCode).toBe(401);
    expect(wrongPw.json()).toEqual({
      error: "invalid_credentials",
      message: "メールまたはパスワードが違います",
    });
    expect(noUser.json()).toEqual(wrongPw.json());
    expect(sessionCookieLine(wrongPw.headers)).toBeUndefined();
  });

  it("存在しないメールでも、パスワードの検証(ダミー)を1回走らせる", async () => {
    const seen: (string | undefined)[] = [];
    const spy: PasswordService = {
      ...passwords,
      verify: (hash, pw) => {
        seen.push(hash);
        return passwords.verify(hash, pw);
      },
    };
    const { app } = await makeApp({ passwords: spy });
    await post(app, "/auth/register", { email: EMAIL, password: VALID_PW });
    await post(app, "/auth/login", {
      email: "nobody@example.com",
      password: VALID_PW,
    });
    await post(app, "/auth/login", {
      email: EMAIL,
      password: "wrong-horse-battery",
    });
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBeUndefined();
    expect(seen[1]?.startsWith("$argon2id$")).toBe(true);
  });

  it("入力が不正なら 400", async () => {
    const { app } = await makeApp();
    const res = await post(app, "/auth/login", { email: EMAIL, password: "" });
    expect(res.statusCode).toBe(400);
  });

  it("このブラウザの古いセッションは消え、新しいセッションができる", async () => {
    const { app, sessions } = await makeApp();
    const reg = await post(app, "/auth/register", {
      email: EMAIL,
      password: VALID_PW,
    });
    const oldToken = sessionToken(reg.headers);
    const res = await post(
      app,
      "/auth/login",
      { email: EMAIL, password: VALID_PW },
      { cookie: `session=${oldToken}` },
    );
    expect(sessions.records.has(hashSessionToken(oldToken))).toBe(false);
    expect(
      sessions.records.has(hashSessionToken(sessionToken(res.headers))),
    ).toBe(true);
  });

  it("別の端末のセッションは残る(複数端末を許す)", async () => {
    const { app, sessions } = await makeApp();
    const reg = await post(app, "/auth/register", {
      email: EMAIL,
      password: VALID_PW,
    });
    await post(app, "/auth/login", { email: EMAIL, password: VALID_PW });
    expect(
      sessions.records.has(hashSessionToken(sessionToken(reg.headers))),
    ).toBe(true);
    expect(sessions.records.size).toBe(2);
  });

  it("新しいセッションの作成に失敗しても、古いセッションは消えない(500)", async () => {
    const sessions = createFakeSessionStore();
    let failCreate = false;
    const wrapped: SessionStore = {
      ...sessions.store,
      create: (record) =>
        failCreate
          ? Promise.reject(new Error("db down"))
          : sessions.store.create(record),
    };
    const { app } = await makeApp({ sessionStore: wrapped });
    const reg = await post(app, "/auth/register", {
      email: EMAIL,
      password: VALID_PW,
    });
    const oldToken = sessionToken(reg.headers);

    failCreate = true;
    const res = await post(
      app,
      "/auth/login",
      { email: EMAIL, password: VALID_PW },
      { cookie: `session=${oldToken}` },
    );
    expect(res.statusCode).toBe(500);
    expect(sessions.records.has(hashSessionToken(oldToken))).toBe(true);
  });
});

describe("POST /auth/logout", () => {
  it("セッションと Cookie を消し、以後 /auth/me は 401", async () => {
    const { app, sessions } = await makeApp();
    const reg = await post(app, "/auth/register", {
      email: EMAIL,
      password: VALID_PW,
    });
    const token = sessionToken(reg.headers);
    const res = await post(app, "/auth/logout", undefined, {
      cookie: `session=${token}`,
    });
    expect(res.statusCode).toBe(204);
    const line = sessionCookieLine(res.headers) ?? "";
    expect(line.startsWith("session=;")).toBe(true);
    expect(line).toContain("1970");
    expect(sessions.records.size).toBe(0);
    expect((await getMe(app, token)).statusCode).toBe(401);
  });

  it("Cookie が無くても 204", async () => {
    const { app } = await makeApp();
    const res = await post(app, "/auth/logout");
    expect(res.statusCode).toBe(204);
  });
});

describe("GET /auth/me", () => {
  it("ログイン中は、ユーザーを返す(パスワードのハッシュは含めない)", async () => {
    const { app } = await makeApp();
    const reg = await post(app, "/auth/register", {
      email: EMAIL,
      password: VALID_PW,
    });
    const res = await getMe(app, sessionToken(reg.headers));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ user: { id: "user-1", email: EMAIL } });
    expect(res.body).not.toContain("passwordHash");
  });

  it("GET は状態を変えない(セッションもユーザーも、そのまま)", async () => {
    const { app, users, sessions } = await makeApp();
    const reg = await post(app, "/auth/register", {
      email: EMAIL,
      password: VALID_PW,
    });
    const snapshot = () =>
      JSON.stringify([
        [...sessions.records.entries()],
        [...users.users.entries()],
      ]);
    const before = snapshot();
    await getMe(app, sessionToken(reg.headers));
    await getMe(app);
    expect(snapshot()).toBe(before);
  });

  it("Cookie なし・でたらめな Cookie・ユーザーが消えたあとは 401", async () => {
    const { app, users } = await makeApp();
    const none = await getMe(app);
    const garbage = await getMe(app, "a".repeat(43));
    expect([none.statusCode, garbage.statusCode]).toEqual([401, 401]);

    const reg = await post(app, "/auth/register", {
      email: EMAIL,
      password: VALID_PW,
    });
    users.users.clear();
    expect((await getMe(app, sessionToken(reg.headers))).statusCode).toBe(401);
  });
});

describe("DB・内部の失敗は、握りつぶさず 500(本文は汎用)", () => {
  it("ユーザーの検索が失敗したら、ログインは 500", async () => {
    const users = createFakeUserStore();
    const failing: UserStore = {
      ...users.store,
      findByEmail: () => Promise.reject(new Error("db down")),
    };
    const { app } = await makeApp({ userStore: failing });
    const res = await post(app, "/auth/login", {
      email: EMAIL,
      password: VALID_PW,
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "internal_error" });
    expect(res.body).not.toContain("db down");
  });

  it("セッションの検索が失敗したら、/auth/me は 500(未ログイン扱いにしない)", async () => {
    const sessions = createFakeSessionStore();
    const failing: SessionStore = {
      ...sessions.store,
      find: () => Promise.reject(new Error("db down")),
    };
    const { app } = await makeApp({ sessionStore: failing });
    const res = await getMe(app, "a".repeat(43));
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("db down");
  });

  it("DB に壊れたハッシュがあるときは、「パスワード違い」にせず 500", async () => {
    const { app, users } = await makeApp();
    users.users.set("u1", {
      id: "u1",
      email: EMAIL,
      passwordHash: "not-a-hash",
    });
    const res = await post(app, "/auth/login", {
      email: EMAIL,
      password: VALID_PW,
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "internal_error" });
  });
});

describe("回数制限と負荷", () => {
  it("ログイン(IP ごと): 上限を超えると 429", async () => {
    const { app } = await makeApp({
      limits: limits({ login: { max: 2, timeWindow: 60_000 } }),
    });
    const statuses: number[] = [];
    let last: { error?: string } = {};
    for (let i = 0; i < 3; i += 1) {
      const res = await post(app, "/auth/login", {
        email: EMAIL,
        password: "wrong-horse-battery",
      });
      statuses.push(res.statusCode);
      last = res.json();
    }
    expect(statuses).toEqual([401, 401, 429]);
    expect(last.error).toBe("rate_limited");
  });

  it("登録(IP ごと): 上限を超えると 429 で、アカウントは作られない", async () => {
    const { app, users } = await makeApp({
      limits: limits({ register: { max: 2, timeWindow: 60_000 } }),
    });
    const statuses: number[] = [];
    for (const email of ["a@example.com", "b@example.com", "c@example.com"]) {
      const res = await post(app, "/auth/register", {
        email,
        password: VALID_PW,
      });
      statuses.push(res.statusCode);
    }
    expect(statuses).toEqual([201, 201, 429]);
    expect(users.users.size).toBe(2);
  });

  it("trustProxy が false なら、X-Forwarded-For を偽っても、同じ相手として数える", async () => {
    const { app } = await makeApp({
      trustProxy: false,
      limits: limits({ login: { max: 2, timeWindow: 60_000 } }),
    });
    const statuses: number[] = [];
    for (const ip of ["1.1.1.1", "2.2.2.2", "3.3.3.3"]) {
      const res = await post(
        app,
        "/auth/login",
        { email: EMAIL, password: VALID_PW },
        { "x-forwarded-for": ip },
      );
      statuses.push(res.statusCode);
    }
    expect(statuses).toEqual([401, 401, 429]);
  });

  it("trustProxy が 1 なら、手前のプロキシが伝えた IP ごとに数える", async () => {
    const { app } = await makeApp({
      trustProxy: 1,
      limits: limits({ login: { max: 2, timeWindow: 60_000 } }),
    });
    const statuses: number[] = [];
    for (const ip of ["1.1.1.1", "2.2.2.2", "3.3.3.3"]) {
      const res = await post(
        app,
        "/auth/login",
        { email: EMAIL, password: VALID_PW },
        { "x-forwarded-for": ip },
      );
      statuses.push(res.statusCode);
    }
    expect(statuses).toEqual([401, 401, 401]);
  });

  it("ログイン(全体): IP が違っても、全体の上限を超えると 429", async () => {
    const { app } = await makeApp({
      trustProxy: 1,
      limits: limits({ globalLogin: { max: 2, timeWindow: 60_000 } }),
    });
    const statuses: number[] = [];
    for (const ip of ["1.1.1.1", "2.2.2.2", "3.3.3.3"]) {
      const res = await post(
        app,
        "/auth/login",
        { email: EMAIL, password: VALID_PW },
        { "x-forwarded-for": ip },
      );
      statuses.push(res.statusCode);
    }
    expect(statuses).toEqual([401, 401, 429]);
  });

  it("登録(全体): IP が違っても、全体の上限を超えると 429", async () => {
    const { app, users } = await makeApp({
      trustProxy: 1,
      limits: limits({ globalRegister: { max: 2, timeWindow: 60_000 } }),
    });
    const statuses: number[] = [];
    for (const [i, email] of [
      "a@example.com",
      "b@example.com",
      "c@example.com",
    ].entries()) {
      const res = await post(
        app,
        "/auth/register",
        { email, password: VALID_PW },
        { "x-forwarded-for": `10.0.0.${i + 1}` },
      );
      statuses.push(res.statusCode);
    }
    expect(statuses).toEqual([201, 201, 429]);
    expect(users.users.size).toBe(2);
  });

  it("入力が不正なリクエストは、全体の上限に数えない", async () => {
    const { app } = await makeApp({
      limits: limits({ globalRegister: { max: 1, timeWindow: 60_000 } }),
    });
    const bad = await post(app, "/auth/register", {
      email: "nope",
      password: VALID_PW,
    });
    const ok = await post(app, "/auth/register", {
      email: EMAIL,
      password: VALID_PW,
    });
    expect([bad.statusCode, ok.statusCode]).toEqual([400, 201]);
  });

  it("負荷が上限を超えたら、待たせすぎずに 503(本文は汎用)", async () => {
    let blocking = false;
    let started!: () => void;
    const startedPromise = new Promise<void>((r) => {
      started = r;
    });
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const slow = await createPasswordService({
      hash: async (pw) => {
        if (blocking) {
          started();
          await gate;
        }
        return `h:${pw}`;
      },
      maxConcurrent: 1,
      maxQueue: 0,
    });
    blocking = true;
    const { app } = await makeApp({ passwords: slow });

    const first = post(app, "/auth/register", {
      email: "a@example.com",
      password: VALID_PW,
    });
    await startedPromise;
    const second = await post(app, "/auth/register", {
      email: "b@example.com",
      password: VALID_PW,
    });
    expect(second.statusCode).toBe(503);
    expect(second.json()).toEqual({ error: "server_busy" });

    release();
    expect((await first).statusCode).toBe(201);
  });
});

describe("ログ", () => {
  it("実際のリクエストのログに、パスワードとトークンが出ない", async () => {
    const lines: string[] = [];
    const { app } = await makeApp({
      logStream: {
        write: (message) => {
          lines.push(message);
        },
      },
    });
    const reg = await post(app, "/auth/register", {
      email: EMAIL,
      password: VALID_PW,
    });
    const token = sessionToken(reg.headers);
    await getMe(app, token);

    const logs = lines.join("");
    expect(logs).toContain("request completed");
    expect(logs).not.toContain(VALID_PW);
    expect(logs).not.toContain(token);
  });
});
