const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class CertificateDao {
  static async create(data) {
    const id = uuidv4();
    const {
      certificate_no,
      type,
      topic,
      course_level,
      course_id,
      active_course_id,
      candidate_id,
      trainer_id,
      location,
      course_conduct,
      status,
      from_date,
      to_date,
      days,
      issue_date,
      show_logo,
      is_manual,
      description1,
      remarks,
      subid,
      is_hidden,
    } = data;

    const query = `
      INSERT INTO certificates (
        id, certificate_no, type, topic, course_level, course_id, 
        active_course_id, candidate_id, trainer_id, location, 
        course_conduct, status, is_hidden, from_date, to_date, days, 
        issue_date, show_logo, is_manual, 
        description1, remarks, subid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      id,
      certificate_no,
      type,
      topic,
      course_level,
      course_id,
      active_course_id,
      candidate_id,
      trainer_id,
      location,
      course_conduct,
      status || 0,
      is_hidden || 0,
      from_date,
      to_date,
      days,
      issue_date,
      show_logo || 1,
      is_manual || 0,
      description1,
      remarks,
      subid,
    ];

    await pool.execute(query, values);
    return { id, ...data };
  }

  static async getAll(search = "", filters = {}, page, limit) {
    let baseQuery = `
      FROM certificates c
      LEFT JOIN users u ON c.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN users t ON c.trainer_id = t.id
      LEFT JOIN master_course mc ON c.course_id = mc.id
      WHERE 1=1
    `;
    const values = [];

    if (search) {
      baseQuery += ` AND (c.certificate_no LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR cp.employee_id LIKE ?)`;
      const searchTerm = `%${search}%`;
      values.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.status !== undefined && filters.status !== "") {
      baseQuery += ` AND c.status = ?`;
      values.push(filters.status);
    }

    if (filters.active_course_id) {
      baseQuery += ` AND c.active_course_id = ?`;
      values.push(filters.active_course_id);
    }

    if (filters.trainer_id) {
      baseQuery += ` AND c.trainer_id = ?`;
      values.push(filters.trainer_id);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const [countResult] = await pool.execute(countQuery, values);
    const total = countResult[0].total;

    // Build data query
    let dataQuery = `
      SELECT c.*, 
             CONCAT(u.first_name, ' ', u.last_name) as candidate_name,
             u.email as candidate_email,
             cp.employee_id as empId,
             t.first_name as trainer_first_name,
             t.last_name as trainer_last_name,
             mc.master_course_name
      ${baseQuery}
      ORDER BY c.created_at DESC
    `;

    // Add pagination if provided
    let pageNum = page ? parseInt(page, 10) : null;
    let limitNum = limit ? parseInt(limit, 10) : null;

    if (pageNum && limitNum) {
      const offset = (pageNum - 1) * limitNum;
      dataQuery += ` LIMIT ? OFFSET ?`;
      values.push(limitNum.toString(), offset.toString());
    }

    const [rows] = await pool.execute(dataQuery, values);

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
      SELECT c.*, 
             CONCAT(u.first_name, ' ', u.last_name) as candidate_name,
             cp.employee_id as empId,
             t.first_name as trainer_first_name,
             t.last_name as trainer_last_name,
             mc.master_course_name
      FROM certificates c
      LEFT JOIN users u ON c.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN users t ON c.trainer_id = t.id
      LEFT JOIN master_course mc ON c.course_id = mc.id
      WHERE c.id = ?
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0];
  }

  static async update(id, data) {
    const validColumns = [
      "certificate_no",
      "type",
      "topic",
      "course_level",
      "course_id",
      "active_course_id",
      "candidate_id",
      "trainer_id",
      "location",
      "course_conduct",
      "status",
      "from_date",
      "to_date",
      "days",
      "issue_date",
      "added_date",
      "show_logo",
      "is_manual",
      "description1",
      "remarks",
      "subid",
      "is_hidden",
    ];

    const filteredData = Object.keys(data)
      .filter((key) => validColumns.includes(key))
      .reduce((obj, key) => {
        obj[key] = data[key];
        return obj;
      }, {});

    const fields = Object.keys(filteredData);
    if (fields.length === 0) return null;

    const setClause = fields.map((field) => `${field} = ?`).join(", ");
    const values = [...Object.values(filteredData), id];

    const query = `UPDATE certificates SET ${setClause} WHERE id = ?`;
    const [result] = await pool.execute(query, values);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const query = "DELETE FROM certificates WHERE id = ?";
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }

  static async getNextSubId(topic, year) {
    const query = `
      SELECT MAX(subid) as max_subid 
      FROM certificates 
      WHERE topic = ? AND YEAR(issue_date) = ?
    `;
    const [rows] = await pool.execute(query, [topic, year]);
    return (rows[0].max_subid || 0) + 1;
  }

  static async getNextSubIdByType(type) {
    const query = `
      SELECT MAX(subid) as max_subid 
      FROM certificates 
      WHERE type = ?
    `;
    const [rows] = await pool.execute(query, [type]);
    return (rows[0].max_subid || 0) + 1;
  }

  static async getByCandidateAndCourse(candidateId, activeCourseId) {
    const query =
      "SELECT * FROM certificates WHERE candidate_id = ? AND active_course_id = ?";
    const [rows] = await pool.execute(query, [candidateId, activeCourseId]);
    return rows[0];
  }
}

module.exports = CertificateDao;
