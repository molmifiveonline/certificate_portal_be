const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class ActiveCourseDao {
  static async create(data) {
    const id = uuidv4();
    // Generate course_id logic here or in controller. For now assuming passed or simple generation.
    // PHP logic: $topicName . "-" . date('Y') . "-" . $lastCourseId;
    // We might need a separate method to generate ID.

    const {
      course_id,
      master_course_id,
      master_course_name,
      topic,
      course_name,
      description = null,
      start_date,
      end_date,
      type_of_location = null,
      location_id = null,
      other_location = null,
      course_type = null,
      remarks = null,
      course_level = null,
      primary_trainer_id = null,
      secondary_trainer_ids = null,
      whatsapp_link = null,
      zoom_link = null,
    } = data;

    const query = `
            INSERT INTO courses (
                id, course_id, master_course_id, master_course_name, topic, course_name, 
                description, start_date, end_date, type_of_location, location_id, 
                other_location, course_type, remarks, status, course_level, 
                primary_trainer_id, secondary_trainer_ids, whatsapp_link, zoom_link
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Initiated', ?, ?, ?, ?, ?)
        `;

    const params = [
      id,
      course_id,
      master_course_id,
      master_course_name,
      topic,
      course_name,
      description,
      start_date,
      end_date,
      type_of_location,
      location_id,
      other_location,
      course_type,
      remarks,
      course_level,
      primary_trainer_id,
      secondary_trainer_ids,
      whatsapp_link,
      zoom_link,
    ];

    await pool.execute(query, params);
    return { id, ...data };
  }

  static async getAll(search = "", page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM courses WHERE status != "Deleted"';
    let countQuery =
      'SELECT COUNT(*) as total FROM courses WHERE status != "Deleted"';
    const params = [];

    if (search) {
      query += " AND (course_name LIKE ? OR topic LIKE ? OR course_id LIKE ?)";
      countQuery +=
        " AND (course_name LIKE ? OR topic LIKE ? OR course_id LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit.toString(), offset.toString());

    const [rows] = await pool.execute(query, params);
    const [countResult] = await pool.execute(countQuery, params.slice(0, -3)); // Remove LIMIT/OFFSET params

    return {
      data: rows,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
    };
  }

  static async getById(id) {
    const query = "SELECT * FROM courses WHERE id = ?";
    const [rows] = await pool.execute(query, [id]);
    return rows[0];
  }

  static async getLastCourseId(topic) {
    // Simple logic to get count for current year and topic to generate next ID
    // This is a simplified version of PHP's findLastCourseId
    const year = new Date().getFullYear();
    const query = `SELECT COUNT(*) as count FROM courses WHERE topic = ? AND YEAR(created_at) = ?`;
    const [rows] = await pool.execute(query, [topic, year]);
    return rows[0].count;
  }

  static async update(id, data) {
    // Construct query dynamically based on data keys
    const keys = Object.keys(data).filter(
      (k) => k !== "id" && k !== "created_at" && k !== "updated_at",
    );
    if (keys.length === 0) return null;

    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => data[k]);
    values.push(id);

    const query = `UPDATE courses SET ${setClause} WHERE id = ?`;
    const [result] = await pool.execute(query, values);

    if (result.affectedRows > 0) {
      return { id, ...data };
    }
    return null;
  }

  static async delete(id) {
    const query = 'UPDATE courses SET status = "Deleted" WHERE id = ?';
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = ActiveCourseDao;
