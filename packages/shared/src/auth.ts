import { z } from "zod";
import { PASSWORD_MAX_LENGTH, passwordSchema } from "./password.js";

export const EMAIL_MAX_LENGTH = 254;

// 前後の空白を除き、小文字にそろえてから検証する(大文字小文字だけが違う重複登録を防ぐ)
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH, "メールアドレスが長すぎます")
  .email("メールアドレスの形式が正しくありません");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// ログインでは、最小長を求めない(規則を変える前に作ったアカウントでも入れるように)。最大長だけ守る
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
