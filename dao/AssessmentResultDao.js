const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class AssessmentResultDao {
  /**
   * Get distinct courses that have at least one submitted assessment result.
   */
  static async getCoursesWithSubmissions(
    search = "",
    page = 1,
    limit = 10,
    type_of_test = null,
  ) {
    const offset = (page - 1) * limit;

    let baseWhere = `WHERE ar.status = 'Completed'`;
    const params = [];

    if (type_of_test) {
      baseWhere += ` AND a.type_of_test = ?`;
      params.push(type_of_test);
    }

    if (search) {
      baseWhere += ` AND (c.course_name LIKE ? OR c.course_id LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const countQuery = `
      SELECT COUNT(DISTINCT ar.course_id) as totalCount
      FROM assessment_results ar
      LEFT JOIN courses c ON ar.course_id = c.id
      LEFT JOIN assessment a ON ar.assessment_id = a.id
      ${baseWhere}
    `;
    const [countResult] = await pool.execute(countQuery, params);
    const totalCount = countResult[0].totalCount;

    const dataQuery = `
      SELECT 
        c.id as course_id,
        c.course_id as course_code,
        c.course_name,
        a.type_of_test,
        COUNT(DISTINCT ar.candidate_id) as total_submissions
      FROM assessment_results ar
      LEFT JOIN courses c ON ar.course_id = c.id
      LEFT JOIN assessment a ON ar.assessment_id = a.id
      ${baseWhere}
      GROUP BY c.id, c.course_id, c.course_name, a.type_of_test
      ORDER BY MAX(ar.created_at) DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit.toString(), offset.toString()];
    const [rows] = await pool.execute(dataQuery, dataParams);

    return {
      data: rows,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  /**
   * Get all candidate submissions for a specific course.
   */
  static async getSubmissionsByCourse(
    courseId,
    search = "",
    page = 1,
    limit = 10,
  ) {
    const offset = (page - 1) * limit;

    let baseWhere = `WHERE ar.course_id = ? AND ar.status = 'Completed'`;
    const params = [courseId];

    if (search) {
      baseWhere += ` AND (u.first_name LIKE ? OR u.middle_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const countQuery = `
      SELECT COUNT(*) as totalCount
      FROM assessment_results ar
      LEFT JOIN users u ON ar.candidate_id = u.id
      ${baseWhere}
    `;
    const [countResult] = await pool.execute(countQuery, params);
    const totalCount = countResult[0].totalCount;

    const dataQuery = `
      SELECT 
        ar.id as result_id,
        ar.assessment_id,
        ar.candidate_id,
        ar.course_id,
        ar.score,
        ar.total_questions,
        ar.correct_answers,
        ar.attempt_number,
        ar.created_at,
        u.first_name,
        u.middle_name,
        u.last_name,
        u.email,
        a.title as assessment_title,
        a.type_of_test,
        c.course_name
      FROM assessment_results ar
      LEFT JOIN users u ON ar.candidate_id = u.id
      LEFT JOIN assessment a ON ar.assessment_id = a.id
      LEFT JOIN courses c ON ar.course_id = c.id
      ${baseWhere}
      ORDER BY ar.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit.toString(), offset.toString()];
    const [rows] = await pool.execute(dataQuery, dataParams);

    return {
      data: rows,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  /**
   * Get detailed submission with all answers for a specific result.
   */
  static async getSubmissionDetail(resultId) {
    // Get result info
    const resultQuery = `
      SELECT 
        ar.*,
        u.first_name,
        u.middle_name,
        u.last_name,
        u.email,
        cp.employee_id,
        cp.rank,
        a.title as assessment_title,
        a.type_of_test,
        c.course_name,
        c.course_id as course_code
      FROM assessment_results ar
      LEFT JOIN users u ON ar.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN assessment a ON ar.assessment_id = a.id
      LEFT JOIN courses c ON ar.course_id = c.id
      WHERE ar.id = ?
    `;
    const [resultRows] = await pool.execute(resultQuery, [resultId]);
    if (resultRows.length === 0) return null;

    const result = resultRows[0];

    // Get answers with question details
    const answersQuery = `
      SELECT 
        aa.id,
        aa.question_id,
        aa.selected_option,
        aa.is_correct,
        qb.question,
        qb.option_a,
        qb.option_b,
        qb.option_c,
        qb.option_d,
        qb.correct_option,
        qb.image,
        qb.opt_img_a,
        qb.opt_img_b,
        qb.opt_img_c,
        qb.opt_img_d
      FROM assessment_answers aa
      LEFT JOIN question_bank qb ON aa.question_id = qb.id
      WHERE aa.assessment_result_id = ?
      ORDER BY aa.created_at ASC
    `;
    const [answerRows] = await pool.execute(answersQuery, [resultId]);

    return {
      result,
      answers: answerRows,
    };
  }

  /**
   * Get all submissions for export.
   */
  static async getAllSubmissions(search = "", type_of_test = null, course_id = null) {
    let baseWhere = `WHERE ar.status = 'Completed'`;
    const params = [];

    if (type_of_test) {
      baseWhere += ` AND a.type_of_test = ?`;
      params.push(type_of_test);
    }

    if (course_id) {
      baseWhere += ` AND ar.course_id = ?`;
      params.push(course_id);
    }

    if (search) {
      baseWhere += ` AND (c.course_name LIKE ? OR c.course_id LIKE ? OR u.first_name LIKE ? OR u.middle_name LIKE ? OR u.last_name LIKE ? OR cp.employee_id LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const dataQuery = `
      SELECT 
        ar.id as result_id,
        ar.assessment_id,
        ar.candidate_id,
        ar.course_id,
        ar.score,
        ar.total_questions,
        ar.correct_answers,
        ar.attempt_number,
        ar.created_at,
        u.first_name,
        u.middle_name,
        u.last_name,
        u.email,
        cp.employee_id,
        cp.passport_no,
        cp.rank,
        a.title as assessment_title,
        a.type_of_test,
        c.course_name,
        c.course_id as course_code
      FROM assessment_results ar
      LEFT JOIN users u ON ar.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN assessment a ON ar.assessment_id = a.id
      LEFT JOIN courses c ON ar.course_id = c.id
      ${baseWhere}
      ORDER BY ar.created_at DESC
    `;

    const [rows] = await pool.execute(dataQuery, params);
    return rows;
  }

  /**
   * Get all submissions paginated.
   */
  static async getAllSubmissionsPaginated(
    search = "",
    page = 1,
    limit = 10,
    type_of_test = null,
    course_id = null,
  ) {
    const offset = (page - 1) * limit;

    let baseWhere = `WHERE ar.status = 'Completed'`;
    const params = [];

    if (type_of_test) {
      baseWhere += ` AND a.type_of_test = ?`;
      params.push(type_of_test);
    }

    if (course_id) {
      baseWhere += ` AND ar.course_id = ?`;
      params.push(course_id);
    }

    if (search) {
      baseWhere += ` AND (c.course_name LIKE ? OR c.course_id LIKE ? OR u.first_name LIKE ? OR u.middle_name LIKE ? OR u.last_name LIKE ? OR cp.employee_id LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const countQuery = `
      SELECT COUNT(*) as totalCount
      FROM assessment_results ar
      LEFT JOIN users u ON ar.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN assessment a ON ar.assessment_id = a.id
      LEFT JOIN courses c ON ar.course_id = c.id
      ${baseWhere}
    `;
    const [countResult] = await pool.execute(countQuery, params);
    const totalCount = countResult[0].totalCount;

    const dataQuery = `
      SELECT 
        ar.id as result_id,
        ar.assessment_id,
        ar.candidate_id,
        ar.course_id,
        ar.score,
        ar.total_questions,
        ar.correct_answers,
        ar.attempt_number,
        ar.created_at,
        u.first_name,
        u.middle_name,
        u.last_name,
        u.email,
        cp.employee_id,
        a.title as assessment_title,
        a.type_of_test,
        c.course_name,
        c.course_id as course_code
      FROM assessment_results ar
      LEFT JOIN users u ON ar.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN assessment a ON ar.assessment_id = a.id
      LEFT JOIN courses c ON ar.course_id = c.id
      ${baseWhere}
      ORDER BY ar.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit.toString(), offset.toString()];
    const [rows] = await pool.execute(dataQuery, dataParams);

    return {
      data: rows,
      totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  /**
   * Get all candidate submissions for a specific assessment.
   */
  static async getSubmissionsByAssessment(
    assessmentId,
    search = "",
    page = 1,
    limit = 10,
  ) {
    const offset = (page - 1) * limit;

    let baseWhere = `WHERE ar.assessment_id = ? AND ar.status = 'Completed'`;
    const params = [assessmentId];

    if (search) {
      baseWhere += ` AND (u.first_name LIKE ? OR u.middle_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const countQuery = `
      SELECT COUNT(*) as totalCount
      FROM assessment_results ar
      LEFT JOIN users u ON ar.candidate_id = u.id
      ${baseWhere}
    `;
    const [countResult] = await pool.execute(countQuery, params);
    const totalCount = countResult[0].totalCount;

    const dataQuery = `
      SELECT 
        ar.id as result_id,
        ar.assessment_id,
        ar.candidate_id,
        ar.course_id,
        ar.score,
        ar.total_questions,
        ar.correct_answers,
        ar.attempt_number,
        ar.created_at,
        u.first_name,
        u.middle_name,
        u.last_name,
        u.email,
        a.title as assessment_title,
        a.type_of_test,
        c.course_name
      FROM assessment_results ar
      LEFT JOIN users u ON ar.candidate_id = u.id
      LEFT JOIN assessment a ON ar.assessment_id = a.id
      LEFT JOIN courses c ON ar.course_id = c.id
      ${baseWhere}
      ORDER BY ar.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit.toString(), offset.toString()];
    const [rows] = await pool.execute(dataQuery, dataParams);

    return {
      data: rows,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  /**
   * Save a single assessment submission result and its answers.
   */
  static async saveSubmission(data) {
    const {
      assessment_id,
      candidate_id,
      course_id,
      score,
      total_questions,
      correct_answers,
      answers, // Array of { question_id, selected_option, is_correct }
    } = data;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get latest attempt number
      const [attemptRows] = await connection.execute(
        "SELECT MAX(attempt_number) as lastAttempt FROM assessment_results WHERE assessment_id = ? AND candidate_id = ? AND course_id = ?",
        [assessment_id, candidate_id, course_id],
      );
      const attempt_number = (attemptRows[0].lastAttempt || 0) + 1;

      const resultId = uuidv4();
      const resultQuery = `
        INSERT INTO assessment_results (
          id, assessment_id, candidate_id, course_id, 
          score, total_questions, correct_answers, 
          attempt_number, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Completed')
      `;

      await connection.execute(resultQuery, [
        resultId,
        assessment_id,
        candidate_id,
        course_id,
        score,
        total_questions,
        correct_answers,
        attempt_number,
      ]);

      // Save individual answers
      if (answers && answers.length > 0) {
        const answerQuery = `
          INSERT INTO assessment_answers (
            id, assessment_result_id, question_id, selected_option, is_correct
          ) VALUES (?, ?, ?, ?, ?)
        `;

        for (const ans of answers) {
          await connection.execute(answerQuery, [
            uuidv4(),
            resultId,
            ans.question_id,
            ans.selected_option,
            ans.is_correct ? 1 : 0,
          ]);
        }
      }

      await connection.commit();
      return { id: resultId, attempt_number };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = AssessmentResultDao;
