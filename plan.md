# Scout Jamboree Registration — implementation plan

## Product approach

Build a mobile-first registration workspace for South Africa’s 26th World Scout Jamboree contingent. The public experience is a guided, saveable registration journey; the restricted CMT experience is a review and export control room. The attached `wsj-fields.json` is copied into the project and treated as the source of truth for the 197 mapped columns, exact labels, UUID option keys, section rows, and conditional relationships. The missing original XLSX remains a launch blocker for round-trip export verification.

### Runtime architecture

- React + TypeScript frontend with route-level public registration, review, and CMT dashboard surfaces.
- Express/tRPC backend with Manus OAuth session support, protected CMT procedures, Drizzle/MySQL persistence, and immutable audit records.
- Registration records store normalized workflow metadata plus a JSON payload keyed by source column/map key so the export adapter can write into the original workbook without retyping.
- The export adapter is template-oriented: it will preserve worksheet structure, styles, metadata, hidden sheets, headers, instructions, and row offset once the original workbook is uploaded and verified.
- The UI never displays source `Section` fields as questions. Applicability rules hide guardian, visa, carer, dietary, allergy, medical, mobility, disability, and IST follow-ups unless their controlling response requires them.

## Design

### Candidate styles

- Field notebook / expedition dispatch — 0.07
- Heritage civic service — 0.05
- Modern clinical intake — 0.03

### Chosen direction: field notebook / expedition dispatch

**Design Movement:** editorial field notes blended with restrained civic service design: warm paper, red route marks, navy ink, and compact operational controls.

**Core Principles:** calm under complexity; visible progress; source-faithful labels; trust through clear status and permission cues.

**Color Philosophy:** a warm parchment canvas makes a high-stakes form feel human; deep navy anchors authority; jamboree red marks actions and route progress; acid yellow is reserved for notices and exception flags.

**Layout Paradigm:** a left route rail on desktop and a top step rail on mobile; the working form sits in a wide paper sheet while a narrow “trip log” column keeps completion, save state, and policy notes in view.

**Signature Elements:** compass-like registration mark; red route line connecting steps; small “source mapped” chips that expose the Excel column number without overwhelming the user.

**Interaction Philosophy:** every action explains what it changes. Conditional sections appear as a deliberate branch, not a surprise. Saving is visible and non-destructive. Admin actions require context and show audit language.

**Animation:** restrained 150–220ms fades and slide-ins for step transitions, branch reveal, status changes, and save confirmations; no looping decorative motion.

**Typography System:** IBM Plex Sans for interface clarity paired with Fraunces for editorial section headings. Uppercase micro-labels use tighter tracking; form labels remain sentence case.

**Brand Essence:** “One verified record from home to Poland” for participants, guardians, and the CMT; clear, grounded, accountable.

**Brand Voice:** headlines are direct and reassuring. Example lines: “Start with the person travelling.” “You can save this record and return when the details are ready.”

**Wordmark & Logo:** a compact red compass-point mark beside a navy wordmark reading “Route 27 / SA contingent”, with a small Poland 2027 lockup.

**Signature Brand Color:** jamboree red `#D54B39`.

## Project structure

- `client/src/pages/Home.tsx`: public intake journey, review state, and CMT dashboard shell.
- `client/src/data/wsj-fields.json`: copied authoritative source inventory.
- `client/src/index.css`: design tokens, layout, responsive behavior, and field-notebook styling.
- `drizzle/schema.ts`: users, registrations, guardian links, and audit events.
- `server/db.ts`: persistence helpers and source-keyed registration storage.
- `server/routers.ts`: public draft/save/submit procedures and protected CMT review/export placeholders.
- `public/manus-routes.json`: route manifest for `/`, `/register`, `/review`, and `/cmt`.
- `plan.md` / `TODO.md`: decisions, concrete acceptance outcomes, and unresolved source-authority blockers.
