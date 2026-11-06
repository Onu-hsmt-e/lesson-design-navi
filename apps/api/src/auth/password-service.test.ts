import { describe, expect, it } from "vitest";
import { createPasswordService } from "./password-service.js";

describe("createPasswordService", () => {
  it("存在しないユーザー(ハッシュなし)でも、ダミーで検証を1回走らせ、必ず false", async () => {
    const calls: [string, string][] = [];
    const service = await createPasswordService({
      hash: (p) => Promise.resolve(`h:${p}`),
      verify: (h, p) => {
        calls.push([h, p]);
        return Promise.resolve(true); // 検証が true を返しても、結果は false になる
      },
    });
    expect(await service.verify(undefined, "whatever-password")).toBe(false);
    expect(calls).toEqual([
      ["h:dummy-password-for-timing", "whatever-password"],
    ]);
  });

  it("ハッシュがあれば、そのハッシュで検証した結果を返す", async () => {
    const calls: [string, string][] = [];
    const service = await createPasswordService({
      hash: (p) => Promise.resolve(`h:${p}`),
      verify: (h, p) => {
        calls.push([h, p]);
        return Promise.resolve(h === `h:${p}`);
      },
    });
    expect(await service.verify("h:secret-password", "secret-password")).toBe(
      true,
    );
    expect(await service.verify("h:secret-password", "other-password")).toBe(
      false,
    );
    expect(calls).toHaveLength(2);
  });

  it("ダミーのハッシュは、起動時に1回だけ作る", async () => {
    let hashCalls = 0;
    const service = await createPasswordService({
      hash: (p) => {
        hashCalls += 1;
        return Promise.resolve(`h:${p}`);
      },
      verify: () => Promise.resolve(false),
    });
    expect(hashCalls).toBe(1);
    await service.verify(undefined, "whatever-password");
    await service.verify(undefined, "whatever-password");
    expect(hashCalls).toBe(1);
  });
});
