const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class TrainerDao {
  static async createTrainer(trainerData) {
    const {
      role_id,
      first_name,
      last_name,
      email,
      password,
      prefix,
      designation,
      nationality,
      rank,
      digital_signature,
      profile_photo,
      officer,
      other_officer,
      mobile,
      status = 1,
    } = trainerData;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Create User
      const userId = uuidv4();
      await connection.query(
        "INSERT INTO users (id, role_id, first_name, last_name, email, password, mobile, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [userId, role_id, first_name, last_name, email, password, mobile, status],
      );

      // 2. Create Trainer Profile
      const profileId = uuidv4();
      await connection.query(
        `INSERT INTO trainer_profiles 
        (id, user_id, prefix, designation, nationality, \`rank\`, digital_signature, profile_photo, officer, other_officer, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profileId,
          userId,
          prefix,
          designation,
          nationality,
          rank,
          digital_signature,
          profile_photo,
          officer,
          other_officer,
          status,
        ],
      );

      await connection.commit();
      return userId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getAllTrainers(filters = {}) {
    let baseQuery = `
      FROM users u
      JOIN trainer_profiles tp ON u.id = tp.user_id
      WHERE 1=1
    `;

    const params = [];

    // Search filter (optional)
    if (filters.search) {
      baseQuery += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR tp.designation LIKE ? OR u.email LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Designation filter (optional)
    if (filters.designation) {
      baseQuery += ` AND tp.designation = ?`;
      params.push(filters.designation);
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as totalCount ${baseQuery}`;
    const [countResult] = await db.query(countQuery, params);
    const totalCount = countResult[0].totalCount;

    // Build data query
    let dataQuery = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.mobile,
        tp.prefix, tp.designation, 
        tp.nationality, tp.rank, 

        tp.digital_signature, tp.profile_photo, tp.status,
        tp.officer, tp.other_officer
      ${baseQuery}
    `;

    // Sorting (optional, defaults to first_name ASC)
    const sortOrder = filters.sort_order === "desc" ? "DESC" : "ASC";
    if (filters.sort_by === "designation") {
      dataQuery += ` ORDER BY tp.designation ${sortOrder}`;
    } else {
      dataQuery += ` ORDER BY u.first_name ${sortOrder}`;
    }

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
      total: totalCount,
      page: page || 1,
      limit: limit || totalCount,
      totalPages: limit ? Math.ceil(totalCount / limit) : 1,
    };
  }

  static async getTrainerById(id) {
    const query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.mobile,
        tp.prefix, tp.designation, 
        tp.nationality, tp.rank, 

        tp.digital_signature, tp.profile_photo, tp.status,
        tp.officer, tp.other_officer
      FROM users u
      JOIN trainer_profiles tp ON u.id = tp.user_id
      WHERE u.id = ? AND tp.status = 1
    `;
    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  static async updateTrainer(id, updateData) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Update User fields if present
      const userFields = ["first_name", "last_name", "email", "mobile", "status"];
      const userUpdates = [];
      const userpParams = [];

      userFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          userUpdates.push(`\`${field}\` = ?`);
          userpParams.push(updateData[field]);
        }
      });

      if (userUpdates.length > 0) {
        userpParams.push(id);
        await connection.query(
          `UPDATE users SET ${userUpdates.join(", ")} WHERE id = ?`,
          userpParams,
        );
      }

      // Update Profile fields
      const profileFields = [
        "prefix",
        "designation",
        "nationality",
        "rank",
        "digital_signature",

        "profile_photo",
        "officer",
        "other_officer",
        "status",
      ];
      const profileUpdates = [];
      const profileParams = [];

      profileFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          profileUpdates.push(`\`${field}\` = ?`);
          profileParams.push(updateData[field]);
        }
      });

      if (profileUpdates.length > 0) {
        profileParams.push(id);
        await connection.query(
          `UPDATE trainer_profiles SET ${profileUpdates.join(", ")} WHERE user_id = ?`,
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

  static async deleteTrainer(id) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Delete from trainer_profiles
      await connection.query("DELETE FROM trainer_profiles WHERE user_id = ?", [id]);

      // Delete from users
      const [result] = await connection.query("DELETE FROM users WHERE id = ?", [id]);

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getDashboardStats(trainerId) {
    // 1. Total Active Courses (where trainer is primary)
    const [coursesCount] = await db.query(
      "SELECT COUNT(*) as count FROM courses WHERE primary_trainer_id = ? AND status != 'Deleted' AND status != 'Course Completed' AND status != 'Cancelled'",
      [trainerId],
    );

    // 2. Total Candidates (enrolled in those courses)
    const [candidatesCount] = await db.query(
      `SELECT COUNT(DISTINCT ce.candidate_id) as count 
       FROM courses_enrollment ce
       JOIN courses c ON ce.course_id = c.id
       WHERE c.primary_trainer_id = ? AND c.status != 'Deleted'`,
      [trainerId],
    );

    // 3. Certificates Issued
    const [certificatesCount] = await db.query(
      "SELECT COUNT(*) as count FROM certificates WHERE trainer_id = ?",
      [trainerId],
    );

    return {
      activeCourses: coursesCount[0].count,
      totalCandidates: candidatesCount[0].count,
      certificatesIssued: certificatesCount[0].count,
    };
  }
}

module.exports = TrainerDao;
