import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";
import { createOriginCheck, normalizeOrigin } from "./origin.js";

export type SecurityConfig = {
  appOrigin: string;
  isProduction: boolean;
};

const DEV_APP_ORIGIN = "http://localhost:5173";

// 本番で APP_ORIGIN が無いときは、黙って開発用の値にせず、起動時に失敗させる
export function loadSecurityConfig(env: {
  NODE_ENV?: string | undefined;
  APP_ORIGIN?: string | undefined;
}): SecurityConfig {
  const isProduction = env.NODE_ENV === "production";
  let raw = env.APP_ORIGIN?.trim();
  if (!raw) raw = isProduction ? undefined : DEV_APP_ORIGIN;
  if (!raw) throw new Error("APP_ORIGIN is required in production");
  return { appOrigin: normalizeOrigin(raw), isProduction };
}

// ルートを登録するより前に呼ぶ(フックは、あとから登録したルートにだけ効く)
export async function applySecurity(
  app: FastifyInstance,
  config: SecurityConfig,
): Promise<void> {
  await app.register(cookie);
  app.addHook("onRequest", createOriginCheck([config.appOrigin]));
}
