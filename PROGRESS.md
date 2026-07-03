# Implementation Progress Report

> **Date**: 2026-07-03
> **Status**: Features 01–11 ALL IMPLEMENTED
> **Dev server**: Confirmed running at `http://localhost:3000` (Next.js 15.5.20)

---

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Database | `node:sqlite` (built-in `DatabaseSync`) | `better-sqlite3` fails to compile on Node.js 26 (C++20 requirement). `node:sqlite` is built-in since Node 22, no native compilation needed. |
| Auth | WebAuthn/Passkeys + username fallback | WebAuthn (Feature 11) fully implemented. Dev fallback "Quick Sign In" retained for local development. |
| Sections naming | "Pending" (not "Active") | USER_GUIDE.md uses "Pending" consistently. EVALUATION.md says "Active" — we follow USER_GUIDE per priority rules. |
| Delete behavior | Immediate, no confirmation | USER_GUIDE.md explicitly states "No confirmation dialog". EVALUATION.md conflicts but USER_GUIDE takes priority. |

---

## Completed Features

### ✅ Feature 01: Todo CRUD Operations

**All checklist items from EVALUATION.md are satisfied:**

- [x] Database schema (`todos` table with all fields)
- [x] `POST /api/todos` — creates todo with validation
- [x] `GET /api/todos` — returns all todos for user, sorted
- [x] `GET /api/todos/[id]` — single todo with ownership check
- [x] `PUT /api/todos/[id]` — partial update
- [x] `DELETE /api/todos/[id]` — returns 204, cascade via FK
- [x] Singapore timezone validation (`validateFutureDate`)
- [x] Title validation (non-empty, trimmed)
- [x] Due date must be in future (minimum 1 minute)
- [x] UI form for creating todos (title + priority + datetime picker)
- [x] UI sections: Overdue / Pending / Completed
- [x] Toggle completion checkbox
- [x] Edit todo modal with pre-populated fields
- [x] Delete — immediate, no confirmation (per USER_GUIDE.md)
- [x] Optimistic UI updates (toggle, delete, create)

**Files:**
- `lib/db.ts` — `todoDB.create`, `findAll`, `findById`, `update`, `delete`
- `lib/timezone.ts` — `parseSingaporeDateString`, `validateFutureDate`, `getSingaporeNow`, `formatSingaporeDate`
- `app/api/todos/route.ts` — GET + POST
- `app/api/todos/[id]/route.ts` — GET + PUT + DELETE
- `app/page.tsx` — Full UI with sections, forms, edit modal

---

### ✅ Feature 02: Priority System

- [x] Database: `priority` field with CHECK constraint + DEFAULT 'medium'
- [x] Type: `type Priority = 'high' | 'medium' | 'low'` (in `lib/types.ts`)
- [x] Priority validation in POST and PUT API routes
- [x] Default priority set to 'medium'
- [x] Priority badge component (red/yellow/blue with dark mode variants)
- [x] Priority dropdown in create and edit forms
- [x] Priority filter dropdown in UI ("All Priorities" default)
- [x] Auto-sort by priority (DB-level + client-side)
- [x] Dark mode color compatibility (Tailwind `dark:` variants)

---

### ✅ Feature 03: Recurring Todos

- [x] Database: `is_recurring` (INTEGER 0/1) and `recurrence_pattern` fields
- [x] Type: `type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'`
- [x] Validation: Recurring todos require due date (400 if missing)
- [x] "Repeat" checkbox in create/edit forms (disabled without due date)
- [x] Recurrence pattern dropdown (shown only when Repeat checked)
- [x] Next instance creation on completion (`todoDB.createNextRecurrence`)
- [x] Due date calculation logic — all 4 patterns, monthly clamps to last day
- [x] Inherits: priority, reminder_minutes, recurrence_pattern, title
- [x] 🔄 badge display with pattern name (purple, bordered)
- [x] API returns `{ completed, next }` for recurring completion

**Key function:** `calculateNextDueDate(current: Date, pattern: RecurrencePattern)` in `lib/timezone.ts`

---

### ✅ Supporting Infrastructure (partial — dev stub)

- [x] `lib/auth.ts` — JWT session management (create, read, clear cookies)
- [x] `middleware.ts` — Protects `/` and `/calendar`, redirects to `/login`
- [x] `app/api/auth/login/route.ts` — Username-based login (find-or-create user)
- [x] `app/api/auth/logout/route.ts` — Clears session cookie
- [x] `app/api/auth/me/route.ts` — Returns current user
- [x] `app/login/page.tsx` — Login form UI
- [x] `app/layout.tsx` — Root layout with Tailwind globals
- [x] `lib/types.ts` — Shared `Priority` and `RecurrencePattern` types

---

### ✅ Feature 04: Reminders & Notifications

- [x] Database: `reminder_minutes` and `last_notification_sent` fields (already existed)
- [x] API endpoint: `GET /api/notifications/check` — returns todos with due reminders, marks as notified
- [x] `todoDB.findDueReminders()` method added to `lib/db.ts`
- [x] Browser notification permission flow via "🔔 Enable Notifications" button
- [x] Polling system (every 60 seconds)
- [x] Duplicate prevention via `last_notification_sent` field
- [x] 🔔 badge display with timing abbreviation
- [x] Reminder dropdown (7 timing options) in create and edit forms
- [x] Reminder disabled without due date

**Files:**
- `app/api/notifications/check/route.ts` — Returns due reminders, marks as notified
- `lib/db.ts` — `todoDB.findDueReminders` method
- `app/page.tsx` — Notification permission button, polling, reminder UI

---

### ✅ Feature 05: Subtasks & Progress Tracking

- [x] Database: `subtasks` table with CASCADE delete
- [x] API: `POST /api/todos/[id]/subtasks` (create)
- [x] API: `PUT /api/subtasks/[id]` (update/toggle)
- [x] API: `DELETE /api/subtasks/[id]`
- [x] Expandable subtask section in UI ("▶ Subtasks" toggle)
- [x] Add subtask input with Enter key support
- [x] Subtask checkboxes for completion toggle
- [x] Delete subtask button (✕)
- [x] Progress bar (blue, green at 100%)
- [x] "X/Y subtasks" text indicator
- [x] Subtasks loaded on mount for progress display

**Files:**
- `app/api/todos/[id]/subtasks/route.ts` — POST create subtask
- `app/api/subtasks/[id]/route.ts` — PUT update + DELETE
- `lib/db.ts` — `subtaskDB` export (create, findByTodoId, update, delete)

---

### ✅ Feature 06: Tag System

- [x] Database: `tags` and `todo_tags` tables (many-to-many with CASCADE)
- [x] API: `GET/POST /api/tags`
- [x] API: `PUT/DELETE /api/tags/[id]`
- [x] API: `POST/DELETE /api/todos/[id]/tags` (assign/remove tags)
- [x] "Manage Tags" modal with color picker + hex input
- [x] Tag creation with duplicate name validation (409 conflict)
- [x] Tag editing (name + color) and deletion
- [x] Tag pills displayed on todos (colored backgrounds)
- [x] Tag selection in edit modal (toggle checkboxes)
- [x] Tag filter dropdown in search section
- [x] User-specific tags (unique per user)

**Files:**
- `app/api/tags/route.ts` — GET all + POST create
- `app/api/tags/[id]/route.ts` — PUT update + DELETE
- `app/api/todos/[id]/tags/route.ts` — POST assign + DELETE remove
- `lib/db.ts` — `tagDB` export (create, findByUser, findByTodoId, update, delete, addToTodo, removeFromTodo)

---

### ✅ Feature 07: Template System

- [x] Database: `templates` table with JSON `subtasks_json` field
- [x] API: `GET/POST /api/templates`
- [x] API: `GET/PUT/DELETE /api/templates/[id]`
- [x] API: `POST /api/templates/[id]/use` — creates todo from template with subtasks
- [x] "💾 Save as Template" button (appears when title filled)
- [x] Save template modal (name, description, category)
- [x] "📋 Templates" modal for browsing/using/deleting templates
- [x] "Use Template" dropdown in create form
- [x] Category display, priority/recurrence/reminder badges in template list

**Files:**
- `app/api/templates/route.ts` — GET all + POST create
- `app/api/templates/[id]/route.ts` — GET one + PUT update + DELETE
- `app/api/templates/[id]/use/route.ts` — POST create todo from template
- `lib/db.ts` — `templateDB` export (create, findByUser, findById, update, delete)

---

### ✅ Feature 08: Search & Filtering

- [x] Search input with 🔍 icon and ✕ clear button
- [x] Real-time debounced search (300ms) — case-insensitive
- [x] Searches todo titles, subtask titles, and tag names
- [x] Priority filter dropdown
- [x] Tag filter dropdown
- [x] Advanced filters panel (▶/▼ toggle):
  - Completion status (All/Incomplete/Completed)
  - Date range (From/To)
  - Saved filter presets display
- [x] "Clear All" button (red) when filters active
- [x] "💾 Save Filter" button (green) — saves to localStorage
- [x] Filter presets: apply and delete
- [x] AND-logic combination of all filters
- [x] Empty state message when no matches

**Files:**
- `app/page.tsx` — All search/filter UI and logic (client-side filtering)

---

### ✅ Feature 09: Export & Import

- [x] API: `GET /api/todos/export?format=json|csv` — exports todos with subtasks/tags (JSON) or flat spreadsheet (CSV)
- [x] API: `POST /api/todos/import` — imports from JSON, remaps IDs, reuses existing tags by name
- [x] JSON export includes: todos, subtasks (nested), tags (nested), completion status, all metadata
- [x] CSV export: spreadsheet-friendly with ID, Title, Completed, Due Date, Priority, Recurring, Pattern, Reminder columns
- [x] Import creates new todos with new IDs, preserves subtasks and tags
- [x] Tag conflict resolution: reuses existing tags by name, creates new ones if needed
- [x] UI: "Export JSON" button, "Export CSV" button, "Import" file picker (all in header)
- [x] Success message shows count of imported todos
- [x] Content-Disposition headers with dated filenames

**Files:**
- `app/api/todos/export/route.ts` — GET export endpoint (JSON + CSV formats)
- `app/api/todos/import/route.ts` — POST import endpoint
- `app/page.tsx` — Export/Import buttons in header

---

### ✅ Feature 10: Calendar View

- [x] `/calendar` page with full monthly grid
- [x] `holidays` table auto-seeded with 2026 Singapore public holidays (11 holidays)
- [x] `GET /api/holidays?year=YYYY` endpoint
- [x] Month navigation: prev (◀), next (▶), Today button
- [x] Current day highlighted with blue ring
- [x] Weekend cells with gray background
- [x] Todos displayed on due dates with priority color dots (red/yellow/blue)
- [x] Multiple todos stack; shows first 3 with "+N more" indicator
- [x] Holiday display with 🎉 badge and red background
- [x] Click-to-view day detail modal (shows all todos + holidays for that day)
- [x] Color legend at bottom
- [x] "← Back to Todos" navigation button
- [x] Suspense boundary wrapping useSearchParams for Next.js build compatibility
- [x] `holidayDB.findByYear()` and `holidayDB.findByMonth()` in lib/db.ts

**Files:**
- `app/calendar/page.tsx` — Calendar view UI (~290 lines)
- `app/api/holidays/route.ts` — GET holidays by year
- `lib/db.ts` — `holidayDB` export + holidays table schema + seedHolidays function

---

### ✅ Feature 11: WebAuthn/Passkeys Authentication

- [x] `authenticators` table for credential storage (credential_id, public_key, counter, transports)
- [x] Installed: `@simplewebauthn/server` + `@simplewebauthn/browser`
- [x] `POST /api/auth/register-options` — generates registration challenge
- [x] `POST /api/auth/register-verify` — verifies registration, stores authenticator, creates session
- [x] `POST /api/auth/login-options` — generates authentication challenge
- [x] `POST /api/auth/login-verify` — verifies authentication, updates counter, creates session
- [x] Challenge stored in HTTP-only cookies (5-minute expiry)
- [x] Counter update on each successful login (replay protection)
- [x] Login page updated with dual mode: "Sign In with Passkey" + "Register Passkey"
- [x] Dev fallback "Quick Sign In" button still available for development
- [x] Uses `isoBase64URL` from `@simplewebauthn/server/helpers` for credential encoding
- [x] Environment variables: RP_ID (default: localhost), RP_NAME, ORIGIN

**Files:**
- `app/api/auth/register-options/route.ts` — Registration challenge generation
- `app/api/auth/register-verify/route.ts` — Registration verification
- `app/api/auth/login-options/route.ts` — Login challenge generation
- `app/api/auth/login-verify/route.ts` — Login verification
- `app/login/page.tsx` — Updated with WebAuthn login/register + dev fallback
- `lib/db.ts` — `authenticatorDB` export + authenticators table schema

---

## Known Issues / Tech Debt

1. **Missing `eslint.config.mjs`** — `npm run lint` will fail. Need to create ESLint flat config for Next.js.
2. **`copilot-instructions.md` references `better-sqlite3`** — Code uses `node:sqlite`. Should update if continuing development with AI agents.
3. **Duplicate JWT_SECRET initialization** — Same logic in `lib/auth.ts` and `middleware.ts`. Could extract to shared module.
4. **No E2E tests yet** — Playwright not installed. Tests should be added per EVALUATION.md requirements.
5. **`next-env.d.ts`** — Auto-generated by Next.js on first dev run. Already created.
6. **WebAuthn production env vars** — `RP_ID` and `ORIGIN` environment variables must be set for production WebAuthn. Defaults to `localhost` / `http://localhost:3000` for local dev.

---

## File Map

```
lib/
├── types.ts          — Shared Priority + RecurrencePattern types
├── timezone.ts       — Singapore timezone utilities + calculateNextDueDate
├── db.ts             — Database singleton, schema, userDB, todoDB, subtaskDB, tagDB, templateDB, holidayDB, authenticatorDB (node:sqlite)
└── auth.ts           — JWT session helpers (create, read, clear)

app/
├── globals.css       — Tailwind import
├── layout.tsx        — Root layout
├── page.tsx          — Main todo UI (monolithic, ~1100 lines currently)
├── login/page.tsx    — Login form with WebAuthn + dev fallback
├── calendar/page.tsx — Calendar monthly view (~290 lines)
└── api/
    ├── auth/
    │   ├── login/route.ts
    │   ├── logout/route.ts
    │   ├── me/route.ts
    │   ├── register-options/route.ts  — WebAuthn registration challenge
    │   ├── register-verify/route.ts   — WebAuthn registration verify
    │   ├── login-options/route.ts     — WebAuthn login challenge
    │   └── login-verify/route.ts      — WebAuthn login verify
    ├── holidays/
    │   └── route.ts          — GET holidays by year
    ├── notifications/
    │   └── check/route.ts    — GET due reminders
    ├── subtasks/
    │   └── [id]/route.ts     — PUT update + DELETE
    ├── tags/
    │   ├── route.ts          — GET all + POST create
    │   └── [id]/route.ts     — PUT update + DELETE
    ├── templates/
    │   ├── route.ts          — GET all + POST create
    │   └── [id]/
    │       ├── route.ts      — GET one + PUT update + DELETE
    │       └── use/route.ts  — POST create todo from template
    └── todos/
        ├── route.ts          — GET all + POST create
        ├── export/route.ts   — GET export (JSON + CSV)
        ├── import/route.ts   — POST import
        └── [id]/
            ├── route.ts      — GET one + PUT update + DELETE
            ├── subtasks/route.ts — POST create subtask
            └── tags/route.ts    — POST assign + DELETE remove

middleware.ts         — Route protection
next.config.ts        — Next.js config
tsconfig.json         — TypeScript config
postcss.config.mjs    — Tailwind PostCSS
package.json          — Dependencies (no native modules)
.env.local            — JWT_SECRET, RP_ID, RP_NAME, ORIGIN
.gitignore            — node_modules, .next, todos.db, .env.local
```

---

## How to Continue

1. **Install dependencies**: `npm install` (already done)
2. **Start dev server**: `npm run dev` → http://localhost:3000
3. **All features complete** — focus on testing and deployment
4. **Testing**: Install Playwright (`npm init playwright@latest`) and create test files per EVALUATION.md
5. **Linting**: Create `eslint.config.mjs` for Next.js flat config
6. **Production**: Set `RP_ID`, `RP_NAME`, `ORIGIN` env vars for WebAuthn in production

### Next Steps
```
Phase 6: E2E Testing (Playwright) — all 11 features need test coverage
Phase 7: Production readiness (ESLint, env config, deployment)
```

### Important Constraints
- All dates must use `lib/timezone.ts` helpers (never `new Date()` for display)
- API routes: always `await params` for dynamic segments (Next.js 15+)
- Database operations are synchronous (`node:sqlite` DatabaseSync)
- Main UI stays in `app/page.tsx` (monolithic pattern per project convention)
- WebAuthn: use `?? 0` for counter field to handle undefined values
- USER_GUIDE.md takes priority over EVALUATION.md when they conflict
