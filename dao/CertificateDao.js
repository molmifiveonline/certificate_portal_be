const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const CERTIFICATE_DATE_FIELDS = new Set([
  "from_date",
  "to_date",
  "issue_date",
  "added_date",
]);

function formatDateForMysql(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeMysqlDateValue(value) {
  if (value === null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateForMysql(value);
  }
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return formatDateForMysql(parsed);

  return value;
}

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
      status_pool = null,
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
        course_conduct, status, status_pool, is_hidden, from_date, to_date, days, 
        issue_date, show_logo, is_manual, 
        description1, remarks, subid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      status_pool || null,
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

  static async getAll(search = "", filters = {}, page, limit, sortBy = "issue_date", sortOrder = "DESC") {
    const searchTerm = search ? `%${search}%` : "";
    const regularValues = [];
    const outhouseValues = [];

    let regularWhere = "WHERE 1=1";
    let outhouseWhere = `
      WHERE COALESCE(ac.is_outhouse, 0) = 1
        AND (ce.status != 'Deleted' OR ce.status IS NULL)
        AND (
          (ce.certificate_number IS NOT NULL AND TRIM(ce.certificate_number) <> '')
          OR ce.certificate_issue_date IS NOT NULL
          OR (ce.certificate_upload_path IS NOT NULL AND TRIM(ce.certificate_upload_path) <> '')
        )
    `;

    if (searchTerm) {
      regularWhere += `
        AND (
          c.certificate_no LIKE ?
          OR u.first_name LIKE ?
          OR u.middle_name LIKE ?
          OR u.last_name LIKE ?
          OR cp.employee_id LIKE ?
          OR c.topic LIKE ?
          OR mc.master_course_name LIKE ?
        )
      `;
      regularValues.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      );

      outhouseWhere += `
        AND (
          ce.certificate_number LIKE ?
          OR u.first_name LIKE ?
          OR u.middle_name LIKE ?
          OR u.last_name LIKE ?
          OR cp.employee_id LIKE ?
          OR ac.topic LIKE ?
          OR ac.master_course_name LIKE ?
          OR ac.course_name LIKE ?
        )
      `;
      outhouseValues.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      );
    }

    if (filters.status !== undefined && filters.status !== "") {
      regularWhere += " AND c.status = ?";
      regularValues.push(filters.status);
      outhouseWhere += " AND 0 = ?";
      outhouseValues.push(Number(filters.status));
    }

    if (filters.active_course_id) {
      regularWhere += " AND c.active_course_id = ?";
      regularValues.push(filters.active_course_id);
      outhouseWhere += " AND ce.course_id = ?";
      outhouseValues.push(filters.active_course_id);
    }

    if (filters.trainer_id) {
      regularWhere += " AND c.trainer_id = ?";
      regularValues.push(filters.trainer_id);
      outhouseWhere += " AND COALESCE(ce.trainer_id, ac.primary_trainer_id) = ?";
      outhouseValues.push(filters.trainer_id);
    }

    if (filters.candidate_id) {
      regularWhere += " AND c.candidate_id = ?";
      regularValues.push(filters.candidate_id);
      outhouseWhere += " AND ce.candidate_id = ?";
      outhouseValues.push(filters.candidate_id);
    }

    if (filters.is_hidden !== undefined && filters.is_hidden !== null && filters.is_hidden !== "") {
      regularWhere += " AND COALESCE(c.is_hidden, 0) = ?";
      regularValues.push(Number(filters.is_hidden));
      outhouseWhere += " AND 0 = ?";
      outhouseValues.push(Number(filters.is_hidden));
    }

    const regularSelect = `
      SELECT
        c.id,
        c.certificate_no,
        COALESCE(
          NULLIF(c.type, ''),
          CASE WHEN COALESCE(ac.is_outhouse, 0) = 1 THEN 'outhouse' ELSE 'Others' END
        ) AS type,
        c.topic,
        c.course_level,
        c.course_id,
        c.active_course_id,
        c.candidate_id,
        c.trainer_id,
        c.location,
        c.course_conduct,
        c.status,
        c.status_pool,
        COALESCE(c.is_hidden, 0) AS is_hidden,
        DATE_FORMAT(COALESCE(c.from_date, ac.start_date), '%Y-%m-%d') AS from_date,
        DATE_FORMAT(COALESCE(c.to_date, ac.end_date), '%Y-%m-%d') AS to_date,
        c.days,
        DATE_FORMAT(c.issue_date, '%Y-%m-%d') AS issue_date,
        DATE_FORMAT(c.added_date, '%Y-%m-%d') AS added_date,
        c.show_logo,
        c.is_manual,
        c.description1,
        c.remarks,
        c.subid,
        c.created_at,
        c.created_at AS updated_at,
        CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) AS candidate_name,
        u.email AS candidate_email,
        cp.employee_id AS empId,
        DATE_FORMAT(cp.dob, '%Y-%m-%d') AS dob,
        cp.nationality,
        cp.prefix AS caprefix,
        t.first_name AS trainer_first_name,
        t.last_name AS trainer_last_name,
        CONCAT_WS(' ', t.first_name, t.last_name) AS trainer_name,
        tp.prefix AS tprefix,
        tp.digital_signature,
        mc.master_course_name,
        NULL AS file_url,
        CASE WHEN COALESCE(ac.is_outhouse, 0) = 1 THEN 'outhouse' ELSE 'certificate' END AS certificate_source,
        CASE WHEN COALESCE(ac.is_outhouse, 0) = 1 THEN 1 ELSE 0 END AS is_outhouse_certificate,
        CASE WHEN COALESCE(ac.is_outhouse, 0) = 1 THEN 0 ELSE 1 END AS can_edit
      FROM certificates c
      LEFT JOIN users u ON c.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN users t ON c.trainer_id = t.id
      LEFT JOIN trainer_profiles tp ON t.id = tp.user_id
      LEFT JOIN master_course mc ON c.course_id = mc.id
      LEFT JOIN courses ac ON c.active_course_id = ac.id
      ${regularWhere}
    `;

    const outhouseSelect = `
      SELECT
        CONCAT('outhouse:', ce.id) AS id,
        ce.certificate_number AS certificate_no,
        'outhouse' AS type,
        ac.topic,
        ac.course_level,
        ac.master_course_id AS course_id,
        ce.course_id AS active_course_id,
        ce.candidate_id,
        COALESCE(ce.trainer_id, ac.primary_trainer_id) AS trainer_id,
        COALESCE(NULLIF(ac.other_location, ''), ac.type_of_location) AS location,
        CASE WHEN ac.type_of_location = 'Online' THEN 'ONL' ELSE 'ONS' END AS course_conduct,
        0 AS status,
        COALESCE(NULLIF(ce.status_pool, ''), cp.status_pool) AS status_pool,
        0 AS is_hidden,
        DATE_FORMAT(COALESCE(ce.from_date, ac.start_date), '%Y-%m-%d') AS from_date,
        DATE_FORMAT(COALESCE(ce.to_date, ac.end_date), '%Y-%m-%d') AS to_date,
        ac.no_of_days AS days,
        DATE_FORMAT(ce.certificate_issue_date, '%Y-%m-%d') AS issue_date,
        DATE_FORMAT(ce.updated_at, '%Y-%m-%d') AS added_date,
        0 AS show_logo,
        0 AS is_manual,
        ac.description AS description1,
        ce.remarks,
        NULL AS subid,
        ce.created_at,
        ce.updated_at,
        CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) AS candidate_name,
        u.email AS candidate_email,
        cp.employee_id AS empId,
        DATE_FORMAT(cp.dob, '%Y-%m-%d') AS dob,
        cp.nationality,
        cp.prefix AS caprefix,
        t.first_name AS trainer_first_name,
        t.last_name AS trainer_last_name,
        CONCAT_WS(' ', t.first_name, t.last_name) AS trainer_name,
        tp.prefix AS tprefix,
        tp.digital_signature,
        ac.master_course_name,
        CASE
          WHEN ce.certificate_upload_path IS NULL OR TRIM(ce.certificate_upload_path) = '' THEN NULL
          ELSE CONCAT('/', REPLACE(ce.certificate_upload_path, '\\\\', '/'))
        END AS file_url,
        'outhouse' AS certificate_source,
        1 AS is_outhouse_certificate,
        0 AS can_edit
      FROM courses_enrollment ce
      JOIN courses ac ON ce.course_id = ac.id
      JOIN users u ON ce.candidate_id = u.id
      LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN users t ON COALESCE(ce.trainer_id, ac.primary_trainer_id) = t.id
      LEFT JOIN trainer_profiles tp ON t.id = tp.user_id
      ${outhouseWhere}
    `;

    const listingQuery = `(${regularSelect}) UNION ALL (${outhouseSelect})`;
    const listingValues = [...regularValues, ...outhouseValues];

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total FROM (${listingQuery}) certificate_listing`,
      listingValues,
    );
    const total = countResult[0].total;

    const validSortColumns = {
      certificate_no: "certificate_no",
      candidate_name: "candidate_name",
      type: "type",
      topic: "topic",
      master_course_name: "master_course_name",
      issue_date: "issue_date",
      status: "status",
      created_at: "created_at",
    };

    const sortColumn = validSortColumns[sortBy] || "issue_date";
    const sortDir = sortOrder && sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    let dataQuery = `
      SELECT *
      FROM (${listingQuery}) certificate_listing
      ORDER BY ${sortColumn} ${sortDir}, issue_date DESC, created_at DESC, certificate_no DESC
    `;
    const dataValues = [...listingValues];

    const pageNum = page ? parseInt(page, 10) : null;
    const limitNum = limit ? parseInt(limit, 10) : null;

    if (pageNum && limitNum) {
      const offset = (pageNum - 1) * limitNum;
      dataQuery += " LIMIT ? OFFSET ?";
      dataValues.push(limitNum, offset);
    }

    const [rows] = await pool.query(dataQuery, dataValues);

    return {
      data: rows,
      total,
      page: pageNum || 1,
      limit: limitNum || total,
      totalPages: limitNum ? Math.ceil(total / limitNum) || 1 : 1,
    };
  }

  static async getById(id) {
    const query = `
      SELECT c.*,
             DATE_FORMAT(c.issue_date, '%Y-%m-%d') as issue_date,
             DATE_FORMAT(c.added_date, '%Y-%m-%d') as added_date,
             DATE_FORMAT(COALESCE(c.from_date, ac.start_date), '%Y-%m-%d') as from_date,
             DATE_FORMAT(COALESCE(c.to_date, ac.end_date), '%Y-%m-%d') as to_date,
             CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) as candidate_name,
             cp.employee_id as empId,
             DATE_FORMAT(cp.dob, '%Y-%m-%d') as dob,
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
             DATE_FORMAT(c.issue_date, '%Y-%m-%d') as issue_date,
             CONCAT_WS(' ', cp.prefix, u.first_name, NULLIF(u.middle_name, ''), u.last_name) as candidate_name,
             DATE_FORMAT(cp.dob, '%Y-%m-%d') as dob,
             mc.master_course_name,
             DATE_FORMAT(COALESCE(c.from_date, ac.start_date), '%Y-%m-%d') as from_date,
             DATE_FORMAT(COALESCE(c.to_date, ac.end_date), '%Y-%m-%d') as to_date,
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
      "status_pool",
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
        obj[key] = CERTIFICATE_DATE_FIELDS.has(key)
          ? normalizeMysqlDateValue(data[key])
          : data[key];
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
