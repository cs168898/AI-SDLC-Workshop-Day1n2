/** POST /api/auth/logout — clears the session cookie. */
import { NextResponse } from "next/server";
import { clearCookieOptions } from "@/lib/auth";

export async function POST() {
  const opts = clearCookieOptions();
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: opts.name,
    value: "",
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    maxAge: 0,
    path: opts.path,
  });
  return response;
}
