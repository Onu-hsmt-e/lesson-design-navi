import { describe, expect, it } from "vitest";
import { emailSchema, loginSchema, registerSchema } from "./auth.js";

// 254文字ちょうどのメール(ローカル部64 + @ + 63 + . + 63 + . + 61)
const email254 = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
const email255 = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}`;

describe("emailSchema", () => {
  it("前後の空白を除き、小文字にそろえる", () => {
    expect(emailSchema.parse("  Test@Example.COM ")).toBe("test@example.com");
  });

  it("形式が違う値は不可", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
  });

  it("254文字ちょうどは可、255文字は不可", () => {
    expect(email254).toHaveLength(254);
    expect(email255).toHaveLength(255);
    expect(emailSchema.safeParse(email254).success).toBe(true);
    expect(emailSchema.safeParse(email255).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("パスワードの規則(12〜128文字)が効く", () => {
    const email = "a@example.com";
    expect(
      registerSchema.safeParse({ email, password: "a".repeat(11) }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ email, password: "a".repeat(12) }).success,
    ).toBe(true);
  });
});

describe("loginSchema", () => {
  it("最小長は求めず、空文字と129文字以上は不可", () => {
    const email = "a@example.com";
    expect(loginSchema.safeParse({ email, password: "short" }).success).toBe(
      true,
    );
    expect(loginSchema.safeParse({ email, password: "" }).success).toBe(false);
    expect(
      loginSchema.safeParse({ email, password: "a".repeat(129) }).success,
    ).toBe(false);
  });
});
