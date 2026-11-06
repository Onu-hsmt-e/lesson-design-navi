import { describe, expect, it } from "vitest";
import { createWindowCounter } from "./window-counter.js";

describe("createWindowCounter", () => {
  it("上限までは通り、超えると止まり、時間窓が過ぎると戻る", () => {
    let t = 0;
    const counter = createWindowCounter(2, 1000, () => t);
    expect([counter.tryTake(), counter.tryTake(), counter.tryTake()]).toEqual([
      true,
      true,
      false,
    ]);
    t = 999;
    expect(counter.tryTake()).toBe(false);
    t = 1000;
    expect(counter.tryTake()).toBe(true);
  });
});
