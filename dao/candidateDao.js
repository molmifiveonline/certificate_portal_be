const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

class CandidateDao {
  static async getAllCandidates(filters = {}) {
    let baseQuery = `
      FROM users u
      JOIN candidate_profiles cp ON u.id = cp.user_id
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'candidate'
    `;

    const params = [];

    // Search filter (optional)
    if (filters.search) {
      baseQuery += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR cp.passport_no LIKE ? OR cp.employee_id LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Additional Filters
    if (filters.manager) {
      baseQuery += ` AND cp.manager = ?`;
      params.push(filters.manager);
    }

    if (filters.rank) {
      baseQuery += ` AND cp.rank = ?`;
      params.push(filters.rank);
    }

    if (filters.nationality) {
      baseQuery += ` AND cp.nationality = ?`;
      params.push(filters.nationality);
    }

    if (filters.registration_type) {
      baseQuery += ` AND cp.registration_type = ?`;
      params.push(filters.registration_type);
    }

    // Status Filter Logic
    if (
      filters.status !== undefined &&
      filters.status !== "" &&
      filters.status !== "all"
    ) {
      baseQuery += ` AND u.status = ?`;
      params.push(filters.status);
    } else if (filters.status === "all") {
      // No status filter, show all
    } else {
      // Default: Show only active candidates
      baseQuery += ` AND u.status = 1`;
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
        cp.whatsapp_number, cp.alternate_mobile, cp.indos_number, cp.registration_type,
        cp.designation, cp.vessel_type, cp.last_vessel_name, cp.next_vessel_name, 
        cp.manning_company, cp.sign_on_date, cp.sign_off_date, cp.officer, cp.seaman_book_no, cp.profile_image
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
        cp.whatsapp_number, cp.alternate_mobile, cp.indos_number, cp.registration_type,
        cp.designation, cp.vessel_type, cp.last_vessel_name, cp.next_vessel_name, 
        cp.manning_company, cp.sign_on_date, cp.sign_off_date, cp.officer, cp.seaman_book_no, cp.profile_image
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
      const userFields = [
        "first_name",
        "last_name",
        "email",
        "mobile",
        "status",
      ];
      const userUpdates = [];
      const userParams = [];

      for (const field of userFields) {
        if (updateData[field] !== undefined) {
          userUpdates.push(`${field} = ?`);
          userParams.push(updateData[field]);
        }
      }

      // Handle Password update
      if (updateData.password) {
        const hashedPassword = await bcrypt.hash(updateData.password, 10);
        userUpdates.push("password = ?");
        userParams.push(hashedPassword);
      }

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
        "designation",
        "vessel_type",
        "last_vessel_name",
        "next_vessel_name",
        "manning_company",
        "sign_on_date",
        "sign_off_date",
        "officer",
        "seaman_book_no",
        "profile_image",
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
        cp.designation, cp.vessel_type, cp.last_vessel_name, cp.next_vessel_name, 
        cp.manning_company, cp.sign_on_date, cp.sign_off_date, cp.officer, cp.seaman_book_no, cp.profile_image,
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

  static async bulkUpsert(candidates) {
    const connection = await db.getConnection();
    const stats = { inserted: 0, updated: 0, errors: 0 };

    try {
      await connection.beginTransaction();

      // Get Candidate Role ID
      const [roles] = await connection.query(
        "SELECT id FROM roles WHERE name = 'candidate'",
      );
      if (roles.length === 0) throw new Error("Candidate role not found");
      const roleId = roles[0].id;

      for (const candidate of candidates) {
        const {
          email,
          first_name,
          last_name,
          mobile,
          middle_name,
          prefix,
          gender,
          dob,
          nationality,
          passport_no,
          employee_id,
          manager,
          rank,
          whatsapp_number,
          alternate_mobile,
          indos_number,
          registration_type,
        } = candidate;

        if (!email) {
          stats.errors++;
          continue;
        }

        // Check if user exists
        const [existingUsers] = await connection.query(
          "SELECT id FROM users WHERE email = ?",
          [email],
        );

        if (existingUsers.length > 0) {
          const userId = existingUsers[0].id;
          // Update User
          await connection.query(
            "UPDATE users SET first_name = ?, last_name = ?, mobile = ? WHERE id = ?",
            [first_name, last_name, mobile, userId],
          );

          // Update Profile
          // Using IGNORE or check if profile exists
          const [profiles] = await connection.query(
            "SELECT id FROM candidate_profiles WHERE user_id = ?",
            [userId],
          );

          if (profiles.length > 0) {
            await connection.query(
              `UPDATE candidate_profiles SET 
                middle_name = ?, prefix = ?, gender = ?, dob = ?, nationality = ?, 
                passport_no = ?, employee_id = ?, manager = ?, rank = ?, 
                whatsapp_number = ?, alternate_mobile = ?, indos_number = ?, 
                registration_type = ?, manager_last_served = ?, rank_last_served = ? 
              WHERE user_id = ?`,
              [
                middle_name,
                prefix,
                gender,
                dob,
                nationality,
                passport_no,
                employee_id,
                manager,
                rank,
                whatsapp_number,
                alternate_mobile,
                indos_number,
                registration_type,
                manager, // Using manager for manager_last_served as well
                rank, // Using rank for rank_last_served as well
                userId,
              ],
            );
          } else {
            const profileId = uuidv4();
            await connection.query(
              `INSERT INTO candidate_profiles 
                (id, user_id, middle_name, prefix, gender, dob, nationality, 
                passport_no, employee_id, manager, rank, whatsapp_number, 
                alternate_mobile, indos_number, registration_type, manager_last_served, rank_last_served) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                profileId,
                userId,
                middle_name,
                prefix,
                gender,
                dob,
                nationality,
                passport_no,
                employee_id,
                manager,
                rank,
                whatsapp_number,
                alternate_mobile,
                indos_number,
                registration_type,
                manager,
                rank,
              ],
            );
          }
          stats.updated++;
        } else {
          // Insert New User
          const userId = uuidv4();
          const tempPassword = crypto.randomBytes(8).toString("hex");
          const hashedPassword = await bcrypt.hash(tempPassword, 10);

          await connection.query(
            "INSERT INTO users (id, role_id, first_name, last_name, email, password, mobile, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
              userId,
              roleId,
              first_name,
              last_name,
              email,
              hashedPassword,
              mobile,
              1,
            ],
          );

          // Insert Profile
          const profileId = uuidv4();
          await connection.query(
            `INSERT INTO candidate_profiles 
              (id, user_id, middle_name, prefix, gender, dob, nationality, 
              passport_no, employee_id, manager, rank, whatsapp_number, 
              alternate_mobile, indos_number, registration_type, manager_last_served, rank_last_served) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              profileId,
              userId,
              middle_name,
              prefix,
              gender,
              dob,
              nationality,
              passport_no,
              employee_id,
              manager,
              rank,
              whatsapp_number,
              alternate_mobile,
              indos_number,
              registration_type,
              manager,
              rank,
            ],
          );
          stats.inserted++;
        }
      }

      await connection.commit();
      return stats;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = CandidateDao;
