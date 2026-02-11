const db = require("../config/db");

class CandidateDao {
  static async getAllCandidates(filters = {}) {
    let baseQuery = `
      FROM users u
      JOIN candidate_profiles cp ON u.id = cp.user_id
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'candidate' AND u.status = 1
    `;

    const params = [];

    // Search filter (optional)
    if (filters.search) {
      baseQuery += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR cp.passport_no LIKE ? OR cp.employee_id LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as totalCount ${baseQuery}`;
    const [countResult] = await db.query(countQuery, params);
    const totalCount = countResult[0].totalCount;

    // Build data query
    let dataQuery = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.mobile, u.status,
        cp.middle_name, cp.prefix, cp.gender, cp.dob, cp.nationality,
        cp.passport_no, cp.employee_id, cp.manager, cp.rank, 
        cp.whatsapp_number, cp.alternate_mobile, cp.indos_number, cp.registration_type
      ${baseQuery}
    `;

    // Sorting (optional)
    const allowedSortFields = {
      first_name: "u.first_name",
      last_name: "u.last_name",
      email: "u.email",
      employee_id: "cp.employee_id",
      rank: "cp.rank",
      nationality: "cp.nationality",
      registration_type: "cp.registration_type",
      created_at: "u.created_at",
    };

    const sortBy = allowedSortFields[filters.sort_by] || "u.created_at";
    const sortOrder = filters.sort_order === "asc" ? "ASC" : "DESC";
    dataQuery += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Pagination (optional)
    const dataParams = [...params];
    let page = null;
    let limit = null;

    if (filters.page && filters.limit) {
      page = Math.max(1, Number(filters.page));
      limit = Number(filters.limit);
      const offset = (page - 1) * limit;
      dataQuery += ` LIMIT ? OFFSET ?`;
      dataParams.push(limit, offset);
    }

    const [rows] = await db.query(dataQuery, dataParams);

    return {
      data: rows,
      totalCount,
      page: page || 1,
      limit: limit || totalCount,
      totalPages: limit ? Math.ceil(totalCount / limit) : 1,
    };
  }

  static async softDeleteCandidate(id) {
    const [result] = await db.query(
      "UPDATE users SET status = 0 WHERE id = ?",
      [id],
    );
    return result.affectedRows > 0;
  }

  static async getCandidateById(id) {
    const query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.mobile, u.status,
        cp.middle_name, cp.prefix, cp.gender, cp.dob, cp.nationality,
        cp.passport_no, cp.employee_id, cp.manager, cp.rank, 
        cp.whatsapp_number, cp.alternate_mobile, cp.indos_number, cp.registration_type
      FROM users u
      JOIN candidate_profiles cp ON u.id = cp.user_id
      WHERE u.id = ?
    `;
    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  static async updateCandidate(id, updateData) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Update User fields
      const userFields = ["first_name", "last_name", "email", "mobile"];
      const userUpdates = [];
      const userParams = [];

      userFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          userUpdates.push(`${field} = ?`);
          userParams.push(updateData[field]);
        }
      });

      if (userUpdates.length > 0) {
        userParams.push(id);
        await connection.query(
          `UPDATE users SET ${userUpdates.join(", ")} WHERE id = ?`,
          userParams,
        );
      }

      // Update Profile fields
      const profileFields = [
        "middle_name",
        "prefix",
        "gender",
        "dob",
        "nationality",
        "passport_no",
        "employee_id",
        "manager",
        "rank",
        "whatsapp_number",
        "alternate_mobile",
        "indos_number",
        "registration_type",
      ];
      const profileUpdates = [];
      const profileParams = [];

      profileFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          profileUpdates.push(`${field} = ?`);
          profileParams.push(updateData[field]);
        }
      });

      if (profileUpdates.length > 0) {
        profileParams.push(id);
        await connection.query(
          `UPDATE candidate_profiles SET ${profileUpdates.join(", ")} WHERE user_id = ?`,
          profileParams,
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async exportCandidates() {
    const query = `
      SELECT 
        u.first_name, u.last_name, u.email, u.mobile,
        cp.middle_name, cp.prefix, cp.gender, cp.dob, cp.nationality,
        cp.passport_no, cp.employee_id, cp.manager, cp.rank, 
        cp.whatsapp_number, cp.alternate_mobile, cp.indos_number, cp.registration_type,
        u.created_at
      FROM users u
      JOIN candidate_profiles cp ON u.id = cp.user_id
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'candidate' AND u.status = 1
      ORDER BY u.created_at DESC
    `;
    const [rows] = await db.query(query);
    return rows;
  }
}

module.exports = CandidateDao;
