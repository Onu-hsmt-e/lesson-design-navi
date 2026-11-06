import "./env.js";
import { buildApp } from "./app.js";
import { createPasswordService } from "./auth/password-service.js";
import { createPrismaStores } from "./auth/prisma-stores.js";
import { loadTrustProxy } from "./auth/proxy.js";
import { loadSecurityConfig } from "./auth/security.js";
import { createPrismaClient } from "./db.js";

// 設定が足りないときは、ここで例外になって起動が止まる(意図した動き)
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const prisma = createPrismaClient(databaseUrl);
const passwords = await createPasswordService();
const app = await buildApp(
  loadSecurityConfig(process.env),
  { ...createPrismaStores(prisma), passwords },
  { trustProxy: loadTrustProxy(process.env) },
);
app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

try {
  await app.listen({ port: 3000 });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
