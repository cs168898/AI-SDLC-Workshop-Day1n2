/**
 * GET    /api/templates/[id] — get a single template
 * PUT    /api/templates/[id] — update a template
 * DELETE /api/templates/[id] — delete a template
 */
import { NextRequest, NextResponse } from "next/server";
import { templateDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Priority, RecurrencePattern } from "@/lib/types";

const VALID_PRIORITIES: Priority[] = ["high", "medium", "low"];
const VALID_PATTERNS: RecurrencePattern[] = ["daily", "weekly", "monthly", "yearly"];

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const templateId = parseInt(id, 10);
  if (isNaN(templateId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const template = templateDB.findById(session.userId, templateId);
  if (!template)
    return NextResponse.json({ error: "Template not found" }, { status: 404 });

  return NextResponse.json(template);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const templateId = parseInt(id, 10);
  if (isNaN(templateId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = templateDB.findById(session.userId, templateId);
  if (!existing)
    return NextResponse.json({ error: "Template not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Parameters<typeof templateDB.update>[2] = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name)
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    updates.name = name;
  }

  if ("description" in body) {
    updates.description =
      typeof body.description === "string"
        ? body.description.trim() || null
        : null;
  }

  if ("category" in body) {
    updates.category =
      typeof body.category === "string" ? body.category.trim() || null : null;
  }

  if ("title_template" in body) {
    const title =
      typeof body.title_template === "string" ? body.title_template.trim() : "";
    if (!title)
      return NextResponse.json(
        { error: "Title template cannot be empty" },
        { status: 400 }
      );
    updates.title_template = title;
  }

  if ("priority" in body) {
    if (
      typeof body.priority !== "string" ||
      !VALID_PRIORITIES.includes(body.priority as Priority)
    ) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    updates.priority = body.priority as Priority;
  }

  if ("is_recurring" in body) {
    updates.is_recurring = body.is_recurring === true || body.is_recurring === 1;
  }

  if ("recurrence_pattern" in body) {
    const pattern = body.recurrence_pattern;
    updates.recurrence_pattern =
      typeof pattern === "string" &&
      VALID_PATTERNS.includes(pattern as RecurrencePattern)
        ? (pattern as RecurrencePattern)
        : null;
  }

  if ("reminder_minutes" in body) {
    const VALID_REMINDERS = [15, 30, 60, 120, 1440, 2880, 10080];
    updates.reminder_minutes =
      typeof body.reminder_minutes === "number" &&
      VALID_REMINDERS.includes(body.reminder_minutes)
        ? body.reminder_minutes
        : null;
  }

  if ("subtasks_json" in body) {
    if (body.subtasks_json === null) {
      updates.subtasks_json = null;
    } else if (typeof body.subtasks_json === "string") {
      try {
        JSON.parse(body.subtasks_json);
        updates.subtasks_json = body.subtasks_json;
      } catch {
        return NextResponse.json(
          { error: "Invalid subtasks JSON" },
          { status: 400 }
        );
      }
    } else if (Array.isArray(body.subtasks_json)) {
      updates.subtasks_json = JSON.stringify(body.subtasks_json);
    }
  }

  const updated = templateDB.update(session.userId, templateId, updates);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const templateId = parseInt(id, 10);
  if (isNaN(templateId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const deleted = templateDB.delete(session.userId, templateId);
  if (!deleted)
    return NextResponse.json({ error: "Template not found" }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
