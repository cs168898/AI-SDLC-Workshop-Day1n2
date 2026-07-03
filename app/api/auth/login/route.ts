/**
 * POST /api/auth/login
 * Dev stub: finds or creates a user by username and sets a JWT session cookie.
 * Feature 11 will replace this with the full WebAuthn/Passkeys flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { userDB } from "@/lib/db";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: { username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = (body.username ?? "").trim().toLowerCase();

  if (!username) {
    return NextResponse.json(
      { error: "Username is required" },
      { status: 400 }
    );
  }
  if (username.length > 50) {
    return NextResponse.json(
      { error: "Username must be 50 characters or fewer" },
      { status: 400 }
    );
  }
  // Only allow safe characters to prevent injection via username display
  if (!/^[a-z0-9_.-]+$/.test(username)) {
    return NextResponse.json(
      { error: "Username may only contain letters, numbers, _ . -" },
      { status: 400 }
    );
  }

  const user = userDB.findOrCreate(username);
  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
  });

  const opts = sessionCookieOptions();
  const response = NextResponse.json({ ok: true, username: user.username });
  response.cookies.set({
    name: opts.name,
    value: token,
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    maxAge: opts.maxAge,
    path: opts.path,
  });
  return response;
}
