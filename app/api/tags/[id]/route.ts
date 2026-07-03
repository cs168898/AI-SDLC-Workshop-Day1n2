/**
 * PUT    /api/tags/[id] — update a tag (name or color)
 * DELETE /api/tags/[id] — delete a tag (CASCADE removes from todos)
 */
import { NextRequest, NextResponse } from "next/server";
import { tagDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const tagId = parseInt(id, 10);
  if (isNaN(tagId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const tag = tagDB.findById(tagId);
  if (!tag || tag.user_id !== session.userId)
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Parameters<typeof tagDB.update>[1] = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name)
      return NextResponse.json(
        { error: "Tag name cannot be empty" },
        { status: 400 }
      );
    // Check for duplicate (different tag, same name)
    const existing = tagDB.findByName(session.userId, name);
    if (existing && existing.id !== tagId)
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 409 }
      );
    updates.name = name;
  }

  if ("color" in body) {
    const color = typeof body.color === "string" ? body.color : "";
    if (!/^#[0-9A-Fa-f]{6}$/.test(color))
      return NextResponse.json(
        { error: "Invalid color format (use #RRGGBB)" },
        { status: 400 }
      );
    updates.color = color;
  }

  const updated = tagDB.update(tagId, updates);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const tagId = parseInt(id, 10);
  if (isNaN(tagId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const tag = tagDB.findById(tagId);
  if (!tag || tag.user_id !== session.userId)
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });

  tagDB.delete(tagId);
  return new NextResponse(null, { status: 204 });
}
