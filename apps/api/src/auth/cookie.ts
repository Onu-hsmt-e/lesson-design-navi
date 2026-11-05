export function sessionCookieOptions(expiresAt: Date, isProduction: boolean) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction, // 本番(https)だけ Secure
    expires: expiresAt,
  };
}
