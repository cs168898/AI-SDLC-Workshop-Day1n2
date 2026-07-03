/**
 * GET  /api/todos  — return all todos for the authenticated user
 * POST /api/todos  — create a new todo
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

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const todos = todoDB.findAll(session.userId);
  return NextResponse.json(todos);
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

  // Validate title
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { error: "Title is required and cannot be empty" },
      { status: 400 }
    );
  }

  // Validate priority
  const priority: Priority =
    typeof body.priority === "string" &&
    VALID_PRIORITIES.includes(body.priority as Priority)
      ? (body.priority as Priority)
      : "medium";

  // Validate due_date
  const due_date =
    typeof body.due_date === "string" && body.due_date ? body.due_date : null;
  if (due_date && !validateFutureDate(due_date)) {
    return NextResponse.json(
      { error: "Due date must be at least 1 minute in the future" },
      { status: 400 }
    );
  }

  // Validate recurring
  const is_recurring = body.is_recurring === true || body.is_recurring === 1;
  if (is_recurring && !due_date) {
    return NextResponse.json(
      { error: "Recurring todos must have a due date" },
      { status: 400 }
    );
  }

  const recurrence_pattern: RecurrencePattern | null =
    is_recurring &&
    typeof body.recurrence_pattern === "string" &&
    VALID_PATTERNS.includes(body.recurrence_pattern as RecurrencePattern)
      ? (body.recurrence_pattern as RecurrencePattern)
      : null;

  if (is_recurring && !recurrence_pattern) {
    return NextResponse.json(
      {
        error:
          "Recurring todos must have a recurrence pattern (daily/weekly/monthly/yearly)",
      },
      { status: 400 }
    );
  }

  // Validate reminder_minutes
  const VALID_REMINDERS = [15, 30, 60, 120, 1440, 2880, 10080];
  const reminder_minutes =
    typeof body.reminder_minutes === "number" &&
    VALID_REMINDERS.includes(body.reminder_minutes)
      ? body.reminder_minutes
      : null;

  const todo = todoDB.create(session.userId, {
    title,
    priority,
    due_date,
    is_recurring,
    recurrence_pattern,
    reminder_minutes,
  });

  return NextResponse.json(todo, { status: 201 });
}
