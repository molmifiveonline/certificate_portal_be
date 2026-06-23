# TRG-219 Report Export Plan

## Summary
- Add a new backend Excel export for `TRG-219` as a single-sheet, 3-month training activity report based on the newer shared workbook layout.
- Expose it as a new reports endpoint that accepts `start_month` and `year`, then generates a rolling 3-month window such as `Jul-Sep 2025`.
- Omit both skipped items from the output:
  - `Target Trainees` column
  - `Holiday` row
- Create a new planning doc at `docs/TRG-219-implementation-plan.md` using this finalized scope, since no existing TRG-219 or TRG-218 plan file is currently present in `docs/`.

## Implementation Changes
- DAO layer:
  - Add a `ReportDao.getTrainingActivitiesReport(startDate, endDate)` query for courses overlapping the requested 3-month window.
  - Pull from `courses` with `status NOT IN ('Deleted', 'Cancelled')`.
  - Include both in-house and outhouse course records; use `is_outhouse` to distinguish them.
  - Return fields needed for layout: `course_id`, `topic`, `master_course_name`, `course_name`, `type_of_location`, `course_type`, `no_of_days`, `start_date`, `end_date`, `is_outhouse`.
- Controller layer:
  - Add `exportTrainingActivitiesReport` in `controllers/admin/ReportController.js`.
  - Validate `start_month` as `1-12` and `year` as a valid integer.
  - Build a 3-month window from the first day of the selected month through the last day of month 3.
  - Expand the visible grid to full Sunday-Saturday week boundaries covering the 3 months.
  - Normalize rows by master course:
    - `course code`: prefer `topic`
    - `course name`: prefer `master_course_name`, fallback `course_name`
    - `mode`: normalize from `type_of_location`
    - `duration days`: prefer `no_of_days`, fallback date difference + 1
  - Bucket each course instance into every week it overlaps; if multiple instances of the same course land in one week, join labels in the same cell with line breaks.
- Grouping/config:
  - Add a backend section-mapping constant for TRG-219 so rows render under fixed sample-style groups instead of raw DB topics.
  - Initial grouping behavior:
    - in-house simulator/standard sections mapped by configured course-code list
    - outhouse records grouped under `MOLMI OUTHOUSE COURSES`
    - unmapped codes fall into a final catch-all section such as `OTHER COURSES`
  - Keep this mapping in code as a small dedicated constant/helper so review changes are easy.
- Workbook builder:
  - Add a dedicated TRG-219 workbook builder alongside the existing TRG-218 helpers.
  - Generate one sheet only, using the newer layout style:
    - top-right doc metadata `TRG/219`, revision, issue date, page
    - `As on` row
    - fixed left columns: `Sr. No.`, `Course Code`, `Course Name`, `Mode`, `Duration Days`
    - month header row across weekly columns
    - week-range row across weekly columns
    - no `Holiday` row
    - section header rows from configured mapping
  - Cell values inside week columns should display the course date span within that week, using compact labels like `07-11`.
- Routes/API:
  - Add `POST /api/reports/training-activities/export` in `routes/admin/reportRoutes.js`.
  - Keep `checkPermission("export_reports")`.
  - Response filename format: `TRG-219_Training_Activities_<Mon>_to_<Mon>_<Year>.xlsx`.

## Public Interface Changes
- New API request body:
  - `{ "start_month": 7, "year": 2025 }`
- New API response:
  - Excel file download, single-sheet workbook, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

## Test Plan
- Validation:
  - reject missing `start_month`
  - reject invalid month values outside `1-12`
  - reject invalid year
- Data coverage:
  - include courses fully inside the window
  - include courses that start before the window and end inside it
  - include courses that start inside the window and end after it
  - exclude deleted/cancelled courses
  - include outhouse courses in their dedicated section
- Layout:
  - verify sheet has one tab only
  - verify `Target Trainees` is not present
  - verify `Holiday` row is not present
  - verify week columns span full boundary weeks for the 3-month period
  - verify multiple occurrences of the same course populate multiple week cells correctly
  - verify unmapped course codes still appear in fallback section
- Output:
  - verify download headers and filename
  - manually compare a generated workbook against the shared sample's newer main-sheet structure

## Assumptions
- The target layout is the newer shared TRG-219 main-sheet style, not the older multi-sheet format.
- Scope is backend export only; no frontend work is included in this plan unless a separate frontend repo also needs wiring.
- `topic` is the usable short course code for TRG-219 display.
- Section headers are not reliably derivable from existing schema alone, so a small explicit mapping is the chosen default.
- Since you asked to skip `Target Trainee for Client` and `Holidays`, the export will not include any annex sheet in v1.
