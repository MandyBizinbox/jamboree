# South Africa Contingent Registration App — Developer Guide

This document explains how to run, understand, extend, test, and deploy the Poland 2027 World Scout Jamboree registration application.

## 1. Product overview

The application provides a mobile-first registration journey for the South African contingent attending the 26th World Scout Jamboree in Poland in 2027. It has two operational surfaces:

- **Public registration:** participants, parents/legal guardians, or authorised representatives complete and submit a participant record. The form supports adult/minor branching, conditional questions, consent, review, and local draft save/resume.
- **Restricted CMT workspace:** authorised contingent-management staff review registrations, change statuses, and maintain the form configuration through the form builder.

The supplied `wsj-fields.json` is the authoritative field inventory. It contains the source field labels, source columns, field identifiers, option values, UUID mappings, and source relationships. Display-label and section customisations must never change the source mapping.

The original Poland XLSX workbook has not yet been supplied. Consequently, final workbook export and round-trip import verification are not complete and must not be treated as production-ready.

## 2. Technology stack

- **Frontend:** React 19, TypeScript, Wouter, React Hook Form, Radix UI, Tailwind CSS, Framer Motion, Lucide icons.
- **Backend:** Node.js, Express, tRPC, Zod, Manus OAuth session integration.
- **Persistence:** MySQL-compatible database through Drizzle ORM and `mysql2`.
- **Build:** Vite for the client and esbuild for the server bundle.
- **Tests:** Vitest.
- **Package manager:** pnpm 10.

## 3. Repository structure

```text
client/
  public/manus-routes.json       Route manifest exposed at /manus-routes.json
  src/
    _core/hooks/useAuth.ts       Client auth state and OAuth session handling
    components/                   Shared UI components
    data/wsj-fields.json          Authoritative 197-field source inventory
    pages/Home.tsx                Registration, review, CMT, and form-builder UI
    pages/NotFound.tsx            404 page
    index.css                     Design tokens and responsive layout styles
    App.tsx                       Wouter route declarations

drizzle/
  schema.ts                       MySQL/Drizzle schema
  0000_initial_users.sql           Base users migration
  0001_mute_carlie_cooper.sql      Registration/audit migration
  0002_foamy_baron_zemo.sql        Form-builder migration

server/
  _core/index.ts                  Express entry point and server CMT gate
  _core/trpc.ts                   publicProcedure/protectedProcedure/adminProcedure
  _core/context.ts                tRPC request context
  _core/sdk.ts                    Manus OAuth/session SDK
  _core/oauth.ts                  OAuth routes
  db.ts                            Database connection helper
  registrationDb.ts                Registration and audit persistence
  formBuilderDb.ts                 Form-builder persistence
  routers.ts                       tRPC API router

shared/
  const.ts                         Shared auth constants
  types.ts                         Shared application types

docs/
  DEVELOPER.md                     This document

plan.md                            Product and design decisions
TODO.md                            Launch checklist and unresolved confirmations
package.json                       Scripts and dependency list
```

## 4. Local setup

### Prerequisites

Install Node.js, pnpm, and a MySQL-compatible database. The repository expects pnpm 10.18.0. Confirm the versions with:

```bash
node --version
pnpm --version
```

Install dependencies:

```bash
pnpm install
```

### Environment variables

The exact Manus platform values are normally injected by the managed runtime. For a local or self-hosted environment, configure the following server-side values as appropriate:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL connection URL. Required by Drizzle commands and used by the server database helper. |
| `MANUS_OAUTH_API_URL` | Manus OAuth service URL. Required for OAuth authentication. |
| `MANUS_PROJECT_ID` | Application/project identifier used by the Manus session integration. |
| `MANUS_JWT_SECRET` | Server-side session signing/verification secret. Never expose it to the browser. |
| `MANUS_API_KEY` | Server-side Manus API credential where required by the platform SDK. Never expose it to the browser. |
| `PORT` | HTTP port; defaults to `3000`. |

The browser receives only the named public runtime values from `server/_core/publicConfig.ts`. Do not place database credentials, JWT secrets, or private API keys in client code, `client/public`, or `window.__MANUS_CONFIG__`.

### Database setup

Apply checked-in migrations:

```bash
pnpm db:migrate
```

To generate a migration after changing `drizzle/schema.ts` and immediately apply it during development:

```bash
pnpm db:push
```

Review generated SQL before committing it. Do not edit an already-applied migration in place; create a new migration instead.

### Start development

```bash
pnpm dev
```

The development server listens on `PORT` or port `3000`. It runs Express and Vite together through `server/_core/index.ts`.

Useful local URLs:

- `http://127.0.0.1:3000/` — public registration landing page.
- `http://127.0.0.1:3000/register` — public registration route.
- `http://127.0.0.1:3000/review` — public/client review route.
- `http://127.0.0.1:3000/cmt` — admin-only CMT workspace.
- `http://127.0.0.1:3000/cmt/form-builder` — admin-only form builder.
- `http://127.0.0.1:3000/api/health` — health endpoint.
- `http://127.0.0.1:3000/manus-routes.json` — static route manifest.

## 5. Routing and access control

Client routes are declared in `client/src/App.tsx`. The same `Home` page component currently switches its rendered surface based on the Wouter location.

CMT access is protected in two independent layers:

1. **Express server gate:** `server/_core/index.ts` checks every request whose path is `/cmt` or starts with `/cmt/`. Unauthenticated requests receive HTTP `401`; authenticated non-admin users receive HTTP `403`.
2. **Client guard:** `CmtGuard` in `client/src/pages/Home.tsx` uses `useAuth()`. It displays a Manus OAuth sign-in prompt when there is no session and an access-denied state when the signed-in user is not an administrator.

The API has a third layer through tRPC procedure types:

- `publicProcedure` — no authenticated user required.
- `protectedProcedure` — requires any authenticated user.
- `adminProcedure` — requires `ctx.user.role === "admin"`.

Do not rely on the client guard alone. Any new CMT API procedure must use `adminProcedure`, and any new CMT URL must remain covered by the server path gate.

Administrator status is stored in `users.role` as either `user` or `admin`. Provisioning administrators is an operational/database task in the current implementation; there is no public self-service role-management screen.

## 6. Public registration flow

The public flow is implemented primarily in `client/src/pages/Home.tsx`.

The current flow is designed around these stages:

1. Select the source-defined role.
2. Capture date of birth early and determine minor/adult status using the configured eligibility logic.
3. Identify who is completing the record: participant, parent/legal guardian, or authorised representative.
4. Collect participant identity and contact information.
5. Show source-driven fields grouped into the shorter participant-facing sections.
6. Branch to guardian consent and identity fields for minors.
7. Apply conditional visibility for visa, travel document, diet, allergy, chronic-condition, medication, equipment, mobility, accessibility, and related follow-up fields.
8. Review completeness and consent.
9. Save a draft locally or submit the record.

The public UI does not display source metadata such as `Source field #020 · TextFormField` beneath field labels. The source mapping remains available to the application and CMT form builder without being presented as participant-facing copy.

The removed sections are:

- `04 — Accompanying carer`
- `10 — Arrival and departure`

The shorter participant-facing sections currently include contact information, languages, comfort/activities/equipment, travel documents, visa/immigration, emergency contact, diet, allergies, chronic conditions/medication, vaccinations/blood type, medical equipment/mobility, and accessibility.

## 7. Source inventory and mapping rules

`client/src/data/wsj-fields.json` is copied into the repository and must be treated as immutable source input unless the source authority provides a replacement revision.

Important rules:

- Preserve source column numbers.
- Preserve source field identifiers and `map_key` values.
- Preserve UUID-backed option values.
- Preserve source dropdown labels and relationships.
- Do not populate section-only rows as participant answers.
- Do not use a display-label change as an excuse to change an Excel mapping.
- If the source JSON changes, record the revision and review all conditional logic and option rendering.

The form builder can change the participant-facing display label, section assignment, visibility, and required state. It must not change the source column or source identity.

## 8. CMT form builder

The form builder is available at `/cmt/form-builder` after administrator authentication.

Capabilities include:

- Rename sections.
- Reorder sections.
- Hide/show sections.
- Search fields within sections.
- Rename participant-facing field labels.
- Hide/show fields.
- Toggle required state.
- View read-only mapping information such as source column, source header, `map_key`, UUID details, and source metadata.
- Save individual changes or batch-save the configuration.

The persisted configuration is stored in:

- `formSections`: `sectionKey`, display label, sort order, visibility, and last updater.
- `formFieldConfigs`: source column, display label, section key, visibility, required state, and last updater.

`server/formBuilderDb.ts` uses upsert behavior keyed by the stable section key or source column. This means a configuration update should be safe to repeat, but production workflows should still retain audit context and review changes carefully.

## 9. tRPC API reference

The application router is defined in `server/routers.ts`.

### Authentication

- `auth.me` — public query returning the current user or `null`.
- `auth.logout` — public mutation that clears the session cookie.

### Registrations

- `registrations.saveDraft` — public mutation. Creates a draft registration and writes a `draft_saved` audit event.
- `registrations.submit` — public mutation. Creates a submitted registration and writes a `submitted` audit event.
- `registrations.myDrafts` — protected query. Requires an authenticated user.
- `registrations.cmtQueue` — admin query. Lists registrations for the CMT queue.
- `registrations.setStatus` — admin mutation. Changes a registration status and writes a `status_changed` audit event.

Allowed statuses are:

```text
Draft
Submitted
Needs correction
Approved
Exported
```

### Form builder

- `formBuilder.get` — admin query returning persisted section and field configuration.
- `formBuilder.saveConfig` — admin batch mutation.
- `formBuilder.saveSection` — admin mutation for one section.
- `formBuilder.saveField` — admin mutation for one field.

All input is validated with Zod before reaching persistence helpers.

## 10. Database model

The main tables are defined in `drizzle/schema.ts`.

### `users`

Stores the Manus OAuth identity and application role. The `role` enum is `user` or `admin`.

### `registrations`

Stores workflow metadata and the source-keyed participant payload:

- `reference`: human-readable unique registration reference.
- `participantUserId`, `guardianUserId`: optional user links.
- `role`: selected source role.
- `dateOfBirth`: ISO-like date string from the form.
- `isMinor`: integer boolean.
- `status`: workflow status enum.
- `payload`: JSON serialized source-keyed answers.
- `sourceRevision`: source inventory revision, currently defaulting to `wsj-fields.json`.
- `createdAt`, `updatedAt`: timestamps.

### `auditEvents`

Stores registration or administrative actions. Each event can include a registration, actor, action name, and JSON detail string.

### `formSections`

Stores section presentation overrides without changing source identity.

### `formFieldConfigs`

Stores source-column keyed presentation and validation overrides. The source column is unique and is the stable persistence key.

## 11. Persistence behavior and current caveats

Database helpers intentionally return a non-persisted result when `DATABASE_URL` is unavailable. This allows the UI to run in a local/demo environment, but it is not acceptable for a production launch because registration data would not be durable.

Before launch:

- Require a configured production database rather than silently accepting non-persistence.
- Add robust duplicate/reference handling for repeated draft saves and submissions.
- Add transactional writes for registration plus audit event creation.
- Confirm whether draft updates should update an existing reference instead of inserting a new row.
- Add role-aware participant/guardian ownership checks for any user-facing record retrieval.
- Protect health-data access and define retention/deletion rules.

## 12. Testing and validation

Run the standard checks:

```bash
pnpm check
pnpm test
pnpm build
```

The production build outputs the client under `dist/public` and bundles the server to `dist/index.js`.

Start the production bundle locally with:

```bash
NODE_ENV=production pnpm start
```

Basic route smoke test:

```bash
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1:3000/cmt
curl -i http://127.0.0.1:3000/cmt/form-builder
```

Expected anonymous results:

- `/` returns `200`.
- `/cmt` returns `401`.
- `/cmt/form-builder` returns `401`.

For authenticated testing, use a real Manus OAuth session or the managed preview authentication flow. Never commit session cookies, OAuth codes, JWTs, or test production credentials.

## 13. Production deployment

The normal managed workflow is:

1. Make the change in the repository.
2. Run `pnpm check`, `pnpm test`, and `pnpm build`.
3. Apply and verify database migrations in the target environment.
4. Review the generated route manifest and public runtime configuration.
5. Commit to `main` using a descriptive message.
6. Push to the canonical managed repository.
7. Verify the deployed public route, CMT auth behavior, and `/api/health` endpoint.

The current managed project deployment domain is supplied by the Webdev project configuration; do not hard-code it in client code. Browser-facing URLs should remain relative so preview and deployed proxy environments work correctly.

## 14. XLSX export work that remains

The export adapter must not be completed by guessing workbook structure. Once the official `Template 26th WSJ Data.xlsx` is available:

1. Inspect sheet names, hidden sheets, headers, styles, validation, metadata, and row offsets.
2. Confirm whether cells require UUID keys or display labels.
3. Confirm the first participant row, currently expected to be row 5 but not yet verified.
4. Match all 197 source fields by source column and stable identifier.
5. Exclude section-only source rows from populated answers.
6. Preserve existing workbook structure and formatting.
7. Make export idempotent and retryable.
8. Restrict export to administrators.
9. Write an audit event for each export.
10. Test export → import → normalized payload round-trip with representative adult and minor records.

Do not ship an export feature until CMT/Poland confirms the workbook semantics and the round-trip test passes.

## 15. Security and privacy checklist

This application processes identity, contact, guardian, travel, immigration, dietary, allergy, medical, mobility, and accessibility information. Treat it as sensitive personal and health-related data.

Before production launch:

- Obtain approved POPIA/GDPR and cross-border processing language.
- Define lawful basis, consent wording, retention, deletion, and data-subject request processes.
- Restrict medical information to the minimum CMT roles that require it.
- Use TLS everywhere and secure, HTTP-only session cookies.
- Keep all secrets server-side.
- Review database backups and access logs.
- Add rate limiting and abuse protection to public submission endpoints.
- Add CSRF and origin protections appropriate to the deployed session model.
- Validate and normalize all uploaded or imported workbook data.
- Avoid logging full participant payloads or medical values.
- Ensure audit records do not accidentally duplicate sensitive health data.
- Test that anonymous users cannot access CMT pages, CMT tRPC procedures, or participant records.

## 16. Launch blockers and owner confirmations

The following items are tracked in `TODO.md` and require confirmation before production:

- Official eligibility age policy and reference date.
- Canonical country/NSO values.
- Patrol ID assignment rules.
- UUID-versus-display-label workbook semantics.
- Approved privacy, consent, cross-border processing, retention, deletion, and health-data access policy.
- The original Poland workbook, `Template 26th WSJ Data.xlsx`.

## 17. Recommended extension pattern

When adding a new source-mapped field:

1. Add or update the authoritative source inventory first.
2. Confirm its source column, identifier, options, UUIDs, and conditional relationships.
3. Add rendering logic only through the source-driven field path where possible.
4. Add applicability and validation rules.
5. Ensure the field is represented in the review summary.
6. Confirm it does not alter existing source mappings.
7. Add or update tests for adult, minor, applicable, and non-applicable cases.
8. Run type-check, tests, build, and route/auth smoke tests.

When adding an administrative capability:

1. Add an `adminProcedure` tRPC endpoint.
2. Add server-side route protection if it introduces a new admin URL.
3. Add an audit event for state-changing actions.
4. Avoid exposing sensitive payloads in client logs.
5. Verify behavior for anonymous, normal-user, and admin sessions.

## 18. Useful commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Type-check
pnpm check

# Run tests
pnpm test

# Build client and server
pnpm build

# Run compiled production server
NODE_ENV=production pnpm start

# Apply existing migrations
pnpm db:migrate

# Generate and apply a development migration
pnpm db:push

# Format source files
pnpm format
```
