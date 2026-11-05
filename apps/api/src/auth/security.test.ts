import { describe, expect, it } from "vitest";
import { loadSecurityConfig } from "./security.js";

describe("loadSecurityConfig", () => {
  it("開発では、未設定なら開発用の Origin になる", () => {
    expect(loadSecurityConfig({})).toEqual({
      appOrigin: "http://localhost:5173",
      isProduction: false,
    });
  });

  it("本番では、未設定・空文字なら起動時に例外になる", () => {
    expect(() => loadSecurityConfig({ NODE_ENV: "production" })).toThrow(
      "APP_ORIGIN is required in production",
    );
    expect(() =>
      loadSecurityConfig({ NODE_ENV: "production", APP_ORIGIN: "  " }),
    ).toThrow("APP_ORIGIN is required in production");
  });

  it("本番で設定があれば、isProduction が true になる", () => {
    expect(
      loadSecurityConfig({
        NODE_ENV: "production",
        APP_ORIGIN: "https://example.com",
      }),
    ).toEqual({ appOrigin: "https://example.com", isProduction: true });
  });

  it("末尾のスラッシュやパスがあっても、Origin の形にそろえる", () => {
    expect(
      loadSecurityConfig({ APP_ORIGIN: "https://example.com/" }).appOrigin,
    ).toBe("https://example.com");
    expect(
      loadSecurityConfig({ APP_ORIGIN: "https://example.com/app/" }).appOrigin,
    ).toBe("https://example.com");
  });

  it("URL として不正な値は、例外になる", () => {
    expect(() => loadSecurityConfig({ APP_ORIGIN: "example.com" })).toThrow();
    expect(() =>
      loadSecurityConfig({ APP_ORIGIN: "localhost:5173" }),
    ).toThrow();
  });
});
