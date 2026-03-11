const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class AssessmentDao {
  static async create(data) {
    const id = uuidv4();
    const {
      title,
      course_id,
      type_of_test,
      candidate_ids,
      num_of_questions,
      questions_choice,
      question_ids,
    } = data;

    const query = `
      INSERT INTO assessment (
        id, title, course_id, type_of_test, candidate_ids,
        num_of_questions, questions_choice, question_ids, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    await pool.execute(query, [
      id,
      title,
      course_id,
      type_of_test,
      candidate_ids || null,
      num_of_questions || 10,
      questions_choice || "auto",
      question_ids || null,
    ]);

    return { id, ...data };
  }

  static async getAll(search = "", page, limit) {
    let baseQuery = `
      FROM assessment a
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.status = 1
    `;
    let countQuery =
      "SELECT COUNT(*) as total FROM assessment WHERE status = 1";
    const params = [];

    if (search) {
      baseQuery += " AND (a.title LIKE ? OR c.course_name LIKE ?)";
      countQuery += " AND (title LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    const countParams = search ? [`%${search}%`] : [];
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    let query = `SELECT a.*, c.course_name ${baseQuery} ORDER BY a.created_at DESC`;

    let pageNum = page ? parseInt(page, 10) : null;
    let limitNum = limit ? parseInt(limit, 10) : null;

    if (pageNum && limitNum) {
      const offset = (pageNum - 1) * limitNum;
      query += " LIMIT ? OFFSET ?";
      params.push(limitNum.toString(), offset.toString());
    }

    const [rows] = await pool.execute(query, params);

    return {
      data: rows,
      total,
      page: pageNum || 1,
      limit: limitNum || total,
      totalPages: limitNum ? Math.ceil(total / limitNum) : 1,
    };
  }

  static async getById(id) {
    const query = `
      SELECT a.*, c.course_name
      FROM assessment a
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.id = ? AND a.status = 1
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0];
  }

  static async update(id, data) {
    const {
      title,
      course_id,
      type_of_test,
      candidate_ids,
      num_of_questions,
      questions_choice,
      question_ids,
    } = data;

    const query = `
      UPDATE assessment SET
        title = ?, course_id = ?, type_of_test = ?,
        candidate_ids = ?, num_of_questions = ?,
        questions_choice = ?, question_ids = ?
      WHERE id = ?
    `;

    const [result] = await pool.execute(query, [
      title,
      course_id,
      type_of_test,
      candidate_ids || null,
      num_of_questions || 10,
      questions_choice || "auto",
      question_ids || null,
      id,
    ]);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const query = "UPDATE assessment SET status = 0 WHERE id = ?";
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }

  // Get candidates enrolled in a course
  static async getCandidatesByCourse(courseId) {
    const query = `
      SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS candidate_name, u.email
      FROM users u
      INNER JOIN courses_enrollment ce ON u.id = ce.candidate_id
      WHERE ce.course_id = ? AND (ce.status != 'Deleted' OR ce.status IS NULL)
    `;
    const [rows] = await pool.execute(query, [courseId]);
    return rows;
  }

  // Get questions for a master course
  static async getQuestionsByMasterCourse(masterCourseId, typeOfTest = null) {
    let query = `
      SELECT id, question, option_a, option_b, option_c, option_d, image, opt_img_a, opt_img_b, opt_img_c, opt_img_d, master_course_id, type_of_test
      FROM question_bank
      WHERE master_course_id = ? AND status = 1
    `;
    const params = [masterCourseId];

    if (typeOfTest && typeOfTest !== "3") {
      query += " AND FIND_IN_SET(?, type_of_test) > 0";
      params.push(typeOfTest);
    }

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Get active courses (optionally filtered by test type)
  static async getActiveCourses(typeOfTest = null, excludeAssessmentId = null) {
    let query = `
      SELECT c.id, c.course_id AS course_code, c.course_name, c.master_course_name, c.master_course_id
      FROM courses c
      WHERE c.status = 'Initiated' OR c.status = 'Course started'
    `;
    const params = [];

    if (typeOfTest && typeOfTest !== "3") {
      // For pre/post, exclude courses that already have an assessment of this type
      query += `
        AND c.id NOT IN (
          SELECT course_id FROM assessment
          WHERE type_of_test = ? AND status = 1
      `;
      params.push(typeOfTest);

      if (excludeAssessmentId) {
        query += ` AND id != ?`;
        params.push(excludeAssessmentId);
      }

      query += `
        )
      `;
    }

    query += " ORDER BY c.id DESC";
    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Get assessments for a specific course
  static async getAssessmentsByCourseId(courseId, typeOfTest = null) {
    let query = `
      SELECT a.*, c.course_name
      FROM assessment a
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.course_id = ? AND a.status = 1
    `;
    const params = [courseId];

    if (typeOfTest) {
      query += " AND a.type_of_test = ?";
      params.push(typeOfTest);
    }

    query += " ORDER BY a.created_at DESC";
    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Get assessment details for a candidate to play
  static async getAssessmentDetailsForPlay(id) {
    const query = `
      SELECT a.*, c.master_course_id, c.master_course_name
      FROM assessment a
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.id = ? AND a.status = 1
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0];
  }

  // Get specific questions by their IDs
  static async getQuestionsByIds(questionIds) {
    if (!questionIds || questionIds.length === 0) return [];

    // Create placeholders ?, ?, ? for the IN clause
    const placeholders = questionIds.map(() => "?").join(",");
    const query = `
      SELECT id, question, option_a, option_b, option_c, option_d, image, opt_img_a, opt_img_b, opt_img_c, opt_img_d
      FROM question_bank
      WHERE id IN (${placeholders}) AND status = 1
    `;

    const [rows] = await pool.execute(query, questionIds);
    return rows;
  }
}

module.exports = AssessmentDao;
