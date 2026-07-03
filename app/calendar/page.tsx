"use client";

/**
 * app/calendar/page.tsx — Calendar View (Feature 10)
 *
 * Monthly calendar grid with:
 * - Todos on their due dates (color-coded by priority)
 * - Singapore public holidays
 * - Month navigation (prev/next/today)
 * - Current day highlighting
 */

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "high" | "medium" | "low";

interface Todo {
  id: number;
  title: string;
  priority: Priority;
  due_date: string | null;
  completed_at: string | null;
}

interface Holiday {
  id: number;
  date: string;
  name: string;
  year: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateKey(s: string): string {
  // Convert datetime to YYYY-MM-DD in Singapore timezone
  const d = s.includes("+") || s.endsWith("Z") ? new Date(s) : new Date(s + "+08:00");
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Singapore" });
}

function priorityColor(p: Priority): string {
  return { high: "bg-red-500", medium: "bg-yellow-500", low: "bg-blue-500" }[p];
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay(); // 0 = Sunday
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400">Loading…</div>}>
      <CalendarContent />
    </Suspense>
  );
}

function CalendarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse month from URL or default to current month (Singapore time)
  const now = new Date();
  const sgNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  const monthParam = searchParams.get("month");
  const [year, setYear] = useState(() => {
    if (monthParam) {
      const [y] = monthParam.split("-").map(Number);
      return y || sgNow.getFullYear();
    }
    return sgNow.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    if (monthParam) {
      const parts = monthParam.split("-").map(Number);
      return parts[1] || sgNow.getMonth() + 1;
    }
    return sgNow.getMonth() + 1;
  });

  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    Promise.all([
      fetch("/api/todos").then((r) => r.ok ? r.json() : []),
      fetch(`/api/holidays?year=${year}`).then((r) => r.ok ? r.json() : []),
    ]).then(([todosData, holidaysData]) => {
      setTodos(Array.isArray(todosData) ? todosData : []);
      setHolidays(Array.isArray(holidaysData) ? holidaysData : []);
      setLoading(false);
    });
  }, [year]);

  // Build a map of date → todos
  const todosByDate = useMemo(() => {
    const map: Record<string, Todo[]> = {};
    for (const todo of todos) {
      if (!todo.due_date) continue;
      const key = parseDateKey(todo.due_date);
      if (!map[key]) map[key] = [];
      map[key].push(todo);
    }
    return map;
  }, [todos]);

  // Build a map of date → holidays
  const holidaysByDate = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    for (const h of holidays) {
      if (!map[h.date]) map[h.date] = [];
      map[h.date].push(h);
    }
    return map;
  }, [holidays]);

  // Calendar grid data
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayKey = sgNow.toLocaleDateString("sv-SE", { timeZone: "Asia/Singapore" });

  // Navigation
  function goToMonth(y: number, m: number) {
    if (m < 1) { y--; m = 12; }
    if (m > 12) { y++; m = 1; }
    setYear(y);
    setMonth(m);
    const param = `${y}-${String(m).padStart(2, "0")}`;
    router.push(`/calendar?month=${param}`);
  }

  function goToToday() {
    setYear(sgNow.getFullYear());
    setMonth(sgNow.getMonth() + 1);
    router.push("/calendar");
  }

  // Build calendar cells
  const cells: { day: number; dateKey: string }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateKey });
  }

  // Todos for selected day modal
  const selectedDayTodos = selectedDay ? (todosByDate[selectedDay] ?? []) : [];
  const selectedDayHolidays = selectedDay ? (holidaysByDate[selectedDay] ?? []) : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            📅 Calendar
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="text-sm px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300
                         dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300
                         transition-colors"
            >
              ← Back to Todos
            </button>
          </div>
        </header>

        {/* Month Navigation */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl shadow p-4">
          <button
            onClick={() => goToMonth(year, month - 1)}
            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200
                       dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300
                       transition-colors font-bold"
          >
            ◀
          </button>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {MONTH_NAMES[month - 1]} {year}
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200
                         dark:bg-blue-900/50 dark:hover:bg-blue-900/80 text-blue-800 dark:text-blue-200
                         transition-colors text-sm"
            >
              Today
            </button>
            <button
              onClick={() => goToMonth(year, month + 1)}
              className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200
                         dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300
                         transition-colors font-bold"
            >
              ▶
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
            {DAY_NAMES.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {/* Empty cells for days before the first */}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50" />
            ))}

            {/* Day cells */}
            {cells.map(({ day, dateKey }) => {
              const isToday = dateKey === todayKey;
              const isWeekend = new Date(dateKey).getDay() === 0 || new Date(dateKey).getDay() === 6;
              const dayTodos = todosByDate[dateKey] ?? [];
              const dayHolidays = holidaysByDate[dateKey] ?? [];

              return (
                <div
                  key={dateKey}
                  onClick={() => setSelectedDay(dateKey)}
                  className={`min-h-[80px] p-1 border-b border-r border-gray-100 dark:border-gray-700
                             cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors
                             ${isWeekend ? "bg-gray-50 dark:bg-gray-800/50" : ""}
                             ${isToday ? "ring-2 ring-inset ring-blue-500" : ""}`}
                >
                  <div className={`text-xs font-medium mb-0.5 ${
                    isToday ? "text-blue-600 dark:text-blue-400 font-bold" : "text-gray-700 dark:text-gray-300"
                  }`}>
                    {day}
                    {dayTodos.length > 0 && (
                      <span className="ml-1 text-[10px] px-1 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                        {dayTodos.length}
                      </span>
                    )}
                  </div>

                  {/* Holiday names */}
                  {dayHolidays.map((h) => (
                    <div key={h.id} className="text-[10px] px-1 py-0.5 mb-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200 truncate">
                      🎉 {h.name}
                    </div>
                  ))}

                  {/* Todo indicators (show first 3) */}
                  {dayTodos.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center gap-1 mb-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityColor(t.priority)}`} />
                      <span className={`text-[10px] truncate ${
                        t.completed_at ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"
                      }`}>
                        {t.title}
                      </span>
                    </div>
                  ))}
                  {dayTodos.length > 3 && (
                    <span className="text-[10px] text-gray-400">+{dayTodos.length - 3} more</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> High</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Medium</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Low</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full ring-2 ring-blue-500" /> Today</span>
          <span className="flex items-center gap-1">🎉 Holiday</span>
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setSelectedDay(null)}
        >
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {new Date(selectedDay + "T00:00:00+08:00").toLocaleDateString("en-SG", {
                timeZone: "Asia/Singapore",
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h2>

            {/* Holidays */}
            {selectedDayHolidays.length > 0 && (
              <div className="space-y-1">
                {selectedDayHolidays.map((h) => (
                  <div key={h.id} className="text-sm px-2 py-1 rounded bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200">
                    🎉 {h.name}
                  </div>
                ))}
              </div>
            )}

            {/* Todos */}
            {selectedDayTodos.length > 0 ? (
              <div className="space-y-2">
                {selectedDayTodos.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${priorityColor(t.priority)}`} />
                    <span className={`text-sm flex-1 ${
                      t.completed_at ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-200"
                    }`}>
                      {t.title}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{t.priority}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">No todos due on this day.</p>
            )}

            <button
              onClick={() => setSelectedDay(null)}
              className="w-full py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600
                         text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
