import { z } from "zod";

// スキーマ（実行時の検査用）
export const LessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  grade: z.number().int(),
});

// 型（スキーマから自動で作る）
export type Lesson = z.infer<typeof LessonSchema>;
export * from "./password.js";
