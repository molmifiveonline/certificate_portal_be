# Legacy PHP Migration Runbook

## Required Setup

1. Restore the old PHP dump into a staging database, for example `molmi_legacy_stage`.
2. Set these environment variables before running the migration:

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

# Optional for phase 1. Leave unset if files will be copied later.
OLD_UPLOAD_ROOT=C:\path\to\old_php_uploads
MIGRATION_FILE_MODE=copy
```

If `TARGET_DB_*` is omitted, the script falls back to the existing `DB_*` values.
If `OLD_UPLOAD_ROOT` is omitted, database rows still import and file columns are set to their future target paths, but no source-file lookup or copy is attempted.
When running the migration from a developer machine, `LEGACY_DB_HOST=localhost` only works if the legacy staging database is on that same machine. If the database is on the server, use the server DB host/IP instead.

## Commands

```bash
npm run migrate:legacy:dry-run
npm run migrate:legacy:apply
npm run migrate:legacy:resume
npm run migrate:legacy:copy-files
npm run migrate:legacy:reset
```

Dry-run writes no database rows and copies no files. It still produces a JSON report in `generated/`.
Resume continues from the assessment phase after a partial apply where candidates, trainers, courses, enrollments, hotel rows, certificates, and question bank are already imported.
Copy-files reads `OLD_UPLOAD_ROOT`, copies matched legacy upload files into the new `uploads/` folders, and writes a JSON report.

## Cutover

1. Back up `molmi_certificate_new_portal`.
2. Freeze writes on the old PHP app.
3. Restore the latest PHP SQL dump into the staging DB.
4. Run `npm run migrate:legacy:dry-run`.
5. Fix any duplicate certificate or missing source-folder issue reported.
6. Run `npm run migrate:legacy:apply`.
7. Verify counts, sample certificates, trainer signatures, candidate profile photos, question images, and hotel/venue documents.
8. Generate a test ESDC June 2026 certificate; after `ESDC/2606/0020`, the next number must be `ESDC/2606/0021`.

## Current Checkpoint

On 2026-06-23, the first apply was stopped after these target rows were imported:

- Candidates, trainers, master courses, courses, enrollments, hotel file rows, certificates, and question bank are imported.
- Assessment import is partial.
- Assessment results, assessment answers, feedback, and certificate sequence initialization are still pending.

Use this command to continue without repeating the earlier phases:

```bash
npm run migrate:legacy:resume
```

After extracting `OLD_UPLOAD_ROOT.zip`, copy the legacy uploads with:

```bash
npm run migrate:legacy:copy-files
```

## Post-Migration Corrections

- Candidate registration values must use the app-facing labels `MOLMI Employee` and `Others`; the frontend filters use those exact values.
- Legacy `hotel_details` must be imported separately from `hotel_files`; Hotel Details pages read from `hotel_details`.
- Legacy trainers with duplicate emails should receive deterministic placeholder emails so every `trainer_profiles.user_id` has a matching `users.id`.
