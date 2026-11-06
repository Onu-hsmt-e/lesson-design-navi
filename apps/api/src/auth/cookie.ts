export function sessionCookieOptions(expiresAt: Date, isProduction: boolean) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction, // 本番(https)だけ Secure
    expires: expiresAt,
  };
}

// 削除するときは、付けたときと同じ path と属性で指定する
export function sessionCookieClearOptions(isProduction: boolean) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
  };
}
