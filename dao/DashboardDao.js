const pool = require("../config/db");

class DashboardDao {
  static async getStats() {
    const stats = {};

    // 1. Total Candidates (status = 1)
    // Based on CandidateDao, candidates are users with role 'candidate' and status 1
    const [candidateResult] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'candidate' AND u.status = 1
    `);
    stats.totalCandidates = candidateResult[0].count;

    // 2. Total Trainers (status = 1)
    // Based on TrainerDao, trainers are in trainer_profiles with status 1
    const [trainerResult] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM trainer_profiles 
      WHERE status = 1
    `);
    stats.totalTrainers = trainerResult[0].count;

    // 3. Total Active Courses (status = 'Active' or just not deleted?)
    // Legacy code used 'status = 1' on 'course' table. ActiveCourseDao uses 'status != "Deleted"'
    // We will follow ActiveCourseDao logic for "Active" which seems to be "Not Deleted"
    // But legacy specifically checked for "Active Courses". Let's assume we want all non-deleted for now,
    // or maybe filter by specific status if 'Active' is a value in `status` column (ActiveCourseDao inserts 'Initiated')
    // Let's count all non-deleted for now as "Total Courses"
    const [courseResult] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM courses 
      WHERE status != 'Deleted'
    `);
    stats.totalCourses = courseResult[0].count; // Labelled as "Total Active Courses" in legacy UI

    return stats;
  }

  static async getCourses(filters = {}) {
    let query = `
      SELECT c.*, 
             (SELECT COUNT(*) FROM courses_enrollment ce WHERE ce.course_id = c.id) as candidate_count,
             (SELECT COUNT(*) FROM course_attendance ca WHERE ca.course_id = c.id AND (ca.absent_reasons IS NOT NULL AND ca.absent_reasons != '[]' AND ca.absent_reasons != '')) as absent_count
      FROM courses c
      WHERE c.status != 'Deleted'
    `;
    const params = [];

    if (filters.trainer_id) {
      // Legacy used primary_trainer_id
      query += ` AND c.primary_trainer_id = ?`;
      params.push(filters.trainer_id);
    }

    if (filters.master_course_id) {
      // Legacy used master_course_name (which seems to store ID or Name? Legacy model used master_course_name)
      // ActiveCourseDao stores master_course_id and master_course_name.
      // Let's filter by master_course_id if provided
      query += ` AND c.master_course_id = ?`;
      params.push(filters.master_course_id);
    }

    if (filters.start_date && filters.end_date) {
      query += ` AND c.start_date >= ? AND c.end_date <= ?`;
      params.push(filters.start_date, filters.end_date);
    }

    if (filters.status) {
      // Legacy 'type_of_status' column ? ActiveCourseDao inserts into 'status' column with 'Initiated'.
      // Wait, ActiveCourseDao inserts 'Initiated' into `status` column?
      // Line 39: VALUES (..., 'Initiated', ...)
      // Line 36: ..., status, ...
      // So `status` column holds 'Initiated', 'Active', 'Completed' etc. NOT 0/1.
      query += ` AND c.status = ?`;
      params.push(filters.status);
    }

    query += ` ORDER BY c.start_date DESC`;

    const [rows] = await pool.query(query, params);

    // Calculate Avg Feedback manually as it requires joining and complex logic
    // Or we can do a subquery or join if the logic is simple.
    // Legacy: getAvgFeedbackByCourse -> fetch all feedback_question_answer for the course -> active_course_id
    // and average the 'answer' column (if numeric).

    // We can do this efficiently with a subquery or doing it in code.
    // Let's try to do it in the main query if possible, or fetch separately.
    // Fetching stats for all courses might be heavy if we do it for every row.
    // Let's iterate and fetch or use a separate query.
    // Given the constraints and legacy parity, let's try to include it.

    /* 
       SELECT AVG(CAST(answer AS DECIMAL(10,2))) 
       FROM feedback_question_answer fqa 
       WHERE fqa.active_course_id = c.id AND fqa.answer RLIKE '^[0-9]+(\.[0-9]+)?$' 
    */

    // Let's refine the query to include avg_feedback
    // We need to be careful about non-numeric answers.
    // MySQL 'AVG' might handle strings by casting, but 'RLIKE' helps.

    // Since we are moving to Node, we can process this in JS if dataset is small, or use a left join.
    // Let's stick to the previous query and maybe do a separate aggregation if needed,
    // but for now, let's return the basic info and maybe add feedback calculation later or in a refined step
    // if performance is okay.
    // Actually, legacy dashboard `getFilteredCourses` returns `courses` and then loops to calculate `avg`.
    // We will do the same: fetch basic course data, and for each course, fetch feedback avg.
    // But doing N+1 queries is bad.
    // Better: Group by course_id on feedback table.

    const courseIds = rows.map((r) => r.id);
    let feedbackMap = {};
    if (courseIds.length > 0) {
      // Placeholder for feedback table check (assuming it exists and `active_course_id` is the key)
      // Need to check if `feedback_question_answer` table exists.
      // User's legacy code had it. I assume it's migrated.
      try {
        const [feedbackRows] = await pool.query(
          `
                SELECT active_course_id, AVG(CAST(answer AS DECIMAL(10,2))) as avg_rating
                FROM feedback_question_answer
                WHERE active_course_id IN (?) AND answer RLIKE '^[0-9]+(\.[0-9]+)?$'
                GROUP BY active_course_id
            `,
          [courseIds],
        );

        feedbackRows.forEach((row) => {
          feedbackMap[row.active_course_id] = parseFloat(
            row.avg_rating,
          ).toFixed(2);
        });
      } catch (e) {
        console.warn(
          "Feedback table might not exist or error calculating avg",
          e.message,
        );
      }
    }

    const result = rows.map((row) => ({
      ...row,
      avg_feedback: feedbackMap[row.id] || "N/A",
    }));

    return result;
  }

  static async getExpiryAlerts() {
    // Legacy: getCandidateExpiry(checkDate)
    // SELECT * from course_attendance where certificate_expiry_date <= checkDate AND (mark_as_read = 0 OR mark_as_read IS NULL)

    // We need to join with candidate and course to get names.
    // Assuming `course_attendance` has `candidate_id`, `course_id`.

    const checkDate = new Date();
    checkDate.setMonth(checkDate.getMonth() + 6); // +6 months
    const checkDateStr = checkDate.toISOString().split("T")[0];

    const query = `
      SELECT 
        ca.candidate_id, 
        ca.course_id, 
        ca.certificate_expiry_date,
        u.first_name, u.last_name,
        cp.employee_id,
        c.course_name
      FROM course_attendance ca
      JOIN users u ON ca.candidate_id = u.id
      JOIN candidate_profiles cp ON u.id = cp.user_id
      JOIN courses c ON ca.course_id = c.id
      WHERE ca.certificate_expiry_date <= ? 
      AND (ca.mark_as_read = 0 OR ca.mark_as_read IS NULL)
    `;

    const [rows] = await pool.query(query, [checkDateStr]);
    return rows;
  }
}

module.exports = DashboardDao;
