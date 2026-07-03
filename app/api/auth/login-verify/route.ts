/**
 * POST /api/auth/login-verify — verify WebAuthn login response
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
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
      { error: "Login session expired. Please try again." },
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

  // Find the authenticator being used
  const authResponse = body as { id?: string; rawId?: string };
  const credentialId = authResponse.id ?? authResponse.rawId ?? "";

  const authenticator = authenticatorDB.findByCredentialId(credentialId);
  if (!authenticator || authenticator.user_id !== userId) {
    return NextResponse.json(
      { error: "Authenticator not found" },
      { status: 400 }
    );
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: authenticator.credential_id,
        publicKey: isoBase64URL.toBuffer(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
        transports: authenticator.transports ? JSON.parse(authenticator.transports) : undefined,
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Authentication verification failed" },
        { status: 400 }
      );
    }

    // Update counter
    authenticatorDB.updateCounter(
      authenticator.credential_id,
      verification.authenticationInfo.newCounter
    );

    // Create session
    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
    });

    const response = NextResponse.json({ verified: true });
    const cookieOpts = sessionCookieOptions();
    response.cookies.set(cookieOpts.name, token, cookieOpts);
    response.cookies.delete("webauthn_challenge");
    response.cookies.delete("webauthn_user_id");

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Login failed: " + (error instanceof Error ? error.message : "Unknown error") },
      { status: 400 }
    );
  }
}
