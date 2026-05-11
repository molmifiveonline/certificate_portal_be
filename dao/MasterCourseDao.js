const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class MasterCourseDao {
  static async create(data) {
    const id = uuidv4();
    const {
      topic,
      master_course_name,
      certificate_type = null,
      expiry_date = null,
      description = null,
      remarks = null,
      material_link = null,
    } = data;
    const query = `
            INSERT INTO master_course (id, topic, master_course_name, certificate_type, expiry_date, description, remarks, material_link, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `;
    await pool.execute(query, [
      id,
      topic,
      master_course_name,
      certificate_type,
      expiry_date,
      description,
      remarks,
      material_link,
    ]);
    return { id, ...data };
  }

  static async getAll(search = "", page, limit) {
    let query = "SELECT * FROM master_course WHERE status = 1";
    let countQuery =
      "SELECT COUNT(*) as total FROM master_course WHERE status = 1";
    const params = [];

    if (search) {
      query += " AND (master_course_name LIKE ? OR topic LIKE ?)";
      countQuery += " AND (master_course_name LIKE ? OR topic LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0].total;

    query += " ORDER BY created_at DESC";

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

  static async getOptions() {
    const query = `
      SELECT id, topic, master_course_name
      FROM master_course
      WHERE status = 1
      ORDER BY topic, master_course_name
    `;
    const [rows] = await pool.execute(query);
    return rows;
  }

  static async getById(id) {
    const query = "SELECT * FROM master_course WHERE id = ? AND status = 1";
    const [rows] = await pool.execute(query, [id]);
    return rows[0];
  }

  static async update(id, data) {
    const {
      topic,
      master_course_name,
      certificate_type = null,
      expiry_date = null,
      description = null,
      remarks = null,
      material_link = null,
    } = data;
    const query = `
            UPDATE master_course 
            SET topic = ?, master_course_name = ?, certificate_type = ?, expiry_date = ?, description = ?, remarks = ?, material_link = ?
            WHERE id = ?
        `;
    const [result] = await pool.execute(query, [
      topic,
      master_course_name,
      certificate_type,
      expiry_date,
      description,
      remarks,
      material_link,
      id,
    ]);
    if (result.affectedRows > 0) {
      return { id, ...data };
    }
    return null;
  }

  static async delete(id) {
    const query = "UPDATE master_course SET status = 0 WHERE id = ?";
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = MasterCourseDao;
