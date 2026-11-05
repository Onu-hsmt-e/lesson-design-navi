import { argon2id, hash, verify } from 'argon2';

const options = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

// 端末や入力方法が違っても同じ結果になるよう、NFKC に正規化してから扱う
function normalize(password: string): string {
  return password.normalize('NFKC');
}

export function hashPassword(password: string): Promise<string> {
  return hash(normalize(password), options);
}

// 不一致は false。壊れたハッシュ(DBの異常)や内部エラーは握りつぶさず、例外のまま投げる
export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, normalize(password));
}
