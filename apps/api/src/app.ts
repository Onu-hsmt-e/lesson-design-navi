import Fastify from "fastify";
import { applySecurity, type SecurityConfig } from "./auth/security.js";

export async function buildApp(config: SecurityConfig) {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  // ルートを登録するより前に呼ぶ(フックは、あとから登録したルートにだけ効く)
  await applySecurity(app, config);

  app.get("/health", async () => {
    return { ok: true };
  });

  return app;
}
