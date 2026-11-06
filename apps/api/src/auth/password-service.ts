import { createConcurrencyLimiter } from "./limiter.js";
import { hashPassword, verifyPassword } from "./password.js";

export type PasswordService = {
  hash(password: string): Promise<string>;
  // passwordHash が無い(存在しないユーザー)ときも、ダミーのハッシュで検証を1回走らせる。そのときは必ず false
  verify(passwordHash: string | undefined, password: string): Promise<boolean>;
};

export type PasswordServiceOptions = {
  hash?: (password: string) => Promise<string>;
  verify?: (passwordHash: string, password: string) => Promise<boolean>;
  maxConcurrent?: number;
  maxQueue?: number;
};

// argon2 は1回あたり約19MBを使う。同時に走る数を制限して、メモリと CPU を使い切られないようにする
export const DEFAULT_MAX_CONCURRENT = 2;
export const DEFAULT_MAX_QUEUE = 20;

const DUMMY_PASSWORD = "dummy-password-for-timing";

export async function createPasswordService(
  options: PasswordServiceOptions = {},
): Promise<PasswordService> {
  const hashFn = options.hash ?? hashPassword;
  const verifyFn = options.verify ?? verifyPassword;
  const run = createConcurrencyLimiter(
    options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT,
    options.maxQueue ?? DEFAULT_MAX_QUEUE,
  );
  // 起動時に1回だけ作る(最初のログイン失敗だけ遅くならないように)
  const dummyHash = await hashFn(DUMMY_PASSWORD);

  return {
    hash: (password) => run(() => hashFn(password)),
    async verify(passwordHash, password) {
      const ok = await run(() => verifyFn(passwordHash ?? dummyHash, password));
      return passwordHash !== undefined && ok;
    },
  };
}
