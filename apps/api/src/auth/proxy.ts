// TRUST_PROXY_HOPS: 手前にあるプロキシの台数。未設定か 0 なら、信用しない(false)。
// true にしない: X-Forwarded-For を誰でも偽装でき、回数制限をすり抜けられるため。
export function loadTrustProxy(env: {
  TRUST_PROXY_HOPS?: string | undefined;
}): number | false {
  const raw = env.TRUST_PROXY_HOPS?.trim();
  if (!raw || raw === "0") return false;
  if (!/^[1-9][0-9]?$/.test(raw)) {
    throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 99");
  }
  return Number(raw);
}
