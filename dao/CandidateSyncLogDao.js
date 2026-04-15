const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class CandidateSyncLogDao {
  static async ensureTableExists() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS candidate_sync_logs (
        id char(36) NOT NULL,
        sync_batch_id char(36) DEFAULT NULL,
        candidate_user_id char(36) DEFAULT NULL,
        sync_status varchar(20) NOT NULL,
        employee_id varchar(100) DEFAULT NULL,
        first_name varchar(255) DEFAULT NULL,
        last_name varchar(255) DEFAULT NULL,
        email varchar(255) DEFAULT NULL,
        mobile varchar(50) DEFAULT NULL,
        nationality varchar(100) DEFAULT NULL,
        passport_no varchar(100) DEFAULT NULL,
        manager varchar(255) DEFAULT NULL,
        rank varchar(255) DEFAULT NULL,
        registration_type varchar(50) DEFAULT NULL,
        source_sync_date date DEFAULT NULL,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY candidate_sync_logs_created_at_idx (created_at),
        KEY candidate_sync_logs_employee_id_idx (employee_id),
        KEY candidate_sync_logs_candidate_user_id_idx (candidate_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
  }

  static async createMany(records = []) {
    if (!Array.isArray(records) || records.length === 0) {
      return 0;
    }

    await this.ensureTableExists();

    const values = records.map((record) => [
      uuidv4(),
      record.sync_batch_id || null,
      record.candidate_user_id || null,
      record.sync_status || "Updated",
      record.employee_id || "",
      record.first_name || "",
      record.last_name || "",
      record.email || "",
      record.mobile || "",
      record.nationality || "",
      record.passport_no || "",
      record.manager || "",
      record.rank || "",
      record.registration_type || "",
      record.source_sync_date || null,
    ]);

    const [result] = await db.query(
      `INSERT INTO candidate_sync_logs (
        id,
        sync_batch_id,
        candidate_user_id,
        sync_status,
        employee_id,
        first_name,
        last_name,
        email,
        mobile,
        nationality,
        passport_no,
        manager,
        rank,
        registration_type,
        source_sync_date
      ) VALUES ?`,
      [values],
    );

    return result.affectedRows || 0;
  }

  static async getHistory(filters = {}) {
    await this.ensureTableExists();

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Number(filters.limit) || 10);
    const offset = (page - 1) * limit;
    const days = Math.min(60, Math.max(1, Number(filters.days) || 60));
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const search = (filters.search || "").trim();
    const registrationType = filters.registration_type || "MOLMI Employee";

    let whereClause = "WHERE created_at >= ?";
    const params = [sinceDate];

    if (registrationType) {
      whereClause += " AND registration_type = ?";
      params.push(registrationType);
    }

    if (search) {
      whereClause += ` AND (
        employee_id LIKE ? OR
        first_name LIKE ? OR
        last_name LIKE ? OR
        email LIKE ? OR
        passport_no LIKE ? OR
        manager LIKE ? OR
        rank LIKE ? OR
        sync_status LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(
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

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM candidate_sync_logs ${whereClause}`,
      params,
    );

    const [rows] = await db.query(
      `SELECT *
       FROM candidate_sync_logs
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      data: rows,
      total: countRows[0]?.total || 0,
      page,
      limit,
      totalPages: Math.ceil((countRows[0]?.total || 0) / limit) || 1,
    };
  }
}

module.exports = CandidateSyncLogDao;
