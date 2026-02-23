const pool = require("../config/db");

class ReportDao {
  static async getFeedbackQuestionIds(startDate, endDate) {
    if (endDate.length === 10) endDate += " 23:59:59";

    const query = `
            SELECT DISTINCT feedback_question_id 
            FROM feedback_question_answer 
            WHERE created_at >= ? AND created_at <= ?
        `;
    const [rows] = await pool.execute(query, [startDate, endDate]);
    return rows.map((r) => r.feedback_question_id);
  }

  static async getAllFeedbackQuestionsCombined(status = 1) {
    let query = `SELECT * FROM feedback_question`;
    const params = [];
    if (status) {
      query += ` WHERE status = ?`;
      params.push(status);
    }

    const [rows] = await pool.execute(query, params);

    const ratings = [];
    const nonRatings = [];

    rows.forEach((row) => {
      if (
        row.question_format &&
        row.question_format.toLowerCase() === "ratings"
      ) {
        ratings.push(row);
      } else {
        nonRatings.push(row);
      }
    });

    return { ratings, nonRatings };
  }

  static async getQuestionsWithCategories(questionIds) {
    if (!questionIds || questionIds.length === 0) return [];

    // Dynamic placeholders for IN clause
    const placeholders = questionIds.map(() => "?").join(",");
    const query = `
            SELECT fq.id, fq.question, fq.feedback_category_id, fq.question_format, fc.name as category_name 
            FROM feedback_question fq 
            LEFT JOIN feedback_category fc ON fq.feedback_category_id = fc.id 
            WHERE fq.id IN (${placeholders})
        `;

    const [rows] = await pool.execute(query, questionIds);
    return rows;
  }

  static async getCandidateCoursePairs(startDate, endDate) {
    if (endDate.length === 10) endDate += " 23:59:59";

    const query = `
            SELECT candidate_id, active_course_id, MAX(created_at) as created_at 
            FROM feedback_question_answer 
            WHERE created_at >= ? AND created_at <= ? 
            GROUP BY candidate_id, active_course_id 
            ORDER BY created_at DESC
        `;

    const [rows] = await pool.execute(query, [startDate, endDate]);
    return rows;
  }

  static async getAllFeedbackAnswersChunk(candidateIds, courseIds) {
    if (candidateIds.length === 0 || courseIds.length === 0) return [];

    const candPlaceholders = candidateIds.map(() => "?").join(",");
    const coursePlaceholders = courseIds.map(() => "?").join(",");

    const query = `
            SELECT candidate_id, active_course_id, feedback_question_id, answer, feedback_question_option_text 
            FROM feedback_question_answer 
            WHERE candidate_id IN (${candPlaceholders}) 
            AND active_course_id IN (${coursePlaceholders})
        `;

    const params = [...candidateIds, ...courseIds];
    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Helper to fetch Candidate info (Users + Profiles)
  static async getCandidatesByIds(candidateIds) {
    if (candidateIds.length === 0) return [];
    const placeholders = candidateIds.map(() => "?").join(",");

    const query = `
            SELECT 
                u.id, u.first_name, u.last_name, u.email, 
                cp.passport_no, cp.employee_id, cp.manager, cp.rank
            FROM users u
            JOIN candidate_profiles cp ON u.id = cp.user_id
            WHERE u.id IN (${placeholders})
        `;

    const [rows] = await pool.execute(query, candidateIds);
    return rows;
  }

  // Helper to fetch Course info
  static async getCoursesByIds(courseIds) {
    if (courseIds.length === 0) return [];
    const placeholders = courseIds.map(() => "?").join(",");
    const query = `SELECT * FROM courses WHERE id IN (${placeholders})`;
    const [rows] = await pool.execute(query, courseIds);
    return rows;
  }

  // Helper to fetch Trainer info (Users + Profiles)
  static async getTrainersByIds(trainerIds) {
    if (trainerIds.length === 0) return [];
    const placeholders = trainerIds.map(() => "?").join(",");

    const query = `
            SELECT 
                u.id, u.first_name, u.last_name, 
                tp.prefix, tp.designation
            FROM users u
            JOIN trainer_profiles tp ON u.id = tp.user_id
            WHERE u.id IN (${placeholders})
        `;

    const [rows] = await pool.execute(query, trainerIds);
    return rows;
  }

  // Helper to fetch Master Course info
  static async getMasterCoursesByIds(names) {
    if (names.length === 0) return [];
    const placeholders = names.map(() => "?").join(",");
    // Note: PHP used 'master_course_name' as ID in some places, check schema if needed.
    // Assuming courses.master_course_name stores the ID or Name.
    // Based on ActiveCourseDao: master_course_name seems to be just a name string or ID.
    // ActiveCourseDao: req.body.topic = topicName; // Store Name in DB, not UUID
    // But let's check MasterCourseDao if possible.
    // For now, assuming we select by ID if names are IDs, or generic SELECT * FROM master_courses
    const query = `SELECT * FROM master_courses WHERE id IN (${placeholders})`;
    const [rows] = await pool.execute(query, names);
    return rows;
  }

  static async getParticipantCounts(courseIds) {
    if (courseIds.length === 0) return [];
    const placeholders = courseIds.map(() => "?").join(",");
    const query = `
            SELECT course_id, COUNT(DISTINCT candidate_id) as total_participants 
            FROM courses_enrollment 
            WHERE course_id IN (${placeholders}) 
            GROUP BY course_id
        `;
    const [rows] = await pool.execute(query, courseIds);
    return rows;
  }

  // Retrieve full data for Certificate Report
  // This replicates the complex join from PHP logic but adapted for new schema (Users/Profiles)
  static async getCertificateReport(startDate, endDate) {
    if (endDate.length === 10) endDate += " 23:59:59";

    const query = `
            SELECT 
                c.id as certificate_id,
                c.candidate_id,
                c.active_course_id,
                c.course_id as master_course_id,
                c.trainer_id,
                c.certificate_no,
                c.issued_date,
                c.from_date,
                c.to_date,
                c.days,
                c.status,
                c.show_logo,
                c.topic,
                c.location,
                c.description1,
                c.remarks,
                
                u_cand.first_name as cand_first_name,
                u_cand.last_name as cand_last_name,
                curr_cp.passport_no,
                curr_cp.employee_id as empId,
                curr_cp.rank,
                curr_cp.manager,
                
                course.course_name,
                course.type_of_course,
                course.course_id as active_course_code,
                course.secondary_trainer_ids,
                
                mc.master_course_name,
                
                u_trainer.first_name as trainer_first_name,
                u_trainer.last_name as trainer_last_name,
                tp.prefix as trainer_prefix
                
            FROM certificates c
            -- Join Candidate (User + Profile)
            LEFT JOIN users u_cand ON c.candidate_id = u_cand.id
            LEFT JOIN candidate_profiles curr_cp ON u_cand.id = curr_cp.user_id
            
            -- Join Active Course
            LEFT JOIN courses course ON c.active_course_id = course.id
            
            -- Join Master Course
            LEFT JOIN master_courses mc ON c.course_id = mc.id
            
            -- Join Trainer (User + Profile)
            LEFT JOIN users u_trainer ON c.trainer_id = u_trainer.id
            LEFT JOIN trainer_profiles tp ON u_trainer.id = tp.user_id
            
            WHERE c.created_at >= ? AND c.created_at <= ?
            ORDER BY c.created_at DESC
        `;

    const [rows] = await pool.execute(query, [startDate, endDate]);
    return rows;
  }
}

module.exports = ReportDao;
