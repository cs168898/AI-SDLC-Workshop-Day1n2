/**
 * POST   /api/todos/[id]/tags — add a tag to a todo
 * DELETE /api/todos/[id]/tags — remove a tag from a todo (tag_id in body)
 */
import { NextRequest, NextResponse } from "next/server";
import { todoDB, tagDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

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

  const tagId =
    typeof body.tag_id === "number" ? body.tag_id : parseInt(String(body.tag_id), 10);
  if (isNaN(tagId))
    return NextResponse.json({ error: "tag_id is required" }, { status: 400 });

  const tag = tagDB.findById(tagId);
  if (!tag || tag.user_id !== session.userId)
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });

  tagDB.addToTodo(todoId, tagId);
  const tags = tagDB.findByTodoId(todoId);
  return NextResponse.json(tags);
}

export async function DELETE(request: NextRequest, { params }: Params) {
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

  const tagId =
    typeof body.tag_id === "number" ? body.tag_id : parseInt(String(body.tag_id), 10);
  if (isNaN(tagId))
    return NextResponse.json({ error: "tag_id is required" }, { status: 400 });

  tagDB.removeFromTodo(todoId, tagId);
  const tags = tagDB.findByTodoId(todoId);
  return NextResponse.json(tags);
}
