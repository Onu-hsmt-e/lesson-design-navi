export class OverloadedError extends Error {
  // Fastify は、statusCode を持つ例外を、その番号の応答にする
  readonly statusCode = 503;
  constructor() {
    super("server is busy");
    this.name = "OverloadedError";
  }
}

// 同時に動かせる数を制限する。超えた分は順番待ちにし、待ちも多すぎれば OverloadedError
export function createConcurrencyLimiter(
  maxConcurrent: number,
  maxQueue: number,
) {
  let active = 0;
  const waiting: (() => void)[] = [];

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= maxConcurrent) {
      if (waiting.length >= maxQueue) throw new OverloadedError();
      // 順番が来たら、前の処理から枠(active)を引き継いで再開する
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
      });
    } else {
      active += 1;
    }
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active -= 1;
    }
  };
}
