import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { createPrismaStores, isUniqueViolation } from "./prisma-stores.js";

function fakePrisma(create: () => Promise<unknown>) {
  return { user: { create } } as unknown as PrismaClient;
}

describe("isUniqueViolation", () => {
  it("Prisma の P2002 だけが、重複(unique 違反)", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("P2002")).toBe(false);
  });
});

describe("createPrismaStores の userStore.create", () => {
  const input = { email: "a@example.com", passwordHash: "h" };

  it("成功したら、ユーザーを返す", async () => {
    const user = { id: "u1", email: input.email, passwordHash: "h" };
    const { userStore } = createPrismaStores(
      fakePrisma(() => Promise.resolve(user)),
    );
    expect(await userStore.create(input)).toEqual({ ok: true, user });
  });

  it("P2002 は、duplicate に変換する", async () => {
    const error = Object.assign(new Error("unique"), { code: "P2002" });
    const { userStore } = createPrismaStores(
      fakePrisma(() => Promise.reject(error)),
    );
    expect(await userStore.create(input)).toEqual({
      ok: false,
      reason: "duplicate",
    });
  });

  it("それ以外のエラーは、握りつぶさず投げる", async () => {
    const { userStore } = createPrismaStores(
      fakePrisma(() => Promise.reject(new Error("db down"))),
    );
    await expect(userStore.create(input)).rejects.toThrow("db down");
  });
});
