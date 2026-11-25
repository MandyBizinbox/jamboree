# 26th World Scout Jamboree · SA Contingent Registration

**Self-hosted release candidate `1.0.0-rc1`, prepared 25 November 2026.** Independent implementation built from approved form specification v15, the source Poland workbook and the 18-group beta feedback. Intended for **staging on the Forge VPS** before collecting any real children's or medical data.

## Application

- Public `/` and `/register` routes without participant login.
- Role choices: Adult Patrol Leaders, Contingent Management Team, Head of Contingent, International Service Team, Youth Participants.
- Participant/guardian/authorised representative routing; age-specific guardian authority and permission.
- 11 participant-facing steps, derived from the 14 approved conceptual sections; carer and travel allocation remain hidden, and personal identity is one combined Traveller Details page.
- All original 197 Poland template fields retained by Excel column name, label and source dropdown ID where available.
- Conditional questionnaires, including native language and four-skill matrix, seven-row comfort matrix, previous Jamboree, visa, guardian Other/addresses, emergency-contact reuse, diet, 17 allergens and selected severity, medication, vaccination, mobility and accessibility.
- No participant account: recover draft using 256-bit token shown once (only SHA-256 digest stored), expires in 30 days; submitted records cannot be resumed without an admin-issued correction credential.
- SQLite storage, AES-256-GCM field-data encryption at rest, no records in browser local storage, no cache of API responses, CSRF origin checks, API request throttling.
- Private CMT login with distinct user accounts (`owner`, `reviewer`, `medical`, `exporter`), records, approval/correction status, patrol/team editor, administrative arrival/departure details and label editor.
- Preview XLSX created by writing into the original Poland workbook. All 105 worksheets and hidden mapping sheets retained. SA time entries are converted to Europe/Warsaw using date-aware DST. Production export is disabled unless explicitly verified.

## Environment and launch

Requires **Node.js 22+ and Python 3.10+**. There are **no runtime npm dependencies**. For a developer workstation or temporary local staging environment:

```bash
cp .env.example .env
# Set APP_ENCRYPTION_KEY, SESSION_SECRET, CMT_ADMIN_EMAIL and CMT_ADMIN_PASSWORD.
# For local testing, set NODE_ENV=development and PORT=3017.
node --env-file=.env server.mjs
```

- Participant: `http://127.0.0.1:3017/register`
- CMT: `http://127.0.0.1:3017/cmt`
- Field label editor: `http://127.0.0.1:3017/cmt/form-builder`

Run **`npm test`** before each release. The included tests use synthetic records. See [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md) for Nginx, HTTPS, systemd and server-specific instructions.

## Mandatory acceptance before PUBLIC launch

1. CMT confirms **the real staging subdomain**, the legal GDPR/POPIA privacy notice and the cross-border handling of children's passport/health information.
2. CMT confirms the **minor age reference date** and final patrol/team options. Entries can be held for admin assignment until configured.
3. The **Poland importer** must confirm human-readable labels vs UUIDs, dates, medical/accessibility fields and allowed empty columns; the supplied test preview must be imported successfully in their target system. **Never enable `EXPORT_VERIFIED=yes` based solely on this app's unit tests.**
4. Independently complete **browser testing** on the real staging URL for an adult and child; visual QA could not be run from the creation environment due to a local-browser access restriction. Check mobile screens, required/optional fields, conditional visibility, saved draft re-entry, CMT permissions and workbook contents.
5. Secure HTTPS, private writable data directory, backups of **both SQLite and encryption keys**, DNS and Nginx configuration; verify health data access restrictions and approve a retention/deletion policy.

## Technical notes

- `rules.mjs`: server authority for normalized 197-field data and conditional validations.
- `public/app.js`: participant form and administrative interface; source keys are preserved.
- `server.mjs`: API, encrypted persistence, login, admin roles and guarded export.
- `export_template.py`: dependency-free workbook patcher, never changes hidden source tabs.
- `timezone.mjs`: South African local-time to Polish local-time conversion.
- `config/approved-v15.json`: source-of-truth approved JSON, unchanged.
- `config/patrols.json`: initial empty role options; configurable in private CMT dashboard.
- `templates/Template 26th WSJ Data.xlsx`: original source workbook, unchanged.
- `tests/`: synthetic API, normalization, security, workbook and timezone checks.

## Git safety

Do not overwrite `MandyBizinbox/jamboree` branch `main` with this release until staging is accepted. Import this folder into a `selfhosted-rebuild` branch, commit, test and deploy the audited release. Existing Manus database records are not automatically migrated: any migration must be planned, permission-checked and backed up separately.

**Current delivery:** Working local API-tested staging build; no claim of a live deployment, browser certification, privacy-policy approval or Poland importer acceptance.
