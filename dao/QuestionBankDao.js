const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class QuestionBankDao {
  static async create(data) {
    const id = uuidv4();
    const {
      question,
      master_course_id,
      type_of_test,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      image,
      opt_img_a,
      opt_img_b,
      opt_img_c,
      opt_img_d,
    } = data;

    const query = `
      INSERT INTO question_bank (
        id, question, master_course_id, type_of_test,
        option_a, option_b, option_c, option_d, correct_option,
        image, opt_img_a, opt_img_b, opt_img_c, opt_img_d, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    await pool.execute(query, [
      id,
      question,
      master_course_id,
      type_of_test,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      image,
      opt_img_a,
      opt_img_b,
      opt_img_c,
      opt_img_d,
    ]);

    return { id, ...data };
  }

  static async getAll(search = "", masterCourseId = "", page, limit) {
    let baseQuery = `
      FROM question_bank q
      LEFT JOIN master_course m ON q.master_course_id = m.id
      WHERE q.status = 1
    `;
    let countQuery =
      "SELECT COUNT(*) as total FROM question_bank WHERE status = 1";
    const params = [];

    if (search) {
      baseQuery += " AND (q.question LIKE ?)";
      countQuery += " AND (question LIKE ?)";
      params.push(`%${search}%`);
    }

    if (masterCourseId) {
      baseQuery += " AND q.master_course_id = ?";
      countQuery += " AND master_course_id = ?";
      params.push(masterCourseId);
    }

    const countParams = [];
    if (search) countParams.push(`%${search}%`);
    if (masterCourseId) countParams.push(masterCourseId);

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    let query = `SELECT q.*, m.master_course_name ${baseQuery} ORDER BY q.created_at DESC`;

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
      SELECT q.*, m.master_course_name 
      FROM question_bank q
      LEFT JOIN master_course m ON q.master_course_id = m.id
      WHERE q.id = ? AND q.status = 1
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0];
  }

  static async update(id, data) {
    const {
      question,
      master_course_id,
      type_of_test,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      image,
      opt_img_a,
      opt_img_b,
      opt_img_c,
      opt_img_d,
    } = data;

    let query = "UPDATE question_bank SET ";
    const params = [];

    if (question) {
      query += "question = ?, ";
      params.push(question);
    }
    if (master_course_id) {
      query += "master_course_id = ?, ";
      params.push(master_course_id);
    }
    if (type_of_test) {
      query += "type_of_test = ?, ";
      params.push(type_of_test);
    }
    if (option_a) {
      query += "option_a = ?, ";
      params.push(option_a);
    }
    if (option_b) {
      query += "option_b = ?, ";
      params.push(option_b);
    }
    if (option_c) {
      query += "option_c = ?, ";
      params.push(option_c);
    }
    if (option_d) {
      query += "option_d = ?, ";
      params.push(option_d);
    }
    if (correct_option) {
      query += "correct_option = ?, ";
      params.push(correct_option);
    }
    if (image) {
      query += "image = ?, ";
      params.push(image);
    }
    if (opt_img_a) {
      query += "opt_img_a = ?, ";
      params.push(opt_img_a);
    }
    if (opt_img_b) {
      query += "opt_img_b = ?, ";
      params.push(opt_img_b);
    }
    if (opt_img_c) {
      query += "opt_img_c = ?, ";
      params.push(opt_img_c);
    }
    if (opt_img_d) {
      query += "opt_img_d = ?, ";
      params.push(opt_img_d);
    }

    // Remove trailing comma
    query = query.slice(0, -2);
    query += " WHERE id = ?";
    params.push(id);

    const [result] = await pool.execute(query, params);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const query = "UPDATE question_bank SET status = 0 WHERE id = ?";
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = QuestionBankDao;
