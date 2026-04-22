const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { hasColumn, hasTable } = require("../utils/schemaUtils");

class OuthouseCourseDao {
  static async buildOuthousePredicate(alias = "c") {
    return `COALESCE(${alias}.is_outhouse, 0) = 1`;
  }

  static async getLastCourseId(topic) {
    const year = new Date().getFullYear();
    const predicate = await this.buildOuthousePredicate("courses");
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as count
       FROM courses
       WHERE topic = ? AND ${predicate} AND YEAR(created_at) = ?`,
      [topic, year],
    );
    return rows[0].count;
  }

  static async create(data) {
    const id = uuidv4();
    const payload = {
      id,
      course_id: data.course_id,
      master_course_id: data.master_course_id || null,
      master_course_name: data.master_course_name || null,
      topic: data.topic || null,
      course_name: data.course_name || null,
      description: data.description || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      type_of_location: data.location_type || null,
      location_id: data.location_id || null,
      other_location: data.other_location || null,
      course_type: data.type_of_course || "Out house",
      remarks: data.remarks || null,
      status: data.status || "Initiated",
      course_level: data.course_level || null,
      whatsapp_link: data.whatsapp_group || null,
      zoom_link: data.zoom_link || null,
      zoom_username: data.zoom_id || null,
      zoom_password: data.zoom_password || null,
      no_of_days: data.days || null,
      is_outhouse: 1,
    };

    if (await hasColumn("courses", "feedback_type")) {
      payload.feedback_type = data.feedback_type || "Document";
    }
    if (await hasColumn("courses", "creation_mode")) {
      payload.creation_mode = data.creation_mode || "manual";
    }
    if (await hasColumn("courses", "source_pre_active_id")) {
      payload.source_pre_active_id = data.source_pre_active_id || null;
    }

    const columns = Object.keys(payload);
    const placeholders = columns.map(() => "?").join(", ");
    const query = `
      INSERT INTO courses (${columns.join(", ")})
      VALUES (${placeholders})
    `;
    const params = columns.map((column) => payload[column]);

    await pool.execute(query, params);
    return { id, ...data };
  }

  static async update(id, data) {
    const baseAllowed = [
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
      "whatsapp_link",
      "zoom_link",
      "zoom_username",
      "zoom_password",
      "no_of_days",
    ];

    const optionalAllowed = [];
    if (await hasColumn("courses", "feedback_type")) {
      optionalAllowed.push("feedback_type");
    }
    if (await hasColumn("courses", "creation_mode")) {
      optionalAllowed.push("creation_mode");
    }
    if (await hasColumn("courses", "source_pre_active_id")) {
      optionalAllowed.push("source_pre_active_id");
    }

    const keys = Object.keys(data).filter((key) =>
      [...baseAllowed, ...optionalAllowed].includes(key),
    );
    if (!keys.length) return null;

    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => data[key]);
    values.push(id);

    const predicate = await this.buildOuthousePredicate("courses");
    const [result] = await pool.execute(
      `UPDATE courses SET ${setClause} WHERE id = ? AND ${predicate}`,
      values,
    );
    return result.affectedRows > 0;
  }

  static async getAll(
    search = "",
    page,
    limit,
    filters = {},
    sortBy = "created_at",
    sortOrder = "DESC",
  ) {
    const predicate = await this.buildOuthousePredicate("c");
    let whereClause = `WHERE ${predicate} AND c.status != 'Deleted'`;
    const params = [];

    if (search) {
      whereClause +=
        " AND (c.course_name LIKE ? OR c.course_id LIKE ? OR c.topic LIKE ? OR c.master_course_name LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (filters.status) {
      whereClause += " AND c.status = ?";
      params.push(filters.status);
    }
    if (filters.from_date) {
      whereClause += " AND DATE(c.start_date) >= ?";
      params.push(filters.from_date);
    }
    if (filters.to_date) {
      whereClause += " AND DATE(c.end_date) <= ?";
      params.push(filters.to_date);
    }

    const countQuery = `SELECT COUNT(*) as total FROM courses c ${whereClause}`;
    const [countRows] = await pool.query(countQuery, params);
    const total = countRows[0].total;

    // Sanitize sort column and order
    const allowedSortFields = [
      "course_id",
      "course_name",
      "topic",
      "master_course_name",
      "start_date",
      "end_date",
      "status",
      "created_at",
    ];
    const verifiedSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : "created_at";
    const verifiedSortOrder =
      sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    let query = `
      SELECT c.*
      FROM courses c
      ${whereClause}
      ORDER BY c.${verifiedSortBy} ${verifiedSortOrder}
    `;

    const queryParams = [...params];

    // Robustly parse page and limit
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    if (
      !isNaN(parsedPage) &&
      !isNaN(parsedLimit) &&
      parsedPage > 0 &&
      parsedLimit > 0
    ) {
      const offset = (parsedPage - 1) * parsedLimit;
      query += " LIMIT ? OFFSET ?";
      queryParams.push(parsedLimit, offset);
    }

    const [rows] = await pool.query(query, queryParams);

    return {
      data: rows,
      total,
      page: isNaN(parsedPage) ? 1 : parsedPage,
      limit: isNaN(parsedLimit) ? total || 10 : parsedLimit,
      totalPages:
        !isNaN(parsedLimit) && parsedLimit > 0
          ? Math.ceil(total / parsedLimit)
          : 1,
    };
  }

  static async getById(id) {
    const predicate = await this.buildOuthousePredicate("c");
    const [rows] = await pool.execute(
      `SELECT c.*
       FROM courses c
       WHERE c.id = ? AND ${predicate}`,
      [id],
    );
    return rows[0];
  }

  static async getMasterCourseOptions() {
    const [rows] = await pool.execute(
      "SELECT id, topic, master_course_name, description, remarks FROM master_course WHERE status = 1 ORDER BY topic, master_course_name",
    );
    return rows;
  }

  static async getPreActiveOptions() {
    const [rows] = await pool.execute(
      "SELECT id, course_id, course_name, topic, master_course_id, master_course_name, description, remarks, start_date, end_date, location_id, type_of_location, course_type FROM courses WHERE is_pre_active = 1 AND status = 'Pre-Active' ORDER BY created_at DESC",
    );
    return rows;
  }

  static async getCandidateOptions(courseId, search = "") {
    let query = `
      SELECT u.id, u.first_name, u.last_name, cp.employee_id, cp.passport_no, cp.seaman_book_no, cp.rank, cp.manning_company as manager
      FROM users u
      JOIN candidate_profiles cp ON cp.user_id = u.id
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'candidate'
      AND u.status = 1
      AND u.id NOT IN (
        SELECT ce.candidate_id FROM courses_enrollment ce
        WHERE ce.course_id = ? AND (ce.status != 'Deleted' OR ce.status IS NULL)
      )
    `;
    const params = [courseId];
    if (search) {
      query +=
        " AND (cp.employee_id LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    query += " ORDER BY cp.employee_id, u.first_name";
    const [rows] = await pool.execute(query, params);
    return rows;
  }

  static async createFeedbackDocument(courseId, file) {
    if (!(await hasTable("outhouse_feedback_documents"))) {
      return null;
    }
    const id = uuidv4();
    await pool.execute(
      "INSERT INTO outhouse_feedback_documents (id, course_id, file_name, file_path, mime_type) VALUES (?, ?, ?, ?, ?)",
      [id, courseId, file.filename, file.path, file.mimetype],
    );
    return id;
  }

  static async getFeedbackDocuments(courseId) {
    if (!(await hasTable("outhouse_feedback_documents"))) {
      return [];
    }
    const [rows] = await pool.execute(
      "SELECT * FROM outhouse_feedback_documents WHERE course_id = ? ORDER BY created_at DESC",
      [courseId],
    );
    return rows;
  }

  static async saveCandidateCertificate(courseId, candidateId, data) {
    const query = `
      UPDATE courses_enrollment
      SET certificate_number = ?, certificate_issue_date = ?, certificate_upload_name = ?, certificate_upload_path = ?
      WHERE course_id = ? AND candidate_id = ?
    `;
    const [result] = await pool.execute(query, [
      data.certificate_number || null,
      data.certificate_issue_date || null,
      data.certificate_upload_name || null,
      data.certificate_upload_path || null,
      courseId,
      candidateId,
    ]);
    return result.affectedRows > 0;
  }
}

module.exports = OuthouseCourseDao;
