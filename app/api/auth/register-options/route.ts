/**
 * POST /api/auth/register-options — generate WebAuthn registration challenge
 */
import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { userDB, authenticatorDB } from "@/lib/db";

const RP_NAME = process.env.RP_NAME ?? "Todo App";
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

  // Find or create user
  const user = userDB.findOrCreate(username);

  // Get existing authenticators to exclude
  const existingAuthenticators = authenticatorDB.findByUserId(user.id);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.username,
    userID: new TextEncoder().encode(String(user.id)),
    attestationType: "none",
    excludeCredentials: existingAuthenticators.map((a) => ({
      id: a.credential_id,
      transports: a.transports ? JSON.parse(a.transports) : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Store challenge in a cookie for verification (short-lived)
  const response = NextResponse.json(options);
  response.cookies.set("webauthn_challenge", options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5 minutes
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
