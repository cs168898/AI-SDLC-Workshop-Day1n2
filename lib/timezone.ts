/**
 * Singapore timezone utilities.
 * All date/time operations in this app use Singapore Standard Time (SGT, UTC+8).
 *
 * RULE: Never use `new Date()` for display — always go through these helpers.
 *       For storage, use ISO strings with +08:00 offset so comparisons are UTC-safe.
 */
import type { RecurrencePattern } from "./types";

/** Parse a Singapore-local datetime string (YYYY-MM-DDTHH:mm) into a UTC Date. */
export function parseSingaporeDateString(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  // If the string already carries timezone info, respect it
  if (dateStr.includes("+") || dateStr.endsWith("Z")) {
    return new Date(dateStr);
  }
  // Treat as Singapore local time (UTC+8)
  return new Date(dateStr + "+08:00");
}

/**
 * Return the current time as a UTC Date object.
 * Use this whenever you need "now" for comparisons against parsed dates.
 */
export function getSingaporeNow(): Date {
  return new Date();
}

/** Format a UTC Date for display in Singapore timezone. */
export function formatSingaporeDate(date: Date): string {
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Return the current Singapore local time as a datetime-local input value
 * (YYYY-MM-DDTHH:mm), suitable for setting the `min` attribute on an input.
 */
export function getSingaporeLocalString(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs)
    .toLocaleString("sv-SE", { timeZone: "Asia/Singapore" })
    .replace(" ", "T")
    .slice(0, 16);
}

/**
 * Validate that a Singapore-local datetime string is at least 1 minute in the future.
 * Returns true if valid (future), false if in the past.
 */
export function validateFutureDate(dateStr: string): boolean {
  const date = parseSingaporeDateString(dateStr);
  return date.getTime() > Date.now() + 60 * 1000;
}

/**
 * Calculate the next due date for a recurring todo.
 * Monthly recurrence clamps to the last day of the month if needed (e.g. Jan 31 → Feb 28).
 */
export function calculateNextDueDate(
  current: Date,
  pattern: RecurrencePattern
): Date {
  const next = new Date(current);
  switch (pattern) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly": {
      const targetDay = next.getDate();
      next.setMonth(next.getMonth() + 1);
      // If month overflow (e.g. Jan 31 → Mar 3), clamp to last day of target month
      if (next.getDate() !== targetDay) {
        next.setDate(0); // 0 = last day of previous month
      }
      break;
    }
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

/** Compute a human-readable due-date label and Tailwind color class per USER_GUIDE.md. */
export function getDueDateDisplay(dueDateStr: string): {
  text: string;
  colorClass: string;
} {
  const dueDate = parseSingaporeDateString(dueDateStr);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);
  const diffMinutes = Math.floor(absDiffMs / (1000 * 60));
  const diffHours = Math.floor(absDiffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    // Overdue
    if (diffDays > 0)
      return {
        text: `${diffDays} day${diffDays !== 1 ? "s" : ""} overdue`,
        colorClass: "text-red-600 dark:text-red-400",
      };
    if (diffHours > 0)
      return {
        text: `${diffHours} hour${diffHours !== 1 ? "s" : ""} overdue`,
        colorClass: "text-red-600 dark:text-red-400",
      };
    return {
      text: `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} overdue`,
      colorClass: "text-red-600 dark:text-red-400",
    };
  }

  // Due in < 1 hour → red
  if (diffMs < 60 * 60 * 1000) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return {
      text: `Due in ${mins} minute${mins !== 1 ? "s" : ""}`,
      colorClass: "text-red-600 dark:text-red-400",
    };
  }

  // Due in < 24 hours → orange
  if (diffMs < 24 * 60 * 60 * 1000) {
    const hrs = Math.floor(diffMs / (1000 * 60 * 60));
    return {
      text: `Due in ${hrs} hour${hrs !== 1 ? "s" : ""} (${formatSingaporeDate(dueDate)})`,
      colorClass: "text-orange-600 dark:text-orange-400",
    };
  }

  // Due in < 7 days → yellow
  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return {
      text: `Due in ${days} day${days !== 1 ? "s" : ""} (${formatSingaporeDate(dueDate)})`,
      colorClass: "text-yellow-600 dark:text-yellow-500",
    };
  }

  // 7+ days → blue
  return {
    text: formatSingaporeDate(dueDate),
    colorClass: "text-blue-600 dark:text-blue-400",
  };
}
