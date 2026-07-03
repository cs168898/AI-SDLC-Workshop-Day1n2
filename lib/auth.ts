/**
 * lib/auth.ts — JWT session management.
 *
 * Sessions are stored as HTTP-only cookies containing a signed JWT.
 * This is the dev stub; Feature 11 adds WebAuthn/Passkeys on top.
 *
 * Import ONLY in server-side code (API routes, Server Components).
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-in-production-use-32-chars-min"
);

const COOKIE_NAME = "session";
const SESSION_DURATION_SECS = 7 * 24 * 60 * 60; // 7 days

export interface Session {
  userId: number;
  username: string;
}

/** Sign a new JWT and return the token string. */
export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ userId: session.userId, username: session.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECS}s`)
    .sign(JWT_SECRET);
}

/** Read and verify the session cookie. Returns null if missing or invalid. */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (
      typeof payload.userId !== "number" ||
      typeof payload.username !== "string"
    ) {
      return null;
    }
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

/** Cookie options for Set-Cookie headers. */
export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: SESSION_DURATION_SECS,
    path: "/",
  };
}

/** Cookie options that immediately expire the cookie (for logout). */
export function clearCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/",
  };
}
