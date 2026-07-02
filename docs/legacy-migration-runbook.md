# Legacy PHP Migration Runbook

## Required Setup

1. Restore the old PHP dump into the legacy staging database.
2. Confirm these environment variables are set:

```bash
LEGACY_DB_HOST=localhost
LEGACY_DB_USER=root
LEGACY_DB_PASSWORD=
LEGACY_DB_NAME=molmi_legacy_stage
LEGACY_DB_PORT=3306

TARGET_DB_HOST=139.162.48.128
TARGET_DB_USER=molmi_certificate_new_portal
TARGET_DB_PASSWORD=...
TARGET_DB_NAME=molmi_certificate_new_portal
TARGET_DB_PORT=3306

# Optional. Leave unset until the old upload folder is available.
OLD_UPLOAD_ROOT=C:\path\to\old_php_uploads
MIGRATION_FILE_MODE=copy
```

If `TARGET_DB_*` is omitted, the migration falls back to `DB_*`. If `OLD_UPLOAD_ROOT` is omitted, database rows still import, but file existence/copy checks are skipped.

## Commands

```bash
npm run migrate:legacy:dry-run
npm run migrate:legacy:apply
npm run migrate:legacy:audit
npm run migrate:legacy:repair-all:dry-run
npm run migrate:legacy:repair-all:apply
npm run migrate:legacy:copy-files
npm run migrate:legacy:reset
```

Targeted repair commands are also available:

```bash
npm run migrate:legacy:repair-candidate-names:dry-run
npm run migrate:legacy:repair-candidate-names:apply
npm run migrate:legacy:repair-locations:dry-run
npm run migrate:legacy:repair-locations:apply
npm run migrate:legacy:repair-course-dates:dry-run
npm run migrate:legacy:repair-course-dates:apply
npm run migrate:legacy:repair-attendance:dry-run
npm run migrate:legacy:repair-attendance:apply
npm run migrate:legacy:repair-passwords:dry-run
npm run migrate:legacy:repair-passwords:apply
npm run migrate:legacy:repair-trainer-permissions:dry-run
npm run migrate:legacy:repair-trainer-permissions:apply
```

`repair-all:dry-run` uses a sampled password comparison so it completes quickly. Use `migrate:legacy:repair-passwords:dry-run` when a full password-by-password dry-run is required.

## Next-Phase Sequence

1. Back up `molmi_certificate_new_portal`.
2. Freeze writes on the old PHP app.
3. Restore the latest PHP SQL dump into the legacy staging DB.
4. Run `npm run migrate:legacy:dry-run`.
5. Review the generated dry-run report and fix any source-data blockers.
6. Run `npm run migrate:legacy:apply`.
7. Run `npm run migrate:legacy:audit`.
8. If the audit reports critical blockers, run `npm run migrate:legacy:repair-all:dry-run`, review the report, then run `npm run migrate:legacy:repair-all:apply`.
9. Run `npm run migrate:legacy:audit` again and continue only when there are zero critical blockers.
10. If `OLD_UPLOAD_ROOT` is available, run `npm run migrate:legacy:copy-files`.
11. Verify sample users, courses, feedback, attendance, certificates, trainer signatures, candidate photos, question images, and hotel/venue documents.
12. Generate a test ESDC June 2026 certificate; after `ESDC/2606/0020`, the next number must be `ESDC/2606/0021`.

## Required Spot Checks

- MOLMI candidate list contains MOLMI candidates, and Other Candidates does not contain all migrated candidates.
- Candidate names include middle names where the legacy name has three or more tokens.
- `BBS-2026-036`, `HAZM-2026-11`, and `LNGRS-2026-005` exist and match legacy dates.
- Hotel Details and Location modules show migrated data.
- Known attendance absent counts match the legacy app.
- Candidate and trainer legacy passwords work after migration.
- Trainer login shows My Courses, Feedback, and Certificates.
- Feedback answers match legacy values; `YES`/`NO` text answers are acceptable when legacy stored `YES`/`NO`.
- Certificate sequence rows match imported certificates.

See `docs/migration-known-issues.md` for the issue ledger and verification checklist.
