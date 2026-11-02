import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/health", async () => {
  return { ok: true };
});

try {
  await app.listen({ port: 3000 });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
