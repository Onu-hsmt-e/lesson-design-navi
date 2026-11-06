import { describe, expect, it } from "vitest";
import { loadTrustProxy } from "./proxy.js";

describe("loadTrustProxy", () => {
  it("未設定・空・0 は、信用しない", () => {
    expect(loadTrustProxy({})).toBe(false);
    expect(loadTrustProxy({ TRUST_PROXY_HOPS: "" })).toBe(false);
    expect(loadTrustProxy({ TRUST_PROXY_HOPS: "0" })).toBe(false);
  });

  it("台数は、数字で返す", () => {
    expect(loadTrustProxy({ TRUST_PROXY_HOPS: "1" })).toBe(1);
    expect(loadTrustProxy({ TRUST_PROXY_HOPS: " 2 " })).toBe(2);
  });

  it("台数以外の値は、起動時に例外にする(true も不可)", () => {
    for (const bad of ["true", "-1", "1.5", "abc", "100"]) {
      expect(() => loadTrustProxy({ TRUST_PROXY_HOPS: bad })).toThrow();
    }
  });
});
