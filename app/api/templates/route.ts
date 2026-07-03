/**
 * GET  /api/templates — get all templates for the authenticated user
 * POST /api/templates — create a new template
 */
import { NextRequest, NextResponse } from "next/server";
import { templateDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Priority, RecurrencePattern } from "@/lib/types";

const VALID_PRIORITIES: Priority[] = ["high", "medium", "low"];
const VALID_PATTERNS: RecurrencePattern[] = ["daily", "weekly", "monthly", "yearly"];

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const templates = templateDB.findAll(session.userId);
  return NextResponse.json(templates);
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
      { error: "Template name is required" },
      { status: 400 }
    );

  const title_template =
    typeof body.title_template === "string" ? body.title_template.trim() : "";
  if (!title_template)
    return NextResponse.json(
      { error: "Template title is required" },
      { status: 400 }
    );

  const priority: Priority =
    typeof body.priority === "string" &&
    VALID_PRIORITIES.includes(body.priority as Priority)
      ? (body.priority as Priority)
      : "medium";

  const is_recurring = body.is_recurring === true || body.is_recurring === 1;
  const recurrence_pattern: RecurrencePattern | null =
    is_recurring &&
    typeof body.recurrence_pattern === "string" &&
    VALID_PATTERNS.includes(body.recurrence_pattern as RecurrencePattern)
      ? (body.recurrence_pattern as RecurrencePattern)
      : null;

  const VALID_REMINDERS = [15, 30, 60, 120, 1440, 2880, 10080];
  const reminder_minutes =
    typeof body.reminder_minutes === "number" &&
    VALID_REMINDERS.includes(body.reminder_minutes)
      ? body.reminder_minutes
      : null;

  const description =
    typeof body.description === "string" ? body.description.trim() || null : null;
  const category =
    typeof body.category === "string" ? body.category.trim() || null : null;

  // Validate subtasks_json if provided
  let subtasks_json: string | null = null;
  if (body.subtasks_json) {
    if (typeof body.subtasks_json === "string") {
      try {
        JSON.parse(body.subtasks_json);
        subtasks_json = body.subtasks_json;
      } catch {
        return NextResponse.json(
          { error: "Invalid subtasks JSON" },
          { status: 400 }
        );
      }
    } else if (Array.isArray(body.subtasks_json)) {
      subtasks_json = JSON.stringify(body.subtasks_json);
    }
  }

  const template = templateDB.create(session.userId, {
    name,
    description,
    category,
    title_template,
    priority,
    is_recurring,
    recurrence_pattern,
    reminder_minutes,
    subtasks_json,
  });

  return NextResponse.json(template, { status: 201 });
}
