/**
 * POST /api/auth/login-options — generate WebAuthn login challenge
 */
import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { userDB, authenticatorDB } from "@/lib/db";

const RP_ID = process.env.RP_ID ?? "localhost";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username)
    return NextResponse.json({ error: "Username is required" }, { status: 400 });

  const user = userDB.findByUsername(username);
  if (!user) {
    return NextResponse.json(
      { error: "User not found. Please register first." },
      { status: 404 }
    );
  }

  const authenticators = authenticatorDB.findByUserId(user.id);
  if (authenticators.length === 0) {
    return NextResponse.json(
      { error: "No passkeys registered. Please register first." },
      { status: 404 }
    );
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: authenticators.map((a) => ({
      id: a.credential_id,
      transports: a.transports ? JSON.parse(a.transports) : undefined,
    })),
    userVerification: "preferred",
  });

  const response = NextResponse.json(options);
  response.cookies.set("webauthn_challenge", options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  response.cookies.set("webauthn_user_id", String(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  return response;
}
