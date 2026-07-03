/**
 * POST /api/todos/import — import todos from JSON
 */
import { NextRequest, NextResponse } from "next/server";
import { todoDB, subtaskDB, tagDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { Priority, RecurrencePattern } from "@/lib/types";

const VALID_PRIORITIES: Priority[] = ["high", "medium", "low"];
const VALID_PATTERNS: RecurrencePattern[] = ["daily", "weekly", "monthly", "yearly"];

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
  }

  if (!Array.isArray(body)) {
    return NextResponse.json(
      { error: "Expected an array of todos" },
      { status: 400 }
    );
  }

  let importedCount = 0;

  for (const item of body) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;

    const title = typeof rec.title === "string" ? rec.title.trim() : "";
    if (!title) continue;

    const priority: Priority =
      typeof rec.priority === "string" && VALID_PRIORITIES.includes(rec.priority as Priority)
        ? (rec.priority as Priority)
        : "medium";

    const due_date =
      typeof rec.due_date === "string" && rec.due_date ? rec.due_date : null;

    const is_recurring =
      rec.is_recurring === true || rec.is_recurring === 1;

    const recurrence_pattern: RecurrencePattern | null =
      is_recurring &&
      typeof rec.recurrence_pattern === "string" &&
      VALID_PATTERNS.includes(rec.recurrence_pattern as RecurrencePattern)
        ? (rec.recurrence_pattern as RecurrencePattern)
        : null;

    const VALID_REMINDERS = [15, 30, 60, 120, 1440, 2880, 10080];
    const reminder_minutes =
      typeof rec.reminder_minutes === "number" &&
      VALID_REMINDERS.includes(rec.reminder_minutes)
        ? rec.reminder_minutes
        : null;

    // Create the todo
    const todo = todoDB.create(session.userId, {
      title,
      priority,
      due_date,
      is_recurring,
      recurrence_pattern,
      reminder_minutes,
    });

    // If completed in the import data, mark as completed
    if (rec.completed === true && rec.completed_at) {
      todoDB.update(session.userId, todo.id, {
        completed_at: typeof rec.completed_at === "string" ? rec.completed_at : new Date().toISOString(),
      });
    } else if (rec.completed === true) {
      todoDB.update(session.userId, todo.id, {
        completed_at: new Date().toISOString(),
      });
    }

    // Import subtasks
    if (Array.isArray(rec.subtasks)) {
      for (const sub of rec.subtasks) {
        if (typeof sub === "object" && sub !== null) {
          const subRec = sub as Record<string, unknown>;
          const subTitle = typeof subRec.title === "string" ? subRec.title.trim() : "";
          if (subTitle) {
            const subtask = subtaskDB.create(todo.id, subTitle);
            if (subRec.completed === true) {
              subtaskDB.update(subtask.id, {
                completed_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    // Import tags (reuse existing by name or create new)
    if (Array.isArray(rec.tags)) {
      for (const tagItem of rec.tags) {
        if (typeof tagItem === "object" && tagItem !== null) {
          const tagRec = tagItem as Record<string, unknown>;
          const tagName = typeof tagRec.name === "string" ? tagRec.name.trim() : "";
          if (!tagName) continue;

          const tagColor =
            typeof tagRec.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(tagRec.color)
              ? tagRec.color
              : "#3B82F6";

          // Find existing tag or create new one
          let tag = tagDB.findByName(session.userId, tagName);
          if (!tag) {
            tag = tagDB.create(session.userId, tagName, tagColor);
          }
          tagDB.addToTodo(todo.id, tag.id);
        }
      }
    }

    importedCount++;
  }

  return NextResponse.json({
    message: `Successfully imported ${importedCount} todos`,
    count: importedCount,
  });
}
