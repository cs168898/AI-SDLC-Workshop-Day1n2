/**
 * GET  /api/todos/[id]/subtasks — get all subtasks for a todo
 * POST /api/todos/[id]/subtasks — create a subtask
 */
import { NextRequest, NextResponse } from "next/server";
import { todoDB, subtaskDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const todoId = parseInt(id, 10);
  if (isNaN(todoId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const todo = todoDB.findById(session.userId, todoId);
  if (!todo)
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });

  const subtasks = subtaskDB.findByTodoId(todoId);
  return NextResponse.json(subtasks);
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const todoId = parseInt(id, 10);
  if (isNaN(todoId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const todo = todoDB.findById(session.userId, todoId);
  if (!todo)
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title)
    return NextResponse.json(
      { error: "Subtask title is required" },
      { status: 400 }
    );

  const subtask = subtaskDB.create(todoId, title);
  return NextResponse.json(subtask, { status: 201 });
}
