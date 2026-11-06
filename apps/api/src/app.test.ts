import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createPasswordService } from "./auth/password-service.js";
import {
  createFakeSessionStore,
  createFakeUserStore,
} from "./testing/fakes.js";

const passwords = await createPasswordService({
  hash: (p) => Promise.resolve(`h:${p}`),
  verify: () => Promise.resolve(false),
});

describe("buildApp(本物のアプリの組み込み)", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp(
      { appOrigin: "https://example.com", isProduction: true },
      {
        userStore: createFakeUserStore().store,
        sessionStore: createFakeSessionStore().store,
        passwords,
      },
    );
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("Cookie プラグインが入っている", () => {
    expect(app.hasReplyDecorator("setCookie")).toBe(true);
  });

  it("GET /health は、Origin なしで 200", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("Origin なし・別サイトの POST は 403(認証 API にも効く)", async () => {
    const none = await app.inject({ method: "POST", url: "/auth/login" });
    expect(none.statusCode).toBe(403);
    const evil = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { origin: "https://evil.example" },
    });
    expect(evil.statusCode).toBe(403);
  });

  it("許可した Origin の POST は、フックを通って、ルートに届く(入力が空なので 400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { origin: "https://example.com" },
    });
    expect(res.statusCode).toBe(400);
  });
});
