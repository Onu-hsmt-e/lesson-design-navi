import { describe, expect, it } from 'vitest';
import { passwordSchema } from './password.js';

describe('passwordSchema', () => {
  it('11文字は不可、12文字は可', () => {
    expect(passwordSchema.safeParse('a'.repeat(11)).success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(12)).success).toBe(true);
  });

  it('128文字は可、129文字は不可', () => {
    expect(passwordSchema.safeParse('a'.repeat(128)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });
});
