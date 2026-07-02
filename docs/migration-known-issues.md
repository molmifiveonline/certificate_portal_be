# Legacy Migration Known Issues

Use this ledger before every cutover. Each item must either pass the audit or have a documented reason why it is acceptable.

## Candidate Registration Type

- Issue: MOLMI candidates appeared under Other Candidates.
- Root cause: legacy registration values did not match frontend labels.
- Fix: normalize to `MOLMI Employee` or `Others` during migration.
- Verify: `npm run migrate:legacy:audit`, check `candidate registration type labels`.
- Repair: `npm run migrate:legacy:repair-all:apply`.

## Candidate Names

- Issue: legacy full name was stored entirely in `first_name`.
- Root cause: old DB has one candidate name field; new DB has first, middle, last.
- Fix: split legacy full names into first token, middle tokens, and last token.
- Verify: audit check `candidate names split into first/middle/last`.
- Repair: `npm run migrate:legacy:repair-candidate-names:apply`.

## Hotel Details

- Issue: Hotel Details page had no migrated data.
- Root cause: `hotel_details` is separate from `hotel_files`.
- Fix: import `hotel_details` and map legacy IDs.
- Verify: audit row-count check for `hotel_details`.
- Repair: rerun full migration or targeted import through `repair-all` when mapped rows exist.

## Locations

- Issue: Location module and course `location_id` values were missing.
- Root cause: legacy course stores location text; target expects mapped location IDs.
- Fix: import locations and resolve course location IDs.
- Verify: audit check `course locations mapped from legacy`.
- Repair: `npm run migrate:legacy:repair-locations:apply`.

## Course Dates and Search

- Issue: some target course dates differed from legacy, and some course searches missed expected courses.
- Root cause: legacy date/time parsing and course code/name differences needed normalization.
- Fix: preserve legacy start/end dates and keep both course code and display name searchable.
- Verify: audit checks `course start/end dates match legacy` and `known active courses searchable in target`.
- Repair: `npm run migrate:legacy:repair-course-dates:apply`.

## Attendance

- Issue: absent counts did not match legacy for trainer dashboard/course views.
- Root cause: legacy attendance stores present/holiday/absent date lists that must expand into target rows.
- Fix: import `course_attendance` rows per date and update enrollment metadata.
- Verify: audit check `attendance absent counts match legacy`.
- Repair: `npm run migrate:legacy:repair-attendance:apply`.

## Passwords

- Issue: migrated trainers/candidates could not log in with legacy credentials.
- Root cause: target requires bcrypt hashes; legacy stored usable plaintext or legacy hashes.
- Fix: hash legacy passwords during import and repair existing migrated users.
- Verify: audit check `legacy passwords hashed and sample-match`.
- Repair: `npm run migrate:legacy:repair-passwords:apply`.

## Trainer Menus

- Issue: trainer could see assessments but not My Courses, Feedback, or Certificates.
- Root cause: trainer role had no permission slugs used by the frontend menu.
- Fix: seed trainer permissions including `view_courses`, `view_feedback`, and `view_certificates`.
- Verify: audit check `trainer role has portal menu permissions`.
- Repair: `npm run migrate:legacy:repair-trainer-permissions:apply`.

## Files and Uploads

- Issue: profile images, signatures, question images, and hotel files require the old upload folder.
- Root cause: DB migration can store target paths, but source file copy requires `OLD_UPLOAD_ROOT`.
- Fix: set `OLD_UPLOAD_ROOT` and run `npm run migrate:legacy:copy-files`.
- Verify: audit check `legacy upload files are available`.
- Repair: rerun `npm run migrate:legacy:copy-files` after extracting the old upload folder.

## Feedback

- Issue: a suspected `YES`/`NO` answer mismatch was actually correct for the checked legacy row.
- Root cause: legacy text fields sometimes contain literal `YES`/`NO`.
- Fix: preserve legacy answer values exactly, and preserve legacy question/option status to avoid inactive duplicate questions becoming active.
- Verify: audit check `feedback question active/inactive status preserved`.
- Repair: rerun full migration or add a targeted feedback repair if this check fails after a future import.

## Certificate Continuity

- Issue: new certificate numbers must continue after imported legacy certificate numbers.
- Root cause: `MAX(subid)+1` is unsafe and must be replaced by sequence initialization/generation.
- Fix: initialize `certificate_sequences` from imported certificates and use atomic sequence generation.
- Verify: audit check `certificate sequence table matches imported certificates`.
- Repair: `npm run migrate:legacy:repair-all:apply` rebuilds certificate sequences at the end.

## Must Pass Before Cutover

- `npm run migrate:legacy:audit` reports zero critical blockers.
- `npm run migrate:legacy:repair-all:dry-run` has been reviewed if any blocker appeared.
- `OLD_UPLOAD_ROOT` file audit is either passing or explicitly deferred.
- The required spot checks in `docs/legacy-migration-runbook.md` pass.
