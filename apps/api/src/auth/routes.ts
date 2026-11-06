import rateLimit from "@fastify/rate-limit";
import { loginSchema, registerSchema } from "@lesson/shared";
import type { FastifyInstance } from "fastify";
import { sessionCookieClearOptions, sessionCookieOptions } from "./cookie.js";
import type { PasswordService } from "./password-service.js";
import {
  SESSION_COOKIE_NAME,
  createSession,
  destroySession,
  validateSession,
  type SessionStore,
} from "./session.js";
import type { UserRecord, UserStore } from "./user-store.js";
import { createWindowCounter } from "./window-counter.js";

export type AuthDeps = {
  userStore: UserStore;
  sessionStore: SessionStore;
  passwords: PasswordService;
};

type Limit = { max: number; timeWindow: number };
export type AuthLimits = {
  login: Limit; // IP アドレスごと
  register: Limit; // IP アドレスごと
  globalLogin: Limit; // IP を問わない全体の上限
  globalRegister: Limit; // IP を問わない全体の上限
};
export type AuthRoutesConfig = { isProduction: boolean; limits: AuthLimits };

export const DEFAULT_AUTH_LIMITS: AuthLimits = {
  login: { max: 10, timeWindow: 15 * 60 * 1000 },
  register: { max: 5, timeWindow: 60 * 60 * 1000 },
  globalLogin: { max: 600, timeWindow: 15 * 60 * 1000 },
  globalRegister: { max: 200, timeWindow: 60 * 60 * 1000 },
};

const RATE_LIMITED_BODY = {
  error: "rate_limited",
  message: "しばらくしてから、もう一度お試しください",
} as const;

// 失敗の文言は、1種類だけ(メールが無いのか、パスワードが違うのかを教えない)
const INVALID_CREDENTIALS = {
  error: "invalid_credentials",
  message: "メールまたはパスワードが違います",
} as const;

const EMAIL_TAKEN = {
  error: "email_taken",
  message: "このメールアドレスは登録済みです",
} as const;

function publicUser(user: UserRecord) {
  return { id: user.id, email: user.email };
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: AuthDeps,
  config: AuthRoutesConfig,
): Promise<void> {
  const globalLogin = createWindowCounter(
    config.limits.globalLogin.max,
    config.limits.globalLogin.timeWindow,
  );
  const globalRegister = createWindowCounter(
    config.limits.globalRegister.max,
    config.limits.globalRegister.timeWindow,
  );

  // global: false … 指定したルートにだけ、IP ごとの回数制限をかける
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => ({ statusCode: 429, ...RATE_LIMITED_BODY }),
  });

  app.post(
    "/auth/register",
    { config: { rateLimit: config.limits.register } },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_input" });
      // 入力が正しいものだけ、全体の上限に数える(重い処理の前で判定する)
      if (!globalRegister.tryTake())
        return reply.code(429).send(RATE_LIMITED_BODY);
      const { email, password } = parsed.data;

      // 登録済みなら、重いハッシュ計算をせずに断る
      if (await deps.userStore.findByEmail(email))
        return reply.code(409).send(EMAIL_TAKEN);

      const result = await deps.userStore.create({
        email,
        passwordHash: await deps.passwords.hash(password),
      });
      // 同時に同じメールが登録された場合(DB の unique で判定)
      if (!result.ok) return reply.code(409).send(EMAIL_TAKEN);

      // 登録した直後は、ログインした状態にする
      const { token, expiresAt } = await createSession(
        deps.sessionStore,
        result.user.id,
      );
      reply.setCookie(
        SESSION_COOKIE_NAME,
        token,
        sessionCookieOptions(expiresAt, config.isProduction),
      );
      return reply.code(201).send({ user: publicUser(result.user) });
    },
  );

  app.post(
    "/auth/login",
    { config: { rateLimit: config.limits.login } },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid_input" });
      if (!globalLogin.tryTake())
        return reply.code(429).send(RATE_LIMITED_BODY);
      const { email, password } = parsed.data;

      const user = await deps.userStore.findByEmail(email);
      // user が無いときも、ダミーで検証を1回走らせる(false が返る)
      const passwordOk = await deps.passwords.verify(
        user?.passwordHash,
        password,
      );
      if (!user || !passwordOk)
        return reply.code(401).send(INVALID_CREDENTIALS);

      // 新しいセッションを先に作ってから、古いものを消す(作成に失敗しても、古いセッションは残る)
      const { token, expiresAt } = await createSession(
        deps.sessionStore,
        user.id,
      );
      const oldToken = request.cookies[SESSION_COOKIE_NAME];
      if (oldToken) await destroySession(deps.sessionStore, oldToken);

      reply.setCookie(
        SESSION_COOKIE_NAME,
        token,
        sessionCookieOptions(expiresAt, config.isProduction),
      );
      return reply.send({ user: publicUser(user) });
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) await destroySession(deps.sessionStore, token);
    reply.clearCookie(
      SESSION_COOKIE_NAME,
      sessionCookieClearOptions(config.isProduction),
    );
    return reply.code(204).send();
  });

  // GET は、状態を変えない(読むだけ)
  app.get("/auth/me", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "unauthenticated" });
    const session = await validateSession(deps.sessionStore, token);
    if (!session) return reply.code(401).send({ error: "unauthenticated" });
    const user = await deps.userStore.findById(session.userId);
    if (!user) return reply.code(401).send({ error: "unauthenticated" });
    return reply.send({ user: publicUser(user) });
  });
}
