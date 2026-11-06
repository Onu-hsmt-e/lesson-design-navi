import type { SessionRecord, SessionStore } from "../auth/session.js";
import type {
  CreateUserResult,
  UserRecord,
  UserStore,
} from "../auth/user-store.js";

// テスト用の、メモリ上の偽の窓口
export function createFakeUserStore() {
  const users = new Map<string, UserRecord>();
  let seq = 0;
  const store: UserStore = {
    findByEmail(email) {
      return Promise.resolve(
        [...users.values()].find((u) => u.email === email) ?? null,
      );
    },
    findById(id) {
      return Promise.resolve(users.get(id) ?? null);
    },
    create({ email, passwordHash }) {
      if ([...users.values()].some((u) => u.email === email)) {
        return Promise.resolve<CreateUserResult>({
          ok: false,
          reason: "duplicate",
        });
      }
      seq += 1;
      const user: UserRecord = { id: `user-${seq}`, email, passwordHash };
      users.set(user.id, user);
      return Promise.resolve<CreateUserResult>({ ok: true, user });
    },
  };
  return { store, users };
}

export function createFakeSessionStore() {
  const records = new Map<string, SessionRecord>();
  const store: SessionStore = {
    create(record) {
      records.set(record.id, record);
      return Promise.resolve();
    },
    find(id) {
      return Promise.resolve(records.get(id) ?? null);
    },
    remove(id) {
      records.delete(id);
      return Promise.resolve();
    },
  };
  return { store, records };
}
