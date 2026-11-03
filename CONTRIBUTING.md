# Contributing to Universal POS

Thanks for taking the time to contribute. This document covers how the project is organized, the conventions the existing code follows, and what's expected before you open a pull request.

## Getting set up

Follow [README.md](README.md) to get the database, backend, and frontend running locally. You'll need both the PHP API (`backend/`) and the Vite dev server (`frontend/`) running to work on most features end to end.

## Project layout

See the **Repository Structure** section in the README for the full tree. The short version:

- `backend/src/Controllers/` — one controller per resource, no framework, direct PDO
- `backend/src/Middleware/` — `AuthMiddleware` (JWT), `PermissionMiddleware` (roles/permissions)
- `backend/database/schema.sql` + `seed.sql` — the only source of truth for the database
- `frontend/src/pages/` — one file per screen, routed in `App.jsx`
- `frontend/src/db/` — the offline IndexedDB cache and sync engine
- `frontend/src/i18n/locales/{en,ta}/translation.json` — all user-facing strings

## Branching and commits

- Branch off `main`: `git checkout -b feature/short-description` or `fix/short-description`.
- Keep commits focused — one logical change per commit, with a message that explains *why*, not just *what*.
- Open a pull request against `main`. Small, reviewable PRs are preferred over large ones that touch many modules at once.

## Backend conventions

The backend deliberately avoids a framework — stay consistent with the existing pattern rather than introducing a new one.

- **Controllers** are plain classes constructed with a `PDO` instance, wired up as closures in `public/index.php`. Follow the existing method shapes (`index`, `show`, `store`, `update`, `destroy`) where they fit.
- **Every endpoint that authenticates** must call `AuthMiddleware::authenticate()` first, and most should follow with a `PermissionMiddleware` check for the relevant permission code (see `backend/database/seed.sql` for the existing permission catalog, or add a new one there if your feature needs it).
- **Two permission-check variants exist on purpose:**
  - `PermissionMiddleware::require($claims, $code)` exits immediately with a 403 — safe for a controller method reachable *only* from a direct REST endpoint.
  - `PermissionMiddleware::requireOrThrow($claims, $code)` throws a catchable `PermissionDeniedException` instead — **required** for any method also reachable from `SyncController`'s offline batch dispatcher (`createFromSync`-style methods), because `exit` inside one queued operation would kill the entire sync batch response for every other operation in it. If you're adding a new offline-syncable write (a new entry in `SyncController::push()`'s `match`), use `requireOrThrow`, not `require`.
- **Offline-sync safety**: any endpoint that can be queued and replayed from the client outbox (see `db/syncService.js`) must be idempotent — look up by the client-supplied `uuid` first and return the existing record if found, rather than inserting a duplicate. Follow the existing `createFromSync` pattern in `InvoiceController`, `PurchaseController`, `CustomerController`, etc.
- **Stock changes** always go through a `stock_movements` row alongside the `products.stock_qty` update — never update one without the other. The movements table is the audit trail; the cached quantity on `products` must always be derivable by summing it.
- **Audit logging**: sensitive mutations (create/update/delete/cancel/adjust on products, users, settings, returns) should call `AuditLogger::log($pdo, $claims, $action, $entityType, $entityId, $details)`. Routine transactional writes (a normal sale or purchase) don't need an audit entry — they're already their own record.
- **Validation errors** throw `ValidationException` (422), not a generic `Throwable`. Catch it specifically in the controller and map it to `Response::error($msg, 422)`.

## Database changes

Never hand-edit a running database as the only record of a change. If you add or alter a table/column:

1. Update `backend/database/schema.sql` with the new `CREATE TABLE` / `ALTER TABLE`.
2. Update `backend/database/seed.sql` if the change needs default data (a new permission code, a new lookup row, etc.).
3. Apply it to your local database and confirm a fresh import of both files from scratch still works.

## Frontend conventions

- Functional components with hooks — no class components.
- Styling is Tailwind utility classes inline; keep the existing light/dark pairing (`bg-white dark:bg-slate-900`, etc.) rather than introducing new colors ad hoc.
- **Every user-facing string must go through `t('namespace.key')`** (`react-i18next`) — **and you must add the key to both** `frontend/src/i18n/locales/en/translation.json` **and** `frontend/src/i18n/locales/ta/translation.json` in the same change. A PR that adds English-only text will be asked to add the Tamil translation before merge.
- Gate UI elements by permission with `const { can } = useAuth(); can('some.permission')` — mirror whatever check the corresponding backend endpoint enforces, so the UI doesn't show actions a user's request will be rejected for.
- New pages that write data while offline should use the outbox helpers in `frontend/src/db/db.js` (`enqueueOutboxItem`, `newUuid`, etc.) rather than inventing a separate offline-queueing mechanism.
- New permission-gated or offline-capable screens should be added to `frontend/src/components/Layout.jsx`'s nav list with the matching `perm` key, and routed in `App.jsx`.

## Before opening a pull request

Run both of these and make sure they're clean:

```bash
# Backend — syntax-check every changed PHP file
php -l backend/src/Controllers/YourController.php

# Frontend — full production build must succeed with no errors
cd frontend && npm run build
```

If you changed anything billing-, sync-, or permission-related, manually verify the actual flow in the browser (online and with the network disabled) — these are the areas most likely to break silently. Type-checking a diff is not the same as confirming the feature still works.

## Reporting bugs / requesting features

Open a GitHub issue with:

- What you expected to happen vs. what actually happened
- Steps to reproduce
- Whether it happened online, offline, or during a sync
- Business type in use (Mobile / Furniture / Food & Hotel), if relevant

## Code of conduct

Be respectful and constructive in issues, PRs, and reviews. Disagree on technical grounds, not personal ones.
