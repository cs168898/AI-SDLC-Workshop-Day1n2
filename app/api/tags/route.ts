/**
 * GET  /api/tags — get all tags for the authenticated user
 * POST /api/tags — create a new tag
 */
import { NextRequest, NextResponse } from "next/server";
import { tagDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const tags = tagDB.findAll(session.userId);
  return NextResponse.json(tags);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name)
    return NextResponse.json(
      { error: "Tag name is required" },
      { status: 400 }
    );

  // Check for duplicate
  const existing = tagDB.findByName(session.userId, name);
  if (existing)
    return NextResponse.json(
      { error: "A tag with this name already exists" },
      { status: 409 }
    );

  const color =
    typeof body.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color)
      ? body.color
      : "#3B82F6";

  const tag = tagDB.create(session.userId, name, color);
  return NextResponse.json(tag, { status: 201 });
}
