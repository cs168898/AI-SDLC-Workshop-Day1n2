/**
 * lib/db.ts — Single source of truth for all database operations.
 *
 * Uses Node.js built-in `node:sqlite` (stable since Node 24, available in Node 22+).
 * No native compilation required — works with any Node.js 22+ installation.
 *
 * API is synchronous (same pattern as better-sqlite3).
 *
 * IMPORTANT: Import ONLY in server-side code (API routes).
 *            Never import in client components.
 */

import { DatabaseSync } from "node:sqlite";
import path from "path";
import { calculateNextDueDate, parseSingaporeDateString } from "./timezone";
import type { Priority, RecurrencePattern } from "./types";

export type { Priority, RecurrencePattern } from "./types";

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  priority: Priority;
  due_date: string | null;
  is_recurring: number; // 0 | 1  (SQLite has no boolean)
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed_at: string | null;
  position: number;
  created_at: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface TodoTag {
  todo_id: number;
  tag_id: number;
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  category: string | null;
  title_template: string;
  priority: Priority;
  is_recurring: number;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  subtasks_json: string | null;
  created_at: string;
}

// ─── Database Singleton ───────────────────────────────────────────────────────

const DB_PATH = path.join(process.cwd(), "todos.db");

let _db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec("PRAGMA journal_mode = WAL");
    _db.exec("PRAGMA foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT    UNIQUE NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS todos (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id               INTEGER NOT NULL
                              REFERENCES users(id) ON DELETE CASCADE,
      title                 TEXT    NOT NULL,
      priority              TEXT    NOT NULL DEFAULT 'medium'
                              CHECK(priority IN ('high','medium','low')),
      due_date              TEXT,
      is_recurring          INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern    TEXT
                              CHECK(recurrence_pattern IN
                                ('daily','weekly','monthly','yearly')),
      reminder_minutes      INTEGER,
      last_notification_sent TEXT,
      completed_at          TEXT,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id     INTEGER NOT NULL
                    REFERENCES todos(id) ON DELETE CASCADE,
      title       TEXT    NOT NULL,
      completed_at TEXT,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL
                   REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      color      TEXT    NOT NULL DEFAULT '#3B82F6',
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS todo_tags (
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (todo_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id            INTEGER NOT NULL
                           REFERENCES users(id) ON DELETE CASCADE,
      name               TEXT    NOT NULL,
      description        TEXT,
      category           TEXT,
      title_template     TEXT    NOT NULL,
      priority           TEXT    NOT NULL DEFAULT 'medium'
                           CHECK(priority IN ('high','medium','low')),
      is_recurring       INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern TEXT
                           CHECK(recurrence_pattern IN
                             ('daily','weekly','monthly','yearly')),
      reminder_minutes   INTEGER,
      subtasks_json      TEXT,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** node:sqlite returns lastInsertRowid as bigint; normalise to number. */
function toId(rowid: bigint | number): number {
  return typeof rowid === "bigint" ? Number(rowid) : rowid;
}

/** Cast node:sqlite results (Record<string, SQLOutputValue>) to our domain types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function row<T>(val: any): T { return val as T; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rows<T>(val: any): T[] { return val as T[]; }

// ─── User DB ──────────────────────────────────────────────────────────────────

export const userDB = {
  findByUsername(username: string): User | null {
    return getDb()
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as unknown as User | null;
  },

  findById(id: number): User | null {
    return getDb()
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(id) as unknown as User | null;
  },

  create(username: string): User {
    const db = getDb();
    const result = db
      .prepare("INSERT INTO users (username) VALUES (?)")
      .run(username);
    return db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(toId(result.lastInsertRowid)) as unknown as User;
  },

  /** Find existing user or create a new one. */
  findOrCreate(username: string): User {
    return userDB.findByUsername(username) ?? userDB.create(username);
  },
};

// ─── Todo DB ──────────────────────────────────────────────────────────────────

export const todoDB = {
  findAll(userId: number): Todo[] {
    return getDb()
      .prepare(
        `SELECT * FROM todos
         WHERE user_id = ?
         ORDER BY
           CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END ASC,
           CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC,
           due_date ASC,
           created_at DESC`
      )
      .all(userId) as unknown as Todo[];
  },

  findById(userId: number, id: number): Todo | null {
    return getDb()
      .prepare("SELECT * FROM todos WHERE id = ? AND user_id = ?")
      .get(id, userId) as unknown as Todo | null;
  },

  create(
    userId: number,
    data: {
      title: string;
      priority?: Priority;
      due_date?: string | null;
      is_recurring?: boolean;
      recurrence_pattern?: RecurrencePattern | null;
      reminder_minutes?: number | null;
    }
  ): Todo {
    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO todos
           (user_id, title, priority, due_date, is_recurring,
            recurrence_pattern, reminder_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        data.title.trim(),
        data.priority ?? "medium",
        data.due_date ?? null,
        data.is_recurring ? 1 : 0,
        data.recurrence_pattern ?? null,
        data.reminder_minutes ?? null
      );
    return db
      .prepare("SELECT * FROM todos WHERE id = ?")
      .get(toId(result.lastInsertRowid)) as unknown as Todo;
  },

  update(
    userId: number,
    id: number,
    data: Partial<{
      title: string;
      priority: Priority;
      due_date: string | null;
      is_recurring: boolean;
      recurrence_pattern: RecurrencePattern | null;
      reminder_minutes: number | null;
      completed_at: string | null;
      last_notification_sent: string | null;
    }>
  ): Todo | null {
    const db = getDb();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.title !== undefined) {
      fields.push("title = ?");
      values.push(data.title.trim());
    }
    if (data.priority !== undefined) {
      fields.push("priority = ?");
      values.push(data.priority);
    }
    if ("due_date" in data) {
      fields.push("due_date = ?");
      values.push(data.due_date ?? null);
    }
    if (data.is_recurring !== undefined) {
      fields.push("is_recurring = ?");
      values.push(data.is_recurring ? 1 : 0);
    }
    if ("recurrence_pattern" in data) {
      fields.push("recurrence_pattern = ?");
      values.push(data.recurrence_pattern ?? null);
    }
    if ("reminder_minutes" in data) {
      fields.push("reminder_minutes = ?");
      values.push(data.reminder_minutes ?? null);
    }
    if ("completed_at" in data) {
      fields.push("completed_at = ?");
      values.push(data.completed_at ?? null);
    }
    if ("last_notification_sent" in data) {
      fields.push("last_notification_sent = ?");
      values.push(data.last_notification_sent ?? null);
    }

    if (fields.length === 0) return todoDB.findById(userId, id);

    values.push(id, userId);
    db.prepare(
      `UPDATE todos SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`
    ).run(...values);

    return todoDB.findById(userId, id);
  },

  delete(userId: number, id: number): boolean {
    const result = getDb()
      .prepare("DELETE FROM todos WHERE id = ? AND user_id = ?")
      .run(id, userId);
    return Number(result.changes) > 0;
  },

  /**
   * Create the next recurrence instance for a recurring todo.
   * Called when the current instance is marked complete.
   */
  createNextRecurrence(todo: Todo): Todo {
    if (!todo.due_date || !todo.recurrence_pattern) {
      throw new Error(
        "Recurring todo must have both due_date and recurrence_pattern"
      );
    }

    const currentDue = parseSingaporeDateString(todo.due_date);
    const nextDue = calculateNextDueDate(currentDue, todo.recurrence_pattern);

    // Store as Singapore local string (YYYY-MM-DDTHH:mm) for consistency
    const nextDueStr = nextDue
      .toLocaleString("sv-SE", { timeZone: "Asia/Singapore" })
      .replace(" ", "T")
      .slice(0, 16);

    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO todos
           (user_id, title, priority, due_date, is_recurring,
            recurrence_pattern, reminder_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        todo.user_id,
        todo.title,
        todo.priority,
        nextDueStr,
        todo.is_recurring,
        todo.recurrence_pattern,
        todo.reminder_minutes ?? null
      );
    return db
      .prepare("SELECT * FROM todos WHERE id = ?")
      .get(toId(result.lastInsertRowid)) as unknown as Todo;
  },

  /** Find todos with reminders that are due for notification. */
  findDueReminders(userId: number): Todo[] {
    const now = new Date();
    return (getDb()
      .prepare(
        `SELECT * FROM todos
         WHERE user_id = ?
           AND completed_at IS NULL
           AND reminder_minutes IS NOT NULL
           AND due_date IS NOT NULL
           AND last_notification_sent IS NULL`
      )
      .all(userId) as unknown as Todo[]).filter((todo) => {
      const dueDate = parseSingaporeDateString(todo.due_date!);
      const reminderTime = new Date(
        dueDate.getTime() - (todo.reminder_minutes ?? 0) * 60_000
      );
      return now >= reminderTime;
    });
  },
};

// ─── Subtask DB ───────────────────────────────────────────────────────────────

export const subtaskDB = {
  findByTodoId(todoId: number): Subtask[] {
    return getDb()
      .prepare(
        "SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC, id ASC"
      )
      .all(todoId) as unknown as Subtask[];
  },

  findById(id: number): Subtask | null {
    return getDb()
      .prepare("SELECT * FROM subtasks WHERE id = ?")
      .get(id) as unknown as Subtask | null;
  },

  create(todoId: number, title: string): Subtask {
    const db = getDb();
    const maxPos = db
      .prepare("SELECT COALESCE(MAX(position), -1) as max_pos FROM subtasks WHERE todo_id = ?")
      .get(todoId) as unknown as { max_pos: number };
    const position = maxPos.max_pos + 1;

    const result = db
      .prepare(
        "INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)"
      )
      .run(todoId, title.trim(), position);
    return db
      .prepare("SELECT * FROM subtasks WHERE id = ?")
      .get(toId(result.lastInsertRowid)) as unknown as Subtask;
  },

  update(
    id: number,
    data: Partial<{ title: string; completed_at: string | null; position: number }>
  ): Subtask | null {
    const db = getDb();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.title !== undefined) {
      fields.push("title = ?");
      values.push(data.title.trim());
    }
    if ("completed_at" in data) {
      fields.push("completed_at = ?");
      values.push(data.completed_at ?? null);
    }
    if (data.position !== undefined) {
      fields.push("position = ?");
      values.push(data.position);
    }

    if (fields.length === 0) return subtaskDB.findById(id);
    values.push(id);
    db.prepare(`UPDATE subtasks SET ${fields.join(", ")} WHERE id = ?`).run(
      ...values
    );
    return subtaskDB.findById(id);
  },

  delete(id: number): boolean {
    const result = getDb()
      .prepare("DELETE FROM subtasks WHERE id = ?")
      .run(id);
    return Number(result.changes) > 0;
  },
};

// ─── Tag DB ───────────────────────────────────────────────────────────────────

export const tagDB = {
  findAll(userId: number): Tag[] {
    return getDb()
      .prepare("SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC")
      .all(userId) as unknown as Tag[];
  },

  findById(id: number): Tag | null {
    return getDb()
      .prepare("SELECT * FROM tags WHERE id = ?")
      .get(id) as unknown as Tag | null;
  },

  findByName(userId: number, name: string): Tag | null {
    return getDb()
      .prepare("SELECT * FROM tags WHERE user_id = ? AND name = ?")
      .get(userId, name) as unknown as Tag | null;
  },

  create(userId: number, name: string, color: string): Tag {
    const db = getDb();
    const result = db
      .prepare("INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)")
      .run(userId, name.trim(), color);
    return db
      .prepare("SELECT * FROM tags WHERE id = ?")
      .get(toId(result.lastInsertRowid)) as unknown as Tag;
  },

  update(id: number, data: Partial<{ name: string; color: string }>): Tag | null {
    const db = getDb();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.name !== undefined) {
      fields.push("name = ?");
      values.push(data.name.trim());
    }
    if (data.color !== undefined) {
      fields.push("color = ?");
      values.push(data.color);
    }

    if (fields.length === 0) return tagDB.findById(id);
    values.push(id);
    db.prepare(`UPDATE tags SET ${fields.join(", ")} WHERE id = ?`).run(
      ...values
    );
    return tagDB.findById(id);
  },

  delete(id: number): boolean {
    const result = getDb()
      .prepare("DELETE FROM tags WHERE id = ?")
      .run(id);
    return Number(result.changes) > 0;
  },

  /** Get all tags for a specific todo. */
  findByTodoId(todoId: number): Tag[] {
    return getDb()
      .prepare(
        `SELECT t.* FROM tags t
         INNER JOIN todo_tags tt ON tt.tag_id = t.id
         WHERE tt.todo_id = ?
         ORDER BY t.name ASC`
      )
      .all(todoId) as unknown as Tag[];
  },

  /** Add a tag to a todo. */
  addToTodo(todoId: number, tagId: number): void {
    try {
      getDb()
        .prepare("INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)")
        .run(todoId, tagId);
    } catch {
      // Already exists or invalid FK — ignore
    }
  },

  /** Remove a tag from a todo. */
  removeFromTodo(todoId: number, tagId: number): void {
    getDb()
      .prepare("DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?")
      .run(todoId, tagId);
  },

  /** Get all tag IDs for a todo. */
  getTagIdsForTodo(todoId: number): number[] {
    return (
      getDb()
        .prepare("SELECT tag_id FROM todo_tags WHERE todo_id = ?")
        .all(todoId) as { tag_id: number }[]
    ).map((r) => r.tag_id);
  },
};

// ─── Template DB ──────────────────────────────────────────────────────────────

export const templateDB = {
  findAll(userId: number): Template[] {
    return getDb()
      .prepare("SELECT * FROM templates WHERE user_id = ? ORDER BY name ASC")
      .all(userId) as unknown as Template[];
  },

  findById(userId: number, id: number): Template | null {
    return getDb()
      .prepare("SELECT * FROM templates WHERE id = ? AND user_id = ?")
      .get(id, userId) as unknown as Template | null;
  },

  create(
    userId: number,
    data: {
      name: string;
      description?: string | null;
      category?: string | null;
      title_template: string;
      priority?: Priority;
      is_recurring?: boolean;
      recurrence_pattern?: RecurrencePattern | null;
      reminder_minutes?: number | null;
      subtasks_json?: string | null;
    }
  ): Template {
    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO templates
           (user_id, name, description, category, title_template, priority,
            is_recurring, recurrence_pattern, reminder_minutes, subtasks_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        data.name.trim(),
        data.description ?? null,
        data.category ?? null,
        data.title_template.trim(),
        data.priority ?? "medium",
        data.is_recurring ? 1 : 0,
        data.recurrence_pattern ?? null,
        data.reminder_minutes ?? null,
        data.subtasks_json ?? null
      );
    return db
      .prepare("SELECT * FROM templates WHERE id = ?")
      .get(toId(result.lastInsertRowid)) as unknown as Template;
  },

  update(
    userId: number,
    id: number,
    data: Partial<{
      name: string;
      description: string | null;
      category: string | null;
      title_template: string;
      priority: Priority;
      is_recurring: boolean;
      recurrence_pattern: RecurrencePattern | null;
      reminder_minutes: number | null;
      subtasks_json: string | null;
    }>
  ): Template | null {
    const db = getDb();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.name !== undefined) {
      fields.push("name = ?");
      values.push(data.name.trim());
    }
    if ("description" in data) {
      fields.push("description = ?");
      values.push(data.description ?? null);
    }
    if ("category" in data) {
      fields.push("category = ?");
      values.push(data.category ?? null);
    }
    if (data.title_template !== undefined) {
      fields.push("title_template = ?");
      values.push(data.title_template.trim());
    }
    if (data.priority !== undefined) {
      fields.push("priority = ?");
      values.push(data.priority);
    }
    if (data.is_recurring !== undefined) {
      fields.push("is_recurring = ?");
      values.push(data.is_recurring ? 1 : 0);
    }
    if ("recurrence_pattern" in data) {
      fields.push("recurrence_pattern = ?");
      values.push(data.recurrence_pattern ?? null);
    }
    if ("reminder_minutes" in data) {
      fields.push("reminder_minutes = ?");
      values.push(data.reminder_minutes ?? null);
    }
    if ("subtasks_json" in data) {
      fields.push("subtasks_json = ?");
      values.push(data.subtasks_json ?? null);
    }

    if (fields.length === 0) return templateDB.findById(userId, id);
    values.push(id, userId);
    db.prepare(
      `UPDATE templates SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`
    ).run(...values);
    return templateDB.findById(userId, id);
  },

  delete(userId: number, id: number): boolean {
    const result = getDb()
      .prepare("DELETE FROM templates WHERE id = ? AND user_id = ?")
      .run(id, userId);
    return Number(result.changes) > 0;
  },
};
