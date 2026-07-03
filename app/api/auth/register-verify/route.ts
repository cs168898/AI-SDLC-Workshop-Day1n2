/**
 * POST /api/auth/register-verify — verify WebAuthn registration response
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { userDB, authenticatorDB } from "@/lib/db";
import { createSessionToken, sessionCookieOptions } from "@/lib/auth";

const RP_ID = process.env.RP_ID ?? "localhost";
const ORIGIN = process.env.ORIGIN ?? "http://localhost:3000";

export async function POST(request: NextRequest) {
  const challenge = request.cookies.get("webauthn_challenge")?.value;
  const userIdStr = request.cookies.get("webauthn_user_id")?.value;

  if (!challenge || !userIdStr) {
    return NextResponse.json(
      { error: "Registration session expired. Please try again." },
      { status: 400 }
    );
  }

  const userId = parseInt(userIdStr, 10);
  const user = userDB.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Registration verification failed" },
        { status: 400 }
      );
    }

    const { credential } = verification.registrationInfo;

    // Store the authenticator
    authenticatorDB.create(userId, {
      credential_id: credential.id,
      credential_public_key: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter ?? 0,
      transports: credential.transports
        ? JSON.stringify(credential.transports)
        : null,
    });

    // Create session
    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
    });

    const response = NextResponse.json({ verified: true });
    const cookieOpts = sessionCookieOptions();
    response.cookies.set(cookieOpts.name, token, cookieOpts);
    // Clean up challenge cookies
    response.cookies.delete("webauthn_challenge");
    response.cookies.delete("webauthn_user_id");

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Registration failed: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 400 }
    );
  }
}
