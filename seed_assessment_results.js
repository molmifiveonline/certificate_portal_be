const pool = require("./config/db");
const { v4: uuidv4 } = require("uuid");

async function seed() {
  try {
    console.log("Starting seeding process...");

    // 1. Get some assessments and their course info
    const [assessments] = await pool.execute(`
      SELECT a.id as assessment_id, a.course_id, c.master_course_id, a.type_of_test
      FROM assessment a
      JOIN courses c ON a.course_id = c.id
      LIMIT 5
    `);

    if (assessments.length === 0) {
      console.log(
        "No assessments found. Please create some assessments first.",
      );
      process.exit(0);
    }

    // 2. Get some candidates
    const [candidates] = await pool.execute(`
      SELECT u.id as candidate_id
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'candidate'
      LIMIT 5
    `);

    if (candidates.length === 0) {
      console.log("No candidates found. Please create some candidates first.");
      process.exit(0);
    }

    for (const assessment of assessments) {
      for (const candidate of candidates) {
        const resultId = uuidv4();

        // Fetch questions for this assessment using FIND_IN_SET
        let [questions] = await pool.execute(
          "SELECT id, correct_option FROM question_bank WHERE master_course_id = ? AND FIND_IN_SET(?, type_of_test) > 0",
          [assessment.master_course_id, assessment.type_of_test],
        );

        // If no questions found, create some dummy ones for this master course
        if (questions.length === 0) {
          console.log(
            `Creating dummy questions for master course ${assessment.master_course_id}...`,
          );
          for (let i = 1; i <= 5; i++) {
            const qId = uuidv4();
            await pool.execute(
              `INSERT INTO question_bank (id, question, option_a, option_b, option_c, option_d, correct_option, master_course_id, type_of_test, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [
                qId,
                `Dummy Question ${i} for Master Course ${assessment.master_course_id}`,
                "Option A",
                "Option B",
                "Option C",
                "Option D",
                "option_a",
                assessment.master_course_id,
                assessment.type_of_test,
              ],
            );
          }
          // Fetch them again
          const [newQs] = await pool.execute(
            "SELECT id, correct_option FROM question_bank WHERE master_course_id = ? AND FIND_IN_SET(?, type_of_test) > 0",
            [assessment.master_course_id, assessment.type_of_test],
          );
          questions = newQs;
        }

        if (questions.length === 0) {
          console.log(
            `Still no questions for assessment ${assessment.assessment_id}. Skipping.`,
          );
          continue;
        }

        let correctCount = 0;
        const totalQuestions = questions.length;
        const answers = [];

        for (const q of questions) {
          const answerId = uuidv4();
          // Randomly decide if the answer is correct or not (80% chance of correct for better testing)
          const isCorrect = Math.random() < 0.8;
          let selectedOption = q.correct_option;

          if (!isCorrect) {
            // Pick a different option (assuming a, b, c, d exist)
            const options = [
              "option_a",
              "option_b",
              "option_c",
              "option_d",
            ].filter((o) => o !== q.correct_option);
            selectedOption =
              options[Math.floor(Math.random() * options.length)];
          } else {
            correctCount++;
          }

          answers.push([
            answerId,
            resultId,
            q.id,
            selectedOption,
            isCorrect ? 1 : 0,
          ]);
        }

        const score = (correctCount / totalQuestions) * 100;

        // Create assessment result
        await pool.execute(
          `INSERT INTO assessment_results (id, assessment_id, candidate_id, course_id, score, total_questions, correct_answers, status, attempt_number)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Completed', 1)`,
          [
            resultId,
            assessment.assessment_id,
            candidate.candidate_id,
            assessment.course_id,
            score,
            totalQuestions,
            correctCount,
          ],
        );

        // Create individual answers
        for (const ans of answers) {
          await pool.execute(
            `INSERT INTO assessment_answers (id, assessment_result_id, question_id, selected_option, is_correct)
             VALUES (?, ?, ?, ?, ?)`,
            ans,
          );
        }

        console.log(
          `Seeded submission for candidate ${candidate.candidate_id} on assessment ${assessment.assessment_id} (Score: ${score.toFixed(2)}%)`,
        );
      }
    }

    console.log("Seeding completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  }
}

seed();
