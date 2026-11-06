// 時間窓ごとに、回数を数える(全体の上限用。メモリ上なので、再起動でリセットされる)
export function createWindowCounter(
  max: number,
  windowMs: number,
  now: () => number = Date.now,
) {
  let windowStart = now();
  let count = 0;
  return {
    tryTake(): boolean {
      const t = now();
      if (t - windowStart >= windowMs) {
        windowStart = t;
        count = 0;
      }
      if (count >= max) return false;
      count += 1;
      return true;
    },
  };
}
