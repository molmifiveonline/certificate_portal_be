# AI Question Generator Requirement

## Objective

Add a new AI-enabled question generation feature to the existing Certificate Portal without changing or disrupting any existing Question Bank, Assessment, submission, or candidate flows.

The feature will live as a separate Assessment route and will allow an admin or superadmin to generate multiple-choice questions, review and edit them, then save selected questions into the existing Question Bank using the current question creation API.

## Placement

Frontend route:

```text
/assessment/ai-question-generator
```

Menu placement:

```text
Assessment
  Question Bank
  AI Question Generator
  Assessments
  Submitted Assessments
```

The new route must be added below Question Bank in the Assessment menu.

## Non-Negotiable Constraints

- Do not modify the behavior of existing assessment routes.
- Do not modify the behavior of existing question bank list, add, edit, delete, bulk upload, or sample template features.
- Do not save AI-generated questions automatically.
- Do not call ChatGPT/OpenAI directly from React.
- Keep any AI credential or API URL usage on the backend only.
- Use the existing Question Bank data shape when saving approved questions.
- Add the feature through new route/page/service files where possible.

## Current System Context

Frontend:

- React dashboard.
- Assessment routes are registered in `src/App.js`.
- Sidebar/menu entries are configured in `src/lib/utils/menu.js`.
- Existing Question Bank pages are under `src/pages/assessment`.
- Existing Question Bank client API wrapper is `src/services/questionBankService.js`.

Backend:

- Express API.
- Question Bank routes are mounted at `/api/question-bank`.
- Assessment routes are mounted at `/api/assessment`.
- Existing Question Bank creation endpoint is:

```text
POST /api/question-bank/create
```

Existing Question Bank fields:

```text
master_course_id
type_of_test
question
option_a
option_b
option_c
option_d
correct_option
image
opt_img_a
opt_img_b
opt_img_c
opt_img_d
```

## User Flow

1. Admin opens Assessment > AI Question Generator.
2. Admin selects a Master Course.
3. Admin selects one or more Type of Test values:
   - Pre Course
   - Post Course
   - Daily
4. Admin enters a topic or focus area.
5. Admin selects difficulty.
6. Admin enters number of questions.
7. Admin clicks Generate Questions.
8. Frontend calls the backend AI generation endpoint.
9. Backend calls the configured AI provider.
10. Backend returns structured generated questions.
11. Frontend shows generated questions in a review workspace.
12. Admin can edit, delete, select, or deselect generated questions.
13. Admin clicks Add Selected Questions.
14. Frontend saves each selected question using the existing Question Bank create API.
15. Saved questions appear in the normal Question Bank and remain usable by existing Assessment flows.

## MVP Inputs

The generator form should collect:

```json
{
  "master_course_id": "uuid",
  "master_course_name": "Course name",
  "type_of_test": ["1", "2"],
  "topic": "Topic or module name",
  "difficulty": "medium",
  "number_of_questions": 5
}
```

Difficulty options:

```text
easy
medium
hard
mixed
```

Number of questions:

- Minimum: 1
- Maximum: 20 for MVP
- Default: 5

## Backend API

Add a new isolated route:

```text
POST /api/ai/generate-questions
```

Environment variables:

```text
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_QUESTION_GENERATION_MODEL
OPENAI_QUESTION_GENERATION_MAX_TOKENS
OPENAI_DEFAULT_MODEL
```

`OPENAI_QUESTION_GENERATION_MODEL` is the dedicated model selector for this feature. If it is missing, the backend may fall back to `OPENAI_DEFAULT_MODEL`.
`OPENAI_QUESTION_GENERATION_MAX_TOKENS` controls the maximum AI output size for generated questions. The MVP default should be high enough for up to 20 structured questions.

Request body:

```json
{
  "master_course_id": "uuid",
  "master_course_name": "Food Safety",
  "type_of_test": ["1", "2"],
  "topic": "Personal hygiene",
  "difficulty": "medium",
  "number_of_questions": 5
}
```

Success response:

```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "question": "Which practice best supports personal hygiene before handling food?",
        "option_a": "Washing hands with soap and water",
        "option_b": "Wearing jewelry while preparing food",
        "option_c": "Using the same gloves all day",
        "option_d": "Rinsing hands without soap",
        "correct_option": "opt_a"
      }
    ]
  }
}
```

Temporary response until API details are provided:

- The endpoint may return a clear configuration error or local placeholder response.
- The frontend should handle this gracefully.

## AI Prompt Requirements

When the ChatGPT API is connected, the backend prompt should require:

- JSON-only response.
- Exactly the requested number of questions.
- Every question must have exactly 4 options.
- Options must map to `option_a`, `option_b`, `option_c`, `option_d`.
- Correct option must be one of `opt_a`, `opt_b`, `opt_c`, `opt_d`.
- Questions must match selected course, topic, test type, and difficulty.
- Avoid duplicate or near-duplicate questions.
- Avoid ambiguous wording.
- Avoid trick questions unless explicitly requested later.
- Do not include explanations in MVP output.

## Review Workspace

The generated question review area should support:

- Select or deselect each generated question.
- Edit question text.
- Edit all 4 option texts.
- Change the correct option.
- Remove a generated question from the review list.
- Save selected questions.
- Clear all generated questions.

The review workspace should not include image upload in MVP. AI-generated questions will be text-only initially.

## Save Behavior

Saving selected questions should reuse:

```text
POST /api/question-bank/create
```

Each saved question should send:

```text
master_course_id
type_of_test
question
option_a
option_b
option_c
option_d
correct_option
```

Images should be omitted for AI-generated MVP questions.

## Validation

Frontend validation:

- Master Course is required.
- At least one Type of Test is required.
- Topic is required.
- Difficulty is required.
- Number of questions must be between 1 and 20.
- Generated question text is required before save.
- All 4 options are required before save.
- Correct option is required before save.
- At least one generated question must be selected before save.

Backend validation:

- Validate required request fields.
- Validate number of questions range.
- Validate difficulty enum.
- Validate `type_of_test` values.
- Return safe error messages.

## Permissions

For MVP, use the existing question permissions:

- Menu visibility: `view_questions`
- Generate endpoint: authenticated user with `view_questions`
- Save behavior: existing `create_question` permission through the existing Question Bank create endpoint

This keeps access aligned with the existing Assessment section.

## UI Direction

Visual thesis:

The page should feel like a quiet admin workbench: structured, focused, and practical, using the portal's existing white, slate, and blue UI language.

Content plan:

- Header: identify the AI Question Generator and provide back navigation context.
- Generator controls: course, test type, topic, difficulty, count, generate action.
- Review workspace: generated questions with edit controls and selection.
- Save action area: selected count, clear action, save selected questions.

Interaction thesis:

- Disable actions during generation and save.
- Show clear empty, loading, error, and generated states.
- Keep edits inline so review feels fast and controlled.

## Future Enhancements

Phase 2:

- Regenerate one question.
- AI quality check.
- Duplicate detection against existing Question Bank.
- Support multiple correct answers.
- Difficulty adjustment per question.

Phase 3:

- Generate questions from course material.
- Generate questions based only on uploaded/reference content.
- Add language selection.
- Add explanations/rationales.
- Add batch save transaction on backend.

## Implementation Checklist

- Add this requirement document.
- Add backend AI route file.
- Add backend AI controller.
- Mount `/api/ai` in `index.js`.
- Add frontend AI service.
- Add frontend AI Question Generator page.
- Add lazy route in `src/App.js`.
- Add menu item below Question Bank.
- Verify frontend build.
- Verify backend starts or route can be loaded.
