import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_MS,
  createSession,
  destroySession,
  generateSessionToken,
  hashSessionToken,
  validateSession,
  type SessionRecord,
  type SessionStore,
} from "./session.js";

function createFakeStore() {
  const records = new Map<string, SessionRecord>();
  const calls = { find: 0, remove: 0 };
  const store: SessionStore = {
    create(record) {
      records.set(record.id, record);
      return Promise.resolve();
    },
    find(id) {
      calls.find += 1;
      return Promise.resolve(records.get(id) ?? null);
    },
    remove(id) {
      calls.remove += 1;
      records.delete(id);
      return Promise.resolve();
    },
  };
  return { store, records, calls };
}

const now = new Date("2026-11-05T00:00:00Z");

describe("session token", () => {
  it("32バイトのランダム値(43文字の base64url)で、毎回違う", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
  });

  it("SHA-256 のハッシュ(64桁の16進数)で、トークンとは別の値", () => {
    const token = generateSessionToken();
    const h = hashSessionToken(token);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(token);
    expect(hashSessionToken(token)).toBe(h);
  });
});

describe("session", () => {
  it("有効期限は7日の固定", () => {
    expect(SESSION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("DB にはハッシュだけを保存し、トークンそのものは保存しない", async () => {
    const { store, records } = createFakeStore();
    const { token, expiresAt } = await createSession(store, "user-1", now);
    expect(records.has(token)).toBe(false);
    expect(records.get(hashSessionToken(token))?.userId).toBe("user-1");
    expect(expiresAt.getTime()).toBe(now.getTime() + SESSION_TTL_MS);
  });

  it("期限内のトークンは通り、DB に無いトークンは通らない", async () => {
    const { store } = createFakeStore();
    const { token } = await createSession(store, "user-1", now);
    expect(await validateSession(store, token, now)).toEqual({
      userId: "user-1",
    });
    expect(
      await validateSession(store, generateSessionToken(), now),
    ).toBeNull();
  });

  it("期限の直前に使っても、期限は延長されない", async () => {
    const { store, records } = createFakeStore();
    const { token, expiresAt } = await createSession(store, "user-1", now);
    const justBefore = new Date(expiresAt.getTime() - 1);
    expect(await validateSession(store, token, justBefore)).not.toBeNull();
    expect(records.get(hashSessionToken(token))?.expiresAt.getTime()).toBe(
      expiresAt.getTime(),
    );
  });

  it("期限ちょうどと期限後は通らず、期限切れの行は消える", async () => {
    const a = createFakeStore();
    const sa = await createSession(a.store, "user-1", now);
    expect(await validateSession(a.store, sa.token, sa.expiresAt)).toBeNull();
    expect(a.records.has(hashSessionToken(sa.token))).toBe(false);

    const b = createFakeStore();
    const sb = await createSession(b.store, "user-1", now);
    const later = new Date(sb.expiresAt.getTime() + 24 * 60 * 60 * 1000);
    expect(await validateSession(b.store, sb.token, later)).toBeNull();
    expect(b.records.has(hashSessionToken(sb.token))).toBe(false);
  });

  it("ログアウトしたトークンは通らない", async () => {
    const { store } = createFakeStore();
    const { token } = await createSession(store, "user-1", now);
    await destroySession(store, token);
    expect(await validateSession(store, token, now)).toBeNull();
  });

  it("形式が違うトークンは、DB を引かずに無効になる", async () => {
    const { store, calls } = createFakeStore();
    for (const bad of ["", "short", "a".repeat(44), `${"a".repeat(42)}!`]) {
      expect(await validateSession(store, bad, now)).toBeNull();
      await destroySession(store, bad);
    }
    expect(calls.find).toBe(0);
    expect(calls.remove).toBe(0);
  });

  it("DB の失敗は握りつぶさず、例外のまま投げる", async () => {
    const failing: SessionStore = {
      create: () => Promise.resolve(),
      find: () => Promise.reject(new Error("db down")),
      remove: () => Promise.resolve(),
    };
    await expect(
      validateSession(failing, generateSessionToken(), now),
    ).rejects.toThrow("db down");
  });
});
