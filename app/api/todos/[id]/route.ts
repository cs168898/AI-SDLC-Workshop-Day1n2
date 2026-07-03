/**
 * GET    /api/todos/[id]  — get a single todo
 * PUT    /api/todos/[id]  — update a todo (partial update; handles completion + recurring)
 * DELETE /api/todos/[id]  — delete a todo (cascades to subtasks/tags)
 */
import { NextRequest, NextResponse } from "next/server";
import { todoDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { validateFutureDate } from "@/lib/timezone";
import type { Priority, RecurrencePattern } from "@/lib/types";

const VALID_PRIORITIES: Priority[] = ["high", "medium", "low"];
const VALID_PATTERNS: RecurrencePattern[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];
const VALID_REMINDERS = [15, 30, 60, 120, 1440, 2880, 10080];

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

  return NextResponse.json(todo);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const todoId = parseInt(id, 10);
  if (isNaN(todoId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = todoDB.findById(session.userId, todoId);
  if (!existing)
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Parameters<typeof todoDB.update>[2] = {};

  // Title
  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title)
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 }
      );
    updates.title = title;
  }

  // Priority
  if ("priority" in body) {
    if (
      typeof body.priority !== "string" ||
      !VALID_PRIORITIES.includes(body.priority as Priority)
    ) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    updates.priority = body.priority as Priority;
  }

  // Due date
  if ("due_date" in body) {
    const due_date =
      typeof body.due_date === "string" && body.due_date ? body.due_date : null;
    if (due_date && !validateFutureDate(due_date)) {
      return NextResponse.json(
        { error: "Due date must be at least 1 minute in the future" },
        { status: 400 }
      );
    }
    updates.due_date = due_date;
  }

  // Recurring
  if ("is_recurring" in body) {
    updates.is_recurring =
      body.is_recurring === true || body.is_recurring === 1;
  }
  if ("recurrence_pattern" in body) {
    const pattern = body.recurrence_pattern;
    updates.recurrence_pattern =
      typeof pattern === "string" &&
      VALID_PATTERNS.includes(pattern as RecurrencePattern)
        ? (pattern as RecurrencePattern)
        : null;
  }

  // Reminder
  if ("reminder_minutes" in body) {
    updates.reminder_minutes =
      typeof body.reminder_minutes === "number" &&
      VALID_REMINDERS.includes(body.reminder_minutes)
        ? body.reminder_minutes
        : null;
  }

  // Completion toggle — `completed: true` marks done, `false` unmarks
  let isBeingCompleted = false;
  if ("completed" in body) {
    if (body.completed === true) {
      updates.completed_at = new Date().toISOString();
      isBeingCompleted = !existing.completed_at; // only "new" completion triggers recurrence
    } else {
      updates.completed_at = null;
    }
  }

  const updated = todoDB.update(session.userId, todoId, updates);
  if (!updated)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  // If this is a newly-completed recurring todo, create the next instance
  if (
    isBeingCompleted &&
    updated.is_recurring &&
    updated.recurrence_pattern &&
    updated.due_date
  ) {
    const next = todoDB.createNextRecurrence(updated);
    return NextResponse.json({ completed: updated, next });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const todoId = parseInt(id, 10);
  if (isNaN(todoId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const deleted = todoDB.delete(session.userId, todoId);
  if (!deleted)
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
