/**
 * GET /api/todos/export?format=json|csv — export todos for the authenticated user
 */
import { NextRequest, NextResponse } from "next/server";
import { todoDB, subtaskDB, tagDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const format = request.nextUrl.searchParams.get("format") ?? "json";
  const todos = todoDB.findAll(session.userId);

  if (format === "csv") {
    const header = "ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder,Created At";
    const rows = todos.map((t) => {
      const title = `"${t.title.replace(/"/g, '""')}"`;
      const completed = t.completed_at ? "true" : "false";
      const dueDate = t.due_date ? `"${t.due_date}"` : "";
      const recurring = t.is_recurring ? "true" : "false";
      const pattern = t.recurrence_pattern ?? "";
      const reminder = t.reminder_minutes ?? "";
      const createdAt = `"${t.created_at}"`;
      return `${t.id},${title},${completed},${dueDate},${t.priority},${recurring},${pattern},${reminder},${createdAt}`;
    });

    const csv = [header, ...rows].join("\n");
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="todos-${date}.csv"`,
      },
    });
  }

  // JSON format — include subtasks and tags
  const exportData = todos.map((t) => {
    const subtasks = subtaskDB.findByTodoId(t.id);
    const tags = tagDB.findByTodoId(t.id);
    return {
      id: t.id,
      title: t.title,
      completed: !!t.completed_at,
      completed_at: t.completed_at,
      due_date: t.due_date,
      priority: t.priority,
      is_recurring: !!t.is_recurring,
      recurrence_pattern: t.recurrence_pattern,
      reminder_minutes: t.reminder_minutes,
      created_at: t.created_at,
      subtasks: subtasks.map((s) => ({
        title: s.title,
        completed: !!s.completed_at,
        position: s.position,
      })),
      tags: tags.map((tag) => ({
        name: tag.name,
        color: tag.color,
      })),
    };
  });

  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="todos-${date}.json"`,
    },
  });
}
