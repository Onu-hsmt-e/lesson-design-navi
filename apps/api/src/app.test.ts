import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("buildApp(本物のアプリの組み込み)", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      appOrigin: "https://example.com",
      isProduction: true,
    });
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

  it("Origin なし・別サイトの POST は 403(ルートが無くても、フックが先に効く)", async () => {
    const none = await app.inject({ method: "POST", url: "/any" });
    expect(none.statusCode).toBe(403);
    const evil = await app.inject({
      method: "POST",
      url: "/any",
      headers: { origin: "https://evil.example" },
    });
    expect(evil.statusCode).toBe(403);
  });

  it("許可した Origin の POST は、フックを通って(ルートが無いので)404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/any",
      headers: { origin: "https://example.com" },
    });
    expect(res.statusCode).toBe(404);
  });
});
