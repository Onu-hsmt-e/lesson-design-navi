import type { FastifyReply, FastifyRequest } from "fastify";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isOriginAllowed(
  method: string,
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (!UNSAFE_METHODS.has(method.toUpperCase())) return true;
  if (!origin) return false; // Origin が無い POST などは拒否する
  return allowedOrigins.includes(origin);
}

export function createOriginCheck(allowedOrigins: readonly string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (
      !isOriginAllowed(request.method, request.headers.origin, allowedOrigins)
    ) {
      return reply.code(403).send({ error: "forbidden_origin" });
    }
  };
}

// 設定値(末尾の / やパスつき)を、ブラウザの Origin と同じ形にそろえる
export function normalizeOrigin(value: string): string {
  const origin = new URL(value).origin; // 不正な URL はここで例外になる
  if (origin === "null") throw new Error(`Invalid origin: ${value}`);
  return origin;
}
