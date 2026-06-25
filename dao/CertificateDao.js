const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class CertificateDao {
  static async ensureCertificateSequenceTable(connection = pool) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS certificate_sequences (
        scope_type VARCHAR(50) NOT NULL,
        scope_key VARCHAR(255) NOT NULL,
        sequence_year INT NOT NULL DEFAULT 0,
        next_subid INT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (scope_type, scope_key, sequence_year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
  }

  static async getMaxSubIdForScope(connection, scopeType, scopeKey, sequenceYear) {
    if (scopeType === "topic_year") {
      const [rows] = await connection.execute(
        `SELECT MAX(subid) AS max_subid
         FROM certificates
         WHERE topic = ? AND YEAR(issue_date) = ?`,
        [scopeKey, sequenceYear],
      );
      return rows[0]?.max_subid || 0;
    }

    const [rows] = await connection.execute(
      `SELECT MAX(subid) AS max_subid
       FROM certificates
       WHERE type = ?`,
      [scopeKey],
    );
    return rows[0]?.max_subid || 0;
  }

  static async allocateSubId(scopeType, scopeKey, sequenceYear = 0) {
    const connection = await pool.getConnection();

    try {
      await this.ensureCertificateSequenceTable(connection);
      await connection.beginTransaction();

      const [sequenceRows] = await connection.execute(
        `SELECT next_subid
         FROM certificate_sequences
         WHERE scope_type = ? AND scope_key = ? AND sequence_year = ?
         FOR UPDATE`,
        [scopeType, scopeKey, sequenceYear],
      );

      let subid;

      if (sequenceRows.length === 0) {
        const maxSubId = await this.getMaxSubIdForScope(
          connection,
          scopeType,
          scopeKey,
          sequenceYear,
        );
        subid = maxSubId + 1;
        await connection.execute(
          `INSERT INTO certificate_sequences
             (scope_type, scope_key, sequence_year, next_subid)
           VALUES (?, ?, ?, ?)`,
          [scopeType, scopeKey, sequenceYear, subid + 1],
        );
      } else {
        subid = sequenceRows[0].next_subid || 1;
        await connection.execute(
          `UPDATE certificate_sequences
           SET next_subid = ?
           WHERE scope_type = ? AND scope_key = ? AND sequence_year = ?`,
          [subid + 1, scopeType, scopeKey, sequenceYear],
        );
      }

      await connection.commit();
      return subid;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async create(data) {
    const id = uuidv4();
    const {
      certificate_no = null,
      type = null,
      topic = null,
      course_level = null,
      course_id = null,
      active_course_id = null,
      candidate_id = null,
      trainer_id = null,
      location = null,
      course_conduct = null,
      status,
      from_date = null,
      to_date = null,
      days = null,
      issue_date = null,
      show_logo,
      is_manual,
      description1 = null,
      remarks = null,
      subid = null,
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
      from_date || null,
      to_date || null,
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
      LEFT JOIN trainer_profiles tp ON t.id = tp.user_id
      LEFT JOIN master_course mc ON c.course_id = mc.id
      LEFT JOIN courses ac ON c.active_course_id = ac.id
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
             COALESCE(c.from_date, ac.start_date) as from_date,
             COALESCE(c.to_date, ac.end_date) as to_date,
             CONCAT_WS(' ', u.first_name, u.last_name) as candidate_name,
             u.email as candidate_email,
             cp.employee_id as empId,
             cp.dob,
             cp.nationality,
             cp.prefix as caprefix,
             t.first_name as trainer_first_name,
             t.last_name as trainer_last_name,
             CONCAT_WS(' ', t.first_name, t.last_name) as trainer_name,
             tp.prefix as tprefix,
             tp.digital_signature,
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
             COALESCE(c.from_date, ac.start_date) as from_date,
             COALESCE(c.to_date, ac.end_date) as to_date,
             CONCAT_WS(' ', u.first_name, u.last_name) as candidate_name,
             cp.employee_id as empId,
             cp.dob,
             cp.officer,
             cp.nationality,
             cp.profile_image,
             cp.prefix as caprefix,
             t.first_name as trainer_first_name,
             t.last_name as trainer_last_name,
             CONCAT_WS(' ', t.first_name, t.last_name) as trainer_name,
             tp.prefix as tprefix,
             tp.digital_signature,
             mc.master_course_name
      FROM certificates c
      LEFT JOIN users u ON c.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN users t ON c.trainer_id = t.id
      LEFT JOIN trainer_profiles tp ON t.id = tp.user_id
      LEFT JOIN master_course mc ON c.course_id = mc.id
      LEFT JOIN courses ac ON c.active_course_id = ac.id
      WHERE c.id = ?
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0];
  }

  static async getVerificationById(id) {
    const query = `
      SELECT c.id,
             c.certificate_no,
             c.status,
             c.location,
             c.issue_date,
             CONCAT_WS(' ', cp.prefix, u.first_name, u.last_name) as candidate_name,
             cp.dob,
             mc.master_course_name,
             COALESCE(c.from_date, ac.start_date) as from_date,
             COALESCE(c.to_date, ac.end_date) as to_date,
             CONCAT_WS(' ', tp.prefix, t.first_name, t.last_name) as trainer_name
      FROM certificates c
      LEFT JOIN users u ON c.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN users t ON c.trainer_id = t.id
      LEFT JOIN trainer_profiles tp ON t.id = tp.user_id
      LEFT JOIN master_course mc ON c.course_id = mc.id
      LEFT JOIN courses ac ON c.active_course_id = ac.id
      WHERE c.id = ? AND COALESCE(c.is_hidden, 0) = 0
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
    return this.allocateSubId("topic_year", topic, year);
  }

  static async getNextSubIdByType(type) {
    return this.allocateSubId("type", type, 0);
  }

  static async getByCandidateAndCourse(candidateId, activeCourseId) {
    const query =
      "SELECT * FROM certificates WHERE candidate_id = ? AND active_course_id = ?";
    const [rows] = await pool.execute(query, [candidateId, activeCourseId]);
    return rows[0];
  }
}

module.exports = CertificateDao;
