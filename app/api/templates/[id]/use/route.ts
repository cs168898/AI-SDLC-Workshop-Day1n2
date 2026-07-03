/**
 * POST /api/templates/[id]/use — create a todo from a template
 */
import { NextRequest, NextResponse } from "next/server";
import { templateDB, todoDB, subtaskDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSingaporeLocalString } from "@/lib/timezone";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
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

  // Parse optional due_date from body (or calculate offset)
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine
  }

  const due_date =
    typeof body.due_date === "string" && body.due_date ? body.due_date : null;

  // Create the todo from template
  const todo = todoDB.create(session.userId, {
    title: template.title_template,
    priority: template.priority,
    due_date,
    is_recurring: !!template.is_recurring,
    recurrence_pattern: template.recurrence_pattern,
    reminder_minutes: template.reminder_minutes,
  });

  // Create subtasks from template if any
  if (template.subtasks_json) {
    try {
      const subtasks = JSON.parse(template.subtasks_json) as Array<{
        title: string;
        position?: number;
      }>;
      for (const st of subtasks) {
        if (st.title && typeof st.title === "string") {
          subtaskDB.create(todo.id, st.title);
        }
      }
    } catch {
      // Invalid JSON — skip subtasks silently
    }
  }

  return NextResponse.json(todo, { status: 201 });
}
