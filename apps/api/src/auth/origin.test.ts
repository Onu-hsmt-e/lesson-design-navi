import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOriginCheck, isOriginAllowed } from "./origin.js";

const allowed = ["http://localhost:5173"];

describe("isOriginAllowed", () => {
  it("GET と HEAD は Origin を問わず通る", () => {
    expect(isOriginAllowed("GET", undefined, allowed)).toBe(true);
    expect(isOriginAllowed("HEAD", "http://evil.example", allowed)).toBe(true);
  });

  it("状態を変えるメソッドは、許可した Origin だけ通る", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(isOriginAllowed(method, "http://localhost:5173", allowed)).toBe(
        true,
      );
      expect(isOriginAllowed(method, "http://evil.example", allowed)).toBe(
        false,
      );
      expect(isOriginAllowed(method, undefined, allowed)).toBe(false);
    }
  });
});

describe("createOriginCheck(Fastify に組み込んだ場合)", () => {
  const app = Fastify();
  app.addHook("onRequest", createOriginCheck(allowed));
  app.get("/x", () => ({ ok: true }));
  app.post("/x", () => ({ ok: true }));

  beforeAll(async () => {
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("GET は Origin なしで 200", async () => {
    const res = await app.inject({ method: "GET", url: "/x" });
    expect(res.statusCode).toBe(200);
  });

  it("POST は Origin なし・別サイトなら 403、許可した Origin なら 200", async () => {
    const none = await app.inject({ method: "POST", url: "/x" });
    expect(none.statusCode).toBe(403);

    const evil = await app.inject({
      method: "POST",
      url: "/x",
      headers: { origin: "http://evil.example" },
    });
    expect(evil.statusCode).toBe(403);

    const ok = await app.inject({
      method: "POST",
      url: "/x",
      headers: { origin: "http://localhost:5173" },
    });
    expect(ok.statusCode).toBe(200);
  });
});
