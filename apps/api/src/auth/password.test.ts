import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('同じパスワードでも、ハッシュするたびに結果が違う(ソルト)', async () => {
    const a = await hashPassword('correct-horse-battery');
    const b = await hashPassword('correct-horse-battery');
    expect(a).not.toBe(b);
  });

  it('argon2id・規定のパラメータで、平文を含まない', async () => {
    const h = await hashPassword('correct-horse-battery');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(h).toContain('m=19456,t=2,p=1');
    expect(h).not.toContain('correct-horse-battery');
  });

  it('正しいパスワードだけ通る', async () => {
    const h = await hashPassword('correct-horse-battery');
    expect(await verifyPassword(h, 'correct-horse-battery')).toBe(true);
    expect(await verifyPassword(h, 'wrong-horse-battery')).toBe(false);
  });

  it('壊れたハッシュは false にせず、例外になる', async () => {
    await expect(
      verifyPassword('not-a-hash', 'whatever-password'),
    ).rejects.toThrow();
    await expect(
      verifyPassword('$argon2id$broken', 'whatever-password'),
    ).rejects.toThrow();
  });

  it('全角と半角、合成と分解の違いを同じパスワードとして扱う', async () => {
    const h1 = await hashPassword('ｐａｓｓｗｏｒｄ１２３４');
    expect(await verifyPassword(h1, 'password1234')).toBe(true);

    const h2 = await hashPassword('\u304c'.repeat(12));
    expect(await verifyPassword(h2, '\u304b\u3099'.repeat(12))).toBe(true);
  });
});
