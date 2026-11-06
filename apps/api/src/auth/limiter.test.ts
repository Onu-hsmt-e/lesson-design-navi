import { describe, expect, it } from "vitest";
import { OverloadedError, createConcurrencyLimiter } from "./limiter.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("createConcurrencyLimiter", () => {
  it("同時に動くのは上限までで、残りは順番待ちになる", async () => {
    const run = createConcurrencyLimiter(2, 10);
    const gate = deferred();
    let running = 0;
    let maxRunning = 0;
    const task = async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await gate.promise;
      running -= 1;
    };
    const all = Promise.all([run(task), run(task), run(task), run(task)]);
    await new Promise((r) => setTimeout(r, 20));
    expect(running).toBe(2);
    gate.resolve();
    await all;
    expect(maxRunning).toBe(2);
  });

  it("待ちも上限を超えたら、OverloadedError(503)", async () => {
    const run = createConcurrencyLimiter(1, 1);
    const gate = deferred();
    const slow = () => gate.promise;
    const first = run(slow);
    const second = run(slow); // 順番待ち
    await expect(run(slow)).rejects.toBeInstanceOf(OverloadedError);
    expect(new OverloadedError().statusCode).toBe(503);
    gate.resolve();
    await Promise.all([first, second]);
  });

  it("失敗した処理があっても枠は戻り、次の処理が動く", async () => {
    const run = createConcurrencyLimiter(1, 1);
    await expect(run(() => Promise.reject(new Error("boom")))).rejects.toThrow(
      "boom",
    );
    expect(await run(() => Promise.resolve("ok"))).toBe("ok");
  });
});
