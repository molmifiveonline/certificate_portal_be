const pool = require("../config/db");
const ActiveCourseDao = require("./ActiveCourseDao");

class DashboardDao {
  static async getStats() {
    const stats = {};

    // 1. Total Candidates (status = 1)
    // Based on CandidateDao, candidates are users with role 'candidate' and status 1
    const [candidateResult] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users u
      JOIN candidate_profiles cp ON u.id = cp.user_id
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

    // 3. Total Active Courses — use the same predicate as ActiveCourseDao.getAll()
    // so the count matches exactly what the Active Courses listing page shows
    const activePredicate = await ActiveCourseDao.buildActivePredicate("c");
    const [courseResult] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM courses c
      WHERE ${activePredicate}
    `);
    stats.totalCourses = courseResult[0].count;

    return stats;
  }

  static async getCourses(filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let whereClause = `WHERE c.status != 'Deleted'`;
    const params = [];

    if (filters.trainer_id) {
      whereClause += ` AND c.primary_trainer_id = ?`;
      params.push(filters.trainer_id);
    }

    if (filters.master_course_id) {
      whereClause += ` AND c.master_course_id = ?`;
      params.push(filters.master_course_id);
    }

    if (filters.start_date && filters.end_date) {
      whereClause += ` AND c.start_date >= ? AND c.end_date <= ?`;
      params.push(filters.start_date, filters.end_date);
    }

    if (filters.status) {
      whereClause += ` AND c.status = ?`;
      params.push(filters.status);
    }

    // Get total count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM courses c ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    let query = `
      SELECT c.*, 
             (SELECT COUNT(*) FROM courses_enrollment ce WHERE ce.course_id = c.id) as candidate_count,
             (SELECT COUNT(*) FROM course_attendance ca WHERE ca.course_id = c.id AND (ca.absent_reasons IS NOT NULL AND ca.absent_reasons != '[]' AND ca.absent_reasons != '')) as absent_count
      FROM courses c
      ${whereClause}
      ORDER BY c.start_date DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(query, [...params, parseInt(limit), parseInt(offset)]);

    const courseIds = rows.map((r) => r.id);
    let feedbackMap = {};
    if (courseIds.length > 0) {
      try {
        const [feedbackRows] = await pool.query(
          `
                SELECT active_course_id, AVG(CAST(answer AS DECIMAL(10,2))) as avg_rating
                FROM feedback_question_answer
                WHERE active_course_id IN (?) AND answer RLIKE '^[0-9]+(\\.[0-9]+)?$'
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

    const data = rows.map((row) => ({
      ...row,
      avg_feedback: feedbackMap[row.id] || "N/A",
    }));

    return { data, total };
  }

  static async getExpiryAlerts(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const checkDate = new Date();
    checkDate.setMonth(checkDate.getMonth() + 6); // +6 months
    const checkDateStr = checkDate.toISOString().split("T")[0];

    const whereClause = `
      WHERE ca.certificate_expiry_date <= ? 
      AND (ca.mark_as_read = 0 OR ca.mark_as_read IS NULL)
    `;

    // Get total count
    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) as total
      FROM course_attendance ca
      ${whereClause}
      `,
      [checkDateStr]
    );
    const total = countRows[0].total;

    const query = `
      SELECT 
        ca.candidate_id, 
        ca.course_id, 
        ca.certificate_expiry_date,
        u.first_name, u.last_name, u.email,
        cp.employee_id,
        c.course_name
      FROM course_attendance ca
      JOIN users u ON ca.candidate_id = u.id
      JOIN candidate_profiles cp ON u.id = cp.user_id
      JOIN courses c ON ca.course_id = c.id
      ${whereClause}
      ORDER BY ca.certificate_expiry_date ASC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(query, [checkDateStr, parseInt(limit), parseInt(offset)]);
    return { data: rows, total };
  }
}

module.exports = DashboardDao;
