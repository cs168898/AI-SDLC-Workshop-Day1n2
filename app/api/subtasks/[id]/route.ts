/**
 * PUT    /api/subtasks/[id] — update a subtask (toggle completion, rename)
 * DELETE /api/subtasks/[id] — delete a subtask
 */
import { NextRequest, NextResponse } from "next/server";
import { subtaskDB, todoDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const subtaskId = parseInt(id, 10);
  if (isNaN(subtaskId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const subtask = subtaskDB.findById(subtaskId);
  if (!subtask)
    return NextResponse.json({ error: "Subtask not found" }, { status: 404 });

  // Verify ownership via parent todo
  const todo = todoDB.findById(session.userId, subtask.todo_id);
  if (!todo)
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Parameters<typeof subtaskDB.update>[1] = {};

  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title)
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 }
      );
    updates.title = title;
  }

  if ("completed" in body) {
    updates.completed_at = body.completed ? new Date().toISOString() : null;
  }

  if ("position" in body && typeof body.position === "number") {
    updates.position = body.position;
  }

  const updated = subtaskDB.update(subtaskId, updates);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const subtaskId = parseInt(id, 10);
  if (isNaN(subtaskId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const subtask = subtaskDB.findById(subtaskId);
  if (!subtask)
    return NextResponse.json({ error: "Subtask not found" }, { status: 404 });

  // Verify ownership via parent todo
  const todo = todoDB.findById(session.userId, subtask.todo_id);
  if (!todo)
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  subtaskDB.delete(subtaskId);
  return new NextResponse(null, { status: 204 });
}
