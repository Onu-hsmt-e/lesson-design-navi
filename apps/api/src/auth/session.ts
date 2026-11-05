import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "session";
// 有効期限は7日の固定(使っても延長しない)
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 32バイトの base64url は、43文字になる
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type SessionRecord = {
  id: string; // トークンの SHA-256 ハッシュ(トークンそのものは保存しない)
  userId: string;
  expiresAt: Date;
};

// DB の出し入れの窓口。本物(Prisma)は後で作り、テストでは偽物を使う。
// find / remove が失敗したときは、握りつぶさず例外のまま投げる。
// null は「セッションが無い・期限切れ」のときだけ。
export interface SessionStore {
  create(record: SessionRecord): Promise<void>;
  find(id: string): Promise<SessionRecord | null>;
  remove(id: string): Promise<void>;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  store: SessionStore,
  userId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await store.create({ id: hashSessionToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function validateSession(
  store: SessionStore,
  token: string,
  now: Date = new Date(),
): Promise<{ userId: string } | null> {
  // 形式が違う値は、DB を引かずに無効にする
  if (!TOKEN_PATTERN.test(token)) return null;
  const record = await store.find(hashSessionToken(token));
  if (!record) return null;
  if (record.expiresAt.getTime() <= now.getTime()) {
    // 期限切れの行は、見つけたときに消す(2-11 のスクリプトは取りこぼしの掃除)
    await store.remove(record.id);
    return null;
  }
  return { userId: record.userId };
}

export async function destroySession(
  store: SessionStore,
  token: string,
): Promise<void> {
  if (!TOKEN_PATTERN.test(token)) return;
  await store.remove(hashSessionToken(token));
}
