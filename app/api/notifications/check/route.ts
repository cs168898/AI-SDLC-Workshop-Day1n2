/**
 * GET /api/notifications/check — returns todos with reminders that are due.
 * The client polls this endpoint to trigger browser notifications.
 */
import { NextResponse } from "next/server";
import { todoDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const dueTodos = todoDB.findDueReminders(session.userId);

  // Mark each as notified so we don't send again
  for (const todo of dueTodos) {
    todoDB.update(session.userId, todo.id, {
      last_notification_sent: new Date().toISOString(),
    });
  }

  return NextResponse.json(dueTodos);
}
