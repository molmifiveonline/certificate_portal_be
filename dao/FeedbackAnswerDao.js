const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class FeedbackAnswerDao {
  static async create(answerData) {
    const {
      candidate_id,
      active_course_id,
      feedback_question_id,
      answer,
      feedback_category_id,
      feedback_question_option_id,
      feedback_question_option_text,
      feedback_id,
    } = answerData;

    const id = uuidv4();
    const query = `
      INSERT INTO feedback_question_answer (
        id, 
        candidate_id, 
        active_course_id, 
        feedback_question_id, 
        answer,
        feedback_category_id,
        feedback_id,
        feedback_question_option_id,
        feedback_question_option_text
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await db.query(query, [
      id,
      candidate_id,
      active_course_id,
      feedback_question_id,
      answer,
      feedback_category_id || null,
      feedback_id || null,
      feedback_question_option_id || null,
      feedback_question_option_text || null,
    ]);
    return id;
  }

  static async getDistinctSubmissions(filters = {}) {
    let baseQuery = `
      SELECT 
        fa.candidate_id, 
        fa.active_course_id, 
        MAX(fa.created_at) as effective_date,
        u.first_name, 
        u.last_name, 
        u.email,
        cp.rank,
        cp.manning_company,
        cp.employee_id,
        c.course_name as active_course_name,
        AVG(CASE WHEN fq.type = 'rating' THEN CAST(fa.answer AS DECIMAL(10, 2)) ELSE NULL END) as average_rating
      FROM feedback_question_answer fa
      JOIN users u ON fa.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN courses c ON fa.active_course_id = c.id
      LEFT JOIN feedback_questions fq ON fa.feedback_question_id = fq.id
    `;

    const params = [];
    const whereClauses = [];

    if (filters.search) {
      whereClauses.push(
        `(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`,
      );
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.active_course_id) {
      whereClauses.push(`fa.active_course_id = ?`);
      params.push(filters.active_course_id);
    }

    if (whereClauses.length > 0) {
      baseQuery += ` WHERE ` + whereClauses.join(" AND ");
    }

    baseQuery += ` GROUP BY fa.candidate_id, fa.active_course_id, u.first_name, u.last_name, u.email, cp.rank, cp.manning_company, cp.employee_id, c.course_name`;
    baseQuery += ` ORDER BY effective_date DESC`;

    // Pagination
    if (filters.page && filters.limit) {
      const page = Math.max(1, Number(filters.page));
      const limit = Number(filters.limit);
      const offset = (page - 1) * limit;
      baseQuery += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    }

    const [rows] = await db.query(baseQuery, params);
    return rows;
  }

  static async countDistinctSubmissions(filters = {}) {
    let baseQuery = `
      SELECT COUNT(DISTINCT fa.candidate_id, fa.active_course_id) as totalCount
      FROM feedback_question_answer fa
      JOIN users u ON fa.candidate_id = u.id
    `;
    const params = [];
    const whereClauses = [];

    if (filters.search) {
      whereClauses.push(
        `(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`,
      );
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.active_course_id) {
      whereClauses.push(`fa.active_course_id = ?`);
      params.push(filters.active_course_id);
    }

    if (whereClauses.length > 0) {
      baseQuery += ` WHERE ` + whereClauses.join(" AND ");
    }

    const [rows] = await db.query(baseQuery, params);
    return rows[0].totalCount;
  }

  static async getSubmissionDetails(candidate_id, active_course_id) {
    const query = `
      SELECT 
        fa.*,
        fq.question,
        fq.type
      FROM feedback_question_answer fa
      JOIN feedback_questions fq ON fa.feedback_question_id = fq.id
      WHERE fa.candidate_id = ? AND fa.active_course_id = ?
    `;
    const [rows] = await db.query(query, [candidate_id, active_course_id]);
    return rows;
  }
}

module.exports = FeedbackAnswerDao;
