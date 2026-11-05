import { buildApp } from "./app.js";
import { loadSecurityConfig } from "./auth/security.js";

// 本番で APP_ORIGIN が無いときは、ここで例外になって起動が止まる(意図した動き)
const app = await buildApp(loadSecurityConfig(process.env));

try {
  await app.listen({ port: 3000 });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
