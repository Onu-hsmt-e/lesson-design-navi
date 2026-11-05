import { describe, expect, it } from "vitest";
import { sessionCookieOptions } from "./cookie.js";

const expiresAt = new Date("2026-11-12T00:00:00Z");

describe("sessionCookieOptions", () => {
  it("HttpOnly・SameSite=Lax・期限つき。開発では Secure なし", () => {
    expect(sessionCookieOptions(expiresAt, false)).toEqual({
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      expires: expiresAt,
    });
  });

  it("本番では Secure が付く", () => {
    expect(sessionCookieOptions(expiresAt, true).secure).toBe(true);
  });
});
