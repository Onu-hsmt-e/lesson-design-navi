import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `パスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください`)
  .max(PASSWORD_MAX_LENGTH, `パスワードは${PASSWORD_MAX_LENGTH}文字以内にしてください`);
