export type UserRecord = { id: string; email: string; passwordHash: string };

export type CreateUserResult =
  { ok: true; user: UserRecord } | { ok: false; reason: "duplicate" };

// DB の出し入れの窓口。失敗(DB 障害など)は握りつぶさず、例外のまま投げる。
// null や duplicate は「見つからない」「重複」のときだけ。
export interface UserStore {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: {
    email: string;
    passwordHash: string;
  }): Promise<CreateUserResult>;
}
