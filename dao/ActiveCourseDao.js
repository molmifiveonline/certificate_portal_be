const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { hasColumn } = require("../utils/schemaUtils");

class ActiveCourseDao {
  static async buildActivePredicate(alias = "c") {
    const parts = [`${alias}.status != "Deleted"`];

    if (await hasColumn("courses", "is_pre_active")) {
      parts.push(`COALESCE(${alias}.is_pre_active, 0) = 0`);
    }

    if (await hasColumn("courses", "is_outhouse")) {
      parts.push(`COALESCE(${alias}.is_outhouse, 0) = 0`);
    } else {
      parts.push(`COALESCE(${alias}.course_type, '') != 'Out house'`);
    }

    return parts.join(" AND ");
  }

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
      start_time = null,
      end_time = null,
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
      zoom_username = null,
      zoom_password = null,
    } = data;

    const query = `
            INSERT INTO courses (
                id, course_id, master_course_id, master_course_name, topic, course_name, 
                description, start_date, end_date, start_time, end_time, type_of_location, location_id, 
                other_location, course_type, remarks, status, course_level, 
                primary_trainer_id, secondary_trainer_ids, whatsapp_link, zoom_link,
                zoom_username, zoom_password
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Initiated', ?, ?, ?, ?, ?, ?, ?)
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
      start_time,
      end_time,
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
      zoom_username,
      zoom_password,
    ];

    await pool.execute(query, params);
    return { id, ...data };
  }

  static async getAll(search = "", page, limit, filters = {}) {
    let whereClause = `WHERE ${await this.buildActivePredicate("c")}`;
    const whereParams = [];

    let joinClause = "";
    if (filters.candidate_id) {
      joinClause +=
        " JOIN courses_enrollment ce ON c.id = ce.course_id AND ce.candidate_id = ?";
      whereParams.push(filters.candidate_id);
    }

    if (search) {
      whereClause +=
        " AND (c.course_name LIKE ? OR c.topic LIKE ? OR c.course_id LIKE ?)";
      whereParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (filters.status) {
      whereClause += " AND c.status = ?";
      whereParams.push(filters.status);
    }

    if (filters.from_date) {
      whereClause += " AND c.start_date >= ?";
      whereParams.push(filters.from_date);
    }

    if (filters.to_date) {
      whereClause += " AND c.end_date <= ?";
      whereParams.push(filters.to_date);
    }

    if (filters.trainer_id) {
      whereClause += " AND c.primary_trainer_id = ?";
      whereParams.push(filters.trainer_id);
    }

    const countQuery = `SELECT COUNT(*) as total FROM courses c ${joinClause} ${whereClause}`;
    const [countResult] = await pool.execute(countQuery, whereParams);
    const total = countResult[0].total;

    let query = `SELECT c.* FROM courses c ${joinClause} ${whereClause} ORDER BY c.created_at DESC`;

    let pageNum = page ? parseInt(page, 10) : null;
    let limitNum = limit ? parseInt(limit, 10) : null;

    const queryParams = [...whereParams];
    if (pageNum && limitNum) {
      const offset = (pageNum - 1) * limitNum;
      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(limitNum.toString(), offset.toString());
    }

    const [rows] = await pool.execute(query, queryParams);

    return {
      data: rows,
      total,
      page: pageNum || 1,
      limit: limitNum || total,
      totalPages: limitNum ? Math.ceil(total / limitNum) : 1,
    };
  }

  static async getById(id) {
    const predicate = await this.buildActivePredicate("c");
    const query = `
      SELECT c.*, mc.certificate_type 
      FROM courses c
      LEFT JOIN master_course mc ON c.master_course_id = mc.id
      WHERE c.id = ? AND ${predicate}
    `;
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
    // Define allowed columns for update to prevent SQL errors (e.g. 'location' which is not in DB)
    const allowedColumns = [
      "course_id",
      "master_course_id",
      "master_course_name",
      "topic",
      "course_name",
      "description",
      "start_date",
      "end_date",
      "start_time",
      "end_time",
      "type_of_location",
      "location_id",
      "other_location",
      "course_type",
      "remarks",
      "status",
      "course_level",
      "primary_trainer_id",
      "secondary_trainer_ids",
      "whatsapp_link",
      "zoom_link",
      "zoom_username",
      "zoom_password",
      "no_of_days",
      "cancelation_reason",
      "completion_reason",
    ];

    const keys = Object.keys(data).filter((k) => allowedColumns.includes(k));
    if (keys.length === 0) return null;

    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => data[k]);
    values.push(id);

    const predicate = await this.buildActivePredicate("courses");
    const query = `UPDATE courses SET ${setClause} WHERE id = ? AND ${predicate}`;
    const [result] = await pool.execute(query, values);

    if (result.affectedRows > 0) {
      return { id, ...data };
    }
    return null;
  }

  static async delete(id) {
    const predicate = await this.buildActivePredicate("courses");
    const query = `UPDATE courses SET status = "Deleted" WHERE id = ? AND ${predicate}`;
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }
  static async cancelCourse(id, reason) {
    const predicate = await this.buildActivePredicate("courses");
    const query = `UPDATE courses SET status = 'Cancelled', cancelation_reason = ? WHERE id = ? AND ${predicate}`;
    const [result] = await pool.execute(query, [reason, id]);
    return result.affectedRows > 0;
  }

  static async completeCourse(id, reason) {
    const predicate = await this.buildActivePredicate("courses");
    const query = `UPDATE courses SET status = 'Course Completed', completion_reason = ? WHERE id = ? AND ${predicate}`;
    const [result] = await pool.execute(query, [reason, id]);
    return result.affectedRows > 0;
  }
}

module.exports = ActiveCourseDao;
